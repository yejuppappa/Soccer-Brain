import { Router } from "express";
import axios from "axios";
import { prisma } from "../../db";
import { isApiConfigured } from "../../api-football";

const router = Router();

// ── 부상자 수집 ──
router.post("/sync-injuries", async (req, res) => {
  const season = Number(req.query.season ?? 2023);
  const league = req.query.league ? Number(req.query.league) : undefined;

  if (!Number.isFinite(season)) {
    return res.status(400).json({
      error: "season required (number)",
      example: "/api/admin/sync-injuries?season=2023",
    });
  }

  if (!isApiConfigured()) {
    return res.status(400).json({ error: "API not configured" });
  }

  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "API_SPORTS_KEY missing in .env" });
  }

  try {
    const params: any = { season };
    if (league) params.league = league;

    const r = await axios.get("https://v3.football.api-sports.io/injuries", {
      params,
      headers: { "x-apisports-key": apiKey },
      timeout: 20000,
    });

    const items: any[] = r.data?.response ?? [];

    const limit = Number(req.query.limit ?? 50);
    const targets = items.slice(0, limit);

    let saved = 0;
    let skipped = 0;

    for (const item of targets) {
      const apiFixtureId = item?.fixture?.id;
      const apiTeamId = item?.team?.id;

      if (!apiFixtureId || !apiTeamId) {
        skipped++;
        continue;
      }

      const fixture = await prisma.fixture.findUnique({
        where: { apiFixtureId: Number(apiFixtureId) },
        select: { id: true },
      });
      if (!fixture) {
        skipped++;
        continue;
      }

      const team = await prisma.team.findUnique({
        where: { apiTeamId: Number(apiTeamId) },
        select: { id: true },
      });
      if (!team) {
        skipped++;
        continue;
      }

      const apiPlayerId = item?.player?.id ?? null;
      const playerName = String(item?.player?.name ?? "UNKNOWN");

      const player =
        apiPlayerId
          ? await prisma.player.findUnique({
              where: { apiPlayerId: Number(apiPlayerId) },
              select: { id: true },
            })
          : null;

      const source = "api-football";
      const apiFixtureIdNum = Number(item?.fixture?.id);
      const apiTeamIdNum = Number(item?.team?.id);
      const apiPlayerIdNum = apiPlayerId ? Number(apiPlayerId) : null;
      const externalKey = `${apiFixtureIdNum}:${apiTeamIdNum}:${apiPlayerIdNum ?? "null"}:${playerName}`;

      await prisma.fixtureInjury.upsert({
        where: {
          source_externalKey: { source, externalKey },
        },
        update: {
          fixtureId: fixture.id,
          teamId: team.id,
          apiPlayerId: apiPlayerIdNum,
          playerName,
          status: item?.reason ?? null,
          reason: item?.player?.reason ?? item?.type ?? null,
          raw: item,
          fetchedAt: new Date(),
          playerId: player?.id ?? null,
          source,
          externalKey,
        },
        create: {
          fixtureId: fixture.id,
          teamId: team.id,
          apiPlayerId: apiPlayerIdNum,
          playerName,
          status: item?.reason ?? null,
          reason: item?.player?.reason ?? item?.type ?? null,
          raw: item,
          fetchedAt: new Date(),
          playerId: player?.id ?? null,
          source,
          externalKey,
        },
      });

      saved++;
    }

    return res.json({ ok: true, season, league: league ?? null, total: items.length, saved, skipped });
  } catch (e: any) {
    console.log("====== [sync-injuries FAILED] ======");
    console.log("message:", e?.message ?? String(e));
    console.log("name:", e?.name ?? null);
    console.log("code:", e?.code ?? null);
    console.log("axios status:", e?.response?.status ?? null);
    console.log("axios data:", e?.response?.data ?? null);
    console.log("prisma meta:", e?.meta ?? null);
    console.log("====================================");

    return res.status(500).json({ ok: false, error: "sync-injuries failed" });
  }
});

router.get("/sync-injuries", (_req, res) => {
  res.status(405).json({
    error: "Method Not Allowed",
    hint: "POST로 호출하세요",
    example: "/api/admin/sync-injuries?from=2024-09-01&to=2024-09-30",
  });
});

