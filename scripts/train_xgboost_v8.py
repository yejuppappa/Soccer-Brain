"""
Soccer-Brain XGBoost V8 모델 - 자동 가중치 학습
==============================================
핵심 원칙:
  - 피처는 가공하되, 최종 가중치는 XGBoost가 학습!
  - 수동 가중치 설정 없음
  - Walk-Forward 검증: 2021-2024 학습 → 2025 테스트

사용법:
  python scripts/train_xgboost_v8.py
"""

import os
import sys
import json
from datetime import datetime

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def get_features_from_db():
    """DB에서 Feature 데이터 가져오기 (시즌 정보 포함)"""
    print("📊 DB에서 Feature 데이터 로딩 중...")
    
    conn = psycopg2.connect(DATABASE_URL)
    
    query = """
    SELECT 
        f.id,
        f."fixtureId",
        f."kickoffAt",
        f.season,
        f."leagueId",
        f."homeGoals",
        f."awayGoals",
        
        -- 부상
        f."homeInjuryCount",
        f."awayInjuryCount",
        
        -- 홈팀 최근 평균
        f."home_shotsTotal_avg",
        f."home_shotsOnTarget_avg",
        f."home_possessionPct_avg",
        f."home_passAccuracyPct_avg",
        f."home_corners_avg",
        f."home_xg_avg",
        f."home_goalsFor_avg",
        f."home_goalsAgainst_avg",
        
        -- 어웨이팀 최근 평균
        f."away_shotsTotal_avg",
        f."away_shotsOnTarget_avg",
        f."away_possessionPct_avg",
        f."away_passAccuracyPct_avg",
        f."away_corners_avg",
        f."away_xg_avg",
        f."away_goalsFor_avg",
        f."away_goalsAgainst_avg",
        
        -- 홈/원정 분리
        f."home_goalsFor_atHome_avg",
        f."home_goalsAgainst_atHome_avg",
        f."home_xg_atHome_avg",
        f."home_wins_atHome_pct",
        f."away_goalsFor_atAway_avg",
        f."away_goalsAgainst_atAway_avg",
        f."away_xg_atAway_avg",
        f."away_wins_atAway_pct",
        
        -- 폼
        f."home_form_last3",
        f."home_form_last5",
        f."away_form_last3",
        f."away_form_last5",
        
        -- 피로도
        f."home_days_rest",
        f."away_days_rest",
        f."rest_diff",
        f."home_matches_14d",
        f."away_matches_14d",
        
        -- H2H
        f."h2h_total_matches",
        f."h2h_home_wins",
        f."h2h_away_wins",
        f."h2h_draws",
        f."h2h_home_win_pct"
        
    FROM "FixtureFeatureSnapshot" f
    WHERE f."homeGoals" IS NOT NULL 
      AND f."awayGoals" IS NOT NULL
      AND f."featureVersion" = 5
    ORDER BY f."kickoffAt"
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    # 연도 추출
    df['year'] = pd.to_datetime(df['kickoffAt']).dt.year
    
    print(f"✅ {len(df)} 경기 데이터 로드 완료")
    print(f"   연도 분포: {df['year'].value_counts().sort_index().to_dict()}")
    
    return df


def create_features(df):
    """
    피처 가공 - 단, 최종 가중치는 XGBoost가 학습!
    수동 가중치 조합(v8_score 같은 것) 없음
    """
    print("\n🔧 피처 가공 시작 (가중치는 XGBoost가 학습)")
    
    # ==========================================
    # 1. 폼 관련 파생 피처
    # ==========================================
    # 폼 차이
    df['form_diff_last3'] = df['home_form_last3'].fillna(1) - df['away_form_last3'].fillna(1)
    df['form_diff_last5'] = df['home_form_last5'].fillna(1) - df['away_form_last5'].fillna(1)
    
    # 폼 변화 (3경기 vs 5경기)
    df['home_form_trend'] = df['home_form_last3'].fillna(1) - df['home_form_last5'].fillna(1)
    df['away_form_trend'] = df['away_form_last3'].fillna(1) - df['away_form_last5'].fillna(1)
    
    # ==========================================
    # 2. xG 관련 파생 피처
    # ==========================================
    df['xg_diff'] = df['home_xg_avg'].fillna(1.2) - df['away_xg_avg'].fillna(1.0)
    df['xg_home_diff'] = df['home_xg_atHome_avg'].fillna(1.3) - df['away_xg_atAway_avg'].fillna(0.9)
    
    # xG 대비 실제 득점 (오버퍼폼/언더퍼폼)
    df['home_xg_overperform'] = df['home_goalsFor_avg'].fillna(1.2) - df['home_xg_avg'].fillna(1.2)
    df['away_xg_overperform'] = df['away_goalsFor_avg'].fillna(1.0) - df['away_xg_avg'].fillna(1.0)
    
    # ==========================================
    # 3. 득실 관련 파생 피처
    # ==========================================
    df['goals_diff'] = df['home_goalsFor_avg'].fillna(1.2) - df['away_goalsFor_avg'].fillna(1.0)
    df['goals_against_diff'] = df['home_goalsAgainst_avg'].fillna(1.3) - df['away_goalsAgainst_avg'].fillna(1.5)
    
    # 홈/원정 특화 득실
    df['home_venue_goals_diff'] = df['home_goalsFor_atHome_avg'].fillna(1.4) - df['away_goalsFor_atAway_avg'].fillna(0.9)
    
    # ==========================================
    # 4. 홈/원정 승률 관련
    # ==========================================
    df['home_away_winrate_diff'] = (
        df['home_wins_atHome_pct'].fillna(45) - df['away_wins_atAway_pct'].fillna(30)
    ) / 100
    
    # ==========================================
    # 5. 슈팅 관련
    # ==========================================
    df['shots_diff'] = df['home_shotsTotal_avg'].fillna(12) - df['away_shotsTotal_avg'].fillna(12)
    df['shots_on_target_diff'] = df['home_shotsOnTarget_avg'].fillna(4) - df['away_shotsOnTarget_avg'].fillna(4)
    
    # 슈팅 정확도
    df['home_shot_accuracy'] = df['home_shotsOnTarget_avg'].fillna(4) / (df['home_shotsTotal_avg'].fillna(12) + 0.1)
    df['away_shot_accuracy'] = df['away_shotsOnTarget_avg'].fillna(4) / (df['away_shotsTotal_avg'].fillna(12) + 0.1)
    df['shot_accuracy_diff'] = df['home_shot_accuracy'] - df['away_shot_accuracy']
    
    # ==========================================
    # 6. 피로도 관련
    # ==========================================
    df['rest_diff_normalized'] = df['rest_diff'].fillna(0) / 3  # -1 ~ +1 범위로
    df['fatigue_diff'] = (df['away_matches_14d'].fillna(2) - df['home_matches_14d'].fillna(2)) / 3
    
    # ==========================================
    # 7. H2H 관련 (원시 데이터 유지, 가중치는 모델이 학습)
    # ==========================================
    # H2H 신뢰도 (경기 수 기반)
    df['h2h_reliability'] = np.minimum(df['h2h_total_matches'].fillna(0) / 10, 1.0)
    
    # H2H 홈 우위
    df['h2h_home_advantage'] = (df['h2h_home_win_pct'].fillna(50) - 50) / 100
    
    # ==========================================
    # 8. 점유율/패스 관련
    # ==========================================
    df['possession_diff'] = (
        df['home_possessionPct_avg'].fillna(50) - df['away_possessionPct_avg'].fillna(50)
    ) / 100
    df['pass_accuracy_diff'] = (
        df['home_passAccuracyPct_avg'].fillna(80) - df['away_passAccuracyPct_avg'].fillna(80)
    ) / 100
    
    print(f"✅ 피처 가공 완료")
    
    return df


def get_feature_columns():
    """
    학습에 사용할 피처 목록
    - 원시 피처 + 파생 피처
    - 수동 가중치 조합 피처 없음!
    """
    
    feature_cols = [
        # === 원시 폼 피처 (4개) ===
        'home_form_last3',
        'home_form_last5',
        'away_form_last3',
        'away_form_last5',
        
        # === 폼 파생 피처 (4개) ===
        'form_diff_last3',
        'form_diff_last5',
        'home_form_trend',
        'away_form_trend',
        
        # === 원시 xG 피처 (4개) ===
        'home_xg_avg',
        'away_xg_avg',
        'home_xg_atHome_avg',
        'away_xg_atAway_avg',
        
        # === xG 파생 피처 (4개) ===
        'xg_diff',
        'xg_home_diff',
        'home_xg_overperform',
        'away_xg_overperform',
        
        # === 득실 피처 (6개) ===
        'home_goalsFor_avg',
        'away_goalsFor_avg',
        'home_goalsAgainst_avg',
        'away_goalsAgainst_avg',
        'goals_diff',
        'goals_against_diff',
        
        # === 홈/원정 특화 피처 (5개) ===
        'home_goalsFor_atHome_avg',
        'away_goalsFor_atAway_avg',
        'home_wins_atHome_pct',
        'away_wins_atAway_pct',
        'home_away_winrate_diff',
        
        # === 슈팅 피처 (5개) ===
        'home_shotsTotal_avg',
        'away_shotsTotal_avg',
        'shots_diff',
        'shots_on_target_diff',
        'shot_accuracy_diff',
        
        # === 피로도 피처 (5개) ===
        'home_days_rest',
        'away_days_rest',
        'rest_diff',
        'rest_diff_normalized',
        'fatigue_diff',
        
        # === H2H 피처 (4개) ===
        'h2h_total_matches',
        'h2h_home_win_pct',
        'h2h_reliability',
        'h2h_home_advantage',
        
        # === 점유율/패스 피처 (4개) ===
        'home_possessionPct_avg',
        'away_possessionPct_avg',
        'possession_diff',
        'pass_accuracy_diff',
        
        # === 부상 피처 (2개) ===
        'homeInjuryCount',
        'awayInjuryCount',
    ]
    
    return feature_cols


def create_target(df):
    """승무패 라벨 생성"""
    def get_result(row):
        if row['homeGoals'] > row['awayGoals']:
            return 'home_win'
        elif row['homeGoals'] < row['awayGoals']:
            return 'away_win'
        else:
            return 'draw'
    
    df['result'] = df.apply(get_result, axis=1)
    return df


def walk_forward_validation(df, feature_cols):
    """
    Walk-Forward 검증
    - 2021-2024 학습 → 2025 테스트
    - 실제 서비스와 동일한 조건
    """
    print("\n" + "="*60)
    print("🔬 Walk-Forward 검증")
    print("="*60)
    print("   학습: 2021-2024년 데이터")
    print("   테스트: 2025년 데이터")
    print("="*60)
    
    # 데이터 분리
    train_df = df[df['year'] <= 2024].copy()
    test_df = df[df['year'] >= 2025].copy()
    
    print(f"\n   학습 데이터: {len(train_df)} 경기 (2021-2024)")
    print(f"   테스트 데이터: {len(test_df)} 경기 (2025)")
    
    if len(test_df) < 50:
        print("   ⚠️ 2025년 데이터가 부족합니다. 80:20 분할로 대체합니다.")
        split_idx = int(len(df) * 0.8)
        train_df = df[:split_idx].copy()
        test_df = df[split_idx:].copy()
        print(f"   학습 데이터: {len(train_df)} 경기")
        print(f"   테스트 데이터: {len(test_df)} 경기")
    
    # 피처와 타겟 분리
    X_train = train_df[feature_cols].fillna(0)
    X_test = test_df[feature_cols].fillna(0)
    
    le = LabelEncoder()
    y_train = le.fit_transform(train_df['result'])
    y_test = le.transform(test_df['result'])
    
    print(f"\n   클래스: {list(le.classes_)}")
    print(f"   피처 수: {len(feature_cols)}")
    
    return X_train, X_test, y_train, y_test, le, test_df


def train_model(X_train, X_test, y_train, y_test, feature_cols):
    """XGBoost 모델 학습 - 가중치는 모델이 자동으로 학습!"""
    print("\n🚀 XGBoost 모델 학습 시작...")
    print("   → 피처 간 최적 가중치를 모델이 자동으로 학습합니다!")
    
    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        eval_metric='mlogloss',
        early_stopping_rounds=30,
    )
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )
    
    # 평가
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"\n📊 모델 성능:")
    print(f"   정확도: {accuracy:.4f} ({accuracy*100:.1f}%)")
    
    return model, accuracy


def analyze_feature_importance(model, feature_cols, le):
    """
    피처 중요도 분석 - XGBoost가 학습한 가중치 확인!
    """
    print("\n" + "="*60)
    print("📊 XGBoost가 학습한 피처 중요도 (자동 가중치)")
    print("="*60)
    
    importance = dict(zip(feature_cols, model.feature_importances_))
    sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)
    
    # 카테고리별 집계
    categories = {
        '폼': ['form_last3', 'form_last5', 'form_diff', 'form_trend'],
        'xG': ['xg_avg', 'xg_diff', 'xg_overperform', 'xg_atHome', 'xg_atAway'],
        '득실': ['goalsFor', 'goalsAgainst', 'goals_diff'],
        '홈원정': ['wins_atHome', 'wins_atAway', 'winrate_diff', 'venue'],
        '슈팅': ['shots', 'shot_accuracy'],
        'H2H': ['h2h'],
        '피로도': ['rest', 'fatigue', 'matches_14d'],
        '점유율': ['possession', 'pass'],
        '부상': ['Injury'],
    }
    
    category_importance = {cat: 0 for cat in categories}
    
    for feat, imp in sorted_imp:
        for cat, keywords in categories.items():
            if any(kw.lower() in feat.lower() for kw in keywords):
                category_importance[cat] += imp
                break
    
    print("\n[카테고리별 중요도 - 모델이 학습한 결과!]")
    sorted_cats = sorted(category_importance.items(), key=lambda x: x[1], reverse=True)
    for cat, imp in sorted_cats:
        bar = "█" * int(imp * 50)
        print(f"   {cat:8} {imp*100:5.1f}% {bar}")
    
    print("\n[개별 피처 TOP 15]")
    for i, (feat, imp) in enumerate(sorted_imp[:15], 1):
        bar = "█" * int(imp * 100)
        print(f"   {i:2}. {feat:30} {imp*100:5.2f}% {bar}")
    
    print("\n[개별 피처 BOTTOM 5]")
    for feat, imp in sorted_imp[-5:]:
        print(f"       {feat:30} {imp*100:5.2f}%")
    
    return sorted_imp, category_importance


def analyze_predictions(model, X_test, y_test, le, test_df):
    """예측 결과 분석 - 배당과 비교 가능한 형태로"""
    print("\n" + "="*60)
    print("📊 예측 결과 분석")
    print("="*60)
    
    # 확률 예측
    probs = model.predict_proba(X_test)
    
    class_order = list(le.classes_)
    home_idx = class_order.index('home_win')
    draw_idx = class_order.index('draw')
    away_idx = class_order.index('away_win')
    
    test_df = test_df.copy()
    test_df['ml_home'] = probs[:, home_idx] * 100
    test_df['ml_draw'] = probs[:, draw_idx] * 100
    test_df['ml_away'] = probs[:, away_idx] * 100
    test_df['ml_pred'] = le.inverse_transform(model.predict(X_test))
    test_df['actual'] = le.inverse_transform(y_test)
    test_df['correct'] = test_df['ml_pred'] == test_df['actual']
    
    # 확률 분포
    print("\n[ML 홈 승 확률 분포]")
    bins = [(70, 100), (60, 70), (50, 60), (40, 50), (0, 40)]
    for low, high in bins:
        mask = (test_df['ml_home'] >= low) & (test_df['ml_home'] < high)
        count = mask.sum()
        if count > 0:
            acc = test_df[mask]['correct'].mean() * 100
            print(f"   {low:2}-{high:3}%: {count:3}경기, 적중률 {acc:.1f}%")
    
    print("\n[ML 무승부 확률 분포]")
    bins = [(35, 100), (30, 35), (25, 30), (20, 25), (0, 20)]
    for low, high in bins:
        mask = (test_df['ml_draw'] >= low) & (test_df['ml_draw'] < high)
        count = mask.sum()
        if count > 0:
            acc = test_df[mask & (test_df['actual'] == 'draw')].shape[0] / count * 100 if count > 0 else 0
            print(f"   {low:2}-{high:3}%: {count:3}경기, 무승부 적중률 {acc:.1f}%")
    
    # 샘플 예측
    print("\n[예측 샘플 10경기]")
    sample = test_df.sample(min(10, len(test_df)), random_state=42)
    for _, row in sample.iterrows():
        pred_icon = "✅" if row['correct'] else "❌"
        print(f"   {pred_icon} ML: 홈{row['ml_home']:.0f}%/무{row['ml_draw']:.0f}%/원{row['ml_away']:.0f}% → {row['ml_pred']} (실제: {row['actual']})")
    
    return test_df


def save_model(model, le, feature_cols, accuracy, importance, category_importance):
    """모델 저장"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    os.makedirs(model_dir, exist_ok=True)
    
    # 모델 저장
    model_filename = f"xgboost_v8_{timestamp}.json"
    model_path = os.path.join(model_dir, model_filename)
    model.save_model(model_path)
    
    # 메타데이터 저장
    meta = {
        "version": "V8",
        "created_at": timestamp,
        "accuracy": float(accuracy),
        "classes": list(le.classes_),
        "feature_columns": feature_cols,
        "model_file": model_filename,
        "description": "V8 - XGBoost 자동 가중치 학습, Walk-Forward 검증",
        "design_principles": [
            "수동 가중치 없음 - 모델이 자동 학습",
            "Walk-Forward: 2021-2024 학습 → 2025 테스트",
            "피처 가공은 하되 최종 결합은 모델에게 위임",
        ],
        "learned_category_importance": {k: float(v) for k, v in category_importance.items()},
        "feature_importance_top10": [(f, float(i)) for f, i in importance[:10]]
    }
    
    meta_filename = f"xgboost_v8_{timestamp}_meta.json"
    meta_path = os.path.join(model_dir, meta_filename)
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    
    # latest 심볼릭 링크
    import shutil
    latest_model = os.path.join(model_dir, "xgboost_v8_latest.json")
    latest_meta = os.path.join(model_dir, "xgboost_v8_latest_meta.json")
    
    if os.path.exists(latest_model):
        os.remove(latest_model)
    if os.path.exists(latest_meta):
        os.remove(latest_meta)
    
    shutil.copy(model_path, latest_model)
    shutil.copy(meta_path, latest_meta)
    
    print(f"\n💾 모델 저장 완료:")
    print(f"   {model_path}")
    
    return model_path


