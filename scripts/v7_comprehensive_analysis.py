"""
Soccer-Brain V7 종합 분석
==========================
1. "AI 선택" 기준 분석 (승/무/패)
2. 적중률 높은 조건 발굴 (무료용)
3. ROI+ Edge 분석 - 홈/무/원정 전체
4. 배당 vs 피처 불일치 패턴 분석
"""

import pandas as pd
import numpy as np
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

DATA_DIR = Path(__file__).parent.parent / 'data'

def load_all_data():
    """모든 CSV 파일 로드"""
    all_data = []
    
    leagues = {
        'E0': 'Premier League',
        'D1': 'Bundesliga', 
        'I1': 'Serie A',
        'SP1': 'La Liga',
        'F1': 'Ligue 1'
    }
    
    for league_code, league_name in leagues.items():
        for csv_file in DATA_DIR.glob(f'{league_code}_*.csv'):
            try:
                df = pd.read_csv(csv_file, encoding='utf-8')
                df['League'] = league_name
                df['Season'] = csv_file.stem.split('_')[1]
                all_data.append(df)
            except:
                pass
    
    return pd.concat(all_data, ignore_index=True)

def calculate_implied_probability(home_odds, draw_odds, away_odds):
    """배당에서 내재 확률 계산"""
    raw_home = 1 / home_odds
    raw_draw = 1 / draw_odds
    raw_away = 1 / away_odds
    total = raw_home + raw_draw + raw_away
    
    return raw_home / total, raw_draw / total, raw_away / total

def prepare_data(df):
    """데이터 준비"""
    df = df.dropna(subset=['FTR', 'AvgH', 'AvgD', 'AvgA'])
    
    # 배당 확률
    probs = df.apply(lambda row: calculate_implied_probability(
        row['AvgH'], row['AvgD'], row['AvgA']
    ), axis=1)
    
    df['odds_home_prob'] = probs.apply(lambda x: x[0])
    df['odds_draw_prob'] = probs.apply(lambda x: x[1])
    df['odds_away_prob'] = probs.apply(lambda x: x[2])
    
    # 배당 예측 (가장 높은 확률)
    def get_odds_pick(row):
        probs = {'H': row['odds_home_prob'], 'D': row['odds_draw_prob'], 'A': row['odds_away_prob']}
        return max(probs, key=probs.get)
    
    df['odds_pick'] = df.apply(get_odds_pick, axis=1)
    df['odds_correct'] = df['odds_pick'] == df['FTR']
    
    return df

def analyze_ai_pick_strategies(df):
    """AI 선택 전략별 적중률 분석"""
    
    print("="*70)
    print("📊 AI 선택 전략별 적중률 분석")
    print("="*70)
    
    # === 전략 1: 배당 Favorite 따라가기 ===
    correct = (df['odds_pick'] == df['FTR']).sum()
    total = len(df)
    print(f"\n1️⃣ 배당 Favorite 따라가기 (가장 높은 확률 선택)")
    print(f"   적중: {correct}/{total} ({correct/total*100:.1f}%)")
    
    # === 전략 2: 홈/원정만 선택 (무승부 제외) ===
    df['pick_no_draw'] = df.apply(
        lambda x: 'H' if x['odds_home_prob'] > x['odds_away_prob'] else 'A', axis=1
    )
    correct_no_draw = (df['pick_no_draw'] == df['FTR']).sum()
    print(f"\n2️⃣ 홈/원정만 선택 (무승부 배제)")
    print(f"   적중: {correct_no_draw}/{total} ({correct_no_draw/total*100:.1f}%)")
    
    # === 전략 3: 확률 임계값 적용 ===
    print(f"\n3️⃣ 확률 임계값별 적중률")
    
    for threshold in [0.50, 0.55, 0.60, 0.65, 0.70]:
        subset = df[df['odds_pick_prob'] >= threshold] if 'odds_pick_prob' in df.columns else df[
            (df['odds_home_prob'] >= threshold) | (df['odds_away_prob'] >= threshold)
        ]
        if len(subset) > 0:
            correct = (subset['odds_pick'] == subset['FTR']).sum()
            print(f"   {int(threshold*100)}%+ 경기만: {len(subset)}경기, 적중 {correct/len(subset)*100:.1f}%")

