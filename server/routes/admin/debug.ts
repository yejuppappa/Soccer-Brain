import { Router } from "express";
import axios from "axios";
import { prisma } from "../../db";

const router = Router();

// ── 경기 날짜 범위 ──
router.get("/fixtures-range", async (_req, res) => {
  const min = await prisma.fixture.findFirst({
    orderBy: { kickoffAt: "asc" },
    select: { kickoffAt: true },
  });
  const max = await prisma.fixture.findFirst({
    orderBy: { kickoffAt: "desc" },
    select: { kickoffAt: true },
  });

  return res.json({
    minKickoffAt: min?.kickoffAt ?? null,
    maxKickoffAt: max?.kickoffAt ?? null,
  });
});

// ── 부상자 raw API 응답 (디버그용) ──
router.get("/injuries-raw", async (req, res) => {
  const season = Number(req.query.season ?? 2023);
  const league = req.query.league ? Number(req.query.league) : undefined;
  const team = req.query.team ? Number(req.query.team) : undefined;

  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) return res.status(400).json({ error: "API_SPORTS_KEY missing" });

  const params: any = { season };
  if (league) params.league = league;
  if (team) params.team = team;

  const r = await axios.get("https://v3.football.api-sports.io/injuries", {
    params,
    headers: { "x-apisports-key": apiKey },
    timeout: 20000,
  });

  const items: any[] = r.data?.response ?? [];

  return res.json({
    season,
    league: league ?? null,
    team: team ?? null,
    total: items.length,
    sample: items.slice(0, 3),
    errors: r.data?.errors ?? null,
  });
});

// ── 스탯 커버리지 ──
router.get("/stats-coverage", async (req, res) => {
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;

  if (!from || !to) return res.status(400).json({ error: "from/to required" });

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return res.status(400).json({ error: "Invalid from/to date" });
  }

  const fixtures = await prisma.fixture.count({
    where: {
      kickoffAt: { gte: fromDate, lte: toDate },
      status: "FT",
      ...(leagueId ? { league: { apiLeagueId: leagueId } } : {}),
    },
  });

  const statRows = await prisma.fixtureTeamStatSnapshot.count({
    where: {
      fixture: {
        kickoffAt: { gte: fromDate, lte: toDate },
        status: "FT",
        ...(leagueId ? { league: { apiLeagueId: leagueId } } : {}),
      },
    },
  });

  return res.json({
    range: { from, to },
    leagueId: leagueId ?? null,
    fixturesFT: fixtures,
    statRows,
    expectedStatRows: fixtures * 2,
    coveragePct: fixtures === 0 ? 0 : Math.round((statRows / (fixtures * 2)) * 10000) / 100,
  });
});

// ── 경기장 디버그 ──
router.get("/debug-venues", async (req, res) => {
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const rows = await prisma.fixture.findMany({
    where: { kickoffAt: { gte: fromDate, lte: toDate } },
    select: { id: true, apiFixtureId: true, venueName: true, venueCity: true },
    take: 10,
    orderBy: { kickoffAt: "asc" },
  });

  return res.json({ sample: rows });
});

// ── 종합 데이터 커버리지 ──
router.get("/data-coverage", async (req, res) => {
  try {
    const season = req.query.season ? Number(req.query.season) : undefined;

    const leagues = await prisma.league.findMany({
      where: { enabled: true, ...(season ? { season } : {}) },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });

    const coverageByLeague: any[] = [];

    for (const league of leagues) {
      const fixtures = await prisma.fixture.findMany({
        where: { leagueId: league.id },
        select: { id: true, status: true },
      });

      const fixtureIds = fixtures.map((f) => f.id);
      const totalFixtures = fixtures.length;
      const finishedFixtures = fixtures.filter((f) =>
        ["FT", "AET", "PEN"].includes(f.status)
      ).length;

      const teamStatsCount = await prisma.fixtureTeamStatSnapshot.count({
        where: { fixtureId: { in: fixtureIds } },
      });

      const weatherCount = await prisma.fixtureWeather.count({
        where: { fixtureId: { in: fixtureIds } },
      });

      const injuryFixtures = await prisma.fixtureInjury.groupBy({
        by: ["fixtureId"],
        where: { fixtureId: { in: fixtureIds } },
      });

      const oddsCount = await prisma.fixtureOdds.count({
        where: { fixtureId: { in: fixtureIds } },
      });

      coverageByLeague.push({
        league: {
          id: league.id,
          apiLeagueId: league.apiLeagueId,
          name: league.name,
          country: league.country,
          season: league.season,
        },
        fixtures: {
          total: totalFixtures,
          finished: finishedFixtures,
          finishedPct: totalFixtures > 0 ? Math.round((finishedFixtures / totalFixtures) * 100) : 0,
        },
        teamStats: {
          count: teamStatsCount,
          expected: finishedFixtures * 2,
          coveragePct: finishedFixtures > 0 ? Math.round((teamStatsCount / (finishedFixtures * 2)) * 100) : 0,
        },
        weather: {
          count: weatherCount,
          coveragePct: totalFixtures > 0 ? Math.round((weatherCount / totalFixtures) * 100) : 0,
        },
        injuries: {
          fixturesWithData: injuryFixtures.length,
          coveragePct: totalFixtures > 0 ? Math.round((injuryFixtures.length / totalFixtures) * 100) : 0,
        },
        odds: {
          count: oddsCount,
          coveragePct: totalFixtures > 0 ? Math.round((oddsCount / totalFixtures) * 100) : 0,
        },
      });
    }

    const totals = {
      fixtures: coverageByLeague.reduce((sum, l) => sum + l.fixtures.total, 0),
      finishedFixtures: coverageByLeague.reduce((sum, l) => sum + l.fixtures.finished, 0),
      teamStats: coverageByLeague.reduce((sum, l) => sum + l.teamStats.count, 0),
      weather: coverageByLeague.reduce((sum, l) => sum + l.weather.count, 0),
      injuries: coverageByLeague.reduce((sum, l) => sum + l.injuries.fixturesWithData, 0),
      odds: coverageByLeague.reduce((sum, l) => sum + l.odds.count, 0),
    };

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      filter: { season: season || "all" },
      totals: {
        ...totals,
        teamStatsCoveragePct: totals.finishedFixtures > 0
          ? Math.round((totals.teamStats / (totals.finishedFixtures * 2)) * 100)
          : 0,
        weatherCoveragePct: totals.fixtures > 0
          ? Math.round((totals.weather / totals.fixtures) * 100)
          : 0,
        injuriesCoveragePct: totals.fixtures > 0
          ? Math.round((totals.injuries / totals.fixtures) * 100)
          : 0,
        oddsCoveragePct: totals.fixtures > 0
          ? Math.round((totals.odds / totals.fixtures) * 100)
          : 0,
      },
      byLeague: coverageByLeague,
    });
  } catch (error: any) {
    console.error("[data-coverage] Error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ── 데이터 카운트 ──
router.get("/data-counts", async (_req, res) => {
  try {
    const [fixtures, teams, odds, teamStats] = await Promise.all([
      prisma.fixture.count(),
      prisma.team.count(),
      prisma.fixtureOdds.count(),
      prisma.fixtureTeamStatSnapshot.count(),
    ]);

    res.json({
      ok: true,
      counts: { fixtures, teams, odds, teamStats },
    });
  } catch (error: any) {
    console.error("[data-counts] Error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
