/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  Soccer-Brain 야간 전자동 백필러 (Overnight Backfiller)  ║
 * ╠═══════════════════════════════════════════════════════════╣
 * ║                                                           ║
 * ║  서버 ON/OFF와 무관. 터미널에서 실행 후 잠자면 됨.       ║
 * ║                                                           ║
 * ║  실행: npx tsx scripts/overnight-backfill.ts              ║
 * ║                                                           ║
 * ║  하는 일 (순서대로):                                      ║
 * ║  [Phase 1] 경기 일정 채우기 (리그×시즌 빠진 것)          ║
 * ║  [Phase 2] 경기 스탯 채우기 (FT인데 스탯 없는 것)        ║
 * ║  [Phase 3] 피처 스냅샷 빌드 (스탯 있는데 피처 없는 것)   ║
 * ║                                                           ║
 * ║  70,000콜 한도 자동 관리. 한도 근접 시 자동 중단.        ║
 * ║  중단 후 다시 실행하면 이어서 진행. (이미 있는 건 스킵)  ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

import { PrismaClient, Prisma } from "@prisma/client";
import axios, { AxiosInstance } from "axios";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

// ============================================================
// 설정
// ============================================================
const API_BASE = "https://v3.football.api-sports.io";
const API_KEY = process.env.API_SPORTS_KEY || "";
const DELAY_MS = 350;          // API 호출 간격 (초당 ~3콜)
const MAX_API_CALLS = 70000;   // 75,000 중 5,000은 안전 여유분
const SEASONS = [2020, 2021, 2022, 2023, 2024, 2025];
const CALENDAR_YEAR_LEAGUES = new Set([292, 293, 98, 99, 253, 71, 128, 169, 307, 333, 17, 18, 294]);

// 리그별 최초 시즌 (이전 시즌은 API 콜 낭비 방지)
const LEAGUE_START_SEASON: Record<number, number> = {
  848: 2021,  // Europa Conference League: 2021-22부터
  531: 2017,  // UEFA Super Cup (API 데이터)
  18:  2017,  // AFC Cup
  293: 2017,  // K League 2
};

// ============================================================
// API 클라이언트 (콜 수 자동 추적)
// ============================================================
let apiCallsUsed = 0;
let apiCallsRemaining: number | null = null;

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { "x-apisports-key": API_KEY },
  timeout: 30000,
});

api.interceptors.response.use((res) => {
  apiCallsUsed++;
  // 일일 잔여 콜 (x-ratelimit-requests-remaining = 일일, x-ratelimit-remaining = 분당)
  const dailyRemaining = res.headers["x-ratelimit-requests-remaining"];
  if (dailyRemaining) apiCallsRemaining = parseInt(dailyRemaining);
  return res;
});

