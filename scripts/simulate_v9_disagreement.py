"""
V9 시뮬레이션: ML vs 배당 불일치 분석
=====================================
V8 모델 (2021-2024 학습)로 2025년 전체 경기 예측
→ ML과 배당의 불일치 분포 확인
→ 불일치 구간별 적중률 검증

사용법:
  python scripts/simulate_v9_disagreement.py
"""

import os
import json
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder
import psycopg2
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")


def load_v8_model():
    """V8 모델 로드"""
    model_dir = os.path.join(os.path.dirname(__file__), '..', 'models')
    
    model = xgb.XGBClassifier()
    model.load_model(os.path.join(model_dir, 'xgboost_v8_latest.json'))
    
    with open(os.path.join(model_dir, 'xgboost_v8_latest_meta.json'), 'r', encoding='utf-8') as f:
        meta = json.load(f)
    
    le = LabelEncoder()
    le.classes_ = np.array(meta['classes'])
    
    return model, meta, le


def get_2025_data_with_odds():
    """2025년 데이터 + 배당 로드"""
    print("📊 2025년 데이터 로딩 중...")
    
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
        
        -- 배당
        fo.home as "oddsHome",
        fo.draw as "oddsDraw", 
        fo.away as "oddsAway",
        
        -- 홈/원정 팀 정보 (옵션)
        ht.name as home_team_name,
        at.name as away_team_name,
        
        -- 피처들
        f."homeInjuryCount",
        f."awayInjuryCount",
        f."home_shotsTotal_avg",
        f."home_shotsOnTarget_avg",
        f."home_possessionPct_avg",
        f."home_passAccuracyPct_avg",
        f."home_xg_avg",
        f."home_goalsFor_avg",
        f."home_goalsAgainst_avg",
        f."away_shotsTotal_avg",
        f."away_shotsOnTarget_avg",
        f."away_possessionPct_avg",
        f."away_passAccuracyPct_avg",
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
    JOIN "Fixture" fx ON f."fixtureId" = fx.id
    JOIN "Team" ht ON fx."homeTeamId" = ht.id
    JOIN "Team" at ON fx."awayTeamId" = at.id
    LEFT JOIN "FixtureOdds" fo ON f."fixtureId" = fo."fixtureId"
    WHERE f."homeGoals" IS NOT NULL 
      AND f."awayGoals" IS NOT NULL
      AND f."featureVersion" = 5
      AND EXTRACT(YEAR FROM f."kickoffAt") >= 2025
      AND fo.home IS NOT NULL
    ORDER BY f."kickoffAt"
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    # 결과 라벨
    df['result'] = np.where(df['homeGoals'] > df['awayGoals'], 'home_win',
                   np.where(df['homeGoals'] < df['awayGoals'], 'away_win', 'draw'))
    
    # 배당 → 확률 변환 (마진 제거)
    total = (1/df['oddsHome'] + 1/df['oddsDraw'] + 1/df['oddsAway'])
    df['odds_home'] = (1/df['oddsHome']) / total * 100
    df['odds_draw'] = (1/df['oddsDraw']) / total * 100
    df['odds_away'] = (1/df['oddsAway']) / total * 100
    
    print(f"✅ 2025년 {len(df)}경기 로드 (배당 있는 경기)")
    
    return df


def create_features(df):
    """V8 피처 생성"""
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
    
    # draw_likelihood 계산
    form_diff_abs = (df['home_form_last5'].fillna(1) - df['away_form_last5'].fillna(1)).abs()
    xg_diff_abs = (df['home_xg_avg'].fillna(1.2) - df['away_xg_avg'].fillna(1.0)).abs()
    goals_diff_abs = (df['home_goalsFor_avg'].fillna(1.2) - df['away_goalsFor_avg'].fillna(1.0)).abs()
    h2h_draw_pct = df['h2h_draws'].fillna(0) / (df['h2h_total_matches'].fillna(1) + 0.1) * 100
    
    df['draw_likelihood'] = (
        (1 - form_diff_abs.clip(upper=2) / 2) * 0.3 +
        (1 - xg_diff_abs.clip(upper=1) / 1) * 0.3 +
        (1 - goals_diff_abs.clip(upper=1.5) / 1.5) * 0.2 +
        (h2h_draw_pct.clip(upper=50) / 50) * 0.2
    )
    
    return df


