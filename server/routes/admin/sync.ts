import { Router } from "express";
import axios from "axios";
import { prisma } from "../../db";
import {
  isApiConfigured,
  fetchFixturesByDateRange,
  fetchStandingsForLeague,
  fetchFixtureTeamStats,
} from "../../api-football";
import { normalizeTeamStats } from "../../utils/normalizeTeamStats";
import { getCurrentSeason } from "../_helpers";

const router = Router();

// ── 경기 일정 수집 ──
router.post("/sync-fixtures", async (req, res) => {
  try {
    if (!isApiConfigured()) {
      return res.status(400).json({ error: "API not configured" });
    }

    const seasonOverride = req.query.season ? Number(req.query.season) : null;
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");

    if (!from || !to) {
      return res.status(400).json({
        error: "Missing from/to",
        example: "/api/admin/sync-fixtures?from=2026-02-18&to=2026-02-25",
      });
    }

    const leagues = await prisma.league.findMany({
      where: { enabled: true },
      orderBy: [{ priority: "desc" }, { id: "asc" }],
    });

    let totalUpserted = 0;
    const perLeague: any[] = [];

    for (const league of leagues) {
      const season = seasonOverride ?? getCurrentSeason(league.apiLeagueId);
      const rows = await fetchFixturesByDateRange({
        leagueId: league.apiLeagueId,
        season,
        from,
        to,
      });

      let upserted = 0;

      for (const fx of rows) {
        const home = await prisma.team.upsert({
          where: { apiTeamId: fx.homeTeamId },
          update: { name: fx.homeTeam },
          create: { apiTeamId: fx.homeTeamId, name: fx.homeTeam, country: null, logoUrl: `https://media.api-sports.io/football/teams/${fx.homeTeamId}.png` },
        });
        if (!home.logoUrl) {
          await prisma.team.update({ where: { id: home.id }, data: { logoUrl: `https://media.api-sports.io/football/teams/${fx.homeTeamId}.png` } });
        }

        const away = await prisma.team.upsert({
          where: { apiTeamId: fx.awayTeamId },
          update: { name: fx.awayTeam },
          create: { apiTeamId: fx.awayTeamId, name: fx.awayTeam, country: null, logoUrl: `https://media.api-sports.io/football/teams/${fx.awayTeamId}.png` },
        });
        if (!away.logoUrl) {
          await prisma.team.update({ where: { id: away.id }, data: { logoUrl: `https://media.api-sports.io/football/teams/${fx.awayTeamId}.png` } });
        }

        await prisma.fixture.upsert({
          where: { apiFixtureId: fx.fixtureId },
          update: {
            leagueId: league.id,
            season,
            kickoffAt: new Date(fx.date),
            status: fx.status || "NS",
            homeTeamId: home.id,
            awayTeamId: away.id,
            homeGoals: Number.isFinite(fx.homeScore as any) ? (fx.homeScore as number) : null,
            awayGoals: Number.isFinite(fx.awayScore as any) ? (fx.awayScore as number) : null,
            venueName: fx.venueName ?? null,
            venueCity: fx.venueCity ?? null,
          },
          create: {
            apiFixtureId: fx.fixtureId,
            leagueId: league.id,
            season,
            kickoffAt: new Date(fx.date),
            status: fx.status || "NS",
            homeTeamId: home.id,
            awayTeamId: away.id,
            homeGoals: Number.isFinite(fx.homeScore as any) ? (fx.homeScore as number) : null,
            awayGoals: Number.isFinite(fx.awayScore as any) ? (fx.awayScore as number) : null,
            venueName: fx.venueName ?? null,
            venueCity: fx.venueCity ?? null,
          },
        });

        upserted++;
        totalUpserted++;
      }

      perLeague.push({ leagueId: league.apiLeagueId, name: league.name, fetched: rows.length, upserted });
    }

    res.json({ seasonOverride, from, to, enabledLeagues: leagues.length, totalUpserted, perLeague });
  } catch (e: any) {
    console.error("[sync-fixtures]", e?.message || e);
    res.status(500).json({ error: e?.message || "sync-fixtures failed" });
  }
});

