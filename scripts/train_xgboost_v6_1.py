"""
Soccer-Brain XGBoost V6.1 하이브리드 모델
=========================================
V5 피처 51개 (전체 유지) + V6 신규 피처 16개 = 67개

사용법:
  python scripts/train_xgboost_v6_1.py
"""

import os
import sys
import json
from datetime import datetime

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def get_features_from_db():
    """DB에서 V5 Feature 데이터 가져오기"""
    print("📊 DB에서 V5 Feature 데이터 로딩 중...")
    
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
        f."home_passesTotal_avg",
        f."home_passAccuracyPct_avg",
        f."home_fouls_avg",
        f."home_corners_avg",
        f."home_yellowCards_avg",
        f."home_xg_avg",
        f."home_goalsFor_avg",
        f."home_goalsAgainst_avg",
        
        -- 어웨이팀 최근 평균
        f."away_shotsTotal_avg",
        f."away_shotsOnTarget_avg",
        f."away_possessionPct_avg",
        f."away_passesTotal_avg",
        f."away_passAccuracyPct_avg",
        f."away_fouls_avg",
        f."away_corners_avg",
        f."away_yellowCards_avg",
        f."away_xg_avg",
        f."away_goalsFor_avg",
        f."away_goalsAgainst_avg",
        
        -- 상대 비교 (diff)
        f."shotsTotal_diff",
        f."shotsOnTarget_diff",
        f."possessionPct_diff",
        f."xg_diff",
        f."goalsFor_diff",
        f."goalsAgainst_diff",
        
        -- V3: 홈/원정 분리
        f."home_goalsFor_atHome_avg",
        f."home_goalsAgainst_atHome_avg",
        f."home_xg_atHome_avg",
        f."home_wins_atHome_pct",
        f."away_goalsFor_atAway_avg",
        f."away_goalsAgainst_atAway_avg",
        f."away_xg_atAway_avg",
        f."away_wins_atAway_pct",
        
        -- V3: 폼
        f."home_form_last3",
        f."home_form_last5",
        f."away_form_last3",
        f."away_form_last5",
        f."attack_diff",
        f."defense_diff",
        
        -- V4: 피로도
        f."home_days_rest",
        f."away_days_rest",
        f."rest_diff",
        f."home_matches_14d",
        f."away_matches_14d",
        f."congestion_diff",
        
        -- V5: H2H
        f."h2h_total_matches",
        f."h2h_home_wins",
        f."h2h_away_wins",
        f."h2h_draws",
        f."h2h_home_goals_avg",
        f."h2h_away_goals_avg",
        f."h2h_home_win_pct"
        
    FROM "FixtureFeatureSnapshot" f
    WHERE f."homeGoals" IS NOT NULL 
      AND f."awayGoals" IS NOT NULL
      AND f."featureVersion" = 5
    ORDER BY f."kickoffAt"
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    print(f"✅ {len(df)} 경기 데이터 로드 완료")
    return df