def simulate_v9(df, model, meta, le):
    """V9 로직 시뮬레이션"""
    print("\n" + "="*70)
    print("🎯 V9 시뮬레이션: ML vs 배당 불일치 분석")
    print("="*70)
    
    feature_cols = meta['feature_columns']
    X = df[feature_cols].fillna(0)
    
    # ML 예측
    probs = model.predict_proba(X)
    class_order = list(le.classes_)
    home_idx = class_order.index('home_win')
    draw_idx = class_order.index('draw')
    away_idx = class_order.index('away_win')
    
    df['ml_home'] = probs[:, home_idx] * 100
    df['ml_draw'] = probs[:, draw_idx] * 100
    df['ml_away'] = probs[:, away_idx] * 100
    
    # ML 선택
    df['ml_pick'] = df[['ml_home', 'ml_draw', 'ml_away']].idxmax(axis=1)
    df['ml_pick'] = df['ml_pick'].map({'ml_home': 'home_win', 'ml_draw': 'draw', 'ml_away': 'away_win'})
    df['ml_pick_prob'] = df[['ml_home', 'ml_draw', 'ml_away']].max(axis=1)
    
    # 배당 선택
    df['odds_pick'] = df[['odds_home', 'odds_draw', 'odds_away']].idxmax(axis=1)
    df['odds_pick'] = df['odds_pick'].map({'odds_home': 'home_win', 'odds_draw': 'draw', 'odds_away': 'away_win'})
    
    # 불일치 계산 (ML 선택 기준)
    def calc_disagreement(row):
        if row['ml_pick'] == 'home_win':
            return row['ml_home'] - row['odds_home']
        elif row['ml_pick'] == 'away_win':
            return row['ml_away'] - row['odds_away']
        else:
            return row['ml_draw'] - row['odds_draw']
    
    df['disagreement'] = df.apply(calc_disagreement, axis=1)
    df['abs_disagreement'] = df['disagreement'].abs()
    
    # 적중 여부
    df['ml_correct'] = df['ml_pick'] == df['result']
    df['odds_correct'] = df['odds_pick'] == df['result']
    
    return df


def analyze_disagreement_distribution(df):
    """불일치 분포 분석"""
    print("\n" + "="*70)
    print("📊 [1] 불일치 분포 분석")
    print("="*70)
    
    print(f"\n총 {len(df)}경기 분석")
    print(f"ML 전체 적중률: {df['ml_correct'].mean()*100:.1f}%")
    print(f"배당 전체 적중률: {df['odds_correct'].mean()*100:.1f}%")
    
    print("\n[불일치 통계]")
    print(f"   평균 불일치: {df['disagreement'].mean():+.1f}%p")
    print(f"   불일치 표준편차: {df['disagreement'].std():.1f}%p")
    print(f"   최대 (ML > 배당): {df['disagreement'].max():+.1f}%p")
    print(f"   최소 (ML < 배당): {df['disagreement'].min():+.1f}%p")
    
    print("\n[불일치 분포 히스토그램]")
    bins = [(-100, -15), (-15, -10), (-10, -5), (-5, 0), (0, 5), (5, 10), (10, 15), (15, 100)]
    for low, high in bins:
        mask = (df['disagreement'] >= low) & (df['disagreement'] < high)
        count = mask.sum()
        pct = count / len(df) * 100
        bar = "█" * int(pct)
        label = f"{low:+d}~{high:+d}%p" if high < 100 else f"{low:+d}%p+"
        print(f"   {label:>12}: {count:>4}경기 ({pct:>5.1f}%) {bar}")


