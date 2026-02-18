import { Router } from "express";
import axios from "axios";
import { prisma } from "../../db";

const router = Router();

// 🏆 리그 초기화 API
router.post("/init-leagues", async (req, res) => {
  try {
    const defaultLeagues = [
      { apiLeagueId: 39, name: "Premier League", country: "England", season: 2023, priority: 100 },
      { apiLeagueId: 140, name: "La Liga", country: "Spain", season: 2023, priority: 90 },
      { apiLeagueId: 135, name: "Serie A", country: "Italy", season: 2023, priority: 80 },
      { apiLeagueId: 78, name: "Bundesliga", country: "Germany", season: 2023, priority: 70 },
      { apiLeagueId: 61, name: "Ligue 1", country: "France", season: 2023, priority: 60 },
      { apiLeagueId: 2, name: "UEFA Champions League", country: "Europe", season: 2023, priority: 95 },
      { apiLeagueId: 3, name: "UEFA Europa League", country: "Europe", season: 2023, priority: 50 },
      { apiLeagueId: 292, name: "K League 1", country: "South Korea", season: 2024, priority: 40 },
      { apiLeagueId: 39, name: "Premier League", country: "England", season: 2022, priority: 99 },
      { apiLeagueId: 140, name: "La Liga", country: "Spain", season: 2022, priority: 89 },
      { apiLeagueId: 135, name: "Serie A", country: "Italy", season: 2022, priority: 79 },
      { apiLeagueId: 78, name: "Bundesliga", country: "Germany", season: 2022, priority: 69 },
      { apiLeagueId: 61, name: "Ligue 1", country: "France", season: 2022, priority: 59 },
    ];

    const results: any[] = [];
    let created = 0;
    let updated = 0;

    for (const league of defaultLeagues) {
      const existing = await prisma.league.findFirst({
        where: {
          apiLeagueId: league.apiLeagueId,
          season: league.season,
        },
      });

      if (existing) {
        await prisma.league.update({
          where: { id: existing.id },
          data: {
            name: league.name,
            country: league.country,
            priority: league.priority,
            enabled: true,
          },
        });
        updated++;
        results.push({ ...league, status: "updated" });
      } else {
        await prisma.league.create({
          data: {
            apiLeagueId: league.apiLeagueId,
            name: league.name,
            country: league.country,
            season: league.season,
            priority: league.priority,
            enabled: true,
          },
        });
        created++;
        results.push({ ...league, status: "created" });
      }
    }

    res.json({
      ok: true,
      message: `리그 초기화 완료: ${created}개 생성, ${updated}개 업데이트`,
      created,
      updated,
      leagues: results,
    });
  } catch (error: any) {
    console.error("[init-leagues] Error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 현재 리그 목록 조회
router.get("/leagues", async (req, res) => {
  try {
    const leagues = await prisma.league.findMany({
      orderBy: [{ priority: "desc" }, { season: "desc" }, { name: "asc" }],
    });

    res.json({
      ok: true,
      count: leagues.length,
      leagues: leagues.map((l) => ({
        id: l.id,
        apiLeagueId: l.apiLeagueId,
        name: l.name,
        country: l.country,
        season: l.season,
        enabled: l.enabled,
        priority: l.priority,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 리그 활성화/비활성화 토글
router.post("/leagues/:id/toggle", async (req, res) => {
  try {
    const id = BigInt(req.params.id);
    const league = await prisma.league.findUnique({ where: { id } });

    if (!league) {
      return res.status(404).json({ ok: false, error: "League not found" });
    }

    const updated = await prisma.league.update({
      where: { id },
      data: { enabled: !league.enabled },
    });

    res.json({
      ok: true,
      message: `${updated.name} (${updated.season}) → ${updated.enabled ? "활성화" : "비활성화"}`,
      league: updated,
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 전체 비활성화
router.post("/leagues/disable-all", async (_req, res) => {
  const result = await prisma.league.updateMany({
    data: { enabled: false, priority: 0 },
  });
  res.json({ updated: result.count });
});

// API-Football에서 리그 동기화
router.post("/sync-leagues", async (req, res) => {
  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "API_SPORTS_KEY missing in .env" });
  }

  const season = Number(req.query.season ?? 2023);
  if (!Number.isFinite(season)) {
    return res.status(400).json({ error: "season must be a number" });
  }

  const client = axios.create({
    baseURL: "https://v3.football.api-sports.io",
    headers: { "x-apisports-key": apiKey },
    timeout: 20000,
  });

  const r = await client.get("/leagues", {
    params: { season },
  });

  const items: any[] = r.data?.response ?? [];

  let upserted = 0;
  for (const item of items) {
    const leagueId = item?.league?.id;
    const name = item?.league?.name;
    const country = item?.country?.name ?? null;

    if (!leagueId || !name) continue;

    await prisma.league.upsert({
      where: { apiLeagueId: Number(leagueId) },
      create: {
        apiLeagueId: Number(leagueId),
        name: String(name),
        country: country ? String(country) : null,
        season,
        enabled: true,
        priority: 0,
      },
      update: {
        name: String(name),
        country: country ? String(country) : null,
        season,
      },
    });

    upserted++;
  }

  return res.json({ season, upserted });
});

export default router;
