/**
 * Soccer-Brain 데이터 정리 & pseudo-xG 생성 스크립트
 * ====================================================
 * 
 * 실행: npx tsx scripts/cleanup-and-pseudo-xg.ts
 * 
 * 3단계로 진행:
 *   [1] 불필요 리그 비활성화 (5대 리그 + UCL/UEL + K리그만 유지)
 *   [2] 실제 xG 데이터로 pseudo-xG 공식 보정 (회귀분석)
 *   [3] xG가 NULL인 스탯에 pseudo-xG 채우기
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

// ============================================================
// [1] 리그 정리 - 베트맨 프로토 취급 리그만 활성화
// ============================================================
// 베트맨 프로토 승부식에서 축구 종목으로 취급하는 리그 목록
// (API-Football league ID 기준)
const KEEP_LEAGUES = [
  // ── 5대 리그 ──
  39,   // 🏴 Premier League (EPL)
  140,  // 🇪🇸 La Liga
  135,  // 🇮🇹 Serie A
  78,   // 🇩🇪 Bundesliga
  61,   // 🇫🇷 Ligue 1

  // ── 5대 리그 2부 ──
  40,   // 🏴 Championship (EFL Championship)
  141,  // 🇪🇸 Segunda División (La Liga 2)
  136,  // 🇮🇹 Serie B
  79,   // 🇩🇪 2. Bundesliga
  62,   // 🇫🇷 Ligue 2

  // ── 유럽 대회 ──
  2,    // 🏆 UEFA Champions League
  3,    // 🏆 UEFA Europa League
  848,  // 🏆 UEFA Europa Conference League

  // ── 주요 유럽 리그 ──
  88,   // 🇳🇱 Eredivisie (에레디비지에)
  94,   // 🇵🇹 Primeira Liga (포르투갈)
  144,  // 🇧🇪 Jupiler Pro League (벨기에)
  179,  // 🏴 Scottish Premiership (스코틀랜드)
  203,  // 🇹🇷 Süper Lig (터키)
  207,  // 🇨🇭 Super League (스위스)
  218,  // 🇦🇹 Bundesliga (오스트리아)
  119,  // 🇩🇰 Superliga (덴마크)
  113,  // 🇸🇪 Allsvenskan (스웨덴)
  103,  // 🇳🇴 Eliteserien (노르웨이)
  197,  // 🇬🇷 Super League 1 (그리스)
  106,  // 🇵🇱 Ekstraklasa (폴란드)
  345,  // 🇨🇿 Czech Liga (체코)
  210,  // 🇭🇷 HNL (크로아티아)
  235,  // 🇷🇸 Super Liga (세르비아)

  // ── 국내컵 (베트맨에 간혹 등장) ──
  45,   // 🏴 FA Cup
  81,   // 🇩🇪 DFB Pokal
  137,  // 🇮🇹 Coppa Italia
  143,  // 🇪🇸 Copa del Rey
  66,   // 🇫🇷 Coupe de France

  // ── 아시아 ──
  292,  // 🇰🇷 K League 1
  293,  // 🇰🇷 K League 2
  98,   // 🇯🇵 J1 League
  99,   // 🇯🇵 J2 League
  17,   // 🏆 AFC Champions League

  // ── 아메리카 ──
  253,  // 🇺🇸 MLS
  71,   // 🇧🇷 Serie A (브라질)
  128,  // 🇦🇷 Liga Profesional Argentina

  // ── 기타 (베트맨에 자주 등장) ──
  169,  // 🇨🇳 Chinese Super League (가끔)
  307,  // 🇸🇦 Saudi Pro League (가끔)
  333,  // 🇦🇺 A-League
];

async function cleanupLeagues() {
  console.log("═══════════════════════════════════════════════");
  console.log("  [1] 리그 정리");
  console.log("═══════════════════════════════════════════════\n");

  const allLeagues = await prisma.league.findMany();
  let disabled = 0;
  let kept = 0;

  for (const lg of allLeagues) {
    if (KEEP_LEAGUES.includes(lg.apiLeagueId)) {
      if (!lg.enabled) {
        await prisma.league.update({
          where: { id: lg.id },
          data: { enabled: true },
        });
      }
      kept++;
      console.log(`  ✅ ${lg.name} (ID: ${lg.apiLeagueId})`);
    } else {
      if (lg.enabled) {
        await prisma.league.update({
          where: { id: lg.id },
          data: { enabled: false },
        });
        disabled++;
      }
    }
  }

  console.log(`\n  활성: ${kept}개 | 비활성화: ${disabled}개 | 전체: ${allLeagues.length}개`);
  console.log(`  → 스케줄러 API 콜 절약 효과: 불필요 리그 스캔 제거\n`);
}

// ============================================================
// [2] 실제 xG로 pseudo-xG 공식 보정
// ============================================================
interface CalibrationResult {
  coeffOnTarget: number;
  coeffOffTarget: number;
  intercept: number;
  r2: number;
  sampleSize: number;
}

async function calibratePseudoXg(): Promise<CalibrationResult> {
  console.log("═══════════════════════════════════════════════");
  console.log("  [2] pseudo-xG 공식 보정 (실제 데이터 기반)");
  console.log("═══════════════════════════════════════════════\n");

  // xG와 슈팅 데이터가 모두 있는 레코드 가져오기
  const stats = await prisma.fixtureTeamStatSnapshot.findMany({
    where: {
      xg: { not: null },
      shotsTotal: { not: null },
      shotsOnTarget: { not: null },
    },
    select: {
      xg: true,
      shotsTotal: true,
      shotsOnTarget: true,
      shotsOffTarget: true,
    },
  });

  console.log(`  학습 데이터: ${stats.length}개 레코드 (xG + 슈팅 모두 있는 경기)`);

  if (stats.length < 100) {
    console.log("  ⚠️ 데이터 부족, 기본값 사용");
    return {
      coeffOnTarget: 0.30,
      coeffOffTarget: 0.03,
      intercept: 0.0,
      r2: 0,
      sampleSize: stats.length,
    };
  }

  // 단순 선형 회귀: xG = a × shots_on_target + b × shots_off_target + c
  // 정규방정식으로 직접 계산 (외부 라이브러리 불필요)
  const n = stats.length;
  let sumX1 = 0, sumX2 = 0, sumY = 0;
  let sumX1X1 = 0, sumX1X2 = 0, sumX2X2 = 0;
  let sumX1Y = 0, sumX2Y = 0;

  for (const s of stats) {
    const x1 = s.shotsOnTarget ?? 0;
    const x2 = (s.shotsTotal ?? 0) - (s.shotsOnTarget ?? 0); // off target
    const y = Number(s.xg ?? 0);

    sumX1 += x1; sumX2 += x2; sumY += y;
    sumX1X1 += x1 * x1; sumX1X2 += x1 * x2; sumX2X2 += x2 * x2;
    sumX1Y += x1 * y; sumX2Y += x2 * y;
  }

  // 3x3 정규방정식 풀기 (절편 포함)
  // [n,     sumX1,   sumX2  ] [c ]   [sumY  ]
  // [sumX1, sumX1X1, sumX1X2] [a ] = [sumX1Y]
  // [sumX2, sumX1X2, sumX2X2] [b ]   [sumX2Y]
  
  const A = [
    [n, sumX1, sumX2],
    [sumX1, sumX1X1, sumX1X2],
    [sumX2, sumX1X2, sumX2X2],
  ];
  const B = [sumY, sumX1Y, sumX2Y];

  const solution = solveLinearSystem(A, B);
  const intercept = solution[0];
  const coeffOnTarget = solution[1];
  const coeffOffTarget = solution[2];

  // R² 계산
  const meanY = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (const s of stats) {
    const x1 = s.shotsOnTarget ?? 0;
    const x2 = (s.shotsTotal ?? 0) - (s.shotsOnTarget ?? 0);
    const y = Number(s.xg ?? 0);
    const yPred = intercept + coeffOnTarget * x1 + coeffOffTarget * x2;
    ssRes += (y - yPred) ** 2;
    ssTot += (y - meanY) ** 2;
  }
  const r2 = 1 - ssRes / ssTot;

  console.log(`\n  📐 회귀분석 결과:`);
  console.log(`  ───────────────────────────────────`);
  console.log(`  pseudo_xG = ${coeffOnTarget.toFixed(4)} × 유효슈팅`);
  console.log(`           + ${coeffOffTarget.toFixed(4)} × 빗나간슈팅`);
  console.log(`           + ${intercept.toFixed(4)}`);
  console.log(`  ───────────────────────────────────`);
  console.log(`  R² = ${r2.toFixed(4)} (1에 가까울수록 정확)`);
  console.log(`  샘플: ${n}경기\n`);

  // 검증: 몇 가지 예시
  console.log(`  📊 검증 예시:`);
  console.log(`  유효슈팅 5, 빗나간 5 → pseudo_xG = ${(intercept + coeffOnTarget * 5 + coeffOffTarget * 5).toFixed(2)}`);
  console.log(`  유효슈팅 3, 빗나간 7 → pseudo_xG = ${(intercept + coeffOnTarget * 3 + coeffOffTarget * 7).toFixed(2)}`);
  console.log(`  유효슈팅 8, 빗나간 4 → pseudo_xG = ${(intercept + coeffOnTarget * 8 + coeffOffTarget * 4).toFixed(2)}`);

  // 실제 xG와 비교
  const sample = stats.slice(0, 5);
  console.log(`\n  실제 vs 추정 비교 (상위 5개):`);
  for (const s of sample) {
    const x1 = s.shotsOnTarget ?? 0;
    const x2 = (s.shotsTotal ?? 0) - (s.shotsOnTarget ?? 0);
    const actual = Number(s.xg ?? 0);
    const predicted = intercept + coeffOnTarget * x1 + coeffOffTarget * x2;
    console.log(`  실제 xG: ${actual.toFixed(2)} → pseudo: ${predicted.toFixed(2)} (유효${x1}, 빗나감${x2})`);
  }

  return { coeffOnTarget, coeffOffTarget, intercept, r2, sampleSize: n };
}

// 3x3 가우스 소거법
function solveLinearSystem(A: number[][], B: number[]): number[] {
  const n = 3;
  const M = A.map((row, i) => [...row, B[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= M[i][j] * x[j];
    }
    x[i] /= M[i][i];
  }
  return x;
}

// ============================================================
// [3] xG NULL인 레코드에 pseudo-xG 채우기
// ============================================================
async function fillPseudoXg(calib: CalibrationResult) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  [3] pseudo-xG 채우기 (xG가 NULL인 레코드)");
  console.log("═══════════════════════════════════════════════\n");

  const nullXgStats = await prisma.fixtureTeamStatSnapshot.findMany({
    where: {
      xg: null,
      shotsOnTarget: { not: null },
      shotsTotal: { not: null },
    },
    select: {
      id: true,
      shotsTotal: true,
      shotsOnTarget: true,
    },
  });

  console.log(`  대상: ${nullXgStats.length}개 레코드 (xG NULL + 슈팅 데이터 있음)`);

  if (nullXgStats.length === 0) {
    console.log("  ✅ 채울 레코드 없음!\n");
    return;
  }

  let filled = 0;
  let skipped = 0;

  // 배치 처리 (100개씩)
  const batchSize = 100;
  for (let i = 0; i < nullXgStats.length; i += batchSize) {
    const batch = nullXgStats.slice(i, i + batchSize);

    const updates = batch.map(s => {
      const onTarget = s.shotsOnTarget ?? 0;
      const offTarget = (s.shotsTotal ?? 0) - onTarget;
      const pseudoXg = Math.max(0,
        calib.intercept + calib.coeffOnTarget * onTarget + calib.coeffOffTarget * offTarget
      );
      // 소수점 2자리로 반올림
      const rounded = Math.round(pseudoXg * 100) / 100;

      return prisma.fixtureTeamStatSnapshot.update({
        where: { id: s.id },
        data: { xg: rounded },
      });
    });

    await prisma.$transaction(updates);
    filled += batch.length;

    if ((i + batchSize) % 1000 === 0 || i + batchSize >= nullXgStats.length) {
      process.stdout.write(`  진행: ${Math.min(filled, nullXgStats.length)}/${nullXgStats.length}\r`);
    }
  }

  console.log(`\n  ✅ ${filled}개 레코드에 pseudo-xG 채움`);

  // 슈팅 데이터도 없는 경우
  const noShots = await prisma.fixtureTeamStatSnapshot.count({
    where: { xg: null, shotsOnTarget: null },
  });
  if (noShots > 0) {
    console.log(`  ⚠️ ${noShots}개는 슈팅 데이터도 없어 pseudo-xG 계산 불가`);
  }
}

// ============================================================
// [4] 최종 리포트
// ============================================================
async function finalReport() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  📊 최종 리포트");
  console.log("═══════════════════════════════════════════════\n");

  const total = await prisma.fixtureTeamStatSnapshot.count();
  const xgNull = await prisma.fixtureTeamStatSnapshot.count({ where: { xg: null } });
  const xgFilled = total - xgNull;

  console.log(`  전체 스탯:    ${total}`);
  console.log(`  xG 있음:     ${xgFilled} (${(xgFilled / total * 100).toFixed(1)}%)`);
  console.log(`  xG 여전히 NULL: ${xgNull} (${(xgNull / total * 100).toFixed(1)}%)`);

  const enabledLeagues = await prisma.league.count({ where: { enabled: true } });
  const totalLeagues = await prisma.league.count();
  console.log(`\n  활성 리그:    ${enabledLeagues}/${totalLeagues}`);

  console.log(`\n  ✅ 다음 단계:`);
  console.log(`  1. 피처 스냅샷 재빌드: npx tsx scripts/rebuild-features.ts`);
  console.log(`     (xG가 채워졌으므로 피처도 업데이트 필요)`);
  console.log(`  2. 스탯 백필 (362경기): npx tsx scripts/backfill-stats.ts`);
  console.log(`  3. 스케줄러 활성화 (.env에서 DISABLE_SCHEDULER 제거)\n`);
}

// ============================================================
// 메인
// ============================================================
async function main() {
  console.log("\n🧠 Soccer-Brain 데이터 정리 시작!\n");

  // [1] 리그 정리
  await cleanupLeagues();

  // [2] pseudo-xG 공식 보정
  const calib = await calibratePseudoXg();

  // [3] pseudo-xG 채우기
  await fillPseudoXg(calib);

  // [4] 최종 리포트
  await finalReport();

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