def create_v6_additional_features(df):
    """V6 신규 피처만 추가 (V5 원본 유지)"""
    print("\n🔧 V6.1 신규 피처 추가 중...")
    
    # ==========================================
    # 1. 팀 강도 (Team Strength)
    # ==========================================
    df['home_team_strength'] = (
        (df['home_xg_avg'].fillna(1) / 3) +
        (df['home_goalsFor_avg'].fillna(1) / 3) +
        (df['home_wins_atHome_pct'].fillna(40) / 100)
    ) / 3
    
    df['away_team_strength'] = (
        (df['away_xg_avg'].fillna(1) / 3) +
        (df['away_goalsFor_avg'].fillna(1) / 3) +
        (df['away_wins_atAway_pct'].fillna(30) / 100)
    ) / 3
    
    df['team_strength_diff'] = df['home_team_strength'] - df['away_team_strength']
    print("   ✓ 팀 강도 피처 (3개)")
    
    # ==========================================
    # 2. 조정된 홈 어드벤티지
    # ==========================================
    df['adjusted_home_advantage'] = (
        df['home_wins_atHome_pct'].fillna(40) / 100 * 
        df['home_team_strength']
    )
    
    df['adjusted_away_strength'] = (
        df['away_wins_atAway_pct'].fillna(30) / 100 * 
        df['away_team_strength']
    )
    
    df['home_away_advantage_diff'] = df['adjusted_home_advantage'] - df['adjusted_away_strength']
    print("   ✓ 조정된 홈 어드벤티지 (3개)")
    
    # ==========================================
    # 3. 시간 가중 폼
    # ==========================================
    df['home_weighted_form'] = (
        0.6 * df['home_form_last3'].fillna(1) + 
        0.4 * df['home_form_last5'].fillna(1)
    )
    
    df['away_weighted_form'] = (
        0.6 * df['away_form_last3'].fillna(1) + 
        0.4 * df['away_form_last5'].fillna(1)
    )
    
    df['weighted_form_diff'] = df['home_weighted_form'] - df['away_weighted_form']
    print("   ✓ 시간 가중 폼 (3개)")
    
    # ==========================================
    # 4. 모멘텀 피처
    # ==========================================
    df['home_momentum'] = np.where(
        df['home_form_last3'].fillna(1) >= 2.0, 1,
        np.where(df['home_form_last3'].fillna(1) <= 0.5, -1, 0)
    )
    
    df['away_momentum'] = np.where(
        df['away_form_last3'].fillna(1) >= 2.0, 1,
        np.where(df['away_form_last3'].fillna(1) <= 0.5, -1, 0)
    )
    
    df['momentum_diff'] = df['home_momentum'] - df['away_momentum']
    print("   ✓ 모멘텀 피처 (3개)")
    
    # ==========================================
    # 5. H2H 가중치 조정
    # ==========================================
    h2h_matches = df['h2h_total_matches'].fillna(0)
    h2h_weight = np.minimum(h2h_matches / 4, 1)
    
    df['h2h_weighted_home_win_pct'] = (
        df['h2h_home_win_pct'].fillna(50) * h2h_weight + 
        50 * (1 - h2h_weight)
    )
    
    df['form_vs_h2h_balance'] = (
        0.7 * df['weighted_form_diff'] + 
        0.3 * (df['h2h_weighted_home_win_pct'] - 50) / 50
    )
    print("   ✓ H2H 가중치 조정 (2개)")
    
    # ==========================================
    # 6. 공격력/수비력 종합 지표
    # ==========================================
    df['attack_index_diff'] = (
        (df['home_xg_avg'].fillna(1) + df['home_goalsFor_avg'].fillna(1)) / 2 -
        (df['away_xg_avg'].fillna(1) + df['away_goalsFor_avg'].fillna(1)) / 2
    )
    
    df['defense_index_diff'] = (
        df['away_goalsAgainst_avg'].fillna(1.5) - df['home_goalsAgainst_avg'].fillna(1.5)
    )
    print("   ✓ 공격력/수비력 지표 (2개)")
    
    print(f"\n✅ V6.1 신규 피처 16개 추가 완료")
    
    return df


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


