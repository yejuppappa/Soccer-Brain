"""
Soccer-Brain XGBoost V6 모델 학습 스크립트
==========================================
V5 대비 개선사항:
1. 팀 강도(Team Strength) 피처 추가
2. 조정된 홈 어드벤티지 (강팀/약팀 구분)
3. 시간 가중 폼 (최근 경기에 높은 가중치)
4. 모멘텀 피처 (연승/연패)
5. H2H 가중치 조정 (최근 상대전적에 더 높은 비중)

사용법:
  python scripts/train_xgboost_v6.py
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
    """DB에서 Feature 데이터 가져오기"""
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


def create_v6_features(df):
    """V6 추가 피처 생성"""
    print("\n🔧 V6 피처 엔지니어링 중...")
    
    # ==========================================
    # 1. 팀 강도 (Team Strength) - 0~1 스케일
    # ==========================================
    # 홈팀 강도 = (xG + 득점력 + 홈승률) / 3
    df['home_team_strength'] = (
        (df['home_xg_avg'].fillna(1) / 3) +  # xG 정규화 (평균 ~1.5)
        (df['home_goalsFor_avg'].fillna(1) / 3) +  # 득점력
        (df['home_wins_atHome_pct'].fillna(40) / 100)  # 홈 승률
    ) / 3
    
    df['away_team_strength'] = (
        (df['away_xg_avg'].fillna(1) / 3) +
        (df['away_goalsFor_avg'].fillna(1) / 3) +
        (df['away_wins_atAway_pct'].fillna(30) / 100)
    ) / 3
    
    df['team_strength_diff'] = df['home_team_strength'] - df['away_team_strength']
    
    print("   ✓ 팀 강도 피처 추가")
    
    # ==========================================
    # 2. 조정된 홈 어드벤티지
    # ==========================================
    # 강팀은 홈에서 더 강하고, 약팀은 홈 이점이 적음
    # 홈 어드벤티지 = 홈승률 * 팀강도 (강팀의 홈은 더 강함)
    df['adjusted_home_advantage'] = (
        df['home_wins_atHome_pct'].fillna(40) / 100 * 
        df['home_team_strength']
    )
    
    # 원정팀의 원정 강도
    df['adjusted_away_strength'] = (
        df['away_wins_atAway_pct'].fillna(30) / 100 * 
        df['away_team_strength']
    )
    
    df['home_away_advantage_diff'] = df['adjusted_home_advantage'] - df['adjusted_away_strength']
    
    print("   ✓ 조정된 홈 어드벤티지 피처 추가")
    
    # ==========================================
    # 3. 시간 가중 폼 (최근 경기에 높은 가중치)
    # ==========================================
    # form_last3에 0.6 가중치, form_last5에 0.4 가중치
    # 이유: 최근 3경기가 5경기보다 더 중요
    df['home_weighted_form'] = (
        0.6 * df['home_form_last3'].fillna(1) + 
        0.4 * df['home_form_last5'].fillna(1)
    )
    
    df['away_weighted_form'] = (
        0.6 * df['away_form_last3'].fillna(1) + 
        0.4 * df['away_form_last5'].fillna(1)
    )
    
    df['weighted_form_diff'] = df['home_weighted_form'] - df['away_weighted_form']
    
    print("   ✓ 시간 가중 폼 피처 추가")
    
    # ==========================================
    # 4. 모멘텀 피처 (폼 기반 추정)
    # ==========================================
    # form_last3 > 2.0 = 최근 좋은 흐름 (승점 평균 2.0+)
    # form_last3 < 0.5 = 최근 나쁜 흐름
    df['home_momentum'] = np.where(
        df['home_form_last3'].fillna(1) >= 2.0, 1,  # 좋은 모멘텀
        np.where(df['home_form_last3'].fillna(1) <= 0.5, -1, 0)  # 나쁜 모멘텀
    )
    
    df['away_momentum'] = np.where(
        df['away_form_last3'].fillna(1) >= 2.0, 1,
        np.where(df['away_form_last3'].fillna(1) <= 0.5, -1, 0)
    )
    
    df['momentum_diff'] = df['home_momentum'] - df['away_momentum']
    
    print("   ✓ 모멘텀 피처 추가")
    
    # ==========================================
    # 5. H2H 조정 피처 (샘플 크기 고려)
    # ==========================================
    # 상대전적이 적으면(< 3경기) 가중치 감소
    h2h_matches = df['h2h_total_matches'].fillna(0)
    h2h_weight = np.minimum(h2h_matches / 4, 1)  # 4경기 이상이면 full weight
    
    df['h2h_weighted_home_win_pct'] = (
        df['h2h_home_win_pct'].fillna(50) * h2h_weight + 
        50 * (1 - h2h_weight)  # 샘플 적으면 50%로 수렴
    )
    
    # H2H vs 현재폼 균형 피처
    # 현재 폼이 상대전적보다 중요하다고 가정 (7:3)
    df['form_vs_h2h_balance'] = (
        0.7 * df['weighted_form_diff'] + 
        0.3 * (df['h2h_weighted_home_win_pct'] - 50) / 50
    )
    
    print("   ✓ H2H 조정 피처 추가")
    
    # ==========================================
    # 6. 공격력/수비력 종합 지표
    # ==========================================
    df['home_attack_index'] = (
        df['home_xg_avg'].fillna(1) + 
        df['home_goalsFor_avg'].fillna(1) + 
        df['home_shotsOnTarget_avg'].fillna(4) / 4
    ) / 3
    
    df['away_attack_index'] = (
        df['away_xg_avg'].fillna(1) + 
        df['away_goalsFor_avg'].fillna(1) + 
        df['away_shotsOnTarget_avg'].fillna(4) / 4
    ) / 3
    
    df['home_defense_index'] = (
        2 - df['home_goalsAgainst_avg'].fillna(1.5)  # 낮을수록 좋음
    )
    
    df['away_defense_index'] = (
        2 - df['away_goalsAgainst_avg'].fillna(1.5)
    )
    
    df['attack_index_diff'] = df['home_attack_index'] - df['away_attack_index']
    df['defense_index_diff'] = df['home_defense_index'] - df['away_defense_index']
    
    print("   ✓ 공격력/수비력 종합 지표 추가")
    
    # ==========================================
    # 7. 리그 평균 대비 성적 (상대적 강도)
    # ==========================================
    league_avg_goals = df.groupby('leagueId')['home_goalsFor_avg'].transform('mean')
    df['home_vs_league_avg'] = df['home_goalsFor_avg'].fillna(1) / league_avg_goals.fillna(1)
    df['away_vs_league_avg'] = df['away_goalsFor_avg'].fillna(1) / league_avg_goals.fillna(1)
    
    print("   ✓ 리그 평균 대비 피처 추가")
    
    print(f"\n✅ V6 피처 {len([c for c in df.columns if c not in ['id', 'fixtureId', 'kickoffAt', 'season', 'leagueId', 'homeGoals', 'awayGoals', 'result']])}개 준비 완료")
    
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


def prepare_features_v6(df):
    """V6 학습용 피처 준비"""
    
    # V6 피처 컬럼들 (V5 + 새 피처)
    feature_cols = [
        # === 기존 V5 피처 (일부) ===
        'home_shotsOnTarget_avg',
        'home_possessionPct_avg',
        'home_xg_avg',
        'home_goalsFor_avg',
        'home_goalsAgainst_avg',
        
        'away_shotsOnTarget_avg',
        'away_possessionPct_avg',
        'away_xg_avg',
        'away_goalsFor_avg',
        'away_goalsAgainst_avg',
        
        'xg_diff',
        'goalsFor_diff',
        
        # 홈/원정 분리
        'home_wins_atHome_pct',
        'away_wins_atAway_pct',
        
        # 피로도
        'rest_diff',
        'congestion_diff',
        
        # H2H (조정됨)
        'h2h_total_matches',
        'h2h_weighted_home_win_pct',
        
        # === V6 신규 피처 ===
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
        
        # 폼 vs H2H 균형
        'form_vs_h2h_balance',
        
        # 공격력/수비력 지표
        'home_attack_index',
        'away_attack_index',
        'home_defense_index',
        'away_defense_index',
        'attack_index_diff',
        'defense_index_diff',
        
        # 리그 평균 대비
        'home_vs_league_avg',
        'away_vs_league_avg',
    ]
    
    # 존재하는 컬럼만 선택
    available_cols = [col for col in feature_cols if col in df.columns]
    print(f"📋 V6 피처: {len(available_cols)}개")
    
    X = df[available_cols].copy()
    
    # 결측치 처리
    X = X.fillna(X.mean())
    X = X.fillna(0)
    
    # 무한대 처리
    X = X.replace([np.inf, -np.inf], 0)
    
    return X, available_cols


def train_model_v6(X, y, model_name="V6"):
    """XGBoost V6 모델 학습"""
    
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    print(f"\n🏷️ 클래스: {le.classes_}")
    print(f"   분포: {pd.Series(y).value_counts().to_dict()}")
    
    # Train/Test 분리 (시간순으로 80/20)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y_encoded[:split_idx], y_encoded[split_idx:]
    
    print(f"\n📊 데이터 분리:")
    print(f"   Train: {len(X_train)} 경기")
    print(f"   Test:  {len(X_test)} 경기")
    
    # XGBoost V6 모델 (하이퍼파라미터 조정)
    model = xgb.XGBClassifier(
        n_estimators=300,        # V5: 200 → V6: 300
        max_depth=4,             # V5: 5 → V6: 4 (과적합 방지)
        learning_rate=0.08,      # V5: 0.1 → V6: 0.08 (더 안정적)
        subsample=0.85,          # V5: 0.8 → V6: 0.85
        colsample_bytree=0.85,   # V5: 0.8 → V6: 0.85
        min_child_weight=3,      # 과적합 방지
        gamma=0.1,               # 과적합 방지
        reg_alpha=0.1,           # L1 정규화
        reg_lambda=1.0,          # L2 정규화
        random_state=42,
        use_label_encoder=False,
        eval_metric='mlogloss'
    )
    
    print(f"\n🚀 {model_name} 모델 학습 중...")
    model.fit(X_train, y_train, 
              eval_set=[(X_test, y_test)],
              verbose=False)
    
    # 예측
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)
    
    # 평가
    accuracy = accuracy_score(y_test, y_pred)
    
    print("\n" + "="*50)
    print(f"📊 {model_name} 모델 성능")
    print("="*50)
    print(f"\n✅ 정확도: {accuracy:.1%}")
    print(f"   (무작위 기준: 33.3%)")
    print(f"   (향상도: +{(accuracy - 0.333)*100:.1f}%p)")
    
    print("\n📋 분류 리포트:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))
    
    # 피처 중요도
    print(f"\n🔥 {model_name} 피처 중요도 TOP 15:")
    feature_importance = pd.DataFrame({
        'feature': X.columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    for i, row in feature_importance.head(15).iterrows():
        print(f"   {row['feature']}: {row['importance']:.3f}")
    
    return model, le, accuracy, feature_importance


def compare_with_v5(v6_accuracy, v6_importance):
    """V5와 V6 비교"""
    print("\n" + "="*60)
    print("📊 V5 vs V6 비교")
    print("="*60)
    
    # V5 메타데이터 로드
    try:
        meta_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'xgboost_1x2_latest_meta.json')
        with open(meta_path, 'r') as f:
            v5_meta = json.load(f)
        v5_accuracy = v5_meta['accuracy']
        
        print(f"\n🔹 V5 정확도: {v5_accuracy:.1%}")
        print(f"🔹 V6 정확도: {v6_accuracy:.1%}")
        
        diff = (v6_accuracy - v5_accuracy) * 100
        if diff > 0:
            print(f"\n✅ V6가 V5보다 {diff:.2f}%p 향상!")
        elif diff < 0:
            print(f"\n⚠️ V6가 V5보다 {-diff:.2f}%p 하락")
        else:
            print(f"\n➖ V5와 V6 동일")
            
    except Exception as e:
        print(f"⚠️ V5 메타데이터 로드 실패: {e}")
    
    print("\n🔥 V6 TOP 5 중요 피처:")
    for i, row in v6_importance.head(5).iterrows():
        print(f"   {row['feature']}: {row['importance']:.3f}")


def save_model_v6(model, le, feature_cols, accuracy):
    """V6 모델 저장"""
    
    model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    os.makedirs(model_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # 모델 저장
    model_path = os.path.join(model_dir, f'xgboost_v6_{timestamp}.json')
    model.save_model(model_path)
    print(f"\n💾 V6 모델 저장: {model_path}")
    
    # 메타데이터
    meta = {
        'version': 'V6',
        'created_at': timestamp,
        'accuracy': float(accuracy),
        'classes': le.classes_.tolist(),
        'feature_columns': feature_cols,
        'model_file': f'xgboost_v6_{timestamp}.json',
        'improvements': [
            '팀 강도(Team Strength) 피처',
            '조정된 홈 어드벤티지',
            '시간 가중 폼',
            '모멘텀 피처',
            'H2H 가중치 조정',
            '하이퍼파라미터 최적화'
        ]
    }
    
    meta_path = os.path.join(model_dir, f'xgboost_v6_{timestamp}_meta.json')
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=2)
    
    # 최신 V6 모델 링크
    import shutil
    latest_model = os.path.join(model_dir, 'xgboost_v6_latest.json')
    latest_meta = os.path.join(model_dir, 'xgboost_v6_latest_meta.json')
    
    if os.path.exists(latest_model):
        os.remove(latest_model)
    if os.path.exists(latest_meta):
        os.remove(latest_meta)
    
    shutil.copy(model_path, latest_model)
    shutil.copy(meta_path, latest_meta)
    print(f"💾 최신 V6 모델 링크: {latest_model}")


def main():
    print("="*60)
    print("⚽ Soccer-Brain XGBoost V6 학습")
    print("="*60)
    
    # 1. 데이터 로드
    df = get_features_from_db()
    
    if len(df) < 100:
        print("❌ 데이터 부족. 최소 100경기 필요.")
        sys.exit(1)
    
    # 2. 타겟 생성
    df = create_target(df)
    
    # 3. V6 피처 엔지니어링
    df = create_v6_features(df)
    
    # 4. 피처 준비
    X, feature_cols = prepare_features_v6(df)
    y = df['result']
    
    # 5. 모델 학습
    model, le, accuracy, feature_importance = train_model_v6(X, y, "V6")
    
    # 6. V5와 비교
    compare_with_v5(accuracy, feature_importance)
    
    # 7. 모델 저장
    save_model_v6(model, le, feature_cols, accuracy)
    
    print("\n" + "="*60)
    print("✅ V6 학습 완료!")
    print("="*60)
    
    print(f"""
📊 V6 요약:
   - 학습 데이터: {len(df)} 경기
   - 정확도: {accuracy:.1%}
   - 피처 수: {len(feature_cols)}개

📁 모델 위치: models/xgboost_v6_latest.json

🔧 V6 개선사항:
   1. 팀 강도 피처 (강팀/약팀 구분)
   2. 조정된 홈 어드벤티지
   3. 시간 가중 폼 (최근 경기 중시)
   4. 모멘텀 피처
   5. H2H 가중치 조정
   6. 하이퍼파라미터 최적화
    """)


if __name__ == "__main__":
    main()
