/**
 * ============================================================
 * routes.ts V9 패치 가이드
 * ============================================================
 * 
 * 아래 수정사항을 routes.ts에 적용하세요.
 * v9-analysis.ts 파일을 server/ 폴더에 먼저 복사하세요.
 */

// ============================================================
// 📌 [1] IMPORT 추가 (파일 상단, 약 23번째 줄)
// ============================================================

// 이 줄을 찾으세요:
// import { analyzeMatchV7, getAIPick, getConfidenceBadge, checkValueBet, calculateImpliedProbability } from "./v7-analysis";

// 바로 아래에 추가:
// import { analyzeMatchV9, isV9Recommended } from "./v9-analysis";


// ============================================================
// 📌 [2] V9 분석 추가 (약 4188줄, valueBet 선언 바로 아래)
// ============================================================

// 이 코드를 찾으세요:
`
        // V7 가치 베팅: 검증 통과 Edge 체크
        const valueBet = fx.league?.apiLeagueId 
          ? checkValueBet(oddsProb.home, oddsProb.draw, oddsProb.away, fx.league.apiLeagueId)
          : null;

        // 추천 여부: V7 기준 (가치 베팅이 있거나, 신뢰도 HIGH/MEDIUM)
        const isRecommended = valueBet !== null || confidence.level === 'HIGH' || confidence.level === 'MEDIUM';
`

// 아래 코드로 교체하세요:
`
        // V7 가치 베팅: 검증 통과 Edge 체크
        const valueBet = fx.league?.apiLeagueId 
          ? checkValueBet(oddsProb.home, oddsProb.draw, oddsProb.away, fx.league.apiLeagueId)
          : null;

        // ===== V9: ML 기반 분석 =====
        const v9Analysis = analyzeMatchV9(
          { home: homeProb, draw: drawProb, away: awayProb },
          odds ? { 
            home: Number(odds.home), 
            draw: Number(odds.draw), 
            away: Number(odds.away) 
          } : null,
          snapshot
        );
        
        // V9 추천 여부 (ML 55%+ 기준)
        const isRecommendedV9 = isV9Recommended(v9Analysis);

        // 추천 여부: V9 기준 사용
        const isRecommended = isRecommendedV9;
`


// ============================================================
// 📌 [3] v9 객체 추가 (약 4250줄, v7 객체 바로 아래)
// ============================================================

// 이 코드를 찾으세요 (v7 객체의 마지막 부분):
`
            valueBet: valueBet ? {
              name: valueBet.name,
              description: valueBet.description,
              verifiedROI: valueBet.verifiedROI,
              sampleSize: valueBet.sampleSize,
            } : null,
          },
          features: snapshot ? {
`

// 아래 코드로 교체하세요:
`
            valueBet: valueBet ? {
              name: valueBet.name,
              description: valueBet.description,
              verifiedROI: valueBet.verifiedROI,
              sampleSize: valueBet.sampleSize,
            } : null,
          },
          // ✅ V9 분석 결과 (ML 기반 - 메인으로 사용)
          v9: {
            mlProb: v9Analysis.mlProb,
            mlPick: {
              pick: v9Analysis.mlPick.pick,
              pickProb: v9Analysis.mlPick.pickProb,
              pickName: v9Analysis.mlPick.pickName,
            },
            recommendation: {
              level: v9Analysis.recommendation.level,
              stars: v9Analysis.recommendation.stars,
              reason: v9Analysis.recommendation.reason,
            },
            drawWarning: {
              isClose: v9Analysis.drawWarning.isClose,
              likelihood: Math.round(v9Analysis.drawWarning.likelihood * 100) / 100,
              message: v9Analysis.drawWarning.message,
            },
            valueBet: {
              isValue: v9Analysis.valueBet.isValue,
              ev: v9Analysis.valueBet.ev,
              message: v9Analysis.valueBet.message,
            },
            isRecommended: isRecommendedV9,
          },
          features: snapshot ? {
`


// ============================================================
// 📌 [4] prediction.confidence를 V9 기준으로 (약 4232줄)
// ============================================================

// 이 부분을 찾으세요:
`
          prediction: {
            homeProb,
            drawProb,
            awayProb,
            ...
            isRecommended,
            confidence: confidence.level,  // ✅ 변경: V7 신뢰도 사용
            hasFeatures,
          },
`

// confidence를 V9 기준으로 변경:
`
          prediction: {
            homeProb,
            drawProb,
            awayProb,
            ...
            isRecommended,
            confidence: v9Analysis.recommendation.level,  // ✅ V9 신뢰도 사용
            hasFeatures,
          },
`


// ============================================================
// 📋 적용 순서 요약
// ============================================================
/*
1. v9-analysis.ts 파일을 server/ 폴더에 복사
2. routes.ts 상단에 import 추가
3. V9 분석 코드 추가 (valueBet 아래)
4. v9 객체 추가 (predictions.push 내부)
5. prediction.confidence를 V9 기준으로 변경

서버 재시작 후 확인!
*/
