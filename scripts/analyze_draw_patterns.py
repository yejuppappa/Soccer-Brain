"""
무승부 경기 특성 분석
====================
1. 무승부 vs 비무승부 경기의 피처 비교
2. 무승부 발생 조건 탐색
3. 무승부 예측 특화 피처 도출

사용법:
  python scripts/analyze_draw_patterns.py
"""

import os
import pandas as pd
import numpy as np
import psycopg2
from dotenv import load_dotenv
from scipy import stats

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")


def get_data():
    """피처 데이터 로드"""
    print("📊 데이터 로딩 중...")
    
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
        
        -- 모든 피처
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
    WHERE f."homeGoals" IS NOT NULL 
      AND f."awayGoals" IS NOT NULL
      AND f."featureVersion" = 5
    ORDER BY f."kickoffAt"
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    # 결과 라벨
    df['result'] = np.where(df['homeGoals'] > df['awayGoals'], 'home_win',
                   np.where(df['homeGoals'] < df['awayGoals'], 'away_win', 'draw'))
    df['is_draw'] = (df['result'] == 'draw').astype(int)
    
    # 파생 피처
    df['form_diff'] = df['home_form_last5'].fillna(1) - df['away_form_last5'].fillna(1)
    df['form_diff_abs'] = df['form_diff'].abs()
    df['xg_diff'] = df['home_xg_avg'].fillna(1.2) - df['away_xg_avg'].fillna(1.0)
    df['xg_diff_abs'] = df['xg_diff'].abs()
    df['goals_diff'] = df['home_goalsFor_avg'].fillna(1.2) - df['away_goalsFor_avg'].fillna(1.0)
    df['goals_diff_abs'] = df['goals_diff'].abs()
    df['winrate_diff'] = (df['home_wins_atHome_pct'].fillna(45) - df['away_wins_atAway_pct'].fillna(30)) / 100
    df['winrate_diff_abs'] = df['winrate_diff'].abs()
    df['possession_diff'] = df['home_possessionPct_avg'].fillna(50) - df['away_possessionPct_avg'].fillna(50)
    df['possession_diff_abs'] = df['possession_diff'].abs()
    
    # H2H 무승부 비율
    df['h2h_draw_pct'] = df['h2h_draws'].fillna(0) / (df['h2h_total_matches'].fillna(1) + 0.1) * 100
    
    # 양팀 평균 득점력
    df['total_goals_avg'] = df['home_goalsFor_avg'].fillna(1.2) + df['away_goalsFor_avg'].fillna(1.0)
    df['total_xg_avg'] = df['home_xg_avg'].fillna(1.2) + df['away_xg_avg'].fillna(1.0)
    
    # 양팀 수비력 (실점)
    df['total_goals_against'] = df['home_goalsAgainst_avg'].fillna(1.3) + df['away_goalsAgainst_avg'].fillna(1.5)
    
    print(f"✅ {len(df)} 경기 로드 완료")
    print(f"   무승부: {df['is_draw'].sum()} ({df['is_draw'].mean()*100:.1f}%)")
    
    return df