// ── 스마트 경기 수집 (시즌 자동 판별) ──
router.post("/sync-fixtures-smart", async (req, res) => {
  try {
    if (!isApiConfigured()) {
      return res.status(400).json({ error: "API not configured" });
    }

    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    const onlyLeagueId = req.query.leagueId ? Number(req.query.leagueId) : null;

    if (!from || !to) {
      return res.status(400).json({
        error: "Missing from/to",
        example: "/api/admin/sync-fixtures-smart?from=2024-04-01&to=2024-05-31",
        example2: "/api/admin/sync-fixtures-smart?leagueId=292&from=2024-04-01&to=2024-05-31",
      });
    }

    const CALENDAR_YEAR_LEAGUE_IDS = new Set<number>([292, 293, 98, 99]);

    function parseYmd(s: string) {
      const [y, m, d] = s.split("-").map((v) => Number(v));
      if (!y || !m || !d) return null;
      return { y, m, d };
    }

    function inferSeason(leagueApiId: number, fromYmd: { y: number; m: number }) {
      if (CALENDAR_YEAR_LEAGUE_IDS.has(leagueApiId)) {
        return fromYmd.y;
      }
      return fromYmd.m >= 7 ? fromYmd.y : fromYmd.y - 1;
    }

    const fromYmd = parseYmd(from);
    const toYmd = parseYmd(to);
    if (!fromYmd || !toYmd) {
      return res.status(400).json({ error: "from/to must be YYYY-MM-DD" });
    }

    const leagues = await prisma.league.findMany({
      where: {
        enabled: true,
        ...(onlyLeagueId ? { apiLeagueId: onlyLeagueId } : {}),
      },
      orderBy: [{ priority: "desc" }, { id: "asc" }],
    });

    if (leagues.length === 0) {
      return res.status(404).json({
        error: "No enabled leagues found",
        hint: onlyLeagueId
          ? "해당 leagueId가 enabled=true인지 확인"
          : "enabled=true인 리그가 있는지 확인",
      });
    }

    let totalUpserted = 0;
    const perLeague: any[] = [];

    for (const league of leagues) {
      const season = inferSeason(league.apiLeagueId, fromYmd);

      const rows = await fetchFixturesByDateRange({
        leagueId: league.apiLeagueId,
        season,
        from,
        to,
      });

      let upserted = 0;

      for (const fx of rows) {
        const home = await prisma.team.upsert({
          where: { apiTeamId: fx.homeTeamId },
          update: { name: fx.homeTeam },
          create: { apiTeamId: fx.homeTeamId, name: fx.homeTeam, country: null, logoUrl: `https://media.api-sports.io/football/teams/${fx.homeTeamId}.png` },
        });
        if (!home.logoUrl) {
          await prisma.team.update({ where: { id: home.id }, data: { logoUrl: `https://media.api-sports.io/football/teams/${fx.homeTeamId}.png` } });
        }

        const away = await prisma.team.upsert({
          where: { apiTeamId: fx.awayTeamId },
          update: { name: fx.awayTeam },
          create: { apiTeamId: fx.awayTeamId, name: fx.awayTeam, country: null, logoUrl: `https://media.api-sports.io/football/teams/${fx.awayTeamId}.png` },
        });
        if (!away.logoUrl) {
          await prisma.team.update({ where: { id: away.id }, data: { logoUrl: `https://media.api-sports.io/football/teams/${fx.awayTeamId}.png` } });
        }

        await prisma.fixture.upsert({
          where: { apiFixtureId: fx.fixtureId },
          update: {
            leagueId: league.id,
            season,
            kickoffAt: new Date(fx.date),
            status: fx.status || "NS",
            homeTeamId: home.id,
            awayTeamId: away.id,
            homeGoals: Number.isFinite(fx.homeScore as any) ? (fx.homeScore as number) : null,
            awayGoals: Number.isFinite(fx.awayScore as any) ? (fx.awayScore as number) : null,
            venueName: fx.venueName ?? null,
            venueCity: fx.venueCity ?? null,
          },
          create: {
            apiFixtureId: fx.fixtureId,
            leagueId: league.id,
            season,
            kickoffAt: new Date(fx.date),
            status: fx.status || "NS",
            homeTeamId: home.id,
            awayTeamId: away.id,
            homeGoals: Number.isFinite(fx.homeScore as any) ? (fx.homeScore as number) : null,
            awayGoals: Number.isFinite(fx.awayScore as any) ? (fx.awayScore as number) : null,
            venueName: fx.venueName ?? null,
            venueCity: fx.venueCity ?? null,
          },
        });

        upserted++;
        totalUpserted++;
      }

      perLeague.push({
        leagueId: league.apiLeagueId,
        name: league.name,
        inferredSeason: season,
        fetched: rows.length,
        upserted,
      });
    }

    return res.json({
      from,
      to,
      enabledLeagues: leagues.length,
      totalUpserted,
      perLeague,
    });
  } catch (e: any) {
    console.error("[sync-fixtures-smart]", e?.message || e);
    return res.status(500).json({ error: e?.message || "sync-fixtures-smart failed" });
  }
});