function canContinue(): boolean {
  if (apiCallsRemaining !== null && apiCallsRemaining < 500) {
    log(`⛔ API 잔여: ${apiCallsRemaining}콜. 안전을 위해 중단.`, "warn");
    return false;
  }
  if (apiCallsUsed >= MAX_API_CALLS) {
    log(`⛔ 이번 실행 ${apiCallsUsed}콜 사용. 한도 도달.`, "warn");
    return false;
  }
  return true;
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function log(msg: string, type: "info" | "success" | "error" | "warn" = "info") {
  const icons = { info: "📋", success: "✅", error: "❌", warn: "⚠️" };
  const ts = new Date().toLocaleTimeString("ko-KR", { hour12: false });
  console.log(`[${ts}] ${icons[type]} ${msg}`);
}

function getSeason(leagueApiId: number, year: number): number {
  // 캘린더 연도 리그는 그대로, 유럽 리그는 year가 시즌 시작 연도
  return year;
}

function getSeasonDateRange(leagueApiId: number, season: number): { from: string; to: string } {
  if (CALENDAR_YEAR_LEAGUES.has(leagueApiId)) {
    return { from: `${season}-01-01`, to: `${season}-12-31` };
  }
  // 유럽 리그: season=2023 → 2023-07-01 ~ 2024-06-30
  return { from: `${season}-07-01`, to: `${season + 1}-06-30` };
}

// ============================================================
// Phase 1: 경기 일정 채우기
// ============================================================
async function phase1_fixtures(): Promise<number> {
  log("════════════════════════════════════════════════");
  log("  [Phase 1] 경기 일정 백필");
  log("════════════════════════════════════════════════");

  const leagues = await prisma.league.findMany({
    where: { enabled: true },
    orderBy: { priority: "desc" },
  });

  let totalSynced = 0;

  for (const league of leagues) {
    for (const season of SEASONS) {
      if (!canContinue()) return totalSynced;

      // 리그별 최초 시즌 이전은 스킵
      const startSeason = LEAGUE_START_SEASON[league.apiLeagueId];
      if (startSeason && season < startSeason) continue;

      // 이미 있는지 확인
      const existing = await prisma.fixture.count({
        where: { leagueId: league.id, season },
      });

      if (existing > 0) continue; // 이미 있으면 스킵

      const { from, to } = getSeasonDateRange(league.apiLeagueId, season);

      try {
        const res = await api.get("/fixtures", {
          params: { league: league.apiLeagueId, season, from, to },
        });
        const fixtures = res.data?.response || [];

        if (fixtures.length === 0) {
          await delay(DELAY_MS);
          continue;
        }

        let synced = 0;
        for (const f of fixtures) {
          const homeTeamId = f.teams?.home?.id;
          const awayTeamId = f.teams?.away?.id;
          if (!homeTeamId || !awayTeamId) continue;

          const home = await prisma.team.upsert({
            where: { apiTeamId: homeTeamId },
            update: { name: f.teams.home.name },
            create: { apiTeamId: homeTeamId, name: f.teams.home.name },
          });

          const away = await prisma.team.upsert({
            where: { apiTeamId: awayTeamId },
            update: { name: f.teams.away.name },
            create: { apiTeamId: awayTeamId, name: f.teams.away.name },
          });

          await prisma.fixture.upsert({
            where: { apiFixtureId: f.fixture.id },
            update: {
              leagueId: league.id,
              season,
              kickoffAt: new Date(f.fixture.date),
              status: f.fixture.status?.short || "NS",
              homeTeamId: home.id,
              awayTeamId: away.id,
              homeGoals: f.goals?.home ?? null,
              awayGoals: f.goals?.away ?? null,
              venueName: f.fixture.venue?.name ?? null,
              venueCity: f.fixture.venue?.city ?? null,
            },
            create: {
              apiFixtureId: f.fixture.id,
              leagueId: league.id,
              season,
              kickoffAt: new Date(f.fixture.date),
              status: f.fixture.status?.short || "NS",
              homeTeamId: home.id,
              awayTeamId: away.id,
              homeGoals: f.goals?.home ?? null,
              awayGoals: f.goals?.away ?? null,
              venueName: f.fixture.venue?.name ?? null,
              venueCity: f.fixture.venue?.city ?? null,
            },
          });

          synced++;
        }

        if (synced > 0) {
          log(`  ${league.name} ${season}: ${synced}경기 추가`, "success");
          totalSynced += synced;
        }

        await delay(DELAY_MS);
      } catch (err: any) {
        if (err.response?.status === 429) {
          log("  ⏳ 429 Too Many Requests. 60초 대기...", "warn");
          await delay(60000);
        } else {
          log(`  ${league.name} ${season}: ${err.message?.slice(0, 60)}`, "error");
        }
      }
    }
  }

  log(`Phase 1 완료: ${totalSynced}경기 추가 (${apiCallsUsed}콜 사용)`, "success");
  return totalSynced;
}

// ============================================================
// Phase 2: 경기 스탯 채우기
// ============================================================
async function phase2_stats(): Promise<number> {
  log("\n════════════════════════════════════════════════");
  log("  [Phase 2] 경기 스탯 백필");
  log("════════════════════════════════════════════════");

  // 활성 리그의 FT 경기 중 스탯이 없는 것
  const enabledLeagueIds = (
    await prisma.league.findMany({ where: { enabled: true }, select: { id: true } })
  ).map(l => l.id);

  const fixtures = await prisma.fixture.findMany({
    where: {
      status: "FT",
      leagueId: { in: enabledLeagueIds },
      teamStats: { none: {} },
    },
    include: {
      league: { select: { name: true } },
      homeTeam: { select: { id: true, apiTeamId: true, name: true } },
      awayTeam: { select: { id: true, apiTeamId: true, name: true } },
    },
    orderBy: { kickoffAt: "asc" },
  });

  log(`  스탯 없는 FT 경기: ${fixtures.length}개`);

  if (fixtures.length === 0) {
    log("  Phase 2 스킵: 백필할 경기 없음", "success");
    return 0;
  }

  let success = 0, failed = 0, noData = 0;
  const startTime = Date.now();

  for (let i = 0; i < fixtures.length; i++) {
    if (!canContinue()) break;

    const f = fixtures[i];

    try {
      const res = await api.get("/fixtures/statistics", {
        params: { fixture: f.apiFixtureId },
      });
      const stats = res.data?.response || [];

      if (!stats || stats.length === 0) {
        noData++;
        await delay(DELAY_MS);
        continue;
      }

      for (const teamStats of stats) {
        const isHome = teamStats.team.id === f.homeTeam.apiTeamId;
        const team = isHome ? f.homeTeam : f.awayTeam;
        const getVal = (type: string) => teamStats.statistics?.find((s: any) => s.type === type)?.value;

        await prisma.fixtureTeamStatSnapshot.upsert({
          where: { fixtureId_teamId: { fixtureId: f.id, teamId: team.id } },
          update: {
            shotsTotal: parseInt(getVal("Total Shots")) || null,
            shotsOnTarget: parseInt(getVal("Shots on Goal")) || null,
            shotsOffTarget: parseInt(getVal("Shots off Goal")) || null,
            possessionPct: parseFloat(getVal("Ball Possession")?.replace?.("%", "")) || null,
            passesTotal: parseInt(getVal("Total passes")) || null,
            passesAccurate: parseInt(getVal("Passes accurate")) || null,
            passAccuracyPct: parseFloat(getVal("Passes %")?.replace?.("%", "")) || null,
            fouls: parseInt(getVal("Fouls")) || null,
            corners: parseInt(getVal("Corner Kicks")) || null,
            offsides: parseInt(getVal("Offsides")) || null,
            yellowCards: parseInt(getVal("Yellow Cards")) || null,
            redCards: parseInt(getVal("Red Cards")) || null,
            saves: parseInt(getVal("Goalkeeper Saves")) || null,
            xg: parseFloat(getVal("expected_goals")) || null,
            raw: teamStats as any,
            fetchedAt: new Date(),
          },
          create: {
            fixtureId: f.id,
            teamId: team.id,
            isHome,
            shotsTotal: parseInt(getVal("Total Shots")) || null,
            shotsOnTarget: parseInt(getVal("Shots on Goal")) || null,
            shotsOffTarget: parseInt(getVal("Shots off Goal")) || null,
            possessionPct: parseFloat(getVal("Ball Possession")?.replace?.("%", "")) || null,
            passesTotal: parseInt(getVal("Total passes")) || null,
            passesAccurate: parseInt(getVal("Passes accurate")) || null,
            passAccuracyPct: parseFloat(getVal("Passes %")?.replace?.("%", "")) || null,
            fouls: parseInt(getVal("Fouls")) || null,
            corners: parseInt(getVal("Corner Kicks")) || null,
            offsides: parseInt(getVal("Offsides")) || null,
            yellowCards: parseInt(getVal("Yellow Cards")) || null,
            redCards: parseInt(getVal("Red Cards")) || null,
            saves: parseInt(getVal("Goalkeeper Saves")) || null,
            xg: parseFloat(getVal("expected_goals")) || null,
            raw: teamStats as any,
          },
        });
      }

      success++;
    } catch (err: any) {
      failed++;
      if (err.response?.status === 429) {
        log("  ⏳ 429 Too Many Requests. 60초 대기...", "warn");
        await delay(60000);
        i--; // 다시 시도
        continue;
      }
    }

    await delay(DELAY_MS);

    // 500건마다 중간 리포트
    if ((i + 1) % 500 === 0) {
      const elapsed = (Date.now() - startTime) / 1000 / 60;
      log(`  진행: ${i + 1}/${fixtures.length} (✅${success} ❌${failed} ⚪${noData}) ${elapsed.toFixed(1)}분 경과 | API: ${apiCallsUsed}콜`);
    }
  }

  log(`Phase 2 완료: ✅${success} ❌${failed} ⚪${noData} (누적 ${apiCallsUsed}콜)`, "success");
  return success;
}

// ============================================================
// Phase 3: pseudo-xG 생성
// ============================================================
async function phase3_pseudoXg(): Promise<number> {
  log("\n════════════════════════════════════════════════");
  log("  [Phase 3] pseudo-xG 생성 (API 콜 0)");
  log("════════════════════════════════════════════════");

  // 회귀분석: xG가 있는 데이터로 계수 학습
  const calibData = await prisma.fixtureTeamStatSnapshot.findMany({
    where: {
      xg: { not: null },
      shotsTotal: { not: null },
      shotsOnTarget: { not: null },
    },
    select: { xg: true, shotsTotal: true, shotsOnTarget: true },
  });

  if (calibData.length < 100) {
    log("  xG 학습 데이터 부족. 기본 계수 사용.", "warn");
    var coeffOn = 0.30, coeffOff = 0.03, intercept = 0.0;
  } else {
    // 정규방정식으로 회귀분석
    const n = calibData.length;
    let sX1 = 0, sX2 = 0, sY = 0;
    let sX1X1 = 0, sX1X2 = 0, sX2X2 = 0;
    let sX1Y = 0, sX2Y = 0;

    for (const s of calibData) {
      const x1 = s.shotsOnTarget ?? 0;
      const x2 = (s.shotsTotal ?? 0) - x1;
      const y = Number(s.xg ?? 0);
      sX1 += x1; sX2 += x2; sY += y;
      sX1X1 += x1 * x1; sX1X2 += x1 * x2; sX2X2 += x2 * x2;
      sX1Y += x1 * y; sX2Y += x2 * y;
    }

    // 3x3 가우스 소거
    const M = [
      [n, sX1, sX2, sY],
      [sX1, sX1X1, sX1X2, sX1Y],
      [sX2, sX1X2, sX2X2, sX2Y],
    ];
    for (let col = 0; col < 3; col++) {
      let maxR = col;
      for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[maxR][col])) maxR = r;
      [M[col], M[maxR]] = [M[maxR], M[col]];
      for (let r = col + 1; r < 3; r++) {
        const f = M[r][col] / M[col][col];
        for (let j = col; j <= 3; j++) M[r][j] -= f * M[col][j];
      }
    }
    const x = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      x[i] = M[i][3];
      for (let j = i + 1; j < 3; j++) x[i] -= M[i][j] * x[j];
      x[i] /= M[i][i];
    }

    var intercept = x[0], coeffOn = x[1], coeffOff = x[2];

    log(`  회귀분석 (${n}개 샘플):`, "info");
    log(`  pseudo_xG = ${coeffOn.toFixed(4)} × 유효슈팅 + ${coeffOff.toFixed(4)} × 빗나간슈팅 + ${intercept.toFixed(4)}`);
  }

  // xG NULL인 레코드에 pseudo-xG 채우기
  const nullXg = await prisma.fixtureTeamStatSnapshot.findMany({
    where: { xg: null, shotsOnTarget: { not: null }, shotsTotal: { not: null } },
    select: { id: true, shotsTotal: true, shotsOnTarget: true },
  });

  log(`  채울 대상: ${nullXg.length}개`);

  const batchSize = 100;
  let filled = 0;
  for (let i = 0; i < nullXg.length; i += batchSize) {
    const batch = nullXg.slice(i, i + batchSize);
    const updates = batch.map(s => {
      const onT = s.shotsOnTarget ?? 0;
      const offT = (s.shotsTotal ?? 0) - onT;
      const pxg = Math.max(0, Math.round((intercept + coeffOn * onT + coeffOff * offT) * 100) / 100);
      return prisma.fixtureTeamStatSnapshot.update({
        where: { id: s.id },
        data: { xg: pxg },
      });
    });
    await prisma.$transaction(updates);
    filled += batch.length;
  }

  log(`Phase 3 완료: ${filled}개 pseudo-xG 생성`, "success");
  return filled;
}