def compare_draw_vs_nondraw(df):
    """무승부 vs 비무승부 피처 비교"""
    print("\n" + "="*70)
    print("📊 [1] 무승부 vs 비무승부 피처 비교")
    print("="*70)
    
    draw_df = df[df['is_draw'] == 1]
    nondraw_df = df[df['is_draw'] == 0]
    
    print(f"\n무승부: {len(draw_df)}경기 / 비무승부: {len(nondraw_df)}경기")
    
    # 비교할 피처들
    features_to_compare = [
        ('form_diff_abs', '폼 차이 (절대값)', '작을수록 무승부?'),
        ('xg_diff_abs', 'xG 차이 (절대값)', '작을수록 무승부?'),
        ('goals_diff_abs', '득점력 차이 (절대값)', '작을수록 무승부?'),
        ('winrate_diff_abs', '승률 차이 (절대값)', '작을수록 무승부?'),
        ('possession_diff_abs', '점유율 차이 (절대값)', '작을수록 무승부?'),
        ('h2h_draw_pct', 'H2H 무승부 비율', '높을수록 무승부?'),
        ('total_goals_avg', '양팀 득점력 합', '낮을수록 무승부?'),
        ('total_xg_avg', '양팀 xG 합', '낮을수록 무승부?'),
        ('total_goals_against', '양팀 실점 합', '높을수록 무승부?'),
        ('home_form_last3', '홈팀 최근폼', ''),
        ('away_form_last3', '원정팀 최근폼', ''),
        ('rest_diff', '휴식일 차이', ''),
    ]
    
    print(f"\n{'피처':<25} {'무승부 평균':>12} {'비무승부 평균':>12} {'차이':>10} {'p-value':>10} {'의미':>15}")
    print("-" * 90)
    
    significant_features = []
    
    for feat, name, hypothesis in features_to_compare:
        if feat in df.columns:
            draw_mean = draw_df[feat].mean()
            nondraw_mean = nondraw_df[feat].mean()
            diff = draw_mean - nondraw_mean
            
            # t-test
            t_stat, p_value = stats.ttest_ind(
                draw_df[feat].dropna(), 
                nondraw_df[feat].dropna(),
                equal_var=False
            )
            
            sig = "***" if p_value < 0.001 else "**" if p_value < 0.01 else "*" if p_value < 0.05 else ""
            
            print(f"{name:<25} {draw_mean:>12.3f} {nondraw_mean:>12.3f} {diff:>+10.3f} {p_value:>10.4f} {sig:>5}")
            
            if p_value < 0.05:
                significant_features.append((feat, name, diff, p_value))
    
    print("\n" + "-"*70)
    print("유의미한 피처 (p < 0.05):")
    for feat, name, diff, p in significant_features:
        direction = "무승부 시 더 높음" if diff > 0 else "무승부 시 더 낮음"
        print(f"   ✅ {name}: {direction} (차이: {diff:+.3f})")
    
    return significant_features


def analyze_draw_conditions(df):
    """무승부 발생 조건 분석"""
    print("\n" + "="*70)
    print("📊 [2] 무승부 발생 조건 분석")
    print("="*70)
    
    conditions = [
        # (조건명, 필터, 설명)
        ("폼 차이 < 0.3", df['form_diff_abs'] < 0.3, "양팀 폼이 비슷할 때"),
        ("폼 차이 < 0.5", df['form_diff_abs'] < 0.5, "양팀 폼이 비슷할 때"),
        ("폼 차이 >= 0.5", df['form_diff_abs'] >= 0.5, "양팀 폼 차이 클 때"),
        ("xG 차이 < 0.2", df['xg_diff_abs'] < 0.2, "양팀 xG가 비슷할 때"),
        ("xG 차이 < 0.3", df['xg_diff_abs'] < 0.3, "양팀 xG가 비슷할 때"),
        ("xG 차이 >= 0.3", df['xg_diff_abs'] >= 0.3, "양팀 xG 차이 클 때"),
        ("득점력 차이 < 0.3", df['goals_diff_abs'] < 0.3, "양팀 득점력 비슷"),
        ("득점력 차이 >= 0.5", df['goals_diff_abs'] >= 0.5, "양팀 득점력 차이 큼"),
        ("양팀 득점력 < 2.0", df['total_goals_avg'] < 2.0, "저득점 팀 대결"),
        ("양팀 득점력 2.0-2.5", (df['total_goals_avg'] >= 2.0) & (df['total_goals_avg'] < 2.5), "평균 대결"),
        ("양팀 득점력 >= 2.5", df['total_goals_avg'] >= 2.5, "고득점 팀 대결"),
        ("H2H 무승부 >= 25%", df['h2h_draw_pct'] >= 25, "역대 무승부 많은 매치업"),
        ("H2H 무승부 >= 30%", df['h2h_draw_pct'] >= 30, "역대 무승부 많은 매치업"),
        ("승률 차이 < 10%", df['winrate_diff_abs'] < 0.1, "양팀 승률 비슷"),
        ("승률 차이 < 15%", df['winrate_diff_abs'] < 0.15, "양팀 승률 비슷"),
    ]
    
    print(f"\n{'조건':<25} {'경기수':>8} {'무승부':>8} {'무승부율':>10} {'전체대비':>10}")
    print("-" * 65)
    
    baseline_draw_rate = df['is_draw'].mean() * 100
    print(f"{'전체 (기준선)':<25} {len(df):>8} {df['is_draw'].sum():>8} {baseline_draw_rate:>9.1f}% {'-':>10}")
    print("-" * 65)
    
    good_conditions = []
    
    for name, mask, desc in conditions:
        subset = df[mask]
        if len(subset) >= 100:  # 최소 샘플 수
            draw_rate = subset['is_draw'].mean() * 100
            vs_baseline = draw_rate - baseline_draw_rate
            
            marker = "🔥" if vs_baseline >= 5 else "✅" if vs_baseline >= 2 else ""
            print(f"{name:<25} {len(subset):>8} {subset['is_draw'].sum():>8} {draw_rate:>9.1f}% {vs_baseline:>+9.1f}% {marker}")
            
            if vs_baseline >= 3:
                good_conditions.append((name, draw_rate, vs_baseline, len(subset)))
    
    print("\n" + "-"*70)
    print("무승부 예측에 유용한 조건 (기준선 대비 +3%p 이상):")
    for name, rate, vs_base, count in sorted(good_conditions, key=lambda x: -x[2]):
        print(f"   🔥 {name}: 무승부율 {rate:.1f}% (기준선 대비 {vs_base:+.1f}%p, {count}경기)")
    
    return good_conditions