def analyze_by_disagreement_bands(df):
    """불일치 구간별 적중률"""
    print("\n" + "="*70)
    print("📊 [2] 불일치 구간별 적중률 (핵심!)")
    print("="*70)
    
    print("\n[ML이 배당보다 높게 평가한 경우]")
    print(f"{'구간':<20} {'경기수':>8} {'ML적중':>10} {'배당적중':>10} {'ML우위':>10}")
    print("-" * 65)
    
    bands = [
        (15, 100, "+15%p 이상 (강한 불일치)"),
        (10, 15, "+10~15%p"),
        (5, 10, "+5~10%p"),
        (0, 5, "0~5%p (약한 불일치)"),
    ]
    
    for low, high, label in bands:
        mask = (df['disagreement'] >= low) & (df['disagreement'] < high)
        subset = df[mask]
        if len(subset) > 0:
            ml_acc = subset['ml_correct'].mean() * 100
            odds_acc = subset['odds_correct'].mean() * 100
            diff = ml_acc - odds_acc
            marker = "🔥" if diff > 5 else "✅" if diff > 0 else "❌"
            print(f"{label:<20} {len(subset):>8} {ml_acc:>9.1f}% {odds_acc:>9.1f}% {diff:>+9.1f}% {marker}")
    
    print("\n[ML이 배당보다 낮게 평가한 경우]")
    bands_neg = [
        (-5, 0, "-5~0%p"),
        (-10, -5, "-10~-5%p"),
        (-15, -10, "-15~-10%p"),
        (-100, -15, "-15%p 이하"),
    ]
    
    for low, high, label in bands_neg:
        mask = (df['disagreement'] >= low) & (df['disagreement'] < high)
        subset = df[mask]
        if len(subset) > 0:
            ml_acc = subset['ml_correct'].mean() * 100
            odds_acc = subset['odds_correct'].mean() * 100
            diff = ml_acc - odds_acc
            marker = "🔥" if diff > 5 else "✅" if diff > 0 else "❌"
            print(f"{label:<20} {len(subset):>8} {ml_acc:>9.1f}% {odds_acc:>9.1f}% {diff:>+9.1f}% {marker}")


def analyze_v9_recommendation_candidates(df):
    """V9 추천 후보 분석"""
    print("\n" + "="*70)
    print("📊 [3] V9 추천 후보 분석")
    print("="*70)
    
    # 조건별 분석
    conditions = [
        ("전체", df, "기준선"),
        ("ML 55%+ 예측", df[df['ml_pick_prob'] >= 55], "신뢰도 높은 예측"),
        ("ML 60%+ 예측", df[df['ml_pick_prob'] >= 60], "신뢰도 매우 높은 예측"),
        ("불일치 10%+", df[df['disagreement'] >= 10], "ML이 배당보다 10%+ 높게"),
        ("불일치 5%+ AND ML 55%+", df[(df['disagreement'] >= 5) & (df['ml_pick_prob'] >= 55)], "복합 조건"),
        ("불일치 10%+ AND ML 55%+", df[(df['disagreement'] >= 10) & (df['ml_pick_prob'] >= 55)], "엄격한 조건"),
        ("draw_likelihood < 0.5", df[df['draw_likelihood'] < 0.5], "박빙 아닌 경기"),
        ("복합: 불일치5%+ AND ML55%+ AND 박빙X", 
         df[(df['disagreement'] >= 5) & (df['ml_pick_prob'] >= 55) & (df['draw_likelihood'] < 0.6)],
         "V9 추천 후보"),
    ]
    
    print(f"\n{'조건':<45} {'경기수':>8} {'ML적중':>10} {'비율':>8}")
    print("-" * 75)
    
    for name, subset, desc in conditions:
        if len(subset) > 0:
            ml_acc = subset['ml_correct'].mean() * 100
            ratio = len(subset) / len(df) * 100
            marker = "🔥" if ml_acc >= 60 else "✅" if ml_acc >= 55 else ""
            print(f"{name:<45} {len(subset):>8} {ml_acc:>9.1f}% {ratio:>7.1f}% {marker}")


def analyze_by_pick_type(df):
    """선택 유형별 분석 (홈/원정/무)"""
    print("\n" + "="*70)
    print("📊 [4] 선택 유형별 분석")
    print("="*70)
    
    for pick_type, name in [('home_win', '홈 승'), ('away_win', '원정 승'), ('draw', '무승부')]:
        subset = df[df['ml_pick'] == pick_type]
        if len(subset) > 0:
            ml_acc = subset['ml_correct'].mean() * 100
            odds_acc = subset['odds_correct'].mean() * 100
            avg_disagree = subset['disagreement'].mean()
            
            # 불일치 10%+ 경기
            high_disagree = subset[subset['disagreement'] >= 10]
            high_acc = high_disagree['ml_correct'].mean() * 100 if len(high_disagree) > 0 else 0
            
            print(f"\n[{name} 선택]: {len(subset)}경기")
            print(f"   ML 적중률: {ml_acc:.1f}%")
            print(f"   배당 적중률: {odds_acc:.1f}%")
            print(f"   평균 불일치: {avg_disagree:+.1f}%p")
            print(f"   불일치 10%+: {len(high_disagree)}경기, 적중률 {high_acc:.1f}%")