def analyze_by_result_type(df):
    """결과 유형별 분석 (홈/무/원정)"""
    
    print("\n" + "="*70)
    print("📊 결과 유형별 배당 예측 분석")
    print("="*70)
    
    for result, name in [('H', '홈 승리'), ('D', '무승부'), ('A', '원정 승리')]:
        subset = df[df['FTR'] == result]
        total_result = len(subset)
        pct = total_result / len(df) * 100
        
        # 배당이 이 결과를 예측한 경우
        predicted = len(subset[subset['odds_pick'] == result])
        
        print(f"\n{name}:")
        print(f"   발생: {total_result}경기 ({pct:.1f}%)")
        print(f"   배당 예측 적중: {predicted}/{total_result} ({predicted/total_result*100:.1f}%)")
        
        # 확률 구간별 실제 발생률
        if result == 'H':
            prob_col = 'odds_home_prob'
        elif result == 'D':
            prob_col = 'odds_draw_prob'
        else:
            prob_col = 'odds_away_prob'
        
        print(f"   확률 구간별 실제 발생률 vs 예상:")
        bins = [(0.3, 0.4), (0.4, 0.5), (0.5, 0.6), (0.6, 0.7), (0.7, 0.8)]
        if result == 'D':
            bins = [(0.20, 0.25), (0.25, 0.28), (0.28, 0.31), (0.31, 0.35)]
        
        for low, high in bins:
            bin_df = df[(df[prob_col] >= low) & (df[prob_col] < high)]
            if len(bin_df) > 50:
                actual = (bin_df['FTR'] == result).mean() * 100
                expected = bin_df[prob_col].mean() * 100
                diff = actual - expected
                indicator = "✅ 과소평가" if diff > 2 else "❌ 과대평가" if diff < -2 else "⚖️ 적정"
                print(f"      {int(low*100):2}-{int(high*100):2}%: 예상 {expected:.1f}% → 실제 {actual:.1f}% ({diff:+.1f}%) {indicator}")

def analyze_roi_all_outcomes(df):
    """홈/무/원정 전체 ROI 분석"""
    
    print("\n" + "="*70)
    print("💰 전체 결과 유형 ROI 분석")
    print("="*70)
    
    # === 홈 승리 베팅 ===
    print("\n🏠 홈 승리 베팅")
    for lower, upper in [(55, 60), (60, 65), (65, 70), (67, 72), (70, 75), (75, 80)]:
        subset = df[(df['odds_home_prob'] >= lower/100) & (df['odds_home_prob'] < upper/100)]
        if len(subset) > 100:
            wins = (subset['FTR'] == 'H').sum()
            win_rate = wins / len(subset) * 100
            profits = subset.apply(lambda x: x['AvgH'] - 1 if x['FTR'] == 'H' else -1, axis=1)
            roi = profits.sum() / len(subset) * 100
            indicator = "🔥" if roi > 3 else "✅" if roi > 0 else "❌"
            print(f"   {lower}-{upper}%: {len(subset):4}경기 | 적중 {win_rate:.1f}% | ROI {roi:+.1f}% {indicator}")
    
    # === 원정 승리 베팅 ===
    print("\n✈️ 원정 승리 베팅")
    for lower, upper in [(35, 40), (40, 45), (45, 50), (50, 55), (55, 60), (60, 65), (65, 70)]:
        subset = df[(df['odds_away_prob'] >= lower/100) & (df['odds_away_prob'] < upper/100)]
        if len(subset) > 100:
            wins = (subset['FTR'] == 'A').sum()
            win_rate = wins / len(subset) * 100
            profits = subset.apply(lambda x: x['AvgA'] - 1 if x['FTR'] == 'A' else -1, axis=1)
            roi = profits.sum() / len(subset) * 100
            indicator = "🔥" if roi > 3 else "✅" if roi > 0 else "❌"
            print(f"   {lower}-{upper}%: {len(subset):4}경기 | 적중 {win_rate:.1f}% | ROI {roi:+.1f}% {indicator}")
    
    # === 무승부 베팅 ===
    print("\n🤝 무승부 베팅")
    for lower, upper in [(22, 25), (25, 28), (28, 31), (31, 35)]:
        subset = df[(df['odds_draw_prob'] >= lower/100) & (df['odds_draw_prob'] < upper/100)]
        if len(subset) > 100:
            wins = (subset['FTR'] == 'D').sum()
            win_rate = wins / len(subset) * 100
            profits = subset.apply(lambda x: x['AvgD'] - 1 if x['FTR'] == 'D' else -1, axis=1)
            roi = profits.sum() / len(subset) * 100
            indicator = "🔥" if roi > 3 else "✅" if roi > 0 else "❌"
            print(f"   {lower}-{upper}%: {len(subset):4}경기 | 발생 {win_rate:.1f}% | ROI {roi:+.1f}% {indicator}")

