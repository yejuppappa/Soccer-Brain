/**
 * V9 Analysis Module
 * ==================
 * 핵심 전략:
 * - ML 확률 60%+ → 강한 추천 (71% 적중률)
 * - ML 확률 55%+ → 추천 (65% 적중률)
 * - draw_likelihood >= 0.7 → 박빙 경기 경고
 * - ROI+ = ML 55%+ AND EV > 0
 */

export interface V9Prediction {
  // ML 예측 확률 (메인)
  mlProb: {
    home: number;  // 0-100
    draw: number;
    away: number;
  };
  
  // ML 선택
  mlPick: {
    pick: 'home' | 'draw' | 'away';
    pickName: string;
    pickProb: number;  // 0-100
  };
  
  // 추천 등급
  recommendation: {
    level: 'STRONG' | 'MEDIUM' | 'NONE';
    stars: number;  // 0, 2, 3
    reason: string;
  };
  
  // 박빙 경기 여부
  drawWarning: {
    isClose: boolean;
    likelihood: number;  // 0-1
    message: string | null;
  };
  
  // ROI+ (가치 베팅)
  valueBet: {
    isValue: boolean;
    ev: number;  // 기대값 (%)
    message: string | null;
  };
}

/**
 * ML 선택 결정 (가장 높은 확률)
 */
export function getMLPick(homeProb: number, drawProb: number, awayProb: number): V9Prediction['mlPick'] {
  if (homeProb >= drawProb && homeProb >= awayProb) {
    return { pick: 'home', pickName: '홈 승', pickProb: homeProb };
  } else if (awayProb >= homeProb && awayProb >= drawProb) {
    return { pick: 'away', pickName: '원정 승', pickProb: awayProb };
  } else {
    return { pick: 'draw', pickName: '무승부', pickProb: drawProb };
  }
}

/**
 * 추천 등급 결정
 * - 60%+ → STRONG (⭐⭐⭐) - 71% 적중률
 * - 55%+ → MEDIUM (⭐⭐) - 65% 적중률
 * - else → NONE
 */
export function getRecommendation(pickProb: number): V9Prediction['recommendation'] {
  if (pickProb >= 60) {
    return {
      level: 'STRONG',
      stars: 3,
      reason: `ML ${pickProb.toFixed(0)}% 예측 (높은 신뢰도)`,
    };
  } else if (pickProb >= 55) {
    return {
      level: 'MEDIUM',
      stars: 2,
      reason: `ML ${pickProb.toFixed(0)}% 예측`,
    };
  } else {
    return {
      level: 'NONE',
      stars: 0,
      reason: '',
    };
  }
}

/**
 * draw_likelihood 계산
 * 박빙 지표: 폼/xG/득점력 차이가 작고, H2H 무승부 많으면 높음
 */
export function calculateDrawLikelihood(snapshot: {
  home_form_last5?: number | null;
  away_form_last5?: number | null;
  home_xg_avg?: number | null;
  away_xg_avg?: number | null;
  home_goalsFor_avg?: number | null;
  away_goalsFor_avg?: number | null;
  h2h_draws?: number | null;
  h2h_total_matches?: number | null;
} | null): number {
  if (!snapshot) return 0.5;  // 기본값
  
  // 폼 차이
  const homeForm = snapshot.home_form_last5 ?? 1.0;
  const awayForm = snapshot.away_form_last5 ?? 1.0;
  const formDiffAbs = Math.abs(homeForm - awayForm);
  
  // xG 차이
  const homeXg = snapshot.home_xg_avg ?? 1.2;
  const awayXg = snapshot.away_xg_avg ?? 1.0;
  const xgDiffAbs = Math.abs(homeXg - awayXg);
  
  // 득점력 차이
  const homeGoals = snapshot.home_goalsFor_avg ?? 1.2;
  const awayGoals = snapshot.away_goalsFor_avg ?? 1.0;
  const goalsDiffAbs = Math.abs(homeGoals - awayGoals);
  
  // H2H 무승부 비율
  const h2hDraws = snapshot.h2h_draws ?? 0;
  const h2hTotal = snapshot.h2h_total_matches ?? 0;
  const h2hDrawPct = h2hTotal > 0 ? (h2hDraws / h2hTotal) * 100 : 20;
  
  // draw_likelihood 계산
  const likelihood = (
    (1 - Math.min(formDiffAbs, 2) / 2) * 0.3 +
    (1 - Math.min(xgDiffAbs, 1) / 1) * 0.3 +
    (1 - Math.min(goalsDiffAbs, 1.5) / 1.5) * 0.2 +
    (Math.min(h2hDrawPct, 50) / 50) * 0.2
  );
  
  return Math.max(0, Math.min(1, likelihood));
}

