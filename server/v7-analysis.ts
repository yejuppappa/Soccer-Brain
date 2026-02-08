/**
 * V7 AI 분석 로직
 * ================
 * 
 * 핵심 원칙:
 * - AI 선택 = 배당 확률 중 가장 높은 결과
 * - 신뢰도 = 배당 확률 기준 (70%+ HIGH, 60-70% MEDIUM, 50-60% LOW)
 * - ROI+ 가치 베팅 = Walk-Forward 검증 통과한 Edge만
 */

// 리그명 매핑 (API-Football → 분석용)
const LEAGUE_MAP: Record<number, string> = {
  39: 'Premier League',
  140: 'La Liga',
  135: 'Serie A',
  78: 'Bundesliga',
  61: 'Ligue 1',
};

/**
 * 배당에서 내재 확률 계산 (마진 제거)
 */
export function calculateImpliedProbability(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number
): { home: number; draw: number; away: number } {
  const rawHome = 1 / homeOdds;
  const rawDraw = 1 / drawOdds;
  const rawAway = 1 / awayOdds;
  const total = rawHome + rawDraw + rawAway;

  return {
    home: rawHome / total,
    draw: rawDraw / total,
    away: rawAway / total,
  };
}

/**
 * V7 AI 선택: 배당 확률 중 가장 높은 결과
 */
export function getAIPick(
  homeProb: number,
  drawProb: number,
  awayProb: number
): { pick: 'H' | 'D' | 'A'; pickProb: number; pickName: string } {
  const probs = [
    { pick: 'H' as const, prob: homeProb, name: '홈 승' },
    { pick: 'D' as const, prob: drawProb, name: '무승부' },
    { pick: 'A' as const, prob: awayProb, name: '원정 승' },
  ];

  const best = probs.reduce((a, b) => (a.prob > b.prob ? a : b));

  return {
    pick: best.pick,
    pickProb: best.prob,
    pickName: best.name,
  };
}

/**
 * V7 신뢰도 배지: 배당 확률 기준
 */
export function getConfidenceBadge(maxProb: number): {
  level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN';
  stars: number;
  accuracy: string;
  description: string;
} {
  if (maxProb >= 0.70) {
    return {
      level: 'HIGH',
      stars: 3,
      accuracy: '77%',
      description: 'AI가 높은 확신을 가진 경기',
    };
  }
  if (maxProb >= 0.60) {
    return {
      level: 'MEDIUM',
      stars: 2,
      accuracy: '72%',
      description: 'AI가 우세를 예상하는 경기',
    };
  }
  if (maxProb >= 0.50) {
    return {
      level: 'LOW',
      stars: 1,
      accuracy: '65%',
      description: '박빙의 경기, 신중한 판단 필요',
    };
  }
  return {
    level: 'UNCERTAIN',
    stars: 0,
    accuracy: '<60%',
    description: '예측이 어려운 경기',
  };
}

/**
 * Walk-Forward 검증 통과한 ROI+ Edge 조건
 * 
 * 검증 결과 (2020-2022 학습 → 2023-2026 검증):
 * ✅ 홈 67-72% 라리가: +15.6%
 * ✅ 원정 60-65% 프리미어리그: +11.3%
 * ✅ 무 26-30% 세리에A: +10.9%
 * ✅ 무 26-32% 세리에A: +9.5%
 * ✅ 홈 65-70% 라리가: +7.4%
 * ✅ 무 30-35% 세리에A: +5.7%
 * ✅ 홈 65-70% 전체: +4.4%
 * ✅ 원정 55-60% 세리에A: +4.4%
 */
export interface ValueBetEdge {
  name: string;
  description: string;
  verifiedROI: number;
  sampleSize: number;
}