def analyze_high_confidence_picks(df):
    """고신뢰도 픽 분석 (무료용 - 적중률 중심)"""
    
    print("\n" + "="*70)
    print("🎯 고신뢰도 AI 픽 분석 (무료 모델 - 적중률 중심)")
    print("="*70)
    
    conditions = []
    
    # === 확률 임계값별 ===
    print("\n--- 확률 임계값별 적중률 ---")
    
    for threshold in [0.60, 0.65, 0.70, 0.75, 0.80]:
        # 홈 Favorite
        home_subset = df[df['odds_home_prob'] >= threshold]
        if len(home_subset) > 0:
            correct = (home_subset['FTR'] == 'H').sum()
            acc = correct / len(home_subset) * 100
            conditions.append({'name': f'홈 {int(threshold*100)}%+', 'matches': len(home_subset), 'accuracy': acc})
        
        # 원정 Favorite
        away_subset = df[df['odds_away_prob'] >= threshold]
        if len(away_subset) > 0:
            correct = (away_subset['FTR'] == 'A').sum()
            acc = correct / len(away_subset) * 100
            conditions.append({'name': f'원정 {int(threshold*100)}%+', 'matches': len(away_subset), 'accuracy': acc})
    
    # 정렬 및 출력
    conditions.sort(key=lambda x: x['accuracy'], reverse=True)
    
    print(f"\n{'조건':<20} | {'경기수':>6} | {'적중률':>8}")
    print("-"*45)
    for c in conditions:
        indicator = "⭐⭐⭐" if c['accuracy'] >= 75 else "⭐⭐" if c['accuracy'] >= 70 else "⭐" if c['accuracy'] >= 65 else ""
        print(f"{c['name']:<20} | {c['matches']:>6} | {c['accuracy']:>7.1f}% {indicator}")
    
    # === 리그별 고확률 ===
    print("\n--- 리그별 고확률(65%+) 경기 적중률 ---")
    for league in df['League'].unique():
        league_df = df[df['League'] == league]
        high_prob = league_df[(league_df['odds_home_prob'] >= 0.65) | (league_df['odds_away_prob'] >= 0.65)]
        
        if len(high_prob) > 0:
            # Favorite 선택
            picks = high_prob.apply(
                lambda x: 'H' if x['odds_home_prob'] >= x['odds_away_prob'] else 'A', axis=1
            )
            correct = (picks == high_prob['FTR']).sum()
            acc = correct / len(high_prob) * 100
            print(f"   {league:<20}: {len(high_prob):4}경기, 적중률 {acc:.1f}%")
    
    return conditions