/**
 * 박빙 경기 경고
 */
export function getDrawWarning(likelihood: number): V9Prediction['drawWarning'] {
  if (likelihood >= 0.7) {
    return {
      isClose: true,
      likelihood,
      message: '⚠️ 박빙 경기 - 무승부 가능성 있음',
    };
  } else if (likelihood >= 0.6) {
    return {
      isClose: true,
      likelihood,
      message: '양팀 비슷한 전력',
    };
  } else {
    return {
      isClose: false,
      likelihood,
      message: null,
    };
  }
}

/**
 * ROI+ (가치 베팅) 계산
 * 조건: ML 55%+ AND EV > 0
 */
export function checkValueBetV9(
  mlPick: 'home' | 'draw' | 'away',
  mlPickProb: number,
  odds: { home: number; draw: number; away: number } | null
): V9Prediction['valueBet'] {
  if (!odds || mlPickProb < 55) {
    return { isValue: false, ev: 0, message: null };
  }
  
  // 해당 선택의 배당
  let pickOdds: number;
  if (mlPick === 'home') {
    pickOdds = odds.home;
  } else if (mlPick === 'away') {
    pickOdds = odds.away;
  } else {
    pickOdds = odds.draw;
  }
  
  // EV 계산: (확률 × 배당) - 1
  const ev = ((mlPickProb / 100) * pickOdds - 1) * 100;  // %로 변환
  
  if (ev > 0) {
    return {
      isValue: true,
      ev: Math.round(ev * 10) / 10,
      message: `💎 ROI+ (기대수익 ${ev > 0 ? '+' : ''}${ev.toFixed(1)}%)`,
    };
  } else {
    return {
      isValue: false,
      ev: Math.round(ev * 10) / 10,
      message: null,
    };
  }
}

/**
 * V9 종합 분석
 */
export function analyzeMatchV9(
  mlProb: { home: number; draw: number; away: number },
  odds: { home: number; draw: number; away: number } | null,
  snapshot: Parameters<typeof calculateDrawLikelihood>[0]
): V9Prediction {
  // 1. ML 선택
  const mlPick = getMLPick(mlProb.home, mlProb.draw, mlProb.away);
  
  // 2. 추천 등급
  const recommendation = getRecommendation(mlPick.pickProb);
  
  // 3. 박빙 경기 체크
  const drawLikelihood = calculateDrawLikelihood(snapshot);
  const drawWarning = getDrawWarning(drawLikelihood);
  
  // 4. 가치 베팅 체크
  const valueBet = checkValueBetV9(mlPick.pick, mlPick.pickProb, odds);
  
  return {
    mlProb: {
      home: Math.round(mlProb.home * 10) / 10,
      draw: Math.round(mlProb.draw * 10) / 10,
      away: Math.round(mlProb.away * 10) / 10,
    },
    mlPick,
    recommendation,
    drawWarning,
    valueBet,
  };
}

/**
 * V9 추천 여부 (간단 버전)
 */
export function isV9Recommended(v9: V9Prediction): boolean {
  // 박빙 경기 && 추천 등급 낮으면 비추천
  if (v9.drawWarning.isClose && v9.drawWarning.likelihood >= 0.7 && v9.recommendation.level === 'NONE') {
    return false;
  }
  
  // STRONG 또는 MEDIUM이면 추천
  return v9.recommendation.level === 'STRONG' || v9.recommendation.level === 'MEDIUM';
}

/**
 * 배당 → 확률 변환 (마진 제거)
 */
export function calculateImpliedProbabilityV9(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number
): { home: number; draw: number; away: number } {
  const homeProb = 1 / homeOdds;
  const drawProb = 1 / drawOdds;
  const awayProb = 1 / awayOdds;
  const total = homeProb + drawProb + awayProb;
  
  return {
    home: (homeProb / total) * 100,
    draw: (drawProb / total) * 100,
    away: (awayProb / total) * 100,
  };
}