def analyze_combined_conditions(df):
    """복합 조건 분석"""
    print("\n" + "="*70)
    print("📊 [3] 복합 조건 분석 (여러 조건 결합)")
    print("="*70)
    
    baseline = df['is_draw'].mean() * 100
    
    combined_conditions = [
        ("폼차이<0.3 AND xG차이<0.2", 
         (df['form_diff_abs'] < 0.3) & (df['xg_diff_abs'] < 0.2)),
        
        ("폼차이<0.3 AND 득점력차이<0.3",
         (df['form_diff_abs'] < 0.3) & (df['goals_diff_abs'] < 0.3)),
        
        ("폼차이<0.5 AND xG차이<0.3 AND 승률차이<15%",
         (df['form_diff_abs'] < 0.5) & (df['xg_diff_abs'] < 0.3) & (df['winrate_diff_abs'] < 0.15)),
        
        ("양팀 저득점(<2.0) AND 폼차이<0.5",
         (df['total_goals_avg'] < 2.0) & (df['form_diff_abs'] < 0.5)),
        
        ("H2H무승부>=25% AND 폼차이<0.5",
         (df['h2h_draw_pct'] >= 25) & (df['form_diff_abs'] < 0.5)),
        
        ("폼차이<0.3 AND xG차이<0.3 AND 승률차이<15%",
         (df['form_diff_abs'] < 0.3) & (df['xg_diff_abs'] < 0.3) & (df['winrate_diff_abs'] < 0.15)),
        
        ("박빙 종합: 폼<0.4 AND xG<0.25 AND 득점력<0.3",
         (df['form_diff_abs'] < 0.4) & (df['xg_diff_abs'] < 0.25) & (df['goals_diff_abs'] < 0.3)),
    ]
    
    print(f"\n{'복합 조건':<50} {'경기수':>8} {'무승부율':>10} {'vs기준선':>10}")
    print("-" * 80)
    print(f"{'기준선 (전체)':<50} {len(df):>8} {baseline:>9.1f}% {'-':>10}")
    print("-" * 80)
    
    best_conditions = []
    
    for name, mask in combined_conditions:
        subset = df[mask]
        if len(subset) >= 50:
            draw_rate = subset['is_draw'].mean() * 100
            vs_baseline = draw_rate - baseline
            
            marker = "🔥🔥" if vs_baseline >= 8 else "🔥" if vs_baseline >= 5 else "✅" if vs_baseline >= 3 else ""
            print(f"{name:<50} {len(subset):>8} {draw_rate:>9.1f}% {vs_baseline:>+9.1f}% {marker}")
            
            if vs_baseline >= 5:
                best_conditions.append((name, draw_rate, vs_baseline, len(subset)))
    
    return best_conditions


def analyze_by_league(df):
    """리그별 무승부 비율"""
    print("\n" + "="*70)
    print("📊 [4] 리그별 무승부 비율")
    print("="*70)
    
    print(f"\n{'리그':<25} {'경기수':>8} {'무승부':>8} {'무승부율':>10}")
    print("-" * 55)
    
    for league in sorted(df['league_name'].unique()):
        league_df = df[df['league_name'] == league]
        if len(league_df) >= 100:
            draw_rate = league_df['is_draw'].mean() * 100
            print(f"{league:<25} {len(league_df):>8} {league_df['is_draw'].sum():>8} {draw_rate:>9.1f}%")