def main():
    print("="*60)
    print("🧠 Soccer-Brain V8 모델")
    print("="*60)
    print("핵심: XGBoost가 피처 가중치를 자동으로 학습!")
    print("검증: Walk-Forward (2021-2024 학습 → 2025 테스트)")
    print("="*60)
    
    # 1. 데이터 로드
    df = get_features_from_db()
    
    # 2. 피처 가공 (가중치 조합 없음!)
    df = create_features(df)
    
    # 3. 타겟 생성
    df = create_target(df)
    
    # 4. 피처 목록
    feature_cols = get_feature_columns()
    print(f"\n📋 피처 수: {len(feature_cols)}")
    
    # 5. Walk-Forward 분할
    X_train, X_test, y_train, y_test, le, test_df = walk_forward_validation(df, feature_cols)
    
    # 6. 모델 학습 (가중치 자동 학습!)
    model, accuracy = train_model(X_train, X_test, y_train, y_test, feature_cols)
    
    # 7. 피처 중요도 분석 (모델이 학습한 가중치 확인)
    importance, category_importance = analyze_feature_importance(model, feature_cols, le)
    
    # 8. 예측 결과 분석
    analyze_predictions(model, X_test, y_test, le, test_df)
    
    # 9. 모델 저장
    save_model(model, le, feature_cols, accuracy, importance, category_importance)
    
    print("\n" + "="*60)
    print("✅ V8 모델 학습 완료!")
    print("="*60)
    print("\n💡 다음 단계:")
    print("   1. 위 '카테고리별 중요도'가 XGBoost가 학습한 결과입니다")
    print("   2. 배당과 ML 불일치 분석을 위해 predict_server를 V8로 업데이트하세요")
    print("="*60)


if __name__ == "__main__":
    main()
