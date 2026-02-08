"""
Soccer-Brain V8 모델 심층 검증
==============================
1. 리그별 성능 분리
2. High Confidence 구간 분석
3. 배당 vs ML 불일치 분석
4. 무승부 제외 성능
5. 시즌별 안정성

사용법:
  python scripts/analyze_v8_deep.py
"""

import os
import json
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")


def load_model_and_meta():
    """V8 모델 및 메타데이터 로드"""
    model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    
    model = xgb.XGBClassifier()
    model.load_model(os.path.join(model_dir, 'xgboost_v8_latest.json'))
    
    with open(os.path.join(model_dir, 'xgboost_v8_latest_meta.json'), 'r', encoding='utf-8') as f:
        meta = json.load(f)
    
    return model, meta


def get_data_with_odds():
    """배당 데이터 포함하여 로드"""
    print("📊 배당 포함 데이터 로딩 중...")
    
    conn = psycopg2.connect(DATABASE_URL)
    
    query = """
    SELECT 
        f.id,
        f."fixtureId",
        f."kickoffAt",
        f.season,
        f."leagueId",
        l.name as league_name,
        f."homeGoals",
        f."awayGoals",
        
        -- 배당 (FixtureOdds 테이블에서)
        fo.home as "oddsHome",
        fo.draw as "oddsDraw", 
        fo.away as "oddsAway",
        
        -- 피처들
        f."homeInjuryCount",
        f."awayInjuryCount",
        f."home_shotsTotal_avg",
        f."home_shotsOnTarget_avg",
        f."home_possessionPct_avg",
        f."home_passAccuracyPct_avg",
        f."home_corners_avg",
        f."home_xg_avg",
        f."home_goalsFor_avg",
        f."home_goalsAgainst_avg",
        f."away_shotsTotal_avg",
        f."away_shotsOnTarget_avg",
        f."away_possessionPct_avg",
        f."away_passAccuracyPct_avg",
        f."away_corners_avg",
        f."away_xg_avg",
        f."away_goalsFor_avg",
        f."away_goalsAgainst_avg",
        f."home_goalsFor_atHome_avg",
        f."home_goalsAgainst_atHome_avg",
        f."home_xg_atHome_avg",
        f."home_wins_atHome_pct",
        f."away_goalsFor_atAway_avg",
        f."away_goalsAgainst_atAway_avg",
        f."away_xg_atAway_avg",
        f."away_wins_atAway_pct",
        f."home_form_last3",
        f."home_form_last5",
        f."away_form_last3",
        f."away_form_last5",
        f."home_days_rest",
        f."away_days_rest",
        f."rest_diff",
        f."home_matches_14d",
        f."away_matches_14d",
        f."h2h_total_matches",
        f."h2h_home_wins",
        f."h2h_away_wins",
        f."h2h_draws",
        f."h2h_home_win_pct"
        
    FROM "FixtureFeatureSnapshot" f
    JOIN "League" l ON f."leagueId" = l.id
    LEFT JOIN "FixtureOdds" fo ON f."fixtureId" = fo."fixtureId"
    WHERE f."homeGoals" IS NOT NULL 
      AND f."awayGoals" IS NOT NULL
      AND f."featureVersion" = 5
    ORDER BY f."kickoffAt"
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    df['year'] = pd.to_datetime(df['kickoffAt']).dt.year
    
    # 배당 → 확률 변환
    df['odds_home_prob'] = np.where(df['oddsHome'] > 0, 100 / df['oddsHome'], 0)
    df['odds_draw_prob'] = np.where(df['oddsDraw'] > 0, 100 / df['oddsDraw'], 0)
    df['odds_away_prob'] = np.where(df['oddsAway'] > 0, 100 / df['oddsAway'], 0)
    
    # 마진 제거 (합이 100%가 되도록)
    total = df['odds_home_prob'] + df['odds_draw_prob'] + df['odds_away_prob']
    df['odds_home_prob'] = df['odds_home_prob'] / total * 100
    df['odds_draw_prob'] = df['odds_draw_prob'] / total * 100
    df['odds_away_prob'] = df['odds_away_prob'] / total * 100
    
    print(f"✅ {len(df)} 경기 로드 (배당 있는 경기: {(df['oddsHome'] > 0).sum()})")
    
    return df


def create_features(df):
    """피처 생성 (V8과 동일)"""
    df['form_diff_last3'] = df['home_form_last3'].fillna(1) - df['away_form_last3'].fillna(1)
    df['form_diff_last5'] = df['home_form_last5'].fillna(1) - df['away_form_last5'].fillna(1)
    df['home_form_trend'] = df['home_form_last3'].fillna(1) - df['home_form_last5'].fillna(1)
    df['away_form_trend'] = df['away_form_last3'].fillna(1) - df['away_form_last5'].fillna(1)
    df['xg_diff'] = df['home_xg_avg'].fillna(1.2) - df['away_xg_avg'].fillna(1.0)
    df['xg_home_diff'] = df['home_xg_atHome_avg'].fillna(1.3) - df['away_xg_atAway_avg'].fillna(0.9)
    df['home_xg_overperform'] = df['home_goalsFor_avg'].fillna(1.2) - df['home_xg_avg'].fillna(1.2)
    df['away_xg_overperform'] = df['away_goalsFor_avg'].fillna(1.0) - df['away_xg_avg'].fillna(1.0)
    df['goals_diff'] = df['home_goalsFor_avg'].fillna(1.2) - df['away_goalsFor_avg'].fillna(1.0)
    df['goals_against_diff'] = df['home_goalsAgainst_avg'].fillna(1.3) - df['away_goalsAgainst_avg'].fillna(1.5)
    df['home_venue_goals_diff'] = df['home_goalsFor_atHome_avg'].fillna(1.4) - df['away_goalsFor_atAway_avg'].fillna(0.9)
    df['home_away_winrate_diff'] = (df['home_wins_atHome_pct'].fillna(45) - df['away_wins_atAway_pct'].fillna(30)) / 100
    df['shots_diff'] = df['home_shotsTotal_avg'].fillna(12) - df['away_shotsTotal_avg'].fillna(12)
    df['shots_on_target_diff'] = df['home_shotsOnTarget_avg'].fillna(4) - df['away_shotsOnTarget_avg'].fillna(4)
    df['home_shot_accuracy'] = df['home_shotsOnTarget_avg'].fillna(4) / (df['home_shotsTotal_avg'].fillna(12) + 0.1)
    df['away_shot_accuracy'] = df['away_shotsOnTarget_avg'].fillna(4) / (df['away_shotsTotal_avg'].fillna(12) + 0.1)
    df['shot_accuracy_diff'] = df['home_shot_accuracy'] - df['away_shot_accuracy']
    df['rest_diff_normalized'] = df['rest_diff'].fillna(0) / 3
    df['fatigue_diff'] = (df['away_matches_14d'].fillna(2) - df['home_matches_14d'].fillna(2)) / 3
    df['h2h_reliability'] = np.minimum(df['h2h_total_matches'].fillna(0) / 10, 1.0)
    df['h2h_home_advantage'] = (df['h2h_home_win_pct'].fillna(50) - 50) / 100
    df['possession_diff'] = (df['home_possessionPct_avg'].fillna(50) - df['away_possessionPct_avg'].fillna(50)) / 100
    df['pass_accuracy_diff'] = (df['home_passAccuracyPct_avg'].fillna(80) - df['away_passAccuracyPct_avg'].fillna(80)) / 100
    
    return df


def create_target(df):
    """승무패 라벨"""
    def get_result(row):
        if row['homeGoals'] > row['awayGoals']:
            return 'home_win'
        elif row['homeGoals'] < row['awayGoals']:
            return 'away_win'
        else:
            return 'draw'
    df['result'] = df.apply(get_result, axis=1)
    return df


def get_feature_columns(meta):
    """메타데이터에서 피처 컬럼 가져오기"""
    return meta['feature_columns']


def analyze_by_league(df, model, feature_cols, le):
    """1. 리그별 성능 분석 (2025년 데이터만)"""
    print("\n" + "="*60)
    print("📊 [1] 리그별 성능 분석")
    print("="*60)
    
    # Walk-Forward: 2025년만 테스트!
    test_df = df[df['year'] >= 2025].copy()
    
    X = test_df[feature_cols].fillna(0)
    probs = model.predict_proba(X)
    
    class_order = list(le.classes_)
    home_idx = class_order.index('home_win')
    
    test_df['ml_home'] = probs[:, home_idx] * 100
    test_df['ml_draw'] = probs[:, class_order.index('draw')] * 100
    test_df['ml_away'] = probs[:, class_order.index('away_win')] * 100
    test_df['ml_max'] = probs.max(axis=1) * 100
    
    # ML 선택
    test_df['ml_pick'] = test_df[['ml_home', 'ml_draw', 'ml_away']].idxmax(axis=1)
    test_df['ml_pick'] = test_df['ml_pick'].map({'ml_home': 'home_win', 'ml_draw': 'draw', 'ml_away': 'away_win'})
    test_df['correct'] = test_df['ml_pick'] == test_df['result']
    
    print(f"\n[Walk-Forward 검증]")
    print(f"   학습: 2021-2024년")
    print(f"   테스트: 2025년 ({len(test_df)}경기)")
    
    print(f"\n{'리그':<20} {'경기수':>6} {'정확도':>8} {'55%+':>6} {'55%+적중':>8}")
    print("-" * 55)
    
    league_stats = []
    for league in sorted(test_df['league_name'].unique()):
        league_df = test_df[test_df['league_name'] == league]
        if len(league_df) >= 20:  # 최소 20경기 이상
            acc = league_df['correct'].mean() * 100
            high_conf = league_df[league_df['ml_max'] >= 55]
            high_conf_acc = high_conf['correct'].mean() * 100 if len(high_conf) > 0 else 0
            
            print(f"{league:<20} {len(league_df):>6} {acc:>7.1f}% {len(high_conf):>6} {high_conf_acc:>7.1f}%")
            league_stats.append({
                'league': league,
                'count': len(league_df),
                'accuracy': acc,
                'high_conf_count': len(high_conf),
                'high_conf_acc': high_conf_acc
            })
    
    return league_stats


def analyze_confidence_bands(df, model, feature_cols, le):
    """2. 신뢰도 구간별 상세 분석 (2025년 데이터만)"""
    print("\n" + "="*60)
    print("📊 [2] 신뢰도 구간별 상세 분석")
    print("="*60)
    
    # Walk-Forward: 2025년만 테스트!
    test_df = df[df['year'] >= 2025].copy()
    
    X = test_df[feature_cols].fillna(0)
    probs = model.predict_proba(X)
    
    class_order = list(le.classes_)
    home_idx = class_order.index('home_win')
    draw_idx = class_order.index('draw')
    away_idx = class_order.index('away_win')
    
    test_df['ml_home'] = probs[:, home_idx] * 100
    test_df['ml_draw'] = probs[:, draw_idx] * 100
    test_df['ml_away'] = probs[:, away_idx] * 100
    test_df['ml_max'] = probs.max(axis=1) * 100
    
    # ML의 최고 확률 선택
    test_df['ml_pick'] = test_df[['ml_home', 'ml_draw', 'ml_away']].idxmax(axis=1)
    test_df['ml_pick'] = test_df['ml_pick'].map({'ml_home': 'home_win', 'ml_draw': 'draw', 'ml_away': 'away_win'})
    test_df['correct'] = test_df['ml_pick'] == test_df['result']
    
    print(f"\n[Walk-Forward 검증]")
    print(f"   학습: 2021-2024년")
    print(f"   테스트: 2025년 ({len(test_df)}경기)")
    
    print("\n[ML 최고 확률 구간별 적중률]")
    print(f"{'구간':<12} {'경기수':>8} {'적중률':>8} {'비율':>8} | {'홈':>6} {'원정':>6} {'무':>6}")
    print("-" * 65)
    
    bands = [(65, 100), (55, 65), (50, 55), (45, 50), (40, 45), (0, 40)]
    for low, high in bands:
        mask = (test_df['ml_max'] >= low) & (test_df['ml_max'] < high)
        band_df = test_df[mask]
        if len(band_df) > 0:
            acc = band_df['correct'].mean() * 100
            ratio = len(band_df) / len(test_df) * 100
            home_cnt = (band_df['ml_pick'] == 'home_win').sum()
            away_cnt = (band_df['ml_pick'] == 'away_win').sum()
            draw_cnt = (band_df['ml_pick'] == 'draw').sum()
            print(f"{low:>2}-{high:<3}%     {len(band_df):>8} {acc:>7.1f}% {ratio:>7.1f}% | {home_cnt:>6} {away_cnt:>6} {draw_cnt:>6}")
    
    # 결과별 적중률
    print("\n[결과별 적중률]")
    for pick_type, name in [('home_win', '홈 승'), ('away_win', '원정 승'), ('draw', '무승부')]:
        pick_df = test_df[test_df['ml_pick'] == pick_type]
        if len(pick_df) > 0:
            acc = pick_df['correct'].mean() * 100
            high_conf = pick_df[pick_df['ml_max'] >= 55]
            high_acc = high_conf['correct'].mean() * 100 if len(high_conf) > 0 else 0
            print(f"   {name}: {len(pick_df)}경기, 적중률 {acc:.1f}% (55%+: {len(high_conf)}경기, {high_acc:.1f}%)")
    
    # AI 추천 후보 분석
    print("\n[AI 추천 후보: 55%+ 예측]")
    high_conf = test_df[test_df['ml_max'] >= 55]
    print(f"   총 {len(high_conf)}경기 ({len(high_conf)/len(test_df)*100:.1f}%)")
    print(f"   적중률: {high_conf['correct'].mean()*100:.1f}%")
    print(f"   - 홈 선택: {(high_conf['ml_pick'] == 'home_win').sum()}경기")
    print(f"   - 원정 선택: {(high_conf['ml_pick'] == 'away_win').sum()}경기")
    print(f"   - 무승부 선택: {(high_conf['ml_pick'] == 'draw').sum()}경기")
    
    return test_df


def analyze_odds_disagreement(df, model, feature_cols, le):
    """3. 배당 vs ML 불일치 분석 (2025년 데이터만)"""
    print("\n" + "="*60)
    print("📊 [3] 배당 vs ML 불일치 분석 (홈/원정/무 모두)")
    print("="*60)
    
    # Walk-Forward: 2025년 + 배당 있는 경기만
    test_df = df[(df['year'] >= 2025) & (df['oddsHome'] > 0)].copy()
    
    X = test_df[feature_cols].fillna(0)
    probs = model.predict_proba(X)
    
    class_order = list(le.classes_)
    home_idx = class_order.index('home_win')
    draw_idx = class_order.index('draw')
    away_idx = class_order.index('away_win')
    
    test_df['ml_home'] = probs[:, home_idx] * 100
    test_df['ml_draw'] = probs[:, draw_idx] * 100
    test_df['ml_away'] = probs[:, away_idx] * 100
    
    # 불일치 계산 (홈/원정/무 각각)
    test_df['disagree_home'] = test_df['ml_home'] - test_df['odds_home_prob']
    test_df['disagree_draw'] = test_df['ml_draw'] - test_df['odds_draw_prob']
    test_df['disagree_away'] = test_df['ml_away'] - test_df['odds_away_prob']
    
    # ML의 최고 확률 선택 (홈/원정/무 중)
    test_df['ml_pick'] = test_df[['ml_home', 'ml_draw', 'ml_away']].idxmax(axis=1)
    test_df['ml_pick'] = test_df['ml_pick'].map({'ml_home': 'home_win', 'ml_draw': 'draw', 'ml_away': 'away_win'})
    test_df['ml_max_prob'] = test_df[['ml_home', 'ml_draw', 'ml_away']].max(axis=1)
    
    # 배당의 최고 확률 선택
    test_df['odds_pick'] = test_df[['odds_home_prob', 'odds_draw_prob', 'odds_away_prob']].idxmax(axis=1)
    test_df['odds_pick'] = test_df['odds_pick'].map({'odds_home_prob': 'home_win', 'odds_draw_prob': 'draw', 'odds_away_prob': 'away_win'})
    
    # ML 선택의 불일치 (ML이 선택한 결과와 배당 비교)
    def get_ml_disagreement(row):
        if row['ml_pick'] == 'home_win':
            return row['disagree_home']
        elif row['ml_pick'] == 'away_win':
            return row['disagree_away']
        else:
            return row['disagree_draw']
    
    test_df['ml_pick_disagreement'] = test_df.apply(get_ml_disagreement, axis=1)
    
    # 적중 여부
    test_df['correct'] = test_df['ml_pick'] == test_df['result']
    
    print(f"\n[Walk-Forward 검증]")
    print(f"   학습: 2021-2024년")
    print(f"   테스트: 2025년 ({len(test_df)}경기, 배당 있는 경기)")
    
    # === 핵심 분석 1: ML 선택의 적중률 (신뢰도별) ===
    print("\n" + "-"*50)
    print("[ML 최고 확률 구간별 적중률] (홈/원정/무 모두 포함)")
    print("-"*50)
    print(f"{'구간':<12} {'경기수':>8} {'적중률':>8} {'홈선택':>8} {'원정선택':>8} {'무선택':>8}")
    print("-" * 60)
    
    bands = [(65, 100), (55, 65), (50, 55), (45, 50), (0, 45)]
    for low, high in bands:
        mask = (test_df['ml_max_prob'] >= low) & (test_df['ml_max_prob'] < high)
        band_df = test_df[mask]
        if len(band_df) > 0:
            acc = band_df['correct'].mean() * 100
            home_picks = (band_df['ml_pick'] == 'home_win').sum()
            away_picks = (band_df['ml_pick'] == 'away_win').sum()
            draw_picks = (band_df['ml_pick'] == 'draw').sum()
            print(f"{low:>2}-{high:<3}%     {len(band_df):>8} {acc:>7.1f}% {home_picks:>8} {away_picks:>8} {draw_picks:>8}")
    
    # === 핵심 분석 2: 불일치 구간별 (ML 선택 기준) ===
    print("\n" + "-"*50)
    print("[ML-배당 불일치 구간별 적중률] (ML이 선택한 결과 기준)")
    print("-"*50)
    print("(양수 = ML이 배당보다 해당 결과를 더 높게 평가)")
    print(f"{'불일치':<15} {'경기수':>8} {'적중률':>8}")
    print("-" * 35)
    
    disagreement_bands = [
        (15, 100, "+15%p 이상"),
        (10, 15, "+10~15%p"),
        (5, 10, "+5~10%p"),
        (0, 5, "0~5%p"),
        (-5, 0, "-5~0%p"),
        (-100, -5, "-5%p 이하"),
    ]
    
    for low, high, label in disagreement_bands:
        mask = (test_df['ml_pick_disagreement'] >= low) & (test_df['ml_pick_disagreement'] < high)
        band_df = test_df[mask]
        if len(band_df) > 0:
            acc = band_df['correct'].mean() * 100
            print(f"{label:<15} {len(band_df):>8} {acc:>7.1f}%")
    
    # === 핵심 분석 3: 결과별 상세 (홈/원정/무 각각) ===
    print("\n" + "-"*50)
    print("[결과별 불일치 분석]")
    print("-"*50)
    
    for pick_type, result_name in [('home_win', '홈 승'), ('away_win', '원정 승'), ('draw', '무승부')]:
        pick_df = test_df[test_df['ml_pick'] == pick_type]
        if len(pick_df) > 0:
            acc = pick_df['correct'].mean() * 100
            avg_disagree = pick_df['ml_pick_disagreement'].mean()
            
            # 불일치 10%+ 경기
            high_disagree = pick_df[pick_df['ml_pick_disagreement'] >= 10]
            high_acc = high_disagree['correct'].mean() * 100 if len(high_disagree) > 0 else 0
            
            print(f"\n{result_name} 선택: {len(pick_df)}경기")
            print(f"   전체 적중률: {acc:.1f}%")
            print(f"   평균 불일치: {avg_disagree:+.1f}%p")
            print(f"   불일치 10%+: {len(high_disagree)}경기, 적중률 {high_acc:.1f}%")
    
    # === 샘플 출력 (홈/원정/무 모두) ===
    print("\n" + "-"*50)
    print("[불일치 큰 경기 샘플 (각 유형별)]")
    print("-"*50)
    
    for pick_type, result_name in [('home_win', '홈'), ('away_win', '원정'), ('draw', '무')]:
        pick_df = test_df[test_df['ml_pick'] == pick_type].nlargest(3, 'ml_pick_disagreement')
        if len(pick_df) > 0:
            print(f"\n{result_name} 선택 TOP 3:")
            for _, row in pick_df.iterrows():
                result_icon = "✅" if row['correct'] else "❌"
                print(f"   {result_icon} ML:{result_name} {row['ml_max_prob']:.0f}% (배당과 차이: {row['ml_pick_disagreement']:+.1f}%p) → 실제: {row['result']}")
    
    return test_df


def analyze_without_draw(df, model, feature_cols, le):
    """4. 무승부 제외 분석 (2025년 데이터만)"""
    print("\n" + "="*60)
    print("📊 [4] 무승부 제외 분석")
    print("="*60)
    
    # Walk-Forward: 2025년 + 무승부 제외
    test_df = df[(df['year'] >= 2025) & (df['result'] != 'draw')].copy()
    
    X = test_df[feature_cols].fillna(0)
    probs = model.predict_proba(X)
    
    class_order = list(le.classes_)
    home_idx = class_order.index('home_win')
    away_idx = class_order.index('away_win')
    
    # 홈승 vs 원정승 이진 분류로 변환
    test_df['ml_home'] = probs[:, home_idx]
    test_df['ml_away'] = probs[:, away_idx]
    
    # 무승부 확률 재분배
    total = test_df['ml_home'] + test_df['ml_away']
    test_df['ml_home_adj'] = test_df['ml_home'] / total * 100
    test_df['ml_away_adj'] = test_df['ml_away'] / total * 100
    
    # 예측
    test_df['binary_pred'] = np.where(test_df['ml_home'] > test_df['ml_away'], 'home_win', 'away_win')
    test_df['correct'] = test_df['binary_pred'] == test_df['result']
    
    acc = test_df['correct'].mean() * 100
    
    print(f"\n   무승부 제외 경기 수: {len(test_df)}")
    print(f"   이진 분류 정확도: {acc:.1f}%")
    
    # 신뢰도별
    print("\n[확률 구간별 (무승부 제외)]")
    bands = [(70, 100), (60, 70), (55, 60), (50, 55)]
    for low, high in bands:
        mask = (test_df['ml_home_adj'] >= low) | (test_df['ml_away_adj'] >= low)
        mask &= (test_df['ml_home_adj'].clip(upper=high) == test_df['ml_home_adj']) | \
                (test_df['ml_away_adj'].clip(upper=high) == test_df['ml_away_adj'])
        # 간단하게 최대 확률 기준
        test_df['max_adj'] = test_df[['ml_home_adj', 'ml_away_adj']].max(axis=1)
        mask = (test_df['max_adj'] >= low) & (test_df['max_adj'] < high)
        band_df = test_df[mask]
        if len(band_df) > 0:
            band_acc = band_df['correct'].mean() * 100
            print(f"   {low}-{high}%: {len(band_df)}경기, 적중률 {band_acc:.1f}%")
    
    return acc


def analyze_by_season(df, model, feature_cols, le):
    """5. 시즌별 정확도 (참고용 - 학습 데이터 포함)"""
    print("\n" + "="*60)
    print("📊 [5] 시즌별 정확도 (참고용)")
    print("="*60)
    print("   ⚠️ 2024년 이하는 학습 데이터이므로 오버피팅 확인용")
    print("   ✅ 2025년만 실제 테스트 성능")
    
    print(f"\n{'시즌':<8} {'경기수':>8} {'정확도':>8} {'비고':>12}")
    print("-" * 40)
    
    for year in sorted(df['year'].unique()):
        if year >= 2021:
            year_df = df[df['year'] == year].copy()
            if len(year_df) >= 30:
                X = year_df[feature_cols].fillna(0)
                
                # ML 선택
                probs = model.predict_proba(X)
                class_order = list(le.classes_)
                year_df['ml_home'] = probs[:, class_order.index('home_win')] * 100
                year_df['ml_draw'] = probs[:, class_order.index('draw')] * 100
                year_df['ml_away'] = probs[:, class_order.index('away_win')] * 100
                year_df['ml_pick'] = year_df[['ml_home', 'ml_draw', 'ml_away']].idxmax(axis=1)
                year_df['ml_pick'] = year_df['ml_pick'].map({'ml_home': 'home_win', 'ml_draw': 'draw', 'ml_away': 'away_win'})
                year_df['correct'] = year_df['ml_pick'] == year_df['result']
                
                acc = year_df['correct'].mean() * 100
                note = "← 테스트" if year >= 2025 else "(학습)"
                print(f"{year:<8} {len(year_df):>8} {acc:>7.1f}% {note:>12}")


def main():
    print("="*60)
    print("🔬 Soccer-Brain V8 심층 검증")
    print("="*60)
    
    # 모델 로드
    model, meta = load_model_and_meta()
    feature_cols = meta['feature_columns']
    
    le = LabelEncoder()
    le.classes_ = np.array(meta['classes'])
    
    print(f"✅ V8 모델 로드 완료 (정확도: {meta['accuracy']*100:.1f}%)")
    
    # 데이터 로드
    df = get_data_with_odds()
    df = create_features(df)
    df = create_target(df)
    
    # 분석 실행
    analyze_by_league(df, model, feature_cols, le)
    analyze_confidence_bands(df, model, feature_cols, le)
    analyze_odds_disagreement(df, model, feature_cols, le)
    analyze_without_draw(df, model, feature_cols, le)
    analyze_by_season(df, model, feature_cols, le)
    
    print("\n" + "="*60)
    print("✅ V8 심층 검증 완료!")
    print("="*60)
    print("\n💡 핵심 인사이트:")
    print("   1. 70%+ 예측은 신뢰할 만한가?")
    print("   2. 어떤 리그에서 성능이 좋은가?")
    print("   3. ML과 배당의 불일치가 가치가 있는가?")
    print("="*60)


if __name__ == "__main__":
    main()