router.get("/sync-fixtures-smart", (_req, res) => {
  res.status(405).json({
    error: "Method Not Allowed",
    hint: "POST로 호출하세요",
    example: "/api/admin/sync-fixtures-smart?from=2024-04-01&to=2024-05-31",
  });
});

// ── 팀 스탯 수집 ──
router.post("/sync-team-stats", async (req, res) => {
  const { from, to, force } = req.query;
  const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;

  if (!from || !to) {
    return res.status(400).json({ error: "from / to required" });
  }

  const fixtures = await prisma.fixture.findMany({
    where: {
      kickoffAt: {
        gte: new Date(from as string),
        lte: new Date(to as string),
      },
      status: "FT",
      ...(leagueId ? { league: { apiLeagueId: leagueId } } : {}),
    },
    select: {
      id: true,
      apiFixtureId: true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam: { select: { apiTeamId: true } },
      awayTeam: { select: { apiTeamId: true } },
    },
  });

  let saved = 0;
  let skipped = 0;
  let errors = 0;

  for (const fixture of fixtures) {
    const exists = await prisma.fixtureTeamStatSnapshot.findFirst({
      where: { fixtureId: fixture.id },
    });

    if (exists && !force) {
      skipped++;
      continue;
    }

    try {
      const response = await fetchFixtureTeamStats(fixture.apiFixtureId);

      for (const teamBlock of response.data.response) {
        const { team, statistics } = teamBlock;
        const { normalized } = normalizeTeamStats(statistics);
        const apiTeamId = team.id;
        const isHome = apiTeamId === fixture.homeTeam.apiTeamId;
        const teamDbId = isHome ? fixture.homeTeamId : fixture.awayTeamId;

        await prisma.fixtureTeamStatSnapshot.upsert({
          where: {
            fixtureId_teamId: {
              fixtureId: fixture.id,
              teamId: teamDbId,
            },
          },
          update: {
            raw: teamBlock,
            fetchedAt: new Date(),
            ...normalized,
          },
          create: {
            fixtureId: fixture.id,
            teamId: teamDbId,
            isHome,
            raw: teamBlock,
            fetchedAt: new Date(),
            ...normalized,
          },
        });

        saved++;
      }
    } catch (e) {
      console.error("sync-team-stats error", fixture.id, e);
      errors++;
    }
  }

  res.json({ saved, skipped, errors });
});