def prepare_features_v6_1(df):
    """V6.1 학습용 피처 준비 (V5 전체 + V6 신규)"""
    
    # V5 원본 피처 51개
    v5_feature_cols = [
        # 홈팀 최근 평균
        'home_shotsTotal_avg',
        'home_shotsOnTarget_avg',
        'home_possessionPct_avg',
        'home_passAccuracyPct_avg',
        'home_corners_avg',
        'home_xg_avg',
        'home_goalsFor_avg',
        'home_goalsAgainst_avg',
        
        # 어웨이팀 최근 평균
        'away_shotsTotal_avg',
        'away_shotsOnTarget_avg',
        'away_possessionPct_avg',
        'away_passAccuracyPct_avg',
        'away_corners_avg',
        'away_xg_avg',
        'away_goalsFor_avg',
        'away_goalsAgainst_avg',
        
        # 상대 비교 (diff)
        'shotsTotal_diff',
        'shotsOnTarget_diff',
        'possessionPct_diff',
        'xg_diff',
        'goalsFor_diff',
        'goalsAgainst_diff',
        
        # 부상
        'homeInjuryCount',
        'awayInjuryCount',
        
        # V3: 홈/원정 분리
        'home_goalsFor_atHome_avg',
        'home_goalsAgainst_atHome_avg',
        'home_xg_atHome_avg',
        'home_wins_atHome_pct',
        'away_goalsFor_atAway_avg',
        'away_goalsAgainst_atAway_avg',
        'away_xg_atAway_avg',
        'away_wins_atAway_pct',
        
        # V3: 폼
        'home_form_last3',
        'home_form_last5',
        'away_form_last3',
        'away_form_last5',
        'attack_diff',
        'defense_diff',
        
        # V4: 피로도
        'home_days_rest',
        'away_days_rest',
        'rest_diff',
        'home_matches_14d',
        'away_matches_14d',
        'congestion_diff',
        
        # V5: H2H
        'h2h_total_matches',
        'h2h_home_wins',
        'h2h_away_wins',
        'h2h_draws',
        'h2h_home_goals_avg',
        'h2h_away_goals_avg',
        'h2h_home_win_pct',
    ]
    
    # V6 신규 피처 16개
    v6_new_features = [
        # 팀 강도
        'home_team_strength',
        'away_team_strength',
        'team_strength_diff',
        
        # 조정된 홈 어드벤티지
        'adjusted_home_advantage',
        'adjusted_away_strength',
        'home_away_advantage_diff',
        
        # 시간 가중 폼
        'home_weighted_form',
        'away_weighted_form',
        'weighted_form_diff',
        
        # 모멘텀
        'home_momentum',
        'away_momentum',
        'momentum_diff',
        
        # H2H 가중치 조정
        'h2h_weighted_home_win_pct',
        'form_vs_h2h_balance',
        
        # 공격력/수비력 지표
        'attack_index_diff',
        'defense_index_diff',
    ]
    
    # V6.1 = V5 + V6 신규
    all_feature_cols = v5_feature_cols + v6_new_features
    
    # 존재하는 컬럼만 선택
    available_cols = [col for col in all_feature_cols if col in df.columns]
    print(f"\n📋 V6.1 피처 구성:")
    print(f"   V5 원본: {len([c for c in v5_feature_cols if c in df.columns])}개")
    print(f"   V6 신규: {len([c for c in v6_new_features if c in df.columns])}개")
    print(f"   총계: {len(available_cols)}개")
    
    X = df[available_cols].copy()
    
    # 결측치 처리
    X = X.fillna(X.mean())
    X = X.fillna(0)
    X = X.replace([np.inf, -np.inf], 0)
    
    return X, available_cols


