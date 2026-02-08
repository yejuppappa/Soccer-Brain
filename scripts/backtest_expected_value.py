"""
Soccer-Brain 기대값 백테스트 (개선판)
======================================
- 시간순 분리: 학습(70%) / 테스트(30%)
- 확률 필터 추가: 기대값 + 확률 조건 모두 충족해야 베팅

사용법:
  python scripts/backtest_expected_value.py
"""

import os
import sys
import json
from datetime import datetime
from decimal import Decimal

import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.preprocessing import LabelEncoder

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def get_all_data():
    """전체 데이터 (Features + Odds) 가져오기"""
    print("📊 데이터 로딩 중...")
    
    conn = psycopg2.connect(DATABASE_URL)
    
    query = """
    SELECT 
        f.id,
        f."fixtureId",
        f."kickoffAt",
        f."homeGoals",
        f."awayGoals",
        
        -- Features
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
        
        f."shotsTotal_diff",
        f."shotsOnTarget_diff",
        f."possessionPct_diff",
        f."xg_diff",
        f."goalsFor_diff",
        f."goalsAgainst_diff",
        
        f."homeInjuryCount",
        f."awayInjuryCount",
        
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
        
        -- V3: 득점력/수비력 차이
        f."attack_diff",
        f."defense_diff",
        
        -- V4: 경기 텀/피로
        f."home_days_rest",
        f."away_days_rest",
        f."rest_diff",
        f."home_matches_14d",
        f."away_matches_14d",
        f."congestion_diff",
        f."home_european_7d",
        f."away_european_7d",
        f."european_diff",
        
        -- V5: 상대전적 (H2H)
        f."h2h_total_matches",
        f."h2h_home_wins",
        f."h2h_away_wins",
        f."h2h_draws",
        f."h2h_home_goals_avg",
        f."h2h_away_goals_avg",
        f."h2h_home_win_pct",
        
        -- Odds
        o."home" as odds_home,
        o."draw" as odds_draw,
        o."away" as odds_away
        
    FROM "FixtureFeatureSnapshot" f
    JOIN "FixtureOdds" o ON f."fixtureId" = o."fixtureId"
    WHERE f."homeGoals" IS NOT NULL 
      AND f."awayGoals" IS NOT NULL
      AND f."featureVersion" = 5
      AND o."home" IS NOT NULL
    ORDER BY f."kickoffAt"
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    print(f"✅ {len(df)} 경기 데이터 로드 (Features + Odds)")
    return df


def create_target(df):
    """실제 결과 라벨 생성"""
    def get_result(row):
        if row['homeGoals'] > row['awayGoals']:
            return 'home_win'
        elif row['homeGoals'] < row['awayGoals']:
            return 'away_win'
        else:
            return 'draw'
    
    df['actual_result'] = df.apply(get_result, axis=1)
    return df


def prepare_features(df):
    """피처 준비"""
    feature_cols = [
        'home_shotsTotal_avg', 'home_shotsOnTarget_avg', 'home_possessionPct_avg',
        'home_passAccuracyPct_avg', 'home_corners_avg', 'home_xg_avg',
        'home_goalsFor_avg', 'home_goalsAgainst_avg',
        'away_shotsTotal_avg', 'away_shotsOnTarget_avg', 'away_possessionPct_avg',
        'away_passAccuracyPct_avg', 'away_corners_avg', 'away_xg_avg',
        'away_goalsFor_avg', 'away_goalsAgainst_avg',
        'shotsTotal_diff', 'shotsOnTarget_diff', 'possessionPct_diff',
        'xg_diff', 'goalsFor_diff', 'goalsAgainst_diff',
        'homeInjuryCount', 'awayInjuryCount',
        # V3: 홈/원정 분리
        'home_goalsFor_atHome_avg', 'home_goalsAgainst_atHome_avg',
        'home_xg_atHome_avg', 'home_wins_atHome_pct',
        'away_goalsFor_atAway_avg', 'away_goalsAgainst_atAway_avg',
        'away_xg_atAway_avg', 'away_wins_atAway_pct',
        # V3: 폼
        'home_form_last3', 'home_form_last5',
        'away_form_last3', 'away_form_last5',
        # V3: 득점력/수비력 차이
        'attack_diff', 'defense_diff',
        # V4: 경기 텀/피로
        'home_days_rest', 'away_days_rest', 'rest_diff',
        'home_matches_14d', 'away_matches_14d', 'congestion_diff',
        'home_european_7d', 'away_european_7d', 'european_diff',
        # V5: 상대전적 (H2H)
        'h2h_total_matches', 'h2h_home_wins', 'h2h_away_wins', 'h2h_draws',
        'h2h_home_goals_avg', 'h2h_away_goals_avg', 'h2h_home_win_pct',
    ]
    
    available_cols = [col for col in feature_cols if col in df.columns]
    X = df[available_cols].copy()
    X = X.fillna(X.mean())
    X = X.fillna(0)
    return X, available_cols


def calculate_expected_value(prob, odds):
    """기대값 계산: (확률 × 배당) - 1"""
    return (prob * float(odds)) - 1


def run_backtest(df_train, df_test, feature_cols):
    """백테스트 실행"""
    
    print("\n" + "="*60)
    print("🎯 기대값 백테스트 (개선판 - 확률 필터 추가)")
    print("="*60)
    
    # ============================================
    # 1. 학습
    # ============================================
    print(f"\n📚 학습 데이터: {len(df_train)}경기")
    print(f"📊 테스트 데이터: {len(df_test)}경기 (모델이 못 본 데이터)")
    
    X_train, _ = prepare_features(df_train)
    y_train = df_train['actual_result']
    
    # 라벨 인코딩
    le = LabelEncoder()
    y_train_encoded = le.fit_transform(y_train)
    
    print(f"\n🏷️ 클래스: {le.classes_}")
    
    # XGBoost 모델 학습
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric='mlogloss'
    )
    
    print("\n🚀 모델 학습 중...")
    model.fit(X_train, y_train_encoded)
    
    # ============================================
    # 2. 테스트 데이터 예측
    # ============================================
    X_test, _ = prepare_features(df_test)
    
    # 예측 확률
    proba = model.predict_proba(X_test)
    classes = le.classes_.tolist()  # ['away_win', 'draw', 'home_win']
    
    # 클래스 인덱스 찾기
    home_idx = classes.index('home_win')
    draw_idx = classes.index('draw')
    away_idx = classes.index('away_win')
    
    # 테스트 데이터에 확률 추가
    df_test = df_test.copy()
    df_test['prob_home'] = proba[:, home_idx]
    df_test['prob_draw'] = proba[:, draw_idx]
    df_test['prob_away'] = proba[:, away_idx]
    
    # 기대값 계산
    df_test['ev_home'] = df_test.apply(lambda r: calculate_expected_value(r['prob_home'], r['odds_home']), axis=1)
    df_test['ev_draw'] = df_test.apply(lambda r: calculate_expected_value(r['prob_draw'], r['odds_draw']), axis=1)
    df_test['ev_away'] = df_test.apply(lambda r: calculate_expected_value(r['prob_away'], r['odds_away']), axis=1)
    
    # 최고 확률 선택 (기존 방식)
    df_test['max_prob'] = df_test[['prob_home', 'prob_draw', 'prob_away']].max(axis=1)
    df_test['max_prob_pick'] = df_test.apply(lambda r:
        'home_win' if r['prob_home'] == r['max_prob'] else
        ('draw' if r['prob_draw'] == r['max_prob'] else 'away_win'), axis=1)
    df_test['max_prob_odds'] = df_test.apply(lambda r:
        float(r['odds_home']) if r['max_prob_pick'] == 'home_win' else
        (float(r['odds_draw']) if r['max_prob_pick'] == 'draw' else float(r['odds_away'])), axis=1)
    df_test['max_prob_ev'] = df_test.apply(lambda r:
        r['ev_home'] if r['max_prob_pick'] == 'home_win' else
        (r['ev_draw'] if r['max_prob_pick'] == 'draw' else r['ev_away']), axis=1)
    
    # ============================================
    # 3. 전략별 시뮬레이션
    # ============================================
    
    BET_AMOUNT = 10000  # 1만원씩 베팅
    
    results = []
    
    # 전략 1: 가장 높은 확률에 베팅 (기준선)
    print("\n📊 전략 1: 가장 높은 확률에 베팅 (기준선)")
    wins_1 = (df_test['max_prob_pick'] == df_test['actual_result']).sum()
    total_1 = len(df_test)
    profit_1 = sum(
        BET_AMOUNT * (row['max_prob_odds'] - 1) if row['max_prob_pick'] == row['actual_result'] 
        else -BET_AMOUNT 
        for _, row in df_test.iterrows()
    )
    roi_1 = profit_1 / (total_1 * BET_AMOUNT) * 100
    
    print(f"   베팅 수: {total_1}")
    print(f"   적중: {wins_1} ({wins_1/total_1*100:.1f}%)")
    print(f"   수익: {profit_1:,.0f}원 (ROI: {roi_1:.1f}%)")
    results.append(('높은 확률 베팅', total_1, wins_1, profit_1, roi_1))
    
    # 전략 2: 무승부 제외, 홈/원정만 베팅
    print("\n📊 전략 2: 무승부 제외 (홈/원정만) ⭐")
    no_draw = df_test[df_test['max_prob_pick'] != 'draw']
    if len(no_draw) > 0:
        wins_2 = (no_draw['max_prob_pick'] == no_draw['actual_result']).sum()
        total_2 = len(no_draw)
        profit_2 = sum(
            BET_AMOUNT * (row['max_prob_odds'] - 1) if row['max_prob_pick'] == row['actual_result'] 
            else -BET_AMOUNT 
            for _, row in no_draw.iterrows()
        )
        roi_2 = profit_2 / (total_2 * BET_AMOUNT) * 100
    else:
        wins_2, total_2, profit_2, roi_2 = 0, 0, 0, 0
    
    print(f"   베팅 수: {total_2} (전체의 {total_2/total_1*100:.1f}%)")
    print(f"   적중: {wins_2} ({wins_2/total_2*100:.1f}%)" if total_2 > 0 else "   적중: 0")
    print(f"   수익: {profit_2:,.0f}원 (ROI: {roi_2:.1f}%)")
    results.append(('무승부 제외', total_2, wins_2, profit_2, roi_2))
    
    # 전략 3: 확률 > 45% + 기대값 > 0
    print("\n📊 전략 3: 확률 > 45% AND 기대값 > 0 ⭐⭐")
    filter_3 = df_test[(df_test['max_prob'] > 0.45) & (df_test['max_prob_ev'] > 0)]
    if len(filter_3) > 0:
        wins_3 = (filter_3['max_prob_pick'] == filter_3['actual_result']).sum()
        total_3 = len(filter_3)
        profit_3 = sum(
            BET_AMOUNT * (row['max_prob_odds'] - 1) if row['max_prob_pick'] == row['actual_result'] 
            else -BET_AMOUNT 
            for _, row in filter_3.iterrows()
        )
        roi_3 = profit_3 / (total_3 * BET_AMOUNT) * 100
    else:
        wins_3, total_3, profit_3, roi_3 = 0, 0, 0, 0
    
    print(f"   베팅 수: {total_3} (전체의 {total_3/total_1*100:.1f}%)")
    print(f"   적중: {wins_3} ({wins_3/total_3*100:.1f}%)" if total_3 > 0 else "   적중: 0")
    print(f"   수익: {profit_3:,.0f}원 (ROI: {roi_3:.1f}%)")
    results.append(('확률>45% & EV>0', total_3, wins_3, profit_3, roi_3))
    
    # 전략 4: 확률 > 50% + 기대값 > 0
    print("\n📊 전략 4: 확률 > 50% AND 기대값 > 0 ⭐⭐⭐")
    filter_4 = df_test[(df_test['max_prob'] > 0.50) & (df_test['max_prob_ev'] > 0)]
    if len(filter_4) > 0:
        wins_4 = (filter_4['max_prob_pick'] == filter_4['actual_result']).sum()
        total_4 = len(filter_4)
        profit_4 = sum(
            BET_AMOUNT * (row['max_prob_odds'] - 1) if row['max_prob_pick'] == row['actual_result'] 
            else -BET_AMOUNT 
            for _, row in filter_4.iterrows()
        )
        roi_4 = profit_4 / (total_4 * BET_AMOUNT) * 100
    else:
        wins_4, total_4, profit_4, roi_4 = 0, 0, 0, 0
    
    print(f"   베팅 수: {total_4} (전체의 {total_4/total_1*100:.1f}%)")
    print(f"   적중: {wins_4} ({wins_4/total_4*100:.1f}%)" if total_4 > 0 else "   적중: 0")
    print(f"   수익: {profit_4:,.0f}원 (ROI: {roi_4:.1f}%)")
    results.append(('확률>50% & EV>0', total_4, wins_4, profit_4, roi_4))
    
    # 전략 5: 확률 > 50% + 기대값 > 5% + 무승부 제외
    print("\n📊 전략 5: 확률 > 50% AND 기대값 > 5% AND 무승부 제외 ⭐⭐⭐⭐")
    filter_5 = df_test[
        (df_test['max_prob'] > 0.50) & 
        (df_test['max_prob_ev'] > 0.05) & 
        (df_test['max_prob_pick'] != 'draw')
    ]
    if len(filter_5) > 0:
        wins_5 = (filter_5['max_prob_pick'] == filter_5['actual_result']).sum()
        total_5 = len(filter_5)
        profit_5 = sum(
            BET_AMOUNT * (row['max_prob_odds'] - 1) if row['max_prob_pick'] == row['actual_result'] 
            else -BET_AMOUNT 
            for _, row in filter_5.iterrows()
        )
        roi_5 = profit_5 / (total_5 * BET_AMOUNT) * 100
    else:
        wins_5, total_5, profit_5, roi_5 = 0, 0, 0, 0
    
    print(f"   베팅 수: {total_5} (전체의 {total_5/total_1*100:.1f}%)")
    print(f"   적중: {wins_5} ({wins_5/total_5*100:.1f}%)" if total_5 > 0 else "   적중: 0")
    print(f"   수익: {profit_5:,.0f}원 (ROI: {roi_5:.1f}%)")
    results.append(('확률>50% & EV>5% & 무승부X', total_5, wins_5, profit_5, roi_5))
    
    # 전략 6: 확률 > 55% + 기대값 > 0 + 무승부 제외
    print("\n📊 전략 6: 확률 > 55% AND 기대값 > 0 AND 무승부 제외 ⭐⭐⭐⭐⭐")
    filter_6 = df_test[
        (df_test['max_prob'] > 0.55) & 
        (df_test['max_prob_ev'] > 0) & 
        (df_test['max_prob_pick'] != 'draw')
    ]
    if len(filter_6) > 0:
        wins_6 = (filter_6['max_prob_pick'] == filter_6['actual_result']).sum()
        total_6 = len(filter_6)
        profit_6 = sum(
            BET_AMOUNT * (row['max_prob_odds'] - 1) if row['max_prob_pick'] == row['actual_result'] 
            else -BET_AMOUNT 
            for _, row in filter_6.iterrows()
        )
        roi_6 = profit_6 / (total_6 * BET_AMOUNT) * 100
    else:
        wins_6, total_6, profit_6, roi_6 = 0, 0, 0, 0
    
    print(f"   베팅 수: {total_6} (전체의 {total_6/total_1*100:.1f}%)")
    print(f"   적중: {wins_6} ({wins_6/total_6*100:.1f}%)" if total_6 > 0 else "   적중: 0")
    print(f"   수익: {profit_6:,.0f}원 (ROI: {roi_6:.1f}%)")
    results.append(('확률>55% & EV>0 & 무승부X', total_6, wins_6, profit_6, roi_6))
    
    # 전략 7: 홈팀만 (홈 어드밴티지)
    print("\n📊 전략 7: 홈팀 확률 > 50% AND 기대값 > 0")
    filter_7 = df_test[
        (df_test['prob_home'] > 0.50) & 
        (df_test['ev_home'] > 0)
    ]
    if len(filter_7) > 0:
        wins_7 = (filter_7['actual_result'] == 'home_win').sum()
        total_7 = len(filter_7)
        profit_7 = sum(
            BET_AMOUNT * (float(row['odds_home']) - 1) if row['actual_result'] == 'home_win' 
            else -BET_AMOUNT 
            for _, row in filter_7.iterrows()
        )
        roi_7 = profit_7 / (total_7 * BET_AMOUNT) * 100
    else:
        wins_7, total_7, profit_7, roi_7 = 0, 0, 0, 0
    
    print(f"   베팅 수: {total_7} (전체의 {total_7/total_1*100:.1f}%)")
    print(f"   적중: {wins_7} ({wins_7/total_7*100:.1f}%)" if total_7 > 0 else "   적중: 0")
    print(f"   수익: {profit_7:,.0f}원 (ROI: {roi_7:.1f}%)")
    results.append(('홈팀>50% & EV>0', total_7, wins_7, profit_7, roi_7))
    
    # 전략 8: 강팀만 (확률 > 60%)
    print("\n📊 전략 8: 확률 > 60% (강팀만)")
    filter_8 = df_test[df_test['max_prob'] > 0.60]
    if len(filter_8) > 0:
        wins_8 = (filter_8['max_prob_pick'] == filter_8['actual_result']).sum()
        total_8 = len(filter_8)
        profit_8 = sum(
            BET_AMOUNT * (row['max_prob_odds'] - 1) if row['max_prob_pick'] == row['actual_result'] 
            else -BET_AMOUNT 
            for _, row in filter_8.iterrows()
        )
        roi_8 = profit_8 / (total_8 * BET_AMOUNT) * 100
    else:
        wins_8, total_8, profit_8, roi_8 = 0, 0, 0, 0
    
    print(f"   베팅 수: {total_8} (전체의 {total_8/total_1*100:.1f}%)")
    print(f"   적중: {wins_8} ({wins_8/total_8*100:.1f}%)" if total_8 > 0 else "   적중: 0")
    print(f"   수익: {profit_8:,.0f}원 (ROI: {roi_8:.1f}%)")
    results.append(('확률>60% (강팀)', total_8, wins_8, profit_8, roi_8))
    
    # ============================================
    # 최종 요약
    # ============================================
    
    print("\n" + "="*70)
    print("📊 전략별 결과 요약")
    print("="*70)
    print(f"{'전략':<30} {'베팅수':>8} {'적중률':>10} {'수익':>15} {'ROI':>10}")
    print("-"*70)
    for name, total, wins, profit, roi in results:
        win_rate = f"{wins/total*100:.1f}%" if total > 0 else "N/A"
        print(f"{name:<30} {total:>8} {win_rate:>10} {profit:>14,.0f}원 {roi:>9.1f}%")
    
    print("\n" + "="*70)
    print("💡 핵심 인사이트")
    print("="*70)
    
    # ROI가 가장 좋은 전략 찾기
    best = max(results, key=lambda x: x[4])
    worst = min(results, key=lambda x: x[4])
    
    print(f"""