// ── 벌크 부상자 수집 ──
router.post("/sync-injuries-bulk", async (req, res) => {
  const season = Number(req.query.season ?? 2023);
  const limitPerLeague = Number(req.query.limitPerLeague ?? 200);
  const dryRun = String(req.query.dryRun ?? "0") === "1";

  if (!Number.isFinite(season)) {
    return res.status(400).json({ error: "season must be a number" });
  }
  if (!isApiConfigured()) {
    return res.status(400).json({ error: "API not configured" });
  }

  const apiKey = process.env.API_SPORTS_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: "API_SPORTS_KEY missing in .env" });
  }

  const leagues = await prisma.league.findMany({
    where: { enabled: true },
    select: { id: true, apiLeagueId: true, name: true },
    orderBy: [{ priority: "desc" }, { id: "asc" }],
  });

  const perLeague: any[] = [];
  let totalFetched = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalNoFixtureMatch = 0;
  let totalNoTeamMatch = 0;

  for (const lg of leagues) {
    try {
      const r = await axios.get("https://v3.football.api-sports.io/injuries", {
        params: { season, league: lg.apiLeagueId },
        headers: { "x-apisports-key": apiKey },
        timeout: 20000,
      });

      const items: any[] = r.data?.response ?? [];
      totalFetched += items.length;

      let saved = 0;
      let skipped = 0;
      let noFixtureMatch = 0;
      let noTeamMatch = 0;

      const targets = items.slice(0, limitPerLeague);

      for (const item of targets) {
        const apiFixtureId = item?.fixture?.id;
        const apiTeamId = item?.team?.id;

        if (!apiFixtureId || !apiTeamId) {
          skipped++;
          continue;
        }

        const fixture = await prisma.fixture.findUnique({
          where: { apiFixtureId: Number(apiFixtureId) },
          select: { id: true },
        });
        if (!fixture) {
          noFixtureMatch++;
          continue;
        }

        const team = await prisma.team.findUnique({
          where: { apiTeamId: Number(apiTeamId) },
          select: { id: true },
        });
        if (!team) {
          noTeamMatch++;
          continue;
        }

        const apiPlayerId = item?.player?.id ?? null;
        const playerName = String(item?.player?.name ?? "UNKNOWN");

        const player =
          apiPlayerId
            ? await prisma.player.findUnique({
                where: { apiPlayerId: Number(apiPlayerId) },
                select: { id: true },
              })
            : null;

        const source = "api-football";
        const externalKey = `${Number(apiFixtureId)}:${Number(apiTeamId)}:${apiPlayerId ? Number(apiPlayerId) : "null"}:${playerName}`;

        if (!dryRun) {
          await prisma.fixtureInjury.upsert({
            where: { source_externalKey: { source, externalKey } },
            update: {
              fixtureId: fixture.id,
              teamId: team.id,
              apiPlayerId: apiPlayerId ? Number(apiPlayerId) : null,
              playerName,
              status: item?.reason ?? null,
              reason: item?.player?.reason ?? item?.type ?? null,
              raw: item,
              fetchedAt: new Date(),
              playerId: player?.id ?? null,
              source,
              externalKey,
            },
            create: {
              fixtureId: fixture.id,
              teamId: team.id,
              apiPlayerId: apiPlayerId ? Number(apiPlayerId) : null,
              playerName,
              status: item?.reason ?? null,
              reason: item?.player?.reason ?? item?.type ?? null,
              raw: item,
              fetchedAt: new Date(),
              playerId: player?.id ?? null,
              source,
              externalKey,
            },
          });
        }

        saved++;
      }

      totalSaved += saved;
      totalSkipped += skipped;
      totalNoFixtureMatch += noFixtureMatch;
      totalNoTeamMatch += noTeamMatch;

      perLeague.push({
        leagueId: lg.apiLeagueId,
        name: lg.name,
        fetched: items.length,
        processed: targets.length,
        saved,
        skipped,
        noFixtureMatch,
        noTeamMatch,
      });

      await new Promise((r) => setTimeout(r, 250));
    } catch (e: any) {
      perLeague.push({
        leagueId: lg.apiLeagueId,
        name: lg.name,
        error: e?.response?.data ?? e?.message ?? String(e),
      });
    }
  }

  return res.json({
    ok: true,
    season,
    enabledLeagues: leagues.length,
    dryRun,
    limitPerLeague,
    totalFetched,
    totalSaved,
    totalSkipped,
    totalNoFixtureMatch,
    totalNoTeamMatch,
    perLeague,
  });
});

export default router;
