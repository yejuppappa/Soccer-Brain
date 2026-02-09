/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║  Soccer-Brain 10년 확장 백필러 (2015~2019)               ║
 * ╠═══════════════════════════════════════════════════════════╣
 * ║                                                           ║
 * ║  1차 백필(2020~2025) 완료 후 실행.                       ║
 * ║  과거 5년치를 추가하여 총 10년 데이터 확보.              ║
 * ║                                                           ║
 * ║  실행: npx tsx scripts/overnight-backfill-10yr.ts         ║
 * ║                                                           ║
 * ║  [Phase 1] 경기 일정 채우기 (2015~2019)                  ║
 * ║  [Phase 2] 경기 스탯 채우기                               ║
 * ║  [Phase 3] 피처 스냅샷 빌드                               ║
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
const SEASONS = [2015, 2016, 2017, 2018, 2019];
const CALENDAR_YEAR_LEAGUES = new Set([292, 293, 98, 99, 253, 71, 128, 169, 307, 333, 17, 18, 294]);

// 리그별 최초 시즌 (이전 시즌은 API 콜 낭비 방지)
const LEAGUE_START_SEASON: Record<number, number> = {
  848: 2021,  // Europa Conference League: 2021-22부터 (전부 스킵)
  531: 2017,  // UEFA Super Cup
  18:  2017,  // AFC Cup
  293: 2017,  // K League 2
  294: 2016,  // Korean FA Cup
  17:  2016,  // AFC Champions League (API 데이터)
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
// Phase 4: 피처 스냅샷 빌드
// ============================================================
async function phase4_features(): Promise<number> {
  log("\n════════════════════════════════════════════════");
  log("  [Phase 4] 피처 스냅샷 빌드 (API 콜 0)");
  log("════════════════════════════════════════════════");

  // 스탯이 있고, 결과가 있고, 피처가 없는 경기
  const enabledLeagueIds = (
    await prisma.league.findMany({ where: { enabled: true }, select: { id: true } })
  ).map(l => l.id);

  let totalBuilt = 0;
  const BATCH = 5000;

  while (true) {
    const fixtures = await prisma.fixture.findMany({
      where: {
        status: "FT",
        homeGoals: { not: null },
        awayGoals: { not: null },
        leagueId: { in: enabledLeagueIds },
        teamStats: { some: {} },
        featureSnapshot: { is: null },
      },
      select: {
        id: true,
        apiFixtureId: true,
        leagueId: true,
        season: true,
        kickoffAt: true,
        homeTeamId: true,
        awayTeamId: true,
        homeGoals: true,
        awayGoals: true,
      },
      orderBy: { kickoffAt: "asc" },
      take: BATCH,
    });

    if (fixtures.length === 0) {
      if (totalBuilt === 0) log("  Phase 4 스킵: 빌드할 경기 없음", "success");
      break;
    }

    log(`  피처 미빌드 경기: ${fixtures.length}개 (누적 완료: ${totalBuilt})`);


  function avg(nums: Array<number | null | undefined>) {
    const clean = nums.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (clean.length === 0) return null;
    return clean.reduce((a, b) => a + b, 0) / clean.length;
  }

  const N = 5; // 최근 N경기

  let built = 0;

  for (let i = 0; i < fixtures.length; i++) {
    const fx = fixtures[i];

    try {
      // 홈팀 최근 N경기 스탯
      const homeStats = await prisma.fixtureTeamStatSnapshot.findMany({
        where: { teamId: fx.homeTeamId, fixture: { kickoffAt: { lt: fx.kickoffAt }, status: "FT" } },
        orderBy: { fixture: { kickoffAt: "desc" } },
        take: N,
        select: {
          shotsTotal: true, shotsOnTarget: true, possessionPct: true,
          passesTotal: true, passAccuracyPct: true, fouls: true,
          corners: true, yellowCards: true, redCards: true, xg: true,
        },
      });

      // 어웨이팀 최근 N경기 스탯
      const awayStats = await prisma.fixtureTeamStatSnapshot.findMany({
        where: { teamId: fx.awayTeamId, fixture: { kickoffAt: { lt: fx.kickoffAt }, status: "FT" } },
        orderBy: { fixture: { kickoffAt: "desc" } },
        take: N,
        select: {
          shotsTotal: true, shotsOnTarget: true, possessionPct: true,
          passesTotal: true, passAccuracyPct: true, fouls: true,
          corners: true, yellowCards: true, redCards: true, xg: true,
        },
      });

      // 최근 N경기 득실
      const homeGoalsData = await prisma.fixture.findMany({
        where: { kickoffAt: { lt: fx.kickoffAt }, status: "FT", OR: [{ homeTeamId: fx.homeTeamId }, { awayTeamId: fx.homeTeamId }] },
        orderBy: { kickoffAt: "desc" },
        take: N,
        select: { homeTeamId: true, homeGoals: true, awayGoals: true },
      });

      const awayGoalsData = await prisma.fixture.findMany({
        where: { kickoffAt: { lt: fx.kickoffAt }, status: "FT", OR: [{ homeTeamId: fx.awayTeamId }, { awayTeamId: fx.awayTeamId }] },
        orderBy: { kickoffAt: "desc" },
        take: N,
        select: { homeTeamId: true, homeGoals: true, awayGoals: true },
      });

      const homeGF = homeGoalsData.map(g => g.homeTeamId === fx.homeTeamId ? g.homeGoals : g.awayGoals);
      const homeGA = homeGoalsData.map(g => g.homeTeamId === fx.homeTeamId ? g.awayGoals : g.homeGoals);
      const awayGF = awayGoalsData.map(g => g.homeTeamId === fx.awayTeamId ? g.homeGoals : g.awayGoals);
      const awayGA = awayGoalsData.map(g => g.homeTeamId === fx.awayTeamId ? g.awayGoals : g.homeGoals);

      // 폼 (최근 3, 5경기)
      function calcForm(teamId: bigint, matches: typeof homeGoalsData): number | null {
        if (matches.length === 0) return null;
        const points = matches.map(m => {
          const gf = m.homeTeamId === teamId ? m.homeGoals : m.awayGoals;
          const ga = m.homeTeamId === teamId ? m.awayGoals : m.homeGoals;
          if (gf === null || ga === null) return null;
          return gf > ga ? 3 : gf === ga ? 1 : 0;
        });
        return avg(points);
      }

      const homeFormData5 = await prisma.fixture.findMany({
        where: { kickoffAt: { lt: fx.kickoffAt }, status: "FT", OR: [{ homeTeamId: fx.homeTeamId }, { awayTeamId: fx.homeTeamId }] },
        orderBy: { kickoffAt: "desc" }, take: 5,
        select: { homeTeamId: true, homeGoals: true, awayGoals: true },
      });
      const awayFormData5 = await prisma.fixture.findMany({
        where: { kickoffAt: { lt: fx.kickoffAt }, status: "FT", OR: [{ homeTeamId: fx.awayTeamId }, { awayTeamId: fx.awayTeamId }] },
        orderBy: { kickoffAt: "desc" }, take: 5,
        select: { homeTeamId: true, homeGoals: true, awayGoals: true },
      });

      // 휴식일
      const homeLastMatch = await prisma.fixture.findFirst({
        where: { kickoffAt: { lt: fx.kickoffAt }, status: "FT", OR: [{ homeTeamId: fx.homeTeamId }, { awayTeamId: fx.homeTeamId }] },
        orderBy: { kickoffAt: "desc" }, select: { kickoffAt: true },
      });
      const awayLastMatch = await prisma.fixture.findFirst({
        where: { kickoffAt: { lt: fx.kickoffAt }, status: "FT", OR: [{ homeTeamId: fx.awayTeamId }, { awayTeamId: fx.awayTeamId }] },
        orderBy: { kickoffAt: "desc" }, select: { kickoffAt: true },
      });

      const homeRest = homeLastMatch ? Math.floor((fx.kickoffAt.getTime() - homeLastMatch.kickoffAt.getTime()) / 86400000) : null;
      const awayRest = awayLastMatch ? Math.floor((fx.kickoffAt.getTime() - awayLastMatch.kickoffAt.getTime()) / 86400000) : null;

      // 부상자 수
      const homeInjuries = await prisma.fixtureInjury.count({ where: { fixtureId: fx.id, teamId: fx.homeTeamId } });
      const awayInjuries = await prisma.fixtureInjury.count({ where: { fixtureId: fx.id, teamId: fx.awayTeamId } });

      // H2H (최근 2년)
      const twoYearsAgo = new Date(fx.kickoffAt.getTime() - 2 * 365 * 86400000);
      const h2h = await prisma.fixture.findMany({
        where: {
          kickoffAt: { gte: twoYearsAgo, lt: fx.kickoffAt },
          status: "FT",
          OR: [
            { homeTeamId: fx.homeTeamId, awayTeamId: fx.awayTeamId },
            { homeTeamId: fx.awayTeamId, awayTeamId: fx.homeTeamId },
          ],
        },
        select: { homeTeamId: true, homeGoals: true, awayGoals: true },
      });

      let h2hHomeWins = 0, h2hAwayWins = 0, h2hDraws = 0;
      const h2hHomeGoals: number[] = [], h2hAwayGoals: number[] = [];
      for (const m of h2h) {
        const isHomeTeamHome = m.homeTeamId === fx.homeTeamId;
        const gHome = isHomeTeamHome ? m.homeGoals : m.awayGoals;
        const gAway = isHomeTeamHome ? m.awayGoals : m.homeGoals;
        if (gHome !== null && gAway !== null) {
          h2hHomeGoals.push(gHome);
          h2hAwayGoals.push(gAway);
          if (gHome > gAway) h2hHomeWins++;
          else if (gHome < gAway) h2hAwayWins++;
          else h2hDraws++;
        }
      }

      // 스냅샷 저장
      const hSA = (field: keyof typeof homeStats[0]) => avg(homeStats.map(r => r[field] as number | null));
      const aSA = (field: keyof typeof awayStats[0]) => avg(awayStats.map(r => r[field] as number | null));

      await prisma.fixtureFeatureSnapshot.upsert({
        where: { fixtureId: fx.id },
        update: { builtAt: new Date() },
        create: {
          fixtureId: fx.id,
          featureVersion: 5,
          nMatches: N,
          builtAt: new Date(),
          kickoffAt: fx.kickoffAt,
          season: fx.season,
          leagueId: fx.leagueId,
          homeTeamId: fx.homeTeamId,
          awayTeamId: fx.awayTeamId,
          homeGoals: fx.homeGoals,
          awayGoals: fx.awayGoals,

          homeInjuryCount: homeInjuries,
          awayInjuryCount: awayInjuries,

          home_shotsTotal_avg: hSA("shotsTotal"),
          home_shotsOnTarget_avg: hSA("shotsOnTarget"),
          home_possessionPct_avg: hSA("possessionPct"),
          home_passAccuracyPct_avg: hSA("passAccuracyPct"),
          home_corners_avg: hSA("corners"),
          home_xg_avg: hSA("xg"),
          home_goalsFor_avg: avg(homeGF),
          home_goalsAgainst_avg: avg(homeGA),
          home_yellowCards_avg: hSA("yellowCards"),
          home_redCards_avg: hSA("redCards"),
          home_fouls_avg: hSA("fouls"),
          home_passesTotal_avg: hSA("passesTotal"),

          away_shotsTotal_avg: aSA("shotsTotal"),
          away_shotsOnTarget_avg: aSA("shotsOnTarget"),
          away_possessionPct_avg: aSA("possessionPct"),
          away_passAccuracyPct_avg: aSA("passAccuracyPct"),
          away_corners_avg: aSA("corners"),
          away_xg_avg: aSA("xg"),
          away_goalsFor_avg: avg(awayGF),
          away_goalsAgainst_avg: avg(awayGA),
          away_yellowCards_avg: aSA("yellowCards"),
          away_redCards_avg: aSA("redCards"),
          away_fouls_avg: aSA("fouls"),
          away_passesTotal_avg: aSA("passesTotal"),

          // diff
          shotsTotal_diff: (hSA("shotsTotal") ?? 0) - (aSA("shotsTotal") ?? 0) || null,
          shotsOnTarget_diff: (hSA("shotsOnTarget") ?? 0) - (aSA("shotsOnTarget") ?? 0) || null,
          possessionPct_diff: (hSA("possessionPct") ?? 0) - (aSA("possessionPct") ?? 0) || null,
          xg_diff: (hSA("xg") ?? 0) - (aSA("xg") ?? 0) || null,
          goalsFor_diff: (avg(homeGF) ?? 0) - (avg(awayGF) ?? 0) || null,
          goalsAgainst_diff: (avg(homeGA) ?? 0) - (avg(awayGA) ?? 0) || null,
          injuryCount_diff: homeInjuries - awayInjuries,

          // 폼
          home_form_last3: calcForm(fx.homeTeamId, homeFormData5.slice(0, 3)),
          home_form_last5: calcForm(fx.homeTeamId, homeFormData5),
          away_form_last3: calcForm(fx.awayTeamId, awayFormData5.slice(0, 3)),
          away_form_last5: calcForm(fx.awayTeamId, awayFormData5),

          // 휴식
          home_days_rest: homeRest,
          away_days_rest: awayRest,
          rest_diff: homeRest !== null && awayRest !== null ? homeRest - awayRest : null,

          // H2H
          h2h_total_matches: h2h.length > 0 ? h2h.length : null,
          h2h_home_wins: h2h.length > 0 ? h2hHomeWins : null,
          h2h_away_wins: h2h.length > 0 ? h2hAwayWins : null,
          h2h_draws: h2h.length > 0 ? h2hDraws : null,
          h2h_home_goals_avg: h2hHomeGoals.length > 0 ? avg(h2hHomeGoals) : null,
          h2h_away_goals_avg: h2hAwayGoals.length > 0 ? avg(h2hAwayGoals) : null,
          h2h_home_win_pct: h2h.length > 0 ? h2hHomeWins / h2h.length : null,
        },
      });

      built++;
    } catch (err: any) {
      // 스킵하고 계속
    }

    // 1000건마다 중간 리포트
    if ((i + 1) % 1000 === 0 || i + 1 === fixtures.length) {
      log(`  피처 빌드 진행: ${i + 1}/${fixtures.length} (${built}개 완료)`);
    }
  }

  log(`Phase 4 완료: ${built}개 피처 빌드`, "success");
  totalBuilt += built;
  } // end while

  log(`Phase 4 최종: 총 ${totalBuilt}개 피처 빌드`, "success");
  return totalBuilt;
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
║          🌙 Soccer-Brain 10년 확장 백필러 (2015~2019)     ║
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

  // Phase 4: 피처 빌드 (API 콜 0)
  const featuresBuilt = await phase4_features();

  // 최종 리포트
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          📊 10년 확장 백필 최종 리포트                     ║
╠═══════════════════════════════════════════════════════════╣
║  소요 시간:       ${elapsed.padStart(8)}분                           ║
║  API 콜 사용:     ${String(apiCallsUsed).padStart(8)}콜                          ║
║  API 잔여:        ${String(apiCallsRemaining ?? "?").padStart(8)}콜                          ║
╠═══════════════════════════════════════════════════════════╣
║  [Phase 1] 경기 추가:     ${String(fixturesAdded).padStart(8)}경기                  ║
║  [Phase 2] 스탯 추가:     ${String(statsAdded).padStart(8)}경기                  ║
║  [Phase 3] 피처 빌드:     ${String(featuresBuilt).padStart(8)}개                    ║
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
