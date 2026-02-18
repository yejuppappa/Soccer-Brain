/**
 * Soccer Brain v2 - New Frontend API Routes
 * 이 파일을 기존 routes.ts 하단에 추가하거나, 별도 import 해서 사용
 * 
 * 추가 엔드포인트:
 * GET /api/v2/fixtures?date=2026-02-10&sort=time|league
 * GET /api/v2/fixtures/:id/detail
 * GET /api/v2/fixtures/:id/h2h?count=5&type=all&venue=all
 * GET /api/v2/highlights?date=2026-02-10
 */

import type { Express } from "express";
import { PrismaClient } from "@prisma/client";
import { computeRadarScores } from "./engines/radarEngine.js";
import type { RadarWindow } from "../shared/schema.js";

const prisma = new PrismaClient();

// 시즌 판별 (기존 로직 재사용)
function getCurrentSeason(apiLeagueId: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const springStartLeagues = [292, 293, 98, 99];
  if (springStartLeagues.includes(apiLeagueId)) {
    return year;
  }
  return month >= 7 ? year : year - 1;
}

export function registerV2Routes(app: Express) {
  
  // ============================================================
  // GET /api/v2/fixtures — 날짜별 경기 목록 (홈 화면)
  // filter: popular(default) | all | favorites
  // sort: time(default) | league
  // league: 하위 호환용 (filter 우선)
  // ============================================================
  app.get("/api/v2/fixtures", async (req, res) => {
    try {
      const dateStr = req.query.date as string;
      const sortParam = (req.query.sort as string) || "time";

      // 날짜 범위: 해당 날짜의 00:00 ~ 23:59 (KST 기준)
      let startDate: Date, endDate: Date;
      if (dateStr) {
        startDate = new Date(dateStr + "T00:00:00+09:00");
        endDate = new Date(dateStr + "T23:59:59+09:00");
      } else {
        const today = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstToday = new Date(today.getTime() + kstOffset);
        const dateOnly = kstToday.toISOString().split("T")[0];
        startDate = new Date(dateOnly + "T00:00:00+09:00");
        endDate = new Date(dateOnly + "T23:59:59+09:00");
      }

      // exposed + enabled 리그의 경기만 반환
      const exposedLeagues = await prisma.league.findMany({
        where: { exposed: true, enabled: true },
        select: { id: true },
      });
      const leagueCondition = { leagueId: { in: exposedLeagues.map(l => l.id) } };

      // 정렬: league → priority asc + kickoffAt asc, time → kickoffAt asc
      const orderBy = sortParam === "league"
        ? [{ league: { priority: "asc" as const } }, { kickoffAt: "asc" as const }]
        : [{ kickoffAt: "asc" as const }];

      const fixtures = await prisma.fixture.findMany({
        where: {
          kickoffAt: { gte: startDate, lte: endDate },
          ...leagueCondition,
        },
        include: {
          homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true, apiTeamId: true } },
          awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true, apiTeamId: true } },
          league: { select: { id: true, name: true, country: true, apiLeagueId: true, logoUrl: true, flagUrl: true, priority: true } },
          odds: { select: { home: true, draw: true, away: true } },
        },
        orderBy,
      });

      const result = fixtures.map(fx => ({
        id: fx.id.toString(),
        apiFixtureId: fx.apiFixtureId,
        kickoffAt: fx.kickoffAt.toISOString(),
        status: fx.status,
        homeTeam: {
          id: fx.homeTeam.id.toString(),
          apiTeamId: fx.homeTeam.apiTeamId,
          name: fx.homeTeam.name,
          shortName: fx.homeTeam.shortName,
          logoUrl: fx.homeTeam.logoUrl,
        },
        awayTeam: {
          id: fx.awayTeam.id.toString(),
          apiTeamId: fx.awayTeam.apiTeamId,
          name: fx.awayTeam.name,
          shortName: fx.awayTeam.shortName,
          logoUrl: fx.awayTeam.logoUrl,
        },
        league: {
          id: fx.league.id.toString(),
          name: fx.league.name,
          country: fx.league.country,
          apiId: fx.league.apiLeagueId,
          logoUrl: fx.league.logoUrl,
          flagUrl: fx.league.flagUrl,
          priority: fx.league.priority,
        },
        round: fx.round,
        score: (fx.homeGoals !== null && fx.awayGoals !== null)
          ? { home: fx.homeGoals, away: fx.awayGoals }
          : null,
        odds: fx.odds ? {
          home: Number(fx.odds.home),
          draw: Number(fx.odds.draw),
          away: Number(fx.odds.away),
        } : null,
      }));

      // leagueGroups: sort=league일 때만 포함
      let leagueGroups: Array<{ leagueId: string; name: string; logoUrl: string | null; flagUrl: string | null; apiId: number; fixtureCount: number }> | undefined;
      if (sortParam === "league") {
        const groupMap = new Map<string, { leagueId: string; name: string; logoUrl: string | null; flagUrl: string | null; apiId: number; priority: number; fixtureCount: number }>();
        for (const fx of fixtures) {
          const lid = fx.league.id.toString();
          if (!groupMap.has(lid)) {
            groupMap.set(lid, {
              leagueId: lid,
              name: fx.league.name,
              logoUrl: fx.league.logoUrl,
              flagUrl: fx.league.flagUrl,
              apiId: fx.league.apiLeagueId,
              priority: fx.league.priority,
              fixtureCount: 0,
            });
          }
          groupMap.get(lid)!.fixtureCount++;
        }
        leagueGroups = [...groupMap.values()]
          .sort((a, b) => a.priority - b.priority)
          .map(({ priority: _p, ...rest }) => rest);
      }

      const response: Record<string, any> = {
        ok: true,
        date: dateStr || new Date().toISOString().split("T")[0],
        sort: sortParam,
        fixtures: result,
      };
      if (leagueGroups) {
        response.leagueGroups = leagueGroups;
      }

      res.json(response);
    } catch (error: any) {
      console.error("[v2/fixtures] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  
  // ============================================================
  // GET /api/v2/fixtures/:id/detail — 경기 상세 (단일 스크롤 페이지용)
  // ============================================================
  app.get("/api/v2/fixtures/:id/detail", async (req, res) => {
    try {
      const fixtureId = BigInt(req.params.id);

      // Phase 1: Fixture 로드 (1쿼리)
      const fixture = await prisma.fixture.findUnique({
        where: { id: fixtureId },
        include: {
          homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          league: { select: { id: true, name: true, country: true, apiLeagueId: true } },
          odds: true,
          weather: { select: { tempC: true, condition: true, humidityPct: true, windKph: true } },
          bookmakerOdds: {
            orderBy: { updatedAt: "desc" },
          },
          lineups: {
            include: {
              players: {
                include: { player: { select: { name: true, position: true } } },
              },
            },
            orderBy: { isConfirmed: "desc" },
          },
        },
      });

      if (!fixture) {
        return res.status(404).json({ ok: false, error: "Fixture not found" });
      }

      // Phase 2: 병렬 쿼리 (8개 + radar)
      const radarWindow: RadarWindow = req.query.window === "season" ? "season" : "last5";
      const h2hOptions = parseH2HOptions(req.query as Record<string, any>);
      const [
        homeStanding,
        awayStanding,
        radar,
        homeRecentFixtures,
        awayRecentFixtures,
        homeAllStats,
        awayAllStats,
        h2h,
        homeInjuriesRaw,
        awayInjuriesRaw,
      ] = await Promise.all([
        // [1] 홈팀 순위
        prisma.standing.findFirst({
          where: { teamId: fixture.homeTeamId, leagueId: fixture.leagueId, season: fixture.season },
        }),
        // [2] 원정팀 순위
        prisma.standing.findFirst({
          where: { teamId: fixture.awayTeamId, leagueId: fixture.leagueId, season: fixture.season },
        }),
        // [3] 레이더 점수
        computeRadarScores(fixtureId, radarWindow),
        // [4] 홈팀 최근 5경기 (모든 대회) → recentForm + restDays
        prisma.fixture.findMany({
          where: {
            OR: [{ homeTeamId: fixture.homeTeamId }, { awayTeamId: fixture.homeTeamId }],
            status: "FT",
            kickoffAt: { lt: fixture.kickoffAt },
            homeGoals: { not: null },
            awayGoals: { not: null },
          },
          orderBy: { kickoffAt: "desc" },
          take: 5,
          select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, kickoffAt: true },
        }),
        // [5] 원정팀 최근 5경기 (모든 대회)
        prisma.fixture.findMany({
          where: {
            OR: [{ homeTeamId: fixture.awayTeamId }, { awayTeamId: fixture.awayTeamId }],
            status: "FT",
            kickoffAt: { lt: fixture.kickoffAt },
            homeGoals: { not: null },
            awayGoals: { not: null },
          },
          orderBy: { kickoffAt: "desc" },
          take: 5,
          select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, kickoffAt: true },
        }),
        // [6] 홈팀 시즌 통계 — 같은 리그만 (컵/챔스 제외)
        prisma.fixtureTeamStatSnapshot.findMany({
          where: {
            fixture: {
              OR: [{ homeTeamId: fixture.homeTeamId }, { awayTeamId: fixture.homeTeamId }],
              status: "FT",
              season: fixture.season,
              leagueId: fixture.leagueId,
              kickoffAt: { lt: fixture.kickoffAt },
            },
          },
          select: {
            teamId: true, fixtureId: true,
            xg: true, possessionPct: true, shotsOnTarget: true, corners: true, passAccuracyPct: true,
            fixture: { select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, kickoffAt: true } },
          },
          orderBy: { fixture: { kickoffAt: "desc" } },
        }),
        // [7] 원정팀 시즌 통계 — 같은 리그만
        prisma.fixtureTeamStatSnapshot.findMany({
          where: {
            fixture: {
              OR: [{ homeTeamId: fixture.awayTeamId }, { awayTeamId: fixture.awayTeamId }],
              status: "FT",
              season: fixture.season,
              leagueId: fixture.leagueId,
              kickoffAt: { lt: fixture.kickoffAt },
            },
          },
          select: {
            teamId: true, fixtureId: true,
            xg: true, possessionPct: true, shotsOnTarget: true, corners: true, passAccuracyPct: true,
            fixture: { select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, kickoffAt: true } },
          },
          orderBy: { fixture: { kickoffAt: "desc" } },
        }),
        // [8] H2H 상대전적
        computeH2H(fixture.homeTeamId, fixture.awayTeamId, fixture.kickoffAt, h2hOptions),
        // [9] 홈팀 최근 부상자 (팀 기준, 가장 최근 경기의 부상 리포트)
        getTeamRecentInjuries(fixture.homeTeamId),
        // [10] 원정팀 최근 부상자
        getTeamRecentInjuries(fixture.awayTeamId),
      ]);

      // --- 데이터 가공 ---

      // recentForm + restDays
      const homeForm = computeRecentForm(homeRecentFixtures, fixture.homeTeamId);
      const awayForm = computeRecentForm(awayRecentFixtures, fixture.awayTeamId);
      const homeRest = computeRestDays(homeRecentFixtures, fixture.kickoffAt);
      const awayRest = computeRestDays(awayRecentFixtures, fixture.kickoffAt);

      // injuries: 팀 기준 최근 부상 리포트 (fixture 연결이 아닌 팀별 조회)
      const homeInjuries = homeInjuriesRaw.map((i: any) => ({
        player: i.playerName, position: i.player?.position ?? null, reason: i.reason, status: i.status,
      }));
      const awayInjuries = awayInjuriesRaw.map((i: any) => ({
        player: i.playerName, position: i.player?.position ?? null, reason: i.reason, status: i.status,
      }));

      // standings
      const fmtStanding = (s: any) => s ? {
        rank: s.rank, points: s.points, played: s.played,
        won: s.won, drawn: s.drawn, lost: s.lost,
        goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst, form: s.form,
      } : null;

      // seasonStats (raw 기반 실시간 계산)
      const seasonStats = {
        home: {
          season: computeStatAverages(homeAllStats, fixture.homeTeamId, null),
          last5: computeStatAverages(homeAllStats, fixture.homeTeamId, 5),
        },
        away: {
          season: computeStatAverages(awayAllStats, fixture.awayTeamId, null),
          last5: computeStatAverages(awayAllStats, fixture.awayTeamId, 5),
        },
      };

      // odds
      const oddsData = fixture.odds;
      const oddsResult = oddsData ? {
        current: {
          home: Number(oddsData.home),
          draw: Number(oddsData.draw),
          away: Number(oddsData.away),
          bookmaker: oddsData.bookmaker,
        },
        allBookmakers: fixture.bookmakerOdds
          .map(bo => ({
            bookmaker: bo.bookmaker,
            home: Number(bo.currentHome || bo.openHome || 0),
            draw: Number(bo.currentDraw || bo.openDraw || 0),
            away: Number(bo.currentAway || bo.openAway || 0),
          }))
          .filter(bo => bo.home > 0),
      } : null;

      // lineups
      const homeLineup = formatTeamLineup(fixture.lineups, fixture.homeTeamId);
      const awayLineup = formatTeamLineup(fixture.lineups, fixture.awayTeamId);
      const lineupsResult = (homeLineup || awayLineup)
        ? { home: homeLineup, away: awayLineup }
        : null;

      // impliedProb (summary 생성용)
      let impliedProb = null;
      if (oddsData) {
        const h = Number(oddsData.home), d = Number(oddsData.draw), a = Number(oddsData.away);
        if (h > 0 && d > 0 && a > 0) {
          const totalMargin = (1/h + 1/d + 1/a);
          impliedProb = {
            home: Math.round((1/h / totalMargin) * 100),
            draw: Math.round((1/d / totalMargin) * 100),
            away: Math.round((1/a / totalMargin) * 100),
          };
        }
      }

      // summary 생성
      const summaryCtx = {
        homeInjuryCount: homeInjuries.length,
        awayInjuryCount: awayInjuries.length,
        rest_diff: (homeRest != null && awayRest != null) ? homeRest - awayRest : null,
      };
      const summary = generateMatchSummary(fixture, homeStanding, awayStanding, summaryCtx, impliedProb);

      // --- 최종 응답 ---
      res.json({
        ok: true,
        fixture: {
          id: fixture.id.toString(),
          kickoffAt: fixture.kickoffAt.toISOString(),
          status: fixture.status,
          score: (fixture.homeGoals !== null && fixture.awayGoals !== null)
            ? { home: fixture.homeGoals, away: fixture.awayGoals } : null,
          venue: { name: fixture.venueName, city: fixture.venueCity },
          league: {
            id: fixture.league.id.toString(),
            name: fixture.league.name,
            country: fixture.league.country,
            apiId: fixture.league.apiLeagueId,
          },
        },
        weather: fixture.weather ? {
          temp: fixture.weather.tempC,
          condition: fixture.weather.condition,
          humidity: fixture.weather.humidityPct,
          windKph: fixture.weather.windKph,
        } : null,
        home: {
          team: {
            id: fixture.homeTeam.id.toString(),
            name: fixture.homeTeam.name,
            shortName: fixture.homeTeam.shortName,
            logo: fixture.homeTeam.logoUrl,
          },
          recentForm: homeForm,
          restDays: homeRest,
          injuries: homeInjuries,
          standing: fmtStanding(homeStanding),
        },
        away: {
          team: {
            id: fixture.awayTeam.id.toString(),
            name: fixture.awayTeam.name,
            shortName: fixture.awayTeam.shortName,
            logo: fixture.awayTeam.logoUrl,
          },
          recentForm: awayForm,
          restDays: awayRest,
          injuries: awayInjuries,
          standing: fmtStanding(awayStanding),
        },
        odds: oddsResult,
        radar,
        seasonStats,
        h2h,
        lineups: lineupsResult,
        summary,
      });
    } catch (error: any) {
      console.error("[v2/fixtures/:id/detail] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  
  // ============================================================
  // GET /api/v2/fixtures/:id/h2h — H2H 상대전적 (필터 지원)
  // ============================================================
  app.get("/api/v2/fixtures/:id/h2h", async (req, res) => {
    try {
      const fixtureId = BigInt(req.params.id);
      const fixture = await prisma.fixture.findUnique({
        where: { id: fixtureId },
        select: { homeTeamId: true, awayTeamId: true, kickoffAt: true },
      });

      if (!fixture) {
        return res.status(404).json({ ok: false, error: "Fixture not found" });
      }

      const options = parseH2HOptions(req.query as Record<string, any>);
      const h2h = await computeH2H(fixture.homeTeamId, fixture.awayTeamId, fixture.kickoffAt, options);

      res.json({ ok: true, ...h2h });
    } catch (error: any) {
      console.error("[v2/fixtures/:id/h2h] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ============================================================
  // GET /api/v2/highlights — 주목할 경기 (홈 상단)
  // ============================================================
  app.get("/api/v2/highlights", async (_req, res) => {
    // 하이라이트 선정 조건 재설계 예정 — 임시 비활성화
    res.json({ ok: true, highlights: [] });
  });

  // ============================================================
  // GET /api/v2/teams/search — 팀 검색 (즐겨찾기용)
  // ============================================================
  app.get("/api/v2/teams/search", async (req, res) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (q.length < 2) return res.json({ ok: true, teams: [] });

      // 콤마 구분 다중 검색 지원 (한글 역매핑 결과)
      const names = q.split(",").map(n => n.trim()).filter(n => n.length >= 2);

      const where = names.length > 1
        ? { OR: names.map(n => ({ name: { contains: n, mode: "insensitive" as const } })) }
        : { name: { contains: names[0], mode: "insensitive" as const } };

      const teams = await prisma.team.findMany({
        where,
        select: { apiTeamId: true, name: true, logoUrl: true },
        take: 20,
        orderBy: { name: "asc" },
      });

      res.json({ ok: true, teams });
    } catch (error: any) {
      console.error("[v2/teams/search] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
}

// ============================================================
// 유틸리티
// ============================================================
function getWinStreak(form: string): number {
  let streak = 0;
  for (let i = form.length - 1; i >= 0; i--) {
    if (form[i] === "W") streak++;
    else break;
  }
  return streak;
}

// ============================================================
// null-safe 평균
// ============================================================
function avgNum(nums: (number | null | undefined)[]): number | null {
  const clean = nums.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (clean.length === 0) return null;
  return Math.round((clean.reduce((a, b) => a + b, 0) / clean.length) * 100) / 100;
}

// ============================================================
// recentForm: 최근 경기 W/D/L 배열 (오른쪽=최근)
// ============================================================
function computeRecentForm(
  recentFixtures: Array<{
    homeTeamId: bigint; awayTeamId: bigint;
    homeGoals: number | null; awayGoals: number | null;
  }>,
  teamId: bigint,
): ("W" | "D" | "L")[] {
  // recentFixtures는 kickoffAt desc 정렬 (최근이 먼저)
  const results: ("W" | "D" | "L")[] = [];
  for (const fx of recentFixtures) {
    if (fx.homeGoals === null || fx.awayGoals === null) continue;
    const isHome = fx.homeTeamId === teamId;
    const gf = isHome ? fx.homeGoals : fx.awayGoals;
    const ga = isHome ? fx.awayGoals : fx.homeGoals;
    if (gf > ga) results.push("W");
    else if (gf === ga) results.push("D");
    else results.push("L");
  }
  // reverse: 오른쪽=최근
  return results.reverse();
}

// ============================================================
// restDays: 직전 경기와의 일수 차이
// ============================================================
function computeRestDays(
  recentFixtures: Array<{ kickoffAt: Date }>,
  targetKickoff: Date,
): number | null {
  if (recentFixtures.length === 0) return null;
  const lastMatch = recentFixtures[0].kickoffAt; // desc 정렬이므로 [0]=가장 최근
  return Math.floor((targetKickoff.getTime() - lastMatch.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================
// seasonStats: 시즌 통계 계산 (raw FixtureTeamStatSnapshot 기반)
// ============================================================
interface SeasonStatFields {
  xgDiff: number | null;
  goals: number | null;
  conceded: number | null;
  possession: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  passAccuracy: number | null;
}

function computeStatAverages(
  allStats: Array<{
    teamId: bigint; fixtureId: bigint;
    xg: number | null; possessionPct: number | null;
    shotsOnTarget: number | null; corners: number | null; passAccuracyPct: number | null;
    fixture: {
      homeTeamId: bigint; awayTeamId: bigint;
      homeGoals: number | null; awayGoals: number | null;
      kickoffAt: Date;
    };
  }>,
  teamId: bigint,
  limit: number | null,
): SeasonStatFields {
  // 1. fixtureId별 그룹핑 (양팀 페어링)
  const byFixture = new Map<string, typeof allStats>();
  for (const snap of allStats) {
    const fid = snap.fixtureId.toString();
    if (!byFixture.has(fid)) byFixture.set(fid, []);
    byFixture.get(fid)!.push(snap);
  }

  // 2. fixture별 정렬 (kickoffAt desc), 팀이 참여한 경기만
  const fixtureEntries = [...byFixture.entries()]
    .filter(([, snaps]) => snaps.some(s => s.teamId === teamId))
    .sort((a, b) => {
      const aTime = a[1][0].fixture.kickoffAt.getTime();
      const bTime = b[1][0].fixture.kickoffAt.getTime();
      return bTime - aTime;
    });

  const targetEntries = limit ? fixtureEntries.slice(0, limit) : fixtureEntries;

  // 3. 경기별 지표 추출
  const xgDiffs: number[] = [];
  const goals: number[] = [];
  const conceded: number[] = [];
  const possessions: (number | null)[] = [];
  const sots: (number | null)[] = [];
  const cornersList: (number | null)[] = [];
  const passAccList: (number | null)[] = [];

  for (const [, snaps] of targetEntries) {
    const teamSnap = snaps.find(s => s.teamId === teamId);
    const oppSnap = snaps.find(s => s.teamId !== teamId);
    if (!teamSnap) continue;

    const fx = teamSnap.fixture;
    const isHome = fx.homeTeamId === teamId;
    const gf = isHome ? fx.homeGoals : fx.awayGoals;
    const ga = isHome ? fx.awayGoals : fx.homeGoals;

    if (gf !== null) goals.push(gf);
    if (ga !== null) conceded.push(ga);

    if (teamSnap.xg != null && oppSnap?.xg != null) {
      xgDiffs.push(teamSnap.xg - oppSnap.xg);
    }

    possessions.push(teamSnap.possessionPct);
    sots.push(teamSnap.shotsOnTarget);
    cornersList.push(teamSnap.corners);
    passAccList.push(teamSnap.passAccuracyPct);
  }

  return {
    xgDiff: avgNum(xgDiffs),
    goals: avgNum(goals),
    conceded: avgNum(conceded),
    possession: avgNum(possessions),
    shotsOnTarget: avgNum(sots),
    corners: avgNum(cornersList),
    passAccuracy: avgNum(passAccList),
  };
}

// ============================================================
// formatTeamLineup: 라인업 포맷 (확정 우선)
// ============================================================
function formatTeamLineup(
  lineups: Array<{
    teamId: bigint;
    formation: string | null;
    coachName: string | null;
    isConfirmed: boolean;
    players: Array<{
      isStarter: boolean;
      number: number | null;
      pos: string | null;
      grid: string | null;
      player: { name: string; position: string | null };
    }>;
  }>,
  teamId: bigint,
): {
  formation: string | null;
  coach: string | null;
  confirmed: boolean;
  starters: Array<{ player: string; pos: string | null; number: number | null; grid: string | null }>;
  subs: Array<{ player: string; pos: string | null; number: number | null }>;
} | null {
  // 확정 라인업 우선 (orderBy isConfirmed desc로 이미 정렬)
  const lineup = lineups.find(l => l.teamId === teamId);
  if (!lineup || lineup.players.length === 0) return null;

  return {
    formation: lineup.formation,
    coach: lineup.coachName,
    confirmed: lineup.isConfirmed,
    starters: lineup.players
      .filter(p => p.isStarter)
      .map(p => ({ player: p.player.name, pos: p.pos, number: p.number, grid: p.grid })),
    subs: lineup.players
      .filter(p => !p.isStarter)
      .map(p => ({ player: p.player.name, pos: p.pos, number: p.number })),
  };
}

// ============================================================
// 경기 요약 생성 (템플릿 기반)
// ============================================================
function generateMatchSummary(
  fixture: any,
  homeStanding: any,
  awayStanding: any,
  context: { homeInjuryCount: number; awayInjuryCount: number; rest_diff: number | null },
  impliedProb: any,
): string {
  const parts: string[] = [];
  const homeName = fixture.homeTeam.shortName || fixture.homeTeam.name;
  const awayName = fixture.awayTeam.shortName || fixture.awayTeam.name;

  // 1. 배당 기반
  if (impliedProb) {
    const fav = impliedProb.home > impliedProb.away ? homeName : awayName;
    const favPct = Math.max(impliedProb.home, impliedProb.away);
    parts.push(`배당상 ${fav} 우세 (${favPct}%).`);
  }

  // 2. 순위
  if (homeStanding && awayStanding) {
    parts.push(`${homeName} ${homeStanding.rank}위(${homeStanding.won}승${homeStanding.drawn}무${homeStanding.lost}패) vs ${awayName} ${awayStanding.rank}위(${awayStanding.won}승${awayStanding.drawn}무${awayStanding.lost}패).`);
  }

  // 3. 폼
  if (homeStanding?.form && awayStanding?.form) {
    const homeWins = (homeStanding.form || "").split("").filter((c: string) => c === "W").length;
    const awayWins = (awayStanding.form || "").split("").filter((c: string) => c === "W").length;
    parts.push(`최근 5경기: ${homeName} ${homeWins}승, ${awayName} ${awayWins}승.`);
  }

  // 4. 부상자 수
  const homeInj = context.homeInjuryCount;
  const awayInj = context.awayInjuryCount;
  if (homeInj + awayInj > 0) {
    const injParts: string[] = [];
    if (homeInj > 0) injParts.push(`${homeName} ${homeInj}명`);
    if (awayInj > 0) injParts.push(`${awayName} ${awayInj}명`);
    parts.push(`결장/부상: ${injParts.join(", ")}.`);
  }

  // 5. 휴식일 차이
  if (context.rest_diff !== null && Math.abs(context.rest_diff) >= 3) {
    const tired = context.rest_diff > 0 ? awayName : homeName;
    parts.push(`${tired}은 체력적 불리 (휴식일 차이 ${Math.abs(context.rest_diff)}일).`);
  }

  return parts.join(" ") || "분석 데이터 수집 중입니다.";
}

// ============================================================
// H2H 상대전적
// ============================================================

/** 컵 대회 apiLeagueId 목록 */
const CUP_LEAGUE_IDS = new Set([
  2, 3, 17, 18, 45, 48, 66, 81, 137, 143, 294,
  526, 528, 529, 531, 547, 556, 848,
]);

type H2HType = "league" | "all";
type H2HVenue = "home" | "all";

interface H2HOptions {
  count: number;
  type: H2HType;
  venue: H2HVenue;
}

function parseH2HOptions(query: Record<string, any>): H2HOptions {
  const rawCount = parseInt(query.count || query.h2hCount);
  const count = [3, 5, 10, 20].includes(rawCount) ? rawCount : 5;
  const type: H2HType = (query.type || query.h2hType) === "league" ? "league" : "all";
  const venue: H2HVenue = (query.venue || query.h2hVenue) === "home" ? "home" : "all";
  return { count, type, venue };
}

async function computeH2H(
  homeTeamId: bigint,
  awayTeamId: bigint,
  kickoffBefore: Date,
  options: H2HOptions,
) {
  // 장소 필터: "home"이면 현재 홈팀이 홈인 경기만
  const venueCondition = options.venue === "home"
    ? { homeTeamId, awayTeamId }
    : { OR: [
        { homeTeamId, awayTeamId },
        { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
      ] };

  // 대회 유형 필터: "league"면 컵대회 제외
  const typeCondition = options.type === "league"
    ? { league: { apiLeagueId: { notIn: [...CUP_LEAGUE_IDS] } } }
    : {};

  const matches = await prisma.fixture.findMany({
    where: {
      ...venueCondition,
      ...typeCondition,
      status: "FT",
      kickoffAt: { lt: kickoffBefore },
      homeGoals: { not: null },
      awayGoals: { not: null },
    },
    include: {
      league: { select: { name: true } },
      homeTeam: { select: { name: true, shortName: true } },
      awayTeam: { select: { name: true, shortName: true } },
    },
    orderBy: { kickoffAt: "desc" },
    take: options.count,
  });

  // 통계 집계
  let homeWins = 0, draws = 0, awayWins = 0;
  let totalGoals = 0, over25Count = 0, bttsCount = 0;

  const matchList = matches.map(m => {
    const hg = m.homeGoals!;
    const ag = m.awayGoals!;
    const isCurrentHomeTeamHome = m.homeTeamId === homeTeamId;

    // 결과: 현재 경기 홈팀 기준 W/D/L
    const gf = isCurrentHomeTeamHome ? hg : ag;
    const ga = isCurrentHomeTeamHome ? ag : hg;
    let result: "W" | "D" | "L";
    if (gf > ga) { result = "W"; homeWins++; }
    else if (gf === ga) { result = "D"; draws++; }
    else { result = "L"; awayWins++; }

    totalGoals += hg + ag;
    if (hg + ag > 2) over25Count++;
    if (hg > 0 && ag > 0) bttsCount++;

    return {
      date: m.kickoffAt.toISOString(),
      competition: m.league.name,
      homeTeam: m.homeTeam.shortName || m.homeTeam.name,
      awayTeam: m.awayTeam.shortName || m.awayTeam.name,
      homeGoals: hg,
      awayGoals: ag,
      isHomeVenue: isCurrentHomeTeamHome,
      result,
    };
  });

  const total = matches.length;

  return {
    filters: { count: options.count, type: options.type, venue: options.venue },
    summary: {
      total,
      homeWins,
      draws,
      awayWins,
      homeWinPct: total > 0 ? Math.round((homeWins / total) * 100) : 0,
      drawPct: total > 0 ? Math.round((draws / total) * 100) : 0,
      awayWinPct: total > 0 ? Math.round((awayWins / total) * 100) : 0,
    },
    metrics: {
      avgGoalsPerMatch: total > 0 ? Math.round((totalGoals / total) * 100) / 100 : null,
      over25Count,
      over25Pct: total > 0 ? Math.round((over25Count / total) * 100) : 0,
      bttsCount,
      bttsPct: total > 0 ? Math.round((bttsCount / total) * 100) : 0,
    },
    matches: matchList,
  };
}

// ============================================================
// 팀 기준 최근 부상자 조회 (가장 최근 경기의 부상 리포트)
// ============================================================
async function getTeamRecentInjuries(teamId: bigint) {
  // 해당 팀의 가장 최근 부상 리포트가 있는 fixtureId를 찾고, 그 경기의 부상자 반환
  const latestInjury = await prisma.fixtureInjury.findFirst({
    where: { teamId },
    orderBy: { fetchedAt: "desc" },
    select: { fixtureId: true },
  });

  if (!latestInjury) return [];

  const injuries = await prisma.fixtureInjury.findMany({
    where: {
      teamId,
      fixtureId: latestInjury.fixtureId,
    },
    include: {
      player: { select: { position: true } },
    },
    orderBy: { playerName: "asc" },
  });

  // 선수명 기준 중복 제거 (가장 최근 fetchedAt 유지)
  const seen = new Set<string>();
  return injuries.filter(i => {
    if (seen.has(i.playerName)) return false;
    seen.add(i.playerName);
    return true;
  });
}
