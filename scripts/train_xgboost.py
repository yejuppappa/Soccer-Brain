"""
Soccer-Brain XGBoost 모델 학습 스크립트
========================================
승무패(1X2) 예측 모델

사용법:
  pip install pandas scikit-learn xgboost psycopg2-binary python-dotenv
  python scripts/train_xgboost.py
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

# DB 연결
import psycopg2
from dotenv import load_dotenv

# .env 로드
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def get_features_from_db():
    """DB에서 Feature 데이터 가져오기"""
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


def prepare_features(df):
    """학습용 피처 준비"""
    
    # 사용할 피처 컬럼들 (V5)
    feature_cols = [
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
    
    # 존재하는 컬럼만 선택
    available_cols = [col for col in feature_cols if col in df.columns]
    print(f"📋 사용할 피처: {len(available_cols)}개")
    
    X = df[available_cols].copy()
    
    # 결측치 처리 (평균값으로)
    X = X.fillna(X.mean())
    
    # 여전히 NaN이면 0으로
    X = X.fillna(0)
    
    return X, available_cols


def train_model(X, y):
    """XGBoost 모델 학습"""
    
    # 라벨 인코딩
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
    
    # XGBoost 모델
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        use_label_encoder=False,
        eval_metric='mlogloss'
    )
    
    print("\n🚀 모델 학습 중...")
    model.fit(X_train, y_train)
    
    # 예측
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)
    
    # 평가
    accuracy = accuracy_score(y_test, y_pred)
    
    print("\n" + "="*50)
    print("📊 모델 성능")
    print("="*50)
    print(f"\n✅ 정확도: {accuracy:.1%}")
    print(f"   (무작위 기준: 33.3%)")
    print(f"   (향상도: +{(accuracy - 0.333)*100:.1f}%p)")
    
    print("\n📋 분류 리포트:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))
    
    print("\n📊 혼동 행렬:")
    cm = confusion_matrix(y_test, y_pred)
    print(pd.DataFrame(cm, 
                       index=[f'실제_{c}' for c in le.classes_],
                       columns=[f'예측_{c}' for c in le.classes_]))
    
    # 피처 중요도
    print("\n🔥 피처 중요도 TOP 10:")
    feature_importance = pd.DataFrame({
        'feature': X.columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    for i, row in feature_importance.head(10).iterrows():
        print(f"   {row['feature']}: {row['importance']:.3f}")
    
    return model, le, accuracy, feature_importance


def save_model(model, le, feature_cols, accuracy):
    """모델 저장"""
    
    # 모델 저장 디렉토리
    model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    os.makedirs(model_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # XGBoost 모델 저장
    model_path = os.path.join(model_dir, f'xgboost_1x2_{timestamp}.json')
    model.save_model(model_path)
    print(f"\n💾 모델 저장: {model_path}")
    
    # 메타데이터 저장
    meta = {
        'created_at': timestamp,
        'accuracy': float(accuracy),
        'classes': le.classes_.tolist(),
        'feature_columns': feature_cols,
        'model_file': f'xgboost_1x2_{timestamp}.json'
    }
    
    meta_path = os.path.join(model_dir, f'xgboost_1x2_{timestamp}_meta.json')
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=2)
    print(f"💾 메타데이터 저장: {meta_path}")
    
    # 최신 모델 심볼릭 링크 (또는 복사)
    latest_model = os.path.join(model_dir, 'xgboost_1x2_latest.json')
    latest_meta = os.path.join(model_dir, 'xgboost_1x2_latest_meta.json')
    
    # 기존 파일 삭제
    if os.path.exists(latest_model):
        os.remove(latest_model)
    if os.path.exists(latest_meta):
        os.remove(latest_meta)
    
    # 복사
    import shutil
    shutil.copy(model_path, latest_model)
    shutil.copy(meta_path, latest_meta)
    print(f"💾 최신 모델 링크: {latest_model}")


def main():
    print("="*50)
    print("⚽ Soccer-Brain XGBoost 학습")
    print("="*50)
    
    # 1. 데이터 로드
    df = get_features_from_db()
    
    if len(df) < 100:
        print("❌ 데이터가 부족합니다. 최소 100경기 필요.")
        sys.exit(1)
    
    # 2. 타겟 생성
    df = create_target(df)
    
    # 3. 피처 준비
    X, feature_cols = prepare_features(df)
    y = df['result']
    
    # 4. 모델 학습
    model, le, accuracy, feature_importance = train_model(X, y)
    
    # 5. 모델 저장
    save_model(model, le, feature_cols, accuracy)
    
    print("\n" + "="*50)
    print("✅ 학습 완료!")
    print("="*50)
    
    # 간단한 요약
    print(f"""
📊 요약:
   - 학습 데이터: {len(df)} 경기
   - 정확도: {accuracy:.1%}
   - 무작위 대비: +{(accuracy - 0.333)*100:.1f}%p 향상

🔥 가장 중요한 피처:
   1. {feature_importance.iloc[0]['feature']}
   2. {feature_importance.iloc[1]['feature']}
   3. {feature_importance.iloc[2]['feature']}

📁 모델 위치: models/xgboost_1x2_latest.json
    """)


if __name__ == "__main__":
    main()