def suggest_draw_features(df, significant_features, good_conditions):
    """무승부 예측 특화 피처 제안"""
    print("\n" + "="*70)
    print("💡 [5] 무승부 예측 특화 피처 제안")
    print("="*70)
    
    print("\n[제안 1] 박빙 지표 (Draw Likelihood Score)")
    print("-" * 50)
    print("""
    draw_likelihood = (
        (1 - form_diff_abs / 2) * 0.3 +      # 폼 차이 작을수록 높음
        (1 - xg_diff_abs / 1) * 0.3 +         # xG 차이 작을수록 높음
        (1 - goals_diff_abs / 1.5) * 0.2 +    # 득점력 차이 작을수록 높음
        (h2h_draw_pct / 50) * 0.2             # H2H 무승부율 높을수록 높음
    )
    
    → draw_likelihood > 0.7 이면 무승부 가능성 높음
    """)
    
    # 실제 계산
    df['draw_likelihood'] = (
        (1 - df['form_diff_abs'].clip(upper=2) / 2) * 0.3 +
        (1 - df['xg_diff_abs'].clip(upper=1) / 1) * 0.3 +
        (1 - df['goals_diff_abs'].clip(upper=1.5) / 1.5) * 0.2 +
        (df['h2h_draw_pct'].clip(upper=50) / 50) * 0.2
    )
    
    print("\n[검증] draw_likelihood 구간별 무승부율:")
    baseline = df['is_draw'].mean() * 100
    
    bins = [(0.7, 1.0), (0.6, 0.7), (0.5, 0.6), (0.4, 0.5), (0, 0.4)]
    for low, high in bins:
        mask = (df['draw_likelihood'] >= low) & (df['draw_likelihood'] < high)
        subset = df[mask]
        if len(subset) > 0:
            draw_rate = subset['is_draw'].mean() * 100
            vs_baseline = draw_rate - baseline
            marker = "🔥" if vs_baseline >= 5 else "✅" if vs_baseline >= 2 else ""
            print(f"   {low:.1f}-{high:.1f}: {len(subset):>5}경기, 무승부율 {draw_rate:.1f}% (vs기준 {vs_baseline:+.1f}%) {marker}")
    
    print("\n[제안 2] 이진 플래그")
    print("-" * 50)
    print("""
    is_close_match = (
        form_diff_abs < 0.4 AND
        xg_diff_abs < 0.3 AND
        goals_diff_abs < 0.4
    )
    
    → 박빙 경기 여부 플래그
    """)
    
    df['is_close_match'] = (
        (df['form_diff_abs'] < 0.4) & 
        (df['xg_diff_abs'] < 0.3) & 
        (df['goals_diff_abs'] < 0.4)
    ).astype(int)
    
    close_matches = df[df['is_close_match'] == 1]
    draw_rate = close_matches['is_draw'].mean() * 100
    print(f"\n[검증] 박빙 경기: {len(close_matches)}경기, 무승부율 {draw_rate:.1f}% (기준 {baseline:.1f}%)")


def main():
    print("="*70)
    print("🔬 무승부 경기 특성 분석")
    print("="*70)
    
    # 데이터 로드
    df = get_data()
    
    # 1. 무승부 vs 비무승부 비교
    significant_features = compare_draw_vs_nondraw(df)
    
    # 2. 단일 조건 분석
    good_conditions = analyze_draw_conditions(df)
    
    # 3. 복합 조건 분석
    best_conditions = analyze_combined_conditions(df)
    
    # 4. 리그별 분석
    analyze_by_league(df)
    
    # 5. 피처 제안
    suggest_draw_features(df, significant_features, good_conditions)
    
    print("\n" + "="*70)
    print("✅ 분석 완료!")
    print("="*70)
    print("\n💡 다음 단계:")
    print("   1. 위 분석 결과를 바탕으로 'draw_likelihood' 피처 추가")
    print("   2. V9 모델에서 무승부 예측 로직 개선")
    print("   3. 무승부 임계값 도입 (예: draw_likelihood > 0.7 이면 무승부 고려)")
    print("="*70)


if __name__ == "__main__":
    main()