export function checkValueBet(
  homeProb: number,
  drawProb: number,
  awayProb: number,
  leagueId: number
): ValueBetEdge | null {
  const league = LEAGUE_MAP[leagueId] || '';

  // 1. 홈 67-72% 라리가 (+15.6% 검증)
  if (league === 'La Liga' && homeProb >= 0.67 && homeProb < 0.72) {
    return {
      name: '라리가 홈팀 강세',
      description: '라리가에서 홈팀이 확실히 유리한 경기',
      verifiedROI: 15.6,
      sampleSize: 51,
    };
  }

  // 2. 원정 60-65% 프리미어리그 (+11.3% 검증)
  if (league === 'Premier League' && awayProb >= 0.60 && awayProb < 0.65) {
    return {
      name: 'EPL 원정팀 강세',
      description: '프리미어리그에서 원정팀이 확실히 유리한 경기',
      verifiedROI: 11.3,
      sampleSize: 36,
    };
  }

  // 3. 무 26-30% 세리에A (+10.9% 검증)
  if (league === 'Serie A' && drawProb >= 0.26 && drawProb < 0.30) {
    return {
      name: '세리에A 무승부 가능',
      description: '세리에A에서 무승부가 나올 가능성이 높은 경기',
      verifiedROI: 10.9,
      sampleSize: 532,
    };
  }

  // 4. 무 26-32% 세리에A (+9.5% 검증) - 위와 겹치지 않는 범위
  if (league === 'Serie A' && drawProb >= 0.30 && drawProb < 0.32) {
    return {
      name: '세리에A 무승부 가능',
      description: '세리에A에서 무승부가 나올 가능성이 높은 경기',
      verifiedROI: 9.5,
      sampleSize: 708,
    };
  }

  // 5. 홈 65-70% 라리가 (+7.4% 검증)
  if (league === 'La Liga' && homeProb >= 0.65 && homeProb < 0.67) {
    return {
      name: '라리가 홈팀 우세',
      description: '라리가에서 홈팀이 유리한 경기',
      verifiedROI: 7.4,
      sampleSize: 55,
    };
  }

  // 6. 무 30-35% 세리에A (+5.7% 검증)
  if (league === 'Serie A' && drawProb >= 0.32 && drawProb < 0.35) {
    return {
      name: '세리에A 무승부 주의',
      description: '세리에A에서 무승부 확률이 높은 경기',
      verifiedROI: 5.7,
      sampleSize: 200,
    };
  }

  // 7. 홈 65-70% 전체 (+4.4% 검증) - 라리가 제외
  if (league !== 'La Liga' && homeProb >= 0.65 && homeProb < 0.70) {
    return {
      name: '홈팀 우세',
      description: '홈팀이 유리한 경기',
      verifiedROI: 4.4,
      sampleSize: 310,
    };
  }

  // 8. 원정 55-60% 세리에A (+4.4% 검증)
  if (league === 'Serie A' && awayProb >= 0.55 && awayProb < 0.60) {
    return {
      name: '세리에A 원정팀 우세',
      description: '세리에A에서 원정팀이 유리한 경기',
      verifiedROI: 4.4,
      sampleSize: 61,
    };
  }

  return null;
}

/**
 * V7 분석 결과 전체 계산
 */
export interface V7Analysis {
  // 배당 확률
  oddsProb: {
    home: number;
    draw: number;
    away: number;
  };
  // AI 선택
  aiPick: {
    pick: 'H' | 'D' | 'A';
    pickProb: number;
    pickName: string;
  };
  // 신뢰도
  confidence: {
    level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN';
    stars: number;
    accuracy: string;
    description: string;
  };
  // 가치 베팅 (있으면)
  valueBet: ValueBetEdge | null;
}

export function analyzeMatchV7(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number,
  leagueId: number
): V7Analysis {
  // 1. 배당 확률 계산
  const oddsProb = calculateImpliedProbability(homeOdds, drawOdds, awayOdds);

  // 2. AI 선택 (배당 확률 최고)
  const aiPick = getAIPick(oddsProb.home, oddsProb.draw, oddsProb.away);

  // 3. 신뢰도 배지
  const confidence = getConfidenceBadge(aiPick.pickProb);

  // 4. 가치 베팅 조건 체크
  const valueBet = checkValueBet(oddsProb.home, oddsProb.draw, oddsProb.away, leagueId);

  return {
    oddsProb,
    aiPick,
    confidence,
    valueBet,
  };
}

export default {
  calculateImpliedProbability,
  getAIPick,
  getConfidenceBadge,
  checkValueBet,
  analyzeMatchV7,
};