🏆 최고 전략: {best[0]}
   - ROI: {best[4]:.1f}%
   - 적중률: {best[2]/best[1]*100:.1f}% ({best[2]}/{best[1]})

😢 최악 전략: {worst[0]}
   - ROI: {worst[4]:.1f}%

📌 분석:
   - 무승부 제외가 효과 있는지?
   - 확률 높을수록 적중률 높은지?
   - 기대값 필터가 도움 되는지?
    """)
    
    # 추가 분석: 실제 결과 분포
    print("\n📊 테스트 데이터 실제 결과 분포:")
    result_dist = df_test['actual_result'].value_counts()
    for result, count in result_dist.items():
        print(f"   {result}: {count} ({count/len(df_test)*100:.1f}%)")
    
    return df_test, results


def main():
    print("="*60)
    print("⚽ Soccer-Brain 기대값 백테스트 (개선판)")
    print("="*60)
    
    # 1. 전체 데이터 로드
    df = get_all_data()
    
    if len(df) < 100:
        print("❌ 데이터가 부족합니다. 최소 100경기 필요.")
        sys.exit(1)
    
    # 2. 실제 결과 라벨
    df = create_target(df)
    
    # 3. 시간순 분리 (70% 학습 / 30% 테스트)
    split_idx = int(len(df) * 0.7)
    df_train = df[:split_idx].copy()
    df_test = df[split_idx:].copy()
    
    print(f"\n📅 데이터 분리:")
    print(f"   학습: {len(df_train)}경기 ({df_train['kickoffAt'].min()} ~ {df_train['kickoffAt'].max()})")
    print(f"   테스트: {len(df_test)}경기 ({df_test['kickoffAt'].min()} ~ {df_test['kickoffAt'].max()})")
    
    # 4. 피처 컬럼
    _, feature_cols = prepare_features(df)
    
    # 5. 백테스트 실행
    df_test, results = run_backtest(df_train, df_test, feature_cols)
    
    print("\n✅ 백테스트 완료!")


if __name__ == "__main__":
    main()