def show_sample_recommendations(df):
    """추천 샘플 출력"""
    print("\n" + "="*70)
    print("📊 [5] V9 추천 샘플")
    print("="*70)
    
    # V9 추천 조건: 불일치 5%+ AND ML 55%+ AND 박빙 아님
    recommended = df[
        (df['disagreement'] >= 5) & 
        (df['ml_pick_prob'] >= 55) & 
        (df['draw_likelihood'] < 0.6)
    ].copy()
    
    print(f"\n[V9 추천 경기: {len(recommended)}경기]")
    
    if len(recommended) > 0:
        # 적중한 경기 샘플
        correct_samples = recommended[recommended['ml_correct']].head(5)
        print("\n✅ 적중 샘플:")
        for _, row in correct_samples.iterrows():
            print(f"   {row['home_team_name']} vs {row['away_team_name']}")
            print(f"      ML: {row['ml_pick']} {row['ml_pick_prob']:.0f}% | 배당: {row['odds_pick']} | 불일치: {row['disagreement']:+.0f}%p")
            print(f"      결과: {row['result']} ✅")
        
        # 실패한 경기 샘플
        wrong_samples = recommended[~recommended['ml_correct']].head(5)
        print("\n❌ 실패 샘플:")
        for _, row in wrong_samples.iterrows():
            print(f"   {row['home_team_name']} vs {row['away_team_name']}")
            print(f"      ML: {row['ml_pick']} {row['ml_pick_prob']:.0f}% | 배당: {row['odds_pick']} | 불일치: {row['disagreement']:+.0f}%p")
            print(f"      결과: {row['result']} ❌")


def summary(df):
    """최종 요약"""
    print("\n" + "="*70)
    print("📊 [요약] V9 설계 인사이트")
    print("="*70)
    
    # V9 추천 조건
    v9_candidates = df[
        (df['disagreement'] >= 5) & 
        (df['ml_pick_prob'] >= 55) & 
        (df['draw_likelihood'] < 0.6)
    ]
    
    total = len(df)
    rec_count = len(v9_candidates)
    rec_acc = v9_candidates['ml_correct'].mean() * 100 if rec_count > 0 else 0
    baseline_acc = df['ml_correct'].mean() * 100
    
    print(f"""
┌─────────────────────────────────────────────────────────────┐
│  V9 추천 기준 (안)                                          │
│  ─────────────────────────────────────────────────────────  │
│  1. ML 예측 확률 >= 55%                                     │
│  2. 불일치 (ML - 배당) >= 5%p                               │
│  3. draw_likelihood < 0.6 (박빙 아님)                       │
├─────────────────────────────────────────────────────────────┤
│  결과                                                       │
│  ─────────────────────────────────────────────────────────  │
│  전체 경기: {total}경기                                       │
│  추천 경기: {rec_count}경기 ({rec_count/total*100:.1f}%)                                   │
│  추천 적중률: {rec_acc:.1f}% (기준선: {baseline_acc:.1f}%)                       │
│  향상: {rec_acc - baseline_acc:+.1f}%p                                             │
└─────────────────────────────────────────────────────────────┘
""")


def main():
    print("="*70)
    print("🎯 V9 시뮬레이션: ML vs 배당 불일치 분석")
    print("="*70)
    print("학습: 2021-2024년 (V8 모델)")
    print("테스트: 2025년 전체 경기")
    print("="*70)
    
    # 모델 로드
    model, meta, le = load_v8_model()
    print(f"✅ V8 모델 로드 완료")
    
    # 데이터 로드
    df = get_2025_data_with_odds()
    
    # 피처 생성
    df = create_features(df)
    
    # V9 시뮬레이션
    df = simulate_v9(df, model, meta, le)
    
    # 분석
    analyze_disagreement_distribution(df)
    analyze_by_disagreement_bands(df)
    analyze_v9_recommendation_candidates(df)
    analyze_by_pick_type(df)
    show_sample_recommendations(df)
    summary(df)
    
    print("\n" + "="*70)
    print("✅ V9 시뮬레이션 완료!")
    print("="*70)


if __name__ == "__main__":
    main()