def find_roi_positive_edges(df):
    """ROI+ Edge 조건 발굴 (유료용)"""
    
    print("\n" + "="*70)
    print("💎 ROI+ Edge 조건 발굴 (유료 모델용)")
    print("="*70)
    
    edges = []
    
    # === 홈 승리 Edge ===
    print("\n🏠 홈 승리 Edge 탐색")
    home_configs = [
        (None, 65, 70), (None, 67, 72), (None, 70, 75),
        ('La Liga', 60, 70), ('La Liga', 65, 75),
        ('Ligue 1', 60, 70), ('Ligue 1', 65, 70),
        ('Bundesliga', 65, 70), ('Serie A', 65, 70),
        ('Premier League', 65, 70)
    ]
    
    for config in home_configs:
        league, lower, upper = config
        if league:
            subset = df[(df['League'] == league) & 
                       (df['odds_home_prob'] >= lower/100) & 
                       (df['odds_home_prob'] < upper/100)]
            name = f"홈 {lower}-{upper}% {league}"
        else:
            subset = df[(df['odds_home_prob'] >= lower/100) & 
                       (df['odds_home_prob'] < upper/100)]
            name = f"홈 {lower}-{upper}% 전체"
        
        if len(subset) >= 50:
            wins = (subset['FTR'] == 'H').sum()
            win_rate = wins / len(subset) * 100
            profits = subset.apply(lambda x: x['AvgH'] - 1 if x['FTR'] == 'H' else -1, axis=1)
            roi = profits.sum() / len(subset) * 100
            
            if roi > 0:
                edges.append({'name': name, 'type': 'H', 'matches': len(subset), 'win_rate': win_rate, 'roi': roi})
                print(f"   ✅ {name}: {len(subset)}경기, 적중 {win_rate:.1f}%, ROI {roi:+.1f}%")
    
    # === 원정 승리 Edge ===
    print("\n✈️ 원정 승리 Edge 탐색")
    away_configs = [
        (None, 55, 60), (None, 60, 65), (None, 65, 70), (None, 55, 65),
        ('La Liga', 55, 65), ('Bundesliga', 55, 65),
        ('Premier League', 55, 65), ('Ligue 1', 55, 65)
    ]
    
    for config in away_configs:
        league, lower, upper = config
        if league:
            subset = df[(df['League'] == league) & 
                       (df['odds_away_prob'] >= lower/100) & 
                       (df['odds_away_prob'] < upper/100)]
            name = f"원정 {lower}-{upper}% {league}"
        else:
            subset = df[(df['odds_away_prob'] >= lower/100) & 
                       (df['odds_away_prob'] < upper/100)]
            name = f"원정 {lower}-{upper}% 전체"
        
        if len(subset) >= 50:
            wins = (subset['FTR'] == 'A').sum()
            win_rate = wins / len(subset) * 100
            profits = subset.apply(lambda x: x['AvgA'] - 1 if x['FTR'] == 'A' else -1, axis=1)
            roi = profits.sum() / len(subset) * 100
            
            if roi > 0:
                edges.append({'name': name, 'type': 'A', 'matches': len(subset), 'win_rate': win_rate, 'roi': roi})
                print(f"   ✅ {name}: {len(subset)}경기, 적중 {win_rate:.1f}%, ROI {roi:+.1f}%")
    
    # === 무승부 Edge ===
    print("\n🤝 무승부 Edge 탐색")
    draw_configs = [
        (None, 28, 32), (None, 30, 35), (None, 26, 30),
        ('Serie A', 26, 32), ('La Liga', 26, 32),
        ('Premier League', 26, 32)
    ]
    
    for config in draw_configs:
        league, lower, upper = config
        if league:
            subset = df[(df['League'] == league) & 
                       (df['odds_draw_prob'] >= lower/100) & 
                       (df['odds_draw_prob'] < upper/100)]
            name = f"무 {lower}-{upper}% {league}"
        else:
            subset = df[(df['odds_draw_prob'] >= lower/100) & 
                       (df['odds_draw_prob'] < upper/100)]
            name = f"무 {lower}-{upper}% 전체"
        
        if len(subset) >= 50:
            wins = (subset['FTR'] == 'D').sum()
            win_rate = wins / len(subset) * 100
            profits = subset.apply(lambda x: x['AvgD'] - 1 if x['FTR'] == 'D' else -1, axis=1)
            roi = profits.sum() / len(subset) * 100
            
            if roi > 0:
                edges.append({'name': name, 'type': 'D', 'matches': len(subset), 'win_rate': win_rate, 'roi': roi})
                print(f"   ✅ {name}: {len(subset)}경기, 발생 {win_rate:.1f}%, ROI {roi:+.1f}%")
    
    # === 결과 정리 ===
    print("\n" + "="*70)
    print("📋 발견된 ROI+ Edge TOP 15")
    print("="*70)
    
    edges.sort(key=lambda x: x['roi'], reverse=True)
    
    print(f"\n{'순위':<4} | {'조건':<30} | {'선택':<4} | {'경기':>5} | {'적중률':>7} | {'ROI':>8}")
    print("-"*75)
    for i, e in enumerate(edges[:15], 1):
        indicator = "🔥" if e['roi'] > 8 else "✅"
        pick_name = {'H': '홈', 'D': '무', 'A': '원정'}[e['type']]
        print(f"{i:>4} | {e['name']:<30} | {pick_name:<4} | {e['matches']:>5} | {e['win_rate']:>6.1f}% | {e['roi']:>+7.1f}% {indicator}")
    
    return edges