// ── 순위 수집 ──
router.post("/sync-standings", async (req, res) => {
  try {
    if (!isApiConfigured()) {
      return res.status(400).json({ error: "API not configured" });
    }

    const leagueId = req.query.leagueId ? Number(req.query.leagueId) : null;
    const manualSeason = req.query.season ? Number(req.query.season) : null;

    const leagues = await prisma.league.findMany({
      where: {
        enabled: true,
        ...(leagueId ? { apiLeagueId: leagueId } : {}),
      },
      orderBy: { priority: "desc" },
    });

    if (leagues.length === 0) {
      return res.status(404).json({
        error: "No enabled leagues found",
        hint: "enabled=true인 리그가 있는지 확인",
      });
    }

    let totalSaved = 0;
    const perLeague: any[] = [];

    for (const league of leagues) {
      const season = manualSeason ?? getCurrentSeason(league.apiLeagueId);

      const standings = await fetchStandingsForLeague(league.apiLeagueId, season);
      let saved = 0;

      for (const s of standings) {
        const team = await prisma.team.upsert({
          where: { apiTeamId: s.teamId },
          update: { name: s.teamName },
          create: { apiTeamId: s.teamId, name: s.teamName, logoUrl: `https://media.api-sports.io/football/teams/${s.teamId}.png` },
        });
        if (!team.logoUrl) {
          await prisma.team.update({ where: { id: team.id }, data: { logoUrl: `https://media.api-sports.io/football/teams/${s.teamId}.png` } });
        }

        await prisma.standing.upsert({
          where: {
            leagueId_teamId_season: {
              leagueId: league.id,
              teamId: team.id,
              season,
            },
          },
          update: {
            rank: s.rank,
            points: s.points,
            played: s.played,
            won: s.won,
            drawn: s.drawn,
            lost: s.lost,
            goalsFor: s.goalsFor,
            goalsAgainst: s.goalsAgainst,
            goalDiff: s.goalDiff,
            form: s.form,
          },
          create: {
            leagueId: league.id,
            teamId: team.id,
            season,
            rank: s.rank,
            points: s.points,
            played: s.played,
            won: s.won,
            drawn: s.drawn,
            lost: s.lost,
            goalsFor: s.goalsFor,
            goalsAgainst: s.goalsAgainst,
            goalDiff: s.goalDiff,
            form: s.form,
          },
        });

        saved++;
      }

      totalSaved += saved;
      perLeague.push({
        leagueId: league.apiLeagueId,
        name: league.name,
        season,
        teamsUpdated: saved,
      });
    }

    res.json({
      ok: true,
      autoSeason: !manualSeason,
      totalLeagues: leagues.length,
      totalTeamsUpdated: totalSaved,
      perLeague,
    });
  } catch (error: any) {
    console.error("[sync-standings] Error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ── 경기장 좌표 수집 ──
router.post("/sync-venue-geo", async (req, res) => {
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");

  if (!from || !to) {
    return res.status(400).json({ ok: false, message: "from/to query is required" });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return res.status(400).json({ ok: false, message: "Invalid from/to date" });
  }

  const fixtures = await prisma.fixture.findMany({
    where: {
      kickoffAt: {
        gte: new Date(from as string),
        lte: new Date(to as string),
      },
      status: "FT",
    },
    select: {
      id: true,
      apiFixtureId: true,
      homeTeamId: true,
      awayTeamId: true,
      venueName: true,
      venueCity: true,
    },
  });

  const geoCache = new Map<string, { lat: number; lon: number } | null>();

  async function geocode(q: string) {
    if (geoCache.has(q)) return geoCache.get(q)!;
    const r = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
      params: { name: q, count: 1, language: "en", format: "json" },
      timeout: 15000,
    });
    const first = r.data?.results?.[0];
    const coords = first ? { lat: first.latitude, lon: first.longitude } : null;
    geoCache.set(q, coords);
    return coords;
  }

  let updated = 0;
  let skipped = 0;

  for (const fx of fixtures) {
    const name = (fx.venueName ?? "").trim();
    const city = (fx.venueCity ?? "").trim();

    const candidates = [
      name && city ? `${name}, ${city}` : "",
      city,
      name,
    ].filter(Boolean);

    let coords: { lat: number; lon: number } | null = null;

    for (const q of candidates) {
      coords = await geocode(q);
      if (coords) break;
    }

    if (!coords) {
      skipped++;
      continue;
    }

    await prisma.fixture.update({
      where: { id: fx.id },
      data: { venueLat: coords.lat, venueLon: coords.lon },
    });

    updated++;
    await new Promise((r) => setTimeout(r, 100));
  }

  return res.json({ ok: true, totalCandidates: fixtures.length, updated, skipped });
});

// ── 날씨 수집 ──
router.post("/sync-weather", async (req, res) => {
  try {
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    const force = String(req.query.force ?? "0") === "1";

    if (!from || !to) {
      return res.status(400).json({ ok: false, message: "from/to query is required" });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({
        ok: false,
        message: `Invalid from/to date. from='${from}' to='${to}'`,
      });
    }

    const fixtures = await prisma.fixture.findMany({
      where: {
        kickoffAt: { gte: fromDate, lte: toDate },
        ...(force ? {} : { weather: { is: null } }),
      },
      select: {
        id: true,
        kickoffAt: true,
        venueCity: true,
        venueName: true,
        venueLat: true,
        venueLon: true,
      },
      take: 200,
      orderBy: { kickoffAt: "asc" },
    });

    let saved = 0;
    let skipped = 0;
    let errors = 0;

    const geoCache = new Map<string, { lat: number; lon: number } | null>();

    async function geocodeCity(city: string) {
      if (geoCache.has(city)) return geoCache.get(city)!;

      const r = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
        params: { name: city, count: 1, language: "en", format: "json" },
        timeout: 15000,
      });

      const first = r.data?.results?.[0];
      const coords = first ? { lat: first.latitude, lon: first.longitude } : null;

      geoCache.set(city, coords);
      return coords;
    }

    async function fetchHourly(lat: number, lon: number, dateIso: string) {
      const r = await axios.get("https://archive-api.open-meteo.com/v1/archive", {
        params: {
          latitude: lat,
          longitude: lon,
          start_date: dateIso,
          end_date: dateIso,
          hourly:
            "temperature_2m,precipitation,weather_code,windspeed_10m,winddirection_10m,relative_humidity_2m,pressure_msl,cloud_cover,is_day",
          timezone: "UTC",
        },
        timeout: 20000,
      });
      return r.data;
    }

    function pickClosestHourIndex(times: string[], kickoffAt: Date) {
      const target = kickoffAt.getTime();
      let bestIdx = 0;
      let bestDiff = Number.POSITIVE_INFINITY;

      for (let i = 0; i < times.length; i++) {
        const t = new Date(times[i]).getTime();
        const diff = Math.abs(t - target);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      return bestIdx;
    }

    for (const fx of fixtures) {
      const lat = fx.venueLat;
      const lon = fx.venueLon;

      if (lat == null || lon == null) {
        skipped++;
        continue;
      }

      try {
        const dateIso = fx.kickoffAt.toISOString().slice(0, 10);
        const forecast = await fetchHourly(lat, lon, dateIso);

        const hourly = forecast?.hourly;
        const times: string[] = hourly?.time ?? [];
        if (!times.length) {
          skipped++;
          continue;
        }

        const idx = pickClosestHourIndex(times, fx.kickoffAt);

        const observedAt = new Date(times[idx]);
        const tempC = hourly?.temperature_2m?.[idx] ?? null;
        const precipitationMm = hourly?.precipitation?.[idx] ?? null;
        const weatherCode = (hourly?.weather_code?.[idx] ?? hourly?.weathercode?.[idx]) ?? null;
        const windKph = hourly?.windspeed_10m?.[idx] ?? null;
        const windDirDeg = hourly?.winddirection_10m?.[idx] ?? null;
        const humidityPct = hourly?.relativehumidity_2m?.[idx] ?? null;
        const pressureHpa = hourly?.pressure_msl?.[idx] ?? null;
        const cloudCoverPct = hourly?.cloudcover?.[idx] ?? null;
        const isDayRaw = hourly?.is_day?.[idx] ?? null;

        const condition = weatherCode === null ? null : `code_${weatherCode}`;
        const icon = weatherCode === null ? null : `om_${weatherCode}`;

        await prisma.fixtureWeather.upsert({
          where: { fixtureId: fx.id },
          update: {
            condition,
            tempC,
            icon,
            provider: "open-meteo",
            timezone: "UTC",
            observedAt,
            weatherCode,
            windKph,
            windDirDeg,
            precipitationMm,
            humidityPct,
            pressureHpa,
            cloudCoverPct,
            isDay: isDayRaw === null ? null : Boolean(isDayRaw),
            lat,
            lon,
            source: "open-meteo",
            raw: forecast,
            fetchedAt: new Date(),
          },
          create: {
            fixtureId: fx.id,
            condition,
            tempC,
            icon,
            provider: "open-meteo",
            timezone: "UTC",
            observedAt,
            weatherCode,
            windKph,
            windDirDeg,
            precipitationMm,
            humidityPct,
            pressureHpa,
            cloudCoverPct,
            isDay: isDayRaw === null ? null : Boolean(isDayRaw),
            lat,
            lon,
            source: "open-meteo",
            raw: forecast,
            fetchedAt: new Date(),
          },
        });

        saved++;
        await new Promise((r) => setTimeout(r, 150));
      } catch (e: any) {
        errors++;
        console.log("[sync-weather][error]", {
          fixtureId: String(fx.id),
          venueCity: fx.venueCity,
          venueName: fx.venueName,
          venueLat: fx.venueLat,
          venueLon: fx.venueLon,
          status: e?.response?.status,
          data: e?.response?.data,
          message: e?.message ?? String(e),
        });
      }
    }

    return res.json({
      ok: true,
      range: { from, to },
      totalCandidates: fixtures.length,
      saved,
      skipped,
      errors,
      hint: "force=1 을 붙이면 기존 날씨도 다시 덮어씁니다",
    });
  } catch (err: any) {
    console.error("[sync-weather] error", err);
    return res.status(500).json({ ok: false, message: err?.message ?? "unknown error" });
  }
});

// ── 팀 로고/shortName 동기화 ──
router.post("/sync-teams", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 500;

    const teamsWithoutLogo = await prisma.team.findMany({
      where: {
        OR: [
          { logoUrl: null },
          { logoUrl: "" },
        ]
      },
      take: limit,
    });

    if (teamsWithoutLogo.length === 0) {
      return res.json({ ok: true, message: "모든 팀에 로고가 있습니다", updated: 0 });
    }

    let updated = 0;

    for (const team of teamsWithoutLogo) {
      const logoUrl = `https://media.api-sports.io/football/teams/${team.apiTeamId}.png`;
      const shortName = team.name.substring(0, 3).toUpperCase();

      await prisma.team.update({
        where: { id: team.id },
        data: { logoUrl, shortName },
      });
      updated++;
    }

    res.json({
      ok: true,
      totalTeamsWithoutLogo: teamsWithoutLogo.length,
      updated,
    });
  } catch (error: any) {
    console.error("[sync-teams] Error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ── 벌크 팀 스탯 수집 ──
router.post("/bulk-sync-team-stats", async (req, res) => {
  try {
    if (!isApiConfigured()) {
      return res.status(400).json({ error: "API not configured" });
    }

    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;
    const batchSize = Number(req.query.batchSize || 50);
    const delayMs = Number(req.query.delayMs || 100);
    const dryRun = req.query.dryRun === "1";

    if (!from || !to) {
      return res.status(400).json({
        error: "from/to required",
        example: "/api/admin/bulk-sync-team-stats?from=2023-08-01&to=2024-05-31&leagueId=39",
      });
    }

    const whereClause: any = {
      kickoffAt: { gte: new Date(from), lte: new Date(to) },
      status: "FT",
    };

    if (leagueId) {
      const league = await prisma.league.findFirst({
        where: { apiLeagueId: leagueId },
      });
      if (league) {
        whereClause.leagueId = league.id;
      }
    }

    const existingStats = await prisma.fixtureTeamStatSnapshot.findMany({
      select: { fixtureId: true },
      distinct: ["fixtureId"],
    });
    const existingFixtureIds = new Set(existingStats.map((s) => s.fixtureId));

    const allFixtures = await prisma.fixture.findMany({
      where: whereClause,
      select: {
        id: true,
        apiFixtureId: true,
        homeTeamId: true,
        awayTeamId: true,
        league: { select: { name: true, apiLeagueId: true } },
      },
      orderBy: { kickoffAt: "asc" },
    });

    const targetFixtures = allFixtures.filter((f) => !existingFixtureIds.has(f.id));

    if (dryRun) {
      return res.json({
        ok: true,
        dryRun: true,
        totalFixtures: allFixtures.length,
        alreadyHaveStats: allFixtures.length - targetFixtures.length,
        needsStats: targetFixtures.length,
        estimatedApiCalls: targetFixtures.length,
        estimatedTimeMinutes: Math.ceil((targetFixtures.length * (delayMs + 500)) / 60000),
      });
    }

    let saved = 0;
    let errors = 0;
    const errorDetails: any[] = [];

    for (let i = 0; i < targetFixtures.length; i += batchSize) {
      const batch = targetFixtures.slice(i, i + batchSize);

      for (const fixture of batch) {
        try {
          const statsRes = await fetchFixtureTeamStats(fixture.apiFixtureId);
          const statsData: any[] = statsRes.data?.response ?? [];

          for (const teamStats of statsData) {
            const apiTeamId = teamStats?.team?.id;
            if (!apiTeamId) continue;

            const team = await prisma.team.findUnique({
              where: { apiTeamId },
              select: { id: true },
            });
            if (!team) continue;

            const isHome = team.id === fixture.homeTeamId;
            const { normalized, extras } = normalizeTeamStats(teamStats.statistics || []);

            const xgValue = extras["expected_goals"] ?? normalized.xg ?? null;

            await prisma.fixtureTeamStatSnapshot.upsert({
              where: {
                fixtureId_teamId: {
                  fixtureId: fixture.id,
                  teamId: team.id,
                },
              },
              update: {
                isHome,
                shotsTotal: normalized.shotsTotal ?? null,
                shotsOnTarget: normalized.shotsOnTarget ?? null,
                shotsOffTarget: normalized.shotsOffTarget ?? null,
                possessionPct: normalized.possessionPct ?? null,
                passesTotal: normalized.passesTotal ?? null,
                passesAccurate: normalized.passesAccurate ?? null,
                passAccuracyPct: normalized.passAccuracyPct ?? null,
                fouls: normalized.fouls ?? null,
                corners: normalized.corners ?? null,
                offsides: normalized.offsides ?? null,
                yellowCards: normalized.yellowCards ?? null,
                redCards: normalized.redCards ?? null,
                tackles: normalized.tackles ?? null,
                interceptions: normalized.interceptions ?? null,
                duelsTotal: normalized.duelsTotal ?? null,
                duelsWon: normalized.duelsWon ?? null,
                saves: normalized.saves ?? null,
                xg: xgValue,
                raw: teamStats,
                fetchedAt: new Date(),
              },
              create: {
                fixtureId: fixture.id,
                teamId: team.id,
                isHome,
                shotsTotal: normalized.shotsTotal ?? null,
                shotsOnTarget: normalized.shotsOnTarget ?? null,
                shotsOffTarget: normalized.shotsOffTarget ?? null,
                possessionPct: normalized.possessionPct ?? null,
                passesTotal: normalized.passesTotal ?? null,
                passesAccurate: normalized.passesAccurate ?? null,
                passAccuracyPct: normalized.passAccuracyPct ?? null,
                fouls: normalized.fouls ?? null,
                corners: normalized.corners ?? null,
                offsides: normalized.offsides ?? null,
                yellowCards: normalized.yellowCards ?? null,
                redCards: normalized.redCards ?? null,
                tackles: normalized.tackles ?? null,
                interceptions: normalized.interceptions ?? null,
                duelsTotal: normalized.duelsTotal ?? null,
                duelsWon: normalized.duelsWon ?? null,
                saves: normalized.saves ?? null,
                xg: xgValue,
                raw: teamStats,
                fetchedAt: new Date(),
              },
            });

            saved++;
          }

          if (delayMs > 0) {
            await new Promise((r) => setTimeout(r, delayMs));
          }
        } catch (e: any) {
          errors++;
          errorDetails.push({
            fixtureId: fixture.apiFixtureId,
            error: e?.message || String(e),
          });
        }
      }

      console.log(`[bulk-sync-team-stats] Batch ${Math.floor(i / batchSize) + 1}: ${saved} saved, ${errors} errors`);
    }

    res.json({
      ok: true,
      totalFixtures: allFixtures.length,
      alreadyHaveStats: allFixtures.length - targetFixtures.length,
      processed: targetFixtures.length,
      saved,
      errors,
      errorDetails: errorDetails.slice(0, 10),
    });
  } catch (error: any) {
    console.error("[bulk-sync-team-stats] Error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ── 누락 통계 백필 ──
router.post("/sync-missed-stats", async (req, res) => {
  try {
    const { manualSync } = await import("../../unified-scheduler");
    const result = await manualSync.backfill();
    res.json({
      ok: true,
      message: `백필 완료: ${result.backfilled}개 성공, ${result.errors}개 실패`,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