// ============================================================
// 메인
// ============================================================
async function main() {
  if (!API_KEY) {
    console.error("❌ API_SPORTS_KEY가 .env에 없습니다!");
    process.exit(1);
  }

  const startTime = Date.now();

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          🌙 Soccer-Brain 야간 전자동 백필러              ║
║                                                           ║
║  시작: ${new Date().toLocaleString("ko-KR")}                      ║
║  API 한도: ${MAX_API_CALLS.toLocaleString()}콜 (안전 여유 5,000)              ║
║  대상 시즌: ${SEASONS.join(", ")}                    ║
╚═══════════════════════════════════════════════════════════╝
`);

  // Phase 1: 경기 일정
  const fixturesAdded = await phase1_fixtures();

  // Phase 2: 경기 스탯
  let statsAdded = 0;
  if (canContinue()) {
    statsAdded = await phase2_stats();
  }

  // Phase 3: pseudo-xG — 비활성화 (노이즈)
  // const xgFilled = await phase3_pseudoXg();

  // Phase 4: FeatureSnapshot 빌드 — 폐기됨 (radarEngine으로 대체)

  // 최종 리포트
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          📊 야간 백필 최종 리포트                         ║
╠═══════════════════════════════════════════════════════════╣
║  소요 시간:       ${elapsed.padStart(8)}분                           ║
║  API 콜 사용:     ${String(apiCallsUsed).padStart(8)}콜                          ║
║  API 잔여:        ${String(apiCallsRemaining ?? "?").padStart(8)}콜                          ║
╠═══════════════════════════════════════════════════════════╣
║  [Phase 1] 경기 추가:     ${String(fixturesAdded).padStart(8)}경기                  ║
║  [Phase 2] 스탯 추가:     ${String(statsAdded).padStart(8)}경기                  ║
║  [Phase 3] (폐기됨)                                        ║
╠═══════════════════════════════════════════════════════════╣
║  ${canContinue() ? "✅ 정상 완료!" : "⚠️ API 한도로 중단됨. 내일 다시 실행하면 이어서 진행."}                                          ║
╚═══════════════════════════════════════════════════════════╝
`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error("💥 치명적 오류:", e);
  prisma.$disconnect();
  process.exit(1);
});