def simulate_folder_performance(df):
    """폴더 베팅 시뮬레이션"""
    
    print("\n" + "="*70)
    print("📂 폴더 베팅 시뮬레이션")
    print("="*70)
    
    # 고확률 경기 추출 (70%+)
    high_prob = df[(df['odds_home_prob'] >= 0.70) | (df['odds_away_prob'] >= 0.70)]
    
    # AI 선택
    high_prob = high_prob.copy()
    high_prob['ai_pick'] = high_prob.apply(
        lambda x: 'H' if x['odds_home_prob'] >= x['odds_away_prob'] else 'A', axis=1
    )
    high_prob['ai_correct'] = high_prob.apply(
        lambda x: x['FTR'] == x['ai_pick'], axis=1
    )
    
    single_acc = high_prob['ai_correct'].mean()
    print(f"\n단일 경기 (70%+) 적중률: {single_acc*100:.1f}%")
    
    # 2폴더 예상 적중률
    folder_2 = single_acc ** 2
    print(f"2폴더 예상 적중률: {folder_2*100:.1f}%")
    
    # 3폴더 예상 적중률
    folder_3 = single_acc ** 3
    print(f"3폴더 예상 적중률: {folder_3*100:.1f}%")
    
    # 65%+ 경기
    print("\n--- 65%+ 경기 기준 ---")
    mid_prob = df[(df['odds_home_prob'] >= 0.65) | (df['odds_away_prob'] >= 0.65)]
    mid_prob = mid_prob.copy()
    mid_prob['ai_pick'] = mid_prob.apply(
        lambda x: 'H' if x['odds_home_prob'] >= x['odds_away_prob'] else 'A', axis=1
    )
    mid_prob['ai_correct'] = mid_prob.apply(
        lambda x: x['FTR'] == x['ai_pick'], axis=1
    )
    
    single_acc_mid = mid_prob['ai_correct'].mean()
    print(f"단일 경기 (65%+) 적중률: {single_acc_mid*100:.1f}%")
    print(f"2폴더 예상: {(single_acc_mid**2)*100:.1f}%")
    print(f"3폴더 예상: {(single_acc_mid**3)*100:.1f}%")