def train_model_v6_1(X, y):
    """XGBoost V6.1 모델 학습"""
    
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    print(f"\n🏷️ 클래스: {le.classes_}")
    print(f"   분포: {pd.Series(y).value_counts().to_dict()}")
    
    # Train/Test 분리 (시간순 80/20)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y_encoded[:split_idx], y_encoded[split_idx:]
    
    print(f"\n📊 데이터 분리:")
    print(f"   Train: {len(X_train)} 경기")
    print(f"   Test:  {len(X_test)} 경기")
    
    # XGBoost V6.1 (하이퍼파라미터 최적화)
    model = xgb.XGBClassifier(
        n_estimators=250,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.8,
        min_child_weight=2,
        gamma=0.05,
        reg_alpha=0.05,
        reg_lambda=1.0,
        random_state=42,
        use_label_encoder=False,
        eval_metric='mlogloss'
    )
    
    print("\n🚀 V6.1 모델 학습 중...")
    model.fit(X_train, y_train,
              eval_set=[(X_test, y_test)],
              verbose=False)
    
    # 예측
    y_pred = model.predict(X_test)
    
    # 평가
    accuracy = accuracy_score(y_test, y_pred)
    
    print("\n" + "="*60)
    print("📊 V6.1 모델 성능")
    print("="*60)
    print(f"\n✅ 정확도: {accuracy:.1%}")
    print(f"   (무작위 기준: 33.3%)")
    print(f"   (향상도: +{(accuracy - 0.333)*100:.1f}%p)")
    
    print("\n📋 분류 리포트:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))
    
    # 피처 중요도
    print("\n🔥 V6.1 피처 중요도 TOP 20:")
    feature_importance = pd.DataFrame({
        'feature': X.columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    for i, row in feature_importance.head(20).iterrows():
        # V6 신규 피처 표시
        marker = "⭐" if row['feature'] in [
            'home_team_strength', 'away_team_strength', 'team_strength_diff',
            'adjusted_home_advantage', 'adjusted_away_strength', 'home_away_advantage_diff',
            'home_weighted_form', 'away_weighted_form', 'weighted_form_diff',
            'home_momentum', 'away_momentum', 'momentum_diff',
            'h2h_weighted_home_win_pct', 'form_vs_h2h_balance',
            'attack_index_diff', 'defense_index_diff'
        ] else "  "
        print(f"   {marker} {row['feature']}: {row['importance']:.4f}")
    
    return model, le, accuracy, feature_importance


def compare_versions(v6_1_accuracy, feature_importance):
    """V5, V6, V6.1 비교"""
    print("\n" + "="*60)
    print("📊 V5 vs V6 vs V6.1 비교")
    print("="*60)
    
    model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    
    # V5 정확도
    try:
        with open(os.path.join(model_dir, 'xgboost_1x2_latest_meta.json'), 'r') as f:
            v5_accuracy = json.load(f)['accuracy']
    except:
        v5_accuracy = 0.493
    
    # V6 정확도
    try:
        with open(os.path.join(model_dir, 'xgboost_v6_latest_meta.json'), 'r') as f:
            v6_accuracy = json.load(f)['accuracy']
    except:
        v6_accuracy = 0.487
    
    print(f"\n🔹 V5 정확도:   {v5_accuracy:.1%} (51 피처)")
    print(f"🔹 V6 정확도:   {v6_accuracy:.1%} (39 피처)")
    print(f"🔹 V6.1 정확도: {v6_1_accuracy:.1%} (67 피처)")
    
    # 최고 모델 판정
    best = max([('V5', v5_accuracy), ('V6', v6_accuracy), ('V6.1', v6_1_accuracy)], key=lambda x: x[1])
    print(f"\n🏆 최고 성능: {best[0]} ({best[1]:.1%})")
    
    if v6_1_accuracy > v5_accuracy:
        diff = (v6_1_accuracy - v5_accuracy) * 100
        print(f"✅ V6.1이 V5보다 {diff:.2f}%p 향상!")
    elif v6_1_accuracy < v5_accuracy:
        diff = (v5_accuracy - v6_1_accuracy) * 100
        print(f"⚠️ V6.1이 V5보다 {diff:.2f}%p 하락")
    
    # V6 신규 피처 중요도 분석
    v6_new = ['home_team_strength', 'away_team_strength', 'team_strength_diff',
              'adjusted_home_advantage', 'adjusted_away_strength', 'home_away_advantage_diff',
              'home_weighted_form', 'away_weighted_form', 'weighted_form_diff',
              'home_momentum', 'away_momentum', 'momentum_diff',
              'h2h_weighted_home_win_pct', 'form_vs_h2h_balance',
              'attack_index_diff', 'defense_index_diff']
    
    v6_importance = feature_importance[feature_importance['feature'].isin(v6_new)]
    total_v6_importance = v6_importance['importance'].sum()
    
    print(f"\n📈 V6 신규 피처 기여도: {total_v6_importance:.1%}")
    print("   TOP 5 V6 신규 피처:")
    for _, row in v6_importance.head(5).iterrows():
        print(f"   ⭐ {row['feature']}: {row['importance']:.4f}")
    
    return best[0], best[1]


def save_model_v6_1(model, le, feature_cols, accuracy, best_version):
    """V6.1 모델 저장"""
    import shutil
    
    model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    os.makedirs(model_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # 모델 저장
    model_path = os.path.join(model_dir, f'xgboost_v6_1_{timestamp}.json')
    model.save_model(model_path)
    print(f"\n💾 V6.1 모델 저장: {model_path}")
    
    # 메타데이터
    meta = {
        'version': 'V6.1',
        'created_at': timestamp,
        'accuracy': float(accuracy),
        'classes': le.classes_.tolist(),
        'feature_columns': feature_cols,
        'model_file': f'xgboost_v6_1_{timestamp}.json',
        'description': 'V5 전체 51개 + V6 신규 16개 = 67개 피처 하이브리드',
        'improvements': [
            'V5 피처 전체 유지',
            '팀 강도(Team Strength) 추가',
            '조정된 홈 어드벤티지 추가',
            '시간 가중 폼 추가',
            '모멘텀 피처 추가',
            'H2H 가중치 조정 추가',
            '하이퍼파라미터 최적화'
        ]
    }
    
    meta_path = os.path.join(model_dir, f'xgboost_v6_1_{timestamp}_meta.json')
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=2)
    
    # 최신 V6.1 모델 링크
    latest_model = os.path.join(model_dir, 'xgboost_v6_1_latest.json')
    latest_meta = os.path.join(model_dir, 'xgboost_v6_1_latest_meta.json')
    
    if os.path.exists(latest_model):
        os.remove(latest_model)
    if os.path.exists(latest_meta):
        os.remove(latest_meta)
    
    shutil.copy(model_path, latest_model)
    shutil.copy(meta_path, latest_meta)
    print(f"💾 최신 V6.1 모델 링크: {latest_model}")
    
    # V6.1이 최고 성능이면 기본 모델로 설정
    if best_version == 'V6.1':
        print(f"\n🏆 V6.1이 최고 성능! 기본 모델로 업데이트합니다.")
        shutil.copy(model_path, os.path.join(model_dir, 'xgboost_1x2_latest.json'))
        shutil.copy(meta_path, os.path.join(model_dir, 'xgboost_1x2_latest_meta.json'))
        return True
    return False


def main():
    print("="*60)
    print("⚽ Soccer-Brain XGBoost V6.1 하이브리드 학습")
    print("   (V5 전체 51개 + V6 신규 16개 = 67개 피처)")
    print("="*60)
    
    # 1. 데이터 로드
    df = get_features_from_db()
    
    if len(df) < 100:
        print("❌ 데이터 부족")
        sys.exit(1)
    
    # 2. 타겟 생성
    df = create_target(df)
    
    # 3. V6 신규 피처 추가
    df = create_v6_additional_features(df)
    
    # 4. 피처 준비
    X, feature_cols = prepare_features_v6_1(df)
    y = df['result']
    
    # 5. 모델 학습
    model, le, accuracy, feature_importance = train_model_v6_1(X, y)
    
    # 6. 버전 비교
    best_version, best_accuracy = compare_versions(accuracy, feature_importance)
    
    # 7. 모델 저장
    is_best = save_model_v6_1(model, le, feature_cols, accuracy, best_version)
    
    print("\n" + "="*60)
    print("✅ V6.1 학습 완료!")
    print("="*60)
    
    print(f"""
📊 V6.1 요약:
   - 학습 데이터: {len(df)} 경기
   - 정확도: {accuracy:.1%}
   - 피처 수: {len(feature_cols)}개 (V5: 51 + V6 신규: 16)

📁 모델 위치: models/xgboost_v6_1_latest.json
{f"🏆 최고 성능으로 기본 모델 업데이트됨!" if is_best else ""}
    """)


if __name__ == "__main__":
    main()