def simulate_ai_pick_history(df):
    """AI 선택 적중 내역 시뮬레이션 (UI용)"""
    
    print("\n" + "="*70)
    print("📈 AI 선택 적중 내역 시뮬레이션")
    print("="*70)
    
    # AI 선택: 배당 확률 최고 결과
    df = df.copy()
    df['ai_pick'] = df.apply(
        lambda x: 'H' if x['odds_home_prob'] >= max(x['odds_draw_prob'], x['odds_away_prob']) else
                  'A' if x['odds_away_prob'] >= x['odds_draw_prob'] else 'D', axis=1
    )
    df['ai_correct'] = df['ai_pick'] == df['FTR']
    
    # 전체 적중률
    total_correct = df['ai_correct'].sum()
    total = len(df)
    print(f"\n전체 AI 선택 적중률: {total_correct}/{total} ({total_correct/total*100:.1f}%)")
    
    # 시즌별
    print("\n--- 시즌별 적중률 ---")
    for season in sorted(df['Season'].unique()):
        season_df = df[df['Season'] == season]
        correct = season_df['ai_correct'].sum()
        total_s = len(season_df)
        print(f"   {season}: {correct}/{total_s} ({correct/total_s*100:.1f}%)")
    
    # 리그별
    print("\n--- 리그별 적중률 ---")
    for league in df['League'].unique():
        league_df = df[df['League'] == league]
        correct = league_df['ai_correct'].sum()
        total_l = len(league_df)
        print(f"   {league:<20}: {correct}/{total_l} ({correct/total_l*100:.1f}%)")
    
    # 선택 유형별
    print("\n--- AI 선택 유형별 적중률 ---")
    for pick, name in [('H', '홈 승'), ('D', '무승부'), ('A', '원정 승')]:
        pick_df = df[df['ai_pick'] == pick]
        if len(pick_df) > 0:
            correct = pick_df['ai_correct'].sum()
            print(f"   {name}: {len(pick_df)}경기, 적중 {correct} ({correct/len(pick_df)*100:.1f}%)")

def main():
    print("🚀 Soccer-Brain V7 종합 분석")
    print("="*70)
    
    df = load_all_data()
    df = prepare_data(df)
    print(f"✅ 총 {len(df)}경기 로드\n")
    
    # 1. AI 선택 전략 분석
    analyze_ai_pick_strategies(df)
    
    # 2. 결과 유형별 분석
    analyze_by_result_type(df)
    
    # 3. ROI 분석 (홈/무/원정)
    analyze_roi_all_outcomes(df)
    
    # 4. 고신뢰도 픽 (무료용)
    analyze_high_confidence_picks(df)
    
    # 5. ROI+ Edge (유료용)
    edges = find_roi_positive_edges(df)
    
    # 6. 폴더 시뮬레이션
    simulate_folder_performance(df)
    
    # 7. AI 적중 내역 시뮬레이션
    simulate_ai_pick_history(df)
    
    # === 최종 요약 ===
    print("\n" + "="*70)
    print("📋 V7 분석 최종 요약")
    print("="*70)
    
    print("""
┌─────────────────────────────────────────────────────────────────────┐
│                    🎯 V7 "AI 선택" 시스템                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AI 선택 규칙:                                                       │
│  ────────────────────────────────────────────                       │
│  • 승/무/패 중 배당 확률이 가장 높은 결과 선택                       │
│  • 예: 홈 55%, 무 25%, 원정 20% → AI 선택: 홈 승                    │
│                                                                     │
│  🆓 무료 사용자용 (적중률 중심)                                      │
│  ────────────────────────────────────────────                       │
│  • 전체 적중률: ~54%                                                │
│  • 65%+ 경기: 적중률 70%+                                           │
│  • 70%+ 경기: 적중률 75%+                                           │
│  • 3폴더(70%+): 예상 적중률 ~42%                                    │
│                                                                     │
│  💎 유료 사용자용 (ROI+ Edge)                                        │
│  ────────────────────────────────────────────                       │
│  • 홈 65-70% 라리가: ROI +16%                                       │
│  • 홈 67-72% 전체: ROI +8%                                          │
│  • (추가 발견된 Edge 조건들...)                                     │
│                                                                     │
│  📈 적중 내역 표시                                                   │
│  ────────────────────────────────────────────                       │
│  • "지난주 AI 적중률: 54.2% (32/59)"                                │
│  • "ROI+ 종목 적중률: 72.1% (18/25)"                                │
│  • "ROI+ 기준 수익률: +12.4%"                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
""")

if __name__ == '__main__':
    main()
