import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { submitVoteSchema } from "@shared/schema";
import { prisma } from "./db";
import axios from "axios";
import { fetchHistoricalMatchesWithResults, fetchCompletedFixtures, fetchStandingsForSeason, fetchStandingsForLeague, fetchBatchFixtures, isApiConfigured, fetchFixturesByDateRange, fetchOddsByDate, fetchOddsForFixture } from "./api-football";
import { 
  loadTrainingData, 
  saveTrainingData, 
  getExistingFixtureIds, 
  getTrainingDataStats,
  getMatchesWithoutStats,
  enrichMatchWithData,
  DAILY_QUOTA,
  type StoredTrainingMatch,
  type CollectionResult,
  type EnrichedData,
} from "./training-data-manager";
import { getMiningState, triggerManualMining } from "./mining-scheduler";
import { fetchFixtureTeamStats } from "./api-football";
import { normalizeTeamStats } from "./utils/normalizeTeamStats";
import { analyzeMatchV9 } from "./v9-analysis";




// BigInt를 res.json / JSON.stringify에서 에러 안 나게 처리
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/matches", async (req, res) => {
    try {
      await storage.refreshMatchesFromApi();
      
      const matches = await storage.getMatches();
      const today = new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });
      
      res.json({
        matches,
        date: today,
        apiError: null,
      });
    } catch (error: any) {
      const errorMessage = error?.message || "Unknown error";
      console.error("[Routes] /api/matches error:", errorMessage);
      
      res.status(500).json({ 
        error: "API_ERROR",
        apiError: errorMessage,
        matches: [],
        date: new Date().toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        }),
      });
    }
  });

  // ============================================================
  // 🏆 리그 초기화 API
  // ============================================================
  app.post("/api/admin/init-leagues", async (req, res) => {
    try {
      // 주요 리그 목록 (API-Football 기준)
      const defaultLeagues = [
        // 유럽 5대 리그 (split-season: 2023 = 23/24시즌)
        { apiLeagueId: 39, name: "Premier League", country: "England", season: 2023, priority: 100 },
        { apiLeagueId: 140, name: "La Liga", country: "Spain", season: 2023, priority: 90 },
        { apiLeagueId: 135, name: "Serie A", country: "Italy", season: 2023, priority: 80 },
        { apiLeagueId: 78, name: "Bundesliga", country: "Germany", season: 2023, priority: 70 },
        { apiLeagueId: 61, name: "Ligue 1", country: "France", season: 2023, priority: 60 },
        // 추가 리그
        { apiLeagueId: 2, name: "UEFA Champions League", country: "Europe", season: 2023, priority: 95 },
        { apiLeagueId: 3, name: "UEFA Europa League", country: "Europe", season: 2023, priority: 50 },
        // K리그 (calendar-year: 2024 = 2024시즌)
        { apiLeagueId: 292, name: "K League 1", country: "South Korea", season: 2024, priority: 40 },
        // 22/23 시즌도 추가 (더 많은 학습 데이터용)
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
        // apiLeagueId + season 조합으로 찾기 (같은 리그의 다른 시즌)
        const existing = await prisma.league.findFirst({
          where: {
            apiLeagueId: league.apiLeagueId,
            season: league.season,
          },
        });

        if (existing) {
          // 이미 있으면 업데이트
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
          // 없으면 생성
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
  app.get("/api/admin/leagues", async (req, res) => {
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
  app.post("/api/admin/leagues/:id/toggle", async (req, res) => {
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

  app.post("/api/admin/sync-fixtures", async (req, res) => {
    try {
      if (!isApiConfigured()) {
        return res.status(400).json({ error: "API not configured" });
      }
  
      const season = Number(req.query.season || 2023);
      const from = String(req.query.from || "");
      const to = String(req.query.to || "");
  
      if (!from || !to) {
        return res.status(400).json({
          error: "Missing from/to",
          example: "/api/admin/sync-fixtures?season=2023&from=2024-03-16&to=2024-03-17",
        });
      }
  
      const leagues = await prisma.league.findMany({
        where: { enabled: true, season },
        orderBy: [{ priority: "desc" }, { id: "asc" }],
      });
  
      let totalUpserted = 0;
      const perLeague: any[] = [];
  
      for (const league of leagues) {
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
            create: { apiTeamId: fx.homeTeamId, name: fx.homeTeam, country: null },
          });
  
          const away = await prisma.team.upsert({
            where: { apiTeamId: fx.awayTeamId },
            update: { name: fx.awayTeam },
            create: { apiTeamId: fx.awayTeamId, name: fx.awayTeam, country: null },
          });
  
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
  
      res.json({ season, from, to, enabledLeagues: leagues.length, totalUpserted, perLeague });
    } catch (e: any) {
      console.error("[sync-fixtures]", e?.message || e);
      res.status(500).json({ error: e?.message || "sync-fixtures failed" });
    }
  });
    // ✅ SMART: date(from/to) 기반으로 season 자동 판별해서 fixture 동기화
  // 사용 예)
  //  - 전체 enabled 리그: POST /api/admin/sync-fixtures-smart?from=2024-04-01&to=2024-05-31
  //  - 특정 리그만:     POST /api/admin/sync-fixtures-smart?leagueId=292&from=2024-04-01&to=2024-05-31
  app.post("/api/admin/sync-fixtures-smart", async (req, res) => {
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

      // ---- season 자동 판별 규칙 ----
      // 1) Calendar-year leagues (K League 등) -> season = date.year
      // 2) Split-season leagues (EPL/UCL 등) -> season = (month>=7 ? year : year-1)
      const CALENDAR_YEAR_LEAGUE_IDS = new Set<number>([
        292, // K League 1
        // 필요하면 추가: 293(K League 2) 등
      ]);

      function parseYmd(s: string) {
        // "YYYY-MM-DD" 가정
        const [y, m, d] = s.split("-").map((v) => Number(v));
        if (!y || !m || !d) return null;
        return { y, m, d };
      }

      function inferSeason(leagueApiId: number, fromYmd: { y: number; m: number }) {
        if (CALENDAR_YEAR_LEAGUE_IDS.has(leagueApiId)) {
          return fromYmd.y;
        }
        // split-season (유럽형): 7월~12월이면 그 해, 1월~6월이면 전 해
        return fromYmd.m >= 7 ? fromYmd.y : fromYmd.y - 1;
      }

      const fromYmd = parseYmd(from);
      const toYmd = parseYmd(to);
      if (!fromYmd || !toYmd) {
        return res.status(400).json({ error: "from/to must be YYYY-MM-DD" });
      }

      // enabled 리그 가져오기 (leagueId 지정 시 해당 리그만)
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
            create: { apiTeamId: fx.homeTeamId, name: fx.homeTeam, country: null },
          });

          const away = await prisma.team.upsert({
            where: { apiTeamId: fx.awayTeamId },
            update: { name: fx.awayTeam },
            create: { apiTeamId: fx.awayTeamId, name: fx.awayTeam, country: null },
          });

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

  // (선택) GET로 열면 HTML 떨어지는 거 방지용: 안내 메시지
  app.get("/api/admin/sync-fixtures-smart", (_req, res) => {
    res.status(405).json({
      error: "Method Not Allowed",
      hint: "POST로 호출하세요",
      example: "/api/admin/sync-fixtures-smart?from=2024-04-01&to=2024-05-31",
    });
  });

  app.post("/api/admin/sync-team-stats", async (req, res) => {
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
  
  // ============================================================
  // 🏆 Standings 동기화 API
  // ============================================================
  
  // 시즌 자동 판별 함수
  const CALENDAR_YEAR_LEAGUES = new Set([292, 293]); // K League 1, K League 2
  
  function getCurrentSeason(leagueApiId: number): number {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    
    // K리그 등 Calendar-Year 리그
    if (CALENDAR_YEAR_LEAGUES.has(leagueApiId)) {
      return year; // 2026년이면 2026
    }
    
    // 유럽 리그 (Split-Season): 7월~12월이면 그 해, 1월~6월이면 전년도
    // 예: 2026년 2월 → 2025 (2025/26 시즌)
    return month >= 7 ? year : year - 1;
  }
  
  app.post("/api/admin/sync-standings", async (req, res) => {
    try {
      if (!isApiConfigured()) {
        return res.status(400).json({ error: "API not configured" });
      }

      const leagueId = req.query.leagueId ? Number(req.query.leagueId) : null;
      
      // 시즌 자동 판별 (파라미터 없으면)
      const manualSeason = req.query.season ? Number(req.query.season) : null;

      // 대상 리그 조회 (enabled만)
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
        // 시즌 자동 판별 (리그별로 다름)
        const season = manualSeason ?? getCurrentSeason(league.apiLeagueId);
        
        const standings = await fetchStandingsForLeague(league.apiLeagueId, season);
        let saved = 0;

        for (const s of standings) {
          // 팀 찾거나 생성
          const team = await prisma.team.upsert({
            where: { apiTeamId: s.teamId },
            update: { name: s.teamName },
            create: { apiTeamId: s.teamId, name: s.teamName },
          });

          // standings upsert
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
  
  // ✅ Injuries sync (결장/부상 데이터 수집)
  app.post("/api/admin/sync-injuries", async (req, res) => {
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
  
        // fixture 찾기
        const fixture = await prisma.fixture.findUnique({
          where: { apiFixtureId: Number(apiFixtureId) },
          select: { id: true },
        });
        if (!fixture) {
          skipped++;
          continue;
        }
  
        // team 찾기
        const team = await prisma.team.findUnique({
          where: { apiTeamId: Number(apiTeamId) },
          select: { id: true },
        });
        if (!team) {
          skipped++;
          continue;
        }
  
        // player 연결 (없어도 됨)
        const apiPlayerId = item?.player?.id ?? null;
        const playerName = String(item?.player?.name ?? "UNKNOWN");
  
        const player =
          apiPlayerId
            ? await prisma.player.findUnique({
                where: { apiPlayerId: Number(apiPlayerId) },
                select: { id: true },
              })
            : null;
  
        // ✅ 스키마에 있는 유니크키: (source, externalKey)로 upsert
const source = "api-football";

// externalKey: fixtureApiId + teamApiId + playerApiId(or null) + playerName
const apiFixtureIdNum = Number(item?.fixture?.id);
const apiTeamIdNum = Number(item?.team?.id);
const apiPlayerIdNum = apiPlayerId ? Number(apiPlayerId) : null;

const externalKey = `${apiFixtureIdNum}:${apiTeamIdNum}:${apiPlayerIdNum ?? "null"}:${playerName}`;

await prisma.fixtureInjury.upsert({
  where: {
    source_externalKey: {
      source,
      externalKey,
    },
  },
  update: {
    fixtureId: fixture.id,
    teamId: team.id,

    apiPlayerId: apiPlayerIdNum,
    playerName,

    status: item?.reason ?? null,

    // ✅ API 응답에서 실제 사유는 player.reason에 있는 경우가 많음
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
    
      // axios 에러면 응답도 찍기
      console.log("axios status:", e?.response?.status ?? null);
      console.log("axios data:", e?.response?.data ?? null);
    
      // prisma 에러면 meta도 찍기
      console.log("prisma meta:", e?.meta ?? null);
      console.log("====================================");
    
      return res.status(500).json({ ok: false, error: "sync-injuries failed" });
    }
    
  });
  

// (선택) GET 방지 안내
app.get("/api/admin/sync-injuries", (_req, res) => {
  res.status(405).json({
    error: "Method Not Allowed",
    hint: "POST로 호출하세요",
    example: "/api/admin/sync-injuries?from=2024-09-01&to=2024-09-30",
  });
});

// ✅ Injuries bulk sync (enabled leagues 전체)
app.post("/api/admin/sync-injuries-bulk", async (req, res) => {
  const season = Number(req.query.season ?? 2023);
  const limitPerLeague = Number(req.query.limitPerLeague ?? 200); // 리그당 저장 개수 제한(테스트용)
  const dryRun = String(req.query.dryRun ?? "0") === "1"; // 1이면 DB 저장 안 하고 개수만 확인

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

  // ✅ enabled 리그 목록
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

  // 리그별로 injuries 호출 → DB 저장
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

        // fixture 매칭
        const fixture = await prisma.fixture.findUnique({
          where: { apiFixtureId: Number(apiFixtureId) },
          select: { id: true },
        });
        if (!fixture) {
          noFixtureMatch++;
          continue;
        }

        // team 매칭
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

        // ✅ 스키마 유니크키: (source, externalKey)
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

      // 과호출 방지용 짧은 딜레이
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

// ✅ Build FeatureSnapshot V1 (stats + weather + injuries)
app.post("/api/admin/build-features", async (req, res) => {
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  const n = Number(req.query.n ?? 5);
  const force = String(req.query.force ?? "0") === "1";
  const featureVersion = Number(req.query.v ?? 1);
  const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;
  const limit = Number(req.query.limit ?? 200);

  if (!from || !to) {
    return res.status(400).json({
      error: "from/to required",
      example: "/api/admin/build-features?from=2024-03-01&to=2024-05-31&n=5&leagueId=39&limit=50",
    });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return res.status(400).json({ error: "Invalid from/to date (YYYY-MM-DD)" });
  }

  // ✅ 대상 fixture (FT만)
  const fixtures = await prisma.fixture.findMany({
    where: {
      kickoffAt: { gte: fromDate, lte: toDate },
      status: "FT",
      ...(leagueId ? { league: { apiLeagueId: leagueId } } : {}),
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
    take: limit,
  });

  function avg(nums: Array<number | null | undefined>) {
    const clean = nums.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (clean.length === 0) return null;
    return clean.reduce((a, b) => a + b, 0) / clean.length;
  }

  async function recentTeamStatsAvg(teamId: bigint, kickoffAt: Date, takeN: number) {
    const rows = await prisma.fixtureTeamStatSnapshot.findMany({
      where: {
        teamId,
        fixture: { kickoffAt: { lt: kickoffAt }, status: "FT" },
      },
      orderBy: { fixture: { kickoffAt: "desc" } },
      take: takeN,
      select: {
        shotsTotal: true,
        shotsOnTarget: true,
        possessionPct: true,
        passesTotal: true,
        passAccuracyPct: true,
        fouls: true,
        corners: true,
        yellowCards: true,
        redCards: true,
        xg: true,
      },
    });

    return {
      shotsTotal_avg: avg(rows.map(r => r.shotsTotal ?? null)),
      shotsOnTarget_avg: avg(rows.map(r => r.shotsOnTarget ?? null)),
      possessionPct_avg: avg(rows.map(r => r.possessionPct ?? null)),
      passesTotal_avg: avg(rows.map(r => r.passesTotal ?? null)),
      passAccuracyPct_avg: avg(rows.map(r => r.passAccuracyPct ?? null)),
      fouls_avg: avg(rows.map(r => r.fouls ?? null)),
      corners_avg: avg(rows.map(r => r.corners ?? null)),
      yellowCards_avg: avg(rows.map(r => r.yellowCards ?? null)),
      redCards_avg: avg(rows.map(r => r.redCards ?? null)),
      xg_avg: avg(rows.map(r => r.xg ?? null)),
    };
  }

  async function recentGoalsAvg(teamId: bigint, kickoffAt: Date, takeN: number) {
    const rows = await prisma.fixture.findMany({
      where: {
        kickoffAt: { lt: kickoffAt },
        status: "FT",
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      },
      orderBy: { kickoffAt: "desc" },
      take: takeN,
      select: {
        homeTeamId: true,
        awayTeamId: true,
        homeGoals: true,
        awayGoals: true,
      },
    });

    const gf: number[] = [];
    const ga: number[] = [];

    for (const r of rows) {
      const isHome = r.homeTeamId === teamId;
      const homeG = r.homeGoals ?? 0;
      const awayG = r.awayGoals ?? 0;

      gf.push(isHome ? homeG : awayG);
      ga.push(isHome ? awayG : homeG);
    }

    return {
      goalsFor_avg: gf.length ? gf.reduce((a, b) => a + b, 0) / gf.length : null,
      goalsAgainst_avg: ga.length ? ga.reduce((a, b) => a + b, 0) / ga.length : null,
    };
  }

  let built = 0;
  let skipped = 0;
  let errors = 0;

  for (const fx of fixtures) {
    try {
      if (!force) {
        const exists = await prisma.fixtureFeatureSnapshot.findUnique({
          where: { fixtureId: fx.id },
          select: { id: true, featureVersion: true },
        });
        if (exists && exists.featureVersion === featureVersion) {
          skipped++;
          continue;
        }
      }

      // injuries count
      const homeInjuryCount = await prisma.fixtureInjury.count({
        where: { fixtureId: fx.id, teamId: fx.homeTeamId },
      });
      const awayInjuryCount = await prisma.fixtureInjury.count({
        where: { fixtureId: fx.id, teamId: fx.awayTeamId },
      });

      // weather
      const weather = await prisma.fixtureWeather.findUnique({
        where: { fixtureId: fx.id },
        select: {
          tempC: true,
          precipitationMm: true,
          windKph: true,
          humidityPct: true,
          pressureHpa: true,
          cloudCoverPct: true,
          isDay: true,
        },
      });

      // recent stats avg
      const homeStats = await recentTeamStatsAvg(fx.homeTeamId, fx.kickoffAt, n);
      const awayStats = await recentTeamStatsAvg(fx.awayTeamId, fx.kickoffAt, n);

      // recent goals avg
      const homeGoals = await recentGoalsAvg(fx.homeTeamId, fx.kickoffAt, n);
      const awayGoals = await recentGoalsAvg(fx.awayTeamId, fx.kickoffAt, n);

      await prisma.fixtureFeatureSnapshot.upsert({
        where: { fixtureId: fx.id },
        update: {
          featureVersion,
          nMatches: n,
          builtAt: new Date(),

          kickoffAt: fx.kickoffAt,
          season: fx.season,
          leagueId: fx.leagueId,
          homeTeamId: fx.homeTeamId,
          awayTeamId: fx.awayTeamId,
          homeGoals: fx.homeGoals,
          awayGoals: fx.awayGoals,

          homeInjuryCount,
          awayInjuryCount,

          tempC: weather?.tempC ?? null,
          precipitationMm: weather?.precipitationMm ?? null,
          windKph: weather?.windKph ?? null,
          humidityPct: weather?.humidityPct ?? null,
          pressureHpa: weather?.pressureHpa ?? null,
          cloudCoverPct: weather?.cloudCoverPct ?? null,
          isDay: weather?.isDay ?? null,

          home_shotsTotal_avg: homeStats.shotsTotal_avg,
          home_shotsOnTarget_avg: homeStats.shotsOnTarget_avg,
          home_possessionPct_avg: homeStats.possessionPct_avg,
          home_passesTotal_avg: homeStats.passesTotal_avg,
          home_passAccuracyPct_avg: homeStats.passAccuracyPct_avg,
          home_fouls_avg: homeStats.fouls_avg,
          home_corners_avg: homeStats.corners_avg,
          home_yellowCards_avg: homeStats.yellowCards_avg,
          home_redCards_avg: homeStats.redCards_avg,
          home_xg_avg: homeStats.xg_avg,

          away_shotsTotal_avg: awayStats.shotsTotal_avg,
          away_shotsOnTarget_avg: awayStats.shotsOnTarget_avg,
          away_possessionPct_avg: awayStats.possessionPct_avg,
          away_passesTotal_avg: awayStats.passesTotal_avg,
          away_passAccuracyPct_avg: awayStats.passAccuracyPct_avg,
          away_fouls_avg: awayStats.fouls_avg,
          away_corners_avg: awayStats.corners_avg,
          away_yellowCards_avg: awayStats.yellowCards_avg,
          away_redCards_avg: awayStats.redCards_avg,
          away_xg_avg: awayStats.xg_avg,

          home_goalsFor_avg: homeGoals.goalsFor_avg,
          home_goalsAgainst_avg: homeGoals.goalsAgainst_avg,
          away_goalsFor_avg: awayGoals.goalsFor_avg,
          away_goalsAgainst_avg: awayGoals.goalsAgainst_avg,
        },
        create: {
          fixtureId: fx.id,
          featureVersion,
          nMatches: n,
          builtAt: new Date(),

          kickoffAt: fx.kickoffAt,
          season: fx.season,
          leagueId: fx.leagueId,
          homeTeamId: fx.homeTeamId,
          awayTeamId: fx.awayTeamId,
          homeGoals: fx.homeGoals,
          awayGoals: fx.awayGoals,

          homeInjuryCount,
          awayInjuryCount,

          tempC: weather?.tempC ?? null,
          precipitationMm: weather?.precipitationMm ?? null,
          windKph: weather?.windKph ?? null,
          humidityPct: weather?.humidityPct ?? null,
          pressureHpa: weather?.pressureHpa ?? null,
          cloudCoverPct: weather?.cloudCoverPct ?? null,
          isDay: weather?.isDay ?? null,

          home_shotsTotal_avg: homeStats.shotsTotal_avg,
          home_shotsOnTarget_avg: homeStats.shotsOnTarget_avg,
          home_possessionPct_avg: homeStats.possessionPct_avg,
          home_passesTotal_avg: homeStats.passesTotal_avg,
          home_passAccuracyPct_avg: homeStats.passAccuracyPct_avg,
          home_fouls_avg: homeStats.fouls_avg,
          home_corners_avg: homeStats.corners_avg,
          home_yellowCards_avg: homeStats.yellowCards_avg,
          home_redCards_avg: homeStats.redCards_avg,
          home_xg_avg: homeStats.xg_avg,

          away_shotsTotal_avg: awayStats.shotsTotal_avg,
          away_shotsOnTarget_avg: awayStats.shotsOnTarget_avg,
          away_possessionPct_avg: awayStats.possessionPct_avg,
          away_passesTotal_avg: awayStats.passesTotal_avg,
          away_passAccuracyPct_avg: awayStats.passAccuracyPct_avg,
          away_fouls_avg: awayStats.fouls_avg,
          away_corners_avg: awayStats.corners_avg,
          away_yellowCards_avg: awayStats.yellowCards_avg,
          away_redCards_avg: awayStats.redCards_avg,
          away_xg_avg: awayStats.xg_avg,

          home_goalsFor_avg: homeGoals.goalsFor_avg,
          home_goalsAgainst_avg: homeGoals.goalsAgainst_avg,
          away_goalsFor_avg: awayGoals.goalsFor_avg,
          away_goalsAgainst_avg: awayGoals.goalsAgainst_avg,
        },
      });

      built++;
    } catch (e) {
      console.error("[build-features][error]", fx.apiFixtureId, e);
      errors++;
    }
  }

  return res.json({
    ok: true,
    range: { from, to },
    n,
    featureVersion,
    force,
    limit,
    candidates: fixtures.length,
    built,
    skipped,
    errors,
  });
});

// ✅ Feature build debug: 왜 null인지 원인 확인용
app.get("/api/admin/feature-debug", async (req, res) => {
  const fixtureId = req.query.fixtureId ? BigInt(String(req.query.fixtureId)) : null;
  if (!fixtureId) return res.status(400).json({ error: "fixtureId required" });

  const fx = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    select: {
      id: true,
      apiFixtureId: true,
      kickoffAt: true,
      status: true,
      homeTeamId: true,
      awayTeamId: true,
      league: { select: { apiLeagueId: true, name: true } },
    },
  });
  if (!fx) return res.status(404).json({ error: "fixture not found" });

  const feature = await prisma.fixtureFeatureSnapshot.findUnique({
    where: { fixtureId },
  });

  const homeStatsCount = await prisma.fixtureTeamStatSnapshot.count({
    where: { teamId: fx.homeTeamId, fixture: { kickoffAt: { lt: fx.kickoffAt }, status: "FT" } },
  });
  const awayStatsCount = await prisma.fixtureTeamStatSnapshot.count({
    where: { teamId: fx.awayTeamId, fixture: { kickoffAt: { lt: fx.kickoffAt }, status: "FT" } },
  });

  const weather = await prisma.fixtureWeather.findUnique({
    where: { fixtureId },
    select: { id: true, tempC: true, observedAt: true },
  });

  const homeInj = await prisma.fixtureInjury.count({ where: { fixtureId, teamId: fx.homeTeamId } });
  const awayInj = await prisma.fixtureInjury.count({ where: { fixtureId, teamId: fx.awayTeamId } });

  return res.json({
    fixture: fx,
    hasFeatureRow: Boolean(feature),
    featurePreview: feature
      ? {
          featureVersion: feature.featureVersion,
          nMatches: feature.nMatches,
          home_shotsTotal_avg: (feature as any).home_shotsTotal_avg ?? null,
          away_shotsTotal_avg: (feature as any).away_shotsTotal_avg ?? null,
          tempC: (feature as any).tempC ?? null,
          homeInjuryCount: (feature as any).homeInjuryCount ?? null,
          awayInjuryCount: (feature as any).awayInjuryCount ?? null,
        }
      : null,
    sourceCoverage: {
      homeStatsRowsBeforeKickoff: homeStatsCount,
      awayStatsRowsBeforeKickoff: awayStatsCount,
      weatherRow: weather,
      injuriesCount: { homeInj, awayInj },
    },
  });
});


app.get("/api/admin/fixtures-range", async (_req, res) => {
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

app.get("/api/admin/injuries-raw", async (req, res) => {
  const season = Number(req.query.season ?? 2023); // ✅ season 필수
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

// ✅ Stats coverage check (Feature null 원인 확인용)
app.get("/api/admin/stats-coverage", async (req, res) => {
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
    expectedStatRows: fixtures * 2, // 홈+원정 = 2
    coveragePct: fixtures === 0 ? 0 : Math.round((statRows / (fixtures * 2)) * 10000) / 100,
  });
});



  app.post("/api/admin/sync-venue-geo", async (req, res) => {
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

      if (!q) {
        skipped++;
        continue;
      }
  
      coords = await geocode(q);
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
  
  // ✅ Weather sync
  app.post("/api/admin/sync-weather", async (req, res) => {
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
  
      // ✅ 대상 경기: 기본은 "날씨 없는 경기만", force=1이면 전체
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
  
      // city -> (lat, lon) 캐시(같은 도시 반복 호출 방지)
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
        // ✅ 도시가 없으면 스킵
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
  
          // UI용 condition/icon은 지금은 raw 기반으로 나중에 매핑(간단 처리)
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
  
          // 호출 속도 조절 (API 안정화)
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
            data: e?.response?.data,   // ⭐ 핵심
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
  
  app.get("/api/admin/debug-venues", async (req, res) => {
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
  

// ✅ Odds sync
app.post("/api/admin/sync-odds", async (req, res) => {
  res.json({ ok: true, message: "sync-odds route is reachable" });
});



  app.post("/api/admin/leagues/disable-all", async (_req, res) => {
    const result = await prisma.league.updateMany({
      data: { enabled: false, priority: 0 },
    });
    res.json({ updated: result.count });
  });
    // DB: enabled leagues
  app.get("/api/leagues", async (req, res) => {
      const enabled = req.query.enabled === "true";
  
      const leagues = await prisma.league.findMany({
        where: enabled ? { enabled: true } : undefined,
        orderBy: [{ priority: "desc" }, { name: "asc" }],
        select: { apiLeagueId: true, name: true, country: true, season: true, priority: true },
      });
  
      res.json({
        leagues: leagues.map((l) => ({
          leagueId: l.apiLeagueId,
          name: l.name,
          country: l.country,
          season: l.season,
          priority: l.priority,
        })),
      });
  });
  
  app.post("/api/admin/sync-leagues", async (req, res) => {
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
      params: { season }, // free 플랜 고려: 2023 권장
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

  // ✅ Export FeatureSnapshot for Python training
app.get("/api/admin/features-export", async (req, res) => {
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;
  const limit = Number(req.query.limit ?? 1000);

  if (!from || !to) {
    return res.status(400).json({
      error: "from/to required",
      example: "/api/admin/features-export?from=2024-03-01&to=2024-05-31&leagueId=39&limit=500",
    });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return res.status(400).json({ error: "Invalid from/to date" });
  }

  const rows = await prisma.fixtureFeatureSnapshot.findMany({
    where: {
      kickoffAt: { gte: fromDate, lte: toDate },
      ...(leagueId ? { fixture: { league: { apiLeagueId: leagueId } } } : {}),
    },
    orderBy: { kickoffAt: "asc" },
    take: limit,
  });

  return res.json({
    ok: true,
    count: rows.length,
    rows,
  });
});

  app.get("/api/matches/:id/analysis", async (req, res) => {
    try {
      const { id } = req.params;
      const analysis = await storage.getMatchAnalysis(id);
      
      if (!analysis) {
        return res.status(404).json({ error: "Match not found" });
      }
      
      res.json({ analysis });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch match analysis" });
    }
  });

  app.get("/api/historical-matches", async (req, res) => {
    try {
      const matches = await storage.getHistoricalMatches();
      res.json({ matches });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch historical matches" });
    }
  });

  app.post("/api/backtest", async (req, res) => {
    try {
      const result = await storage.runBacktest();
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: "Failed to run backtest" });
    }
  });

  // Training data endpoint: Load from training_set.json (synced with data collection)
  app.get("/api/training-data", async (req, res) => {
    try {
      // Load from training_set.json with auto-deduplication
      const storedData = await loadTrainingData();
      
      // Convert stored format to training format for frontend
      const matches = storedData.matches.map(m => ({
        id: m.fixtureId,
        homeTeam: { name: m.homeTeam, ranking: m.homeRank, form: m.homeForm },
        awayTeam: { name: m.awayTeam, ranking: m.awayRank, form: m.awayForm },
        date: m.date,
        venue: m.venue,
        actualResult: m.actualResult,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      }));
      
      console.log(`[Routes] Training data loaded: ${matches.length} unique matches from training_set.json`);
      res.json({ matches, count: matches.length });
    } catch (error: any) {
      console.error("[Routes] Training data fetch error:", error.message);
      res.status(500).json({ error: error.message || "Failed to fetch training data" });
    }
  });

  // New endpoint: Run training with real API data
  app.post("/api/train", async (req, res) => {
    try {
      if (!isApiConfigured()) {
        return res.status(400).json({ error: "API not configured" });
      }
      
      console.log("[Routes] Starting training with real API data...");
      const matches = await fetchHistoricalMatchesWithResults();
      
      if (matches.length === 0) {
        return res.status(400).json({ error: "No training data available" });
      }
      
      const result = await storage.runTrainingWithRealData(matches);
      res.json({ result });
    } catch (error: any) {
      console.error("[Routes] Training error:", error.message);
      res.status(500).json({ error: error.message || "Failed to run training" });
    }
  });

  // Get current training data stats
  app.get("/api/training-set/stats", async (req, res) => {
    try {
      const stats = await getTrainingDataStats();
      res.json(stats);
    } catch (error: any) {
      console.error("[Routes] Training set stats error:", error.message);
      res.status(500).json({ error: error.message || "Failed to get training set stats" });
    }
  });

  // Get all stored training data
  app.get("/api/training-set", async (req, res) => {
    try {
      const data = await loadTrainingData();
      res.json(data);
    } catch (error: any) {
      console.error("[Routes] Training set load error:", error.message);
      res.status(500).json({ error: error.message || "Failed to load training set" });
    }
  });

  // Download training data as backup file
  app.get("/api/training-set/download", async (req, res) => {
    try {
      const data = await loadTrainingData();
      
      if (data.totalMatches === 0) {
        return res.status(404).json({ error: "NO_DATA", message: "백업할 데이터가 없습니다" });
      }
      
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `soccer_ai_backup_${dateStr}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify(data, null, 2));
    } catch (error: any) {
      console.error("[Routes] Training set download error:", error.message);
      res.status(500).json({ error: error.message || "Failed to download training set" });
    }
  });

  // Batch enrich data with statistics and lineups (10 matches per API call)
  // Optimized: 1 API call = 10 matches, 100 calls/day = 1000+ matches
  app.post("/api/enrich-data", async (req, res) => {
    const BATCH_SIZE = 10; // 10 matches per API call
    const MAX_BATCHES = 10; // Max 10 batches = 100 matches per run
    
    try {
      if (!isApiConfigured()) {
        return res.status(400).json({ error: "API not configured" });
      }
      
      const logs: string[] = [];
      logs.push("배치 고도화 시작...");
      
      // Load training data
      const trainingData = await loadTrainingData();
      const allMatchesToEnrich = getMatchesWithoutStats(trainingData, BATCH_SIZE * MAX_BATCHES);
      
      if (allMatchesToEnrich.length === 0) {
        logs.push("이미 모든 데이터가 고품질입니다!");
        return res.json({
          enriched: 0,
          errors: 0,
          total: trainingData.totalMatches,
          logs,
        });
      }
      
      // Split into chunks of 10
      const chunks: typeof allMatchesToEnrich[] = [];
      for (let i = 0; i < allMatchesToEnrich.length; i += BATCH_SIZE) {
        chunks.push(allMatchesToEnrich.slice(i, i + BATCH_SIZE));
      }
      
      logs.push(`고도화 대상: ${allMatchesToEnrich.length}개 경기 (${chunks.length}개 배치)`);
      logs.push(`배치 크기: ${BATCH_SIZE}개씩, API 호출: ${chunks.length}회 예정`);
      
      let enriched = 0;
      let errors = 0;
      
      for (let batchIndex = 0; batchIndex < chunks.length; batchIndex++) {
        const chunk = chunks[batchIndex];
        const fixtureIds = chunk.map(m => m.fixtureId);
        const processed = (batchIndex + 1) * BATCH_SIZE;
        const total = allMatchesToEnrich.length;
        
        logs.push(`\n배치 처리 중... (${Math.min(processed, total)}/${total})`);
        logs.push(`  IDs: ${fixtureIds.join(", ")}`);
        
        try {
          // Single API call for batch of fixtures
          const batchData = await fetchBatchFixtures(fixtureIds);
          
          // 1 second delay between batches to avoid rate limiting
          if (batchIndex < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Merge each fixture's data
          for (const data of batchData) {
            const match = chunk.find(m => m.fixtureId === data.fixtureId);
            if (!match) continue;
            
            const enrichedData: EnrichedData = {
              statistics: data.statistics,
              lineups: data.lineups,
              enrichedAt: new Date().toISOString(),
            };
            
            const success = await enrichMatchWithData(trainingData, data.fixtureId, enrichedData);
            
            if (success) {
              enriched++;
              const hasStats = data.statistics.length > 0;
              const hasLineups = data.lineups.length > 0;
              logs.push(`  ✅ ${match.homeTeam} vs ${match.awayTeam}: 통계=${hasStats ? '있음' : '없음'}, 라인업=${hasLineups ? '있음' : '없음'}`);
            } else {
              errors++;
            }
          }
          
          // Check for fixtures that weren't in the response
          const returnedIds = new Set(batchData.map(d => d.fixtureId));
          for (const match of chunk) {
            if (!returnedIds.has(match.fixtureId)) {
              errors++;
              logs.push(`  ⚠️ ${match.homeTeam} vs ${match.awayTeam}: 데이터 없음 (ID: ${match.fixtureId})`);
            }
          }
          
        } catch (error: any) {
          errors += chunk.length;
          logs.push(`  ❌ 배치 API 오류: ${error.message}`);
        }
      }
      
      // Save updated training data
      await saveTrainingData(trainingData);
      
      logs.push(`\n=============================`);
      logs.push(`고도화 완료!`);
      logs.push(`  업그레이드: ${enriched}개 경기`);
      logs.push(`  API 호출: ${chunks.length}회 (예상 비용 절감: ${(allMatchesToEnrich.length * 2) - chunks.length}회)`);
      if (errors > 0) {
        logs.push(`  오류: ${errors}건`);
      }
      
      res.json({
        enriched,
        errors,
        total: trainingData.totalMatches,
        logs,
      });
    } catch (error: any) {
      console.error("[Routes] Enrich data error:", error.message);
      res.status(500).json({ error: error.message || "Failed to enrich data" });
    }
  });

  // Vote endpoints
  app.post("/api/votes", async (req, res) => {
    try {
      const parseResult = submitVoteSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid input" });
      }
      const { matchId, choice } = parseResult.data;
      const vote = await storage.submitVote(matchId, choice);
      res.json({ vote });
    } catch (error: any) {
      console.error("[Routes] Vote submission error:", error.message);
      res.status(500).json({ error: error.message || "Failed to submit vote" });
    }
  });

  app.get("/api/votes/:matchId", async (req, res) => {
    try {
      const { matchId } = req.params;
      const vote = await storage.getVoteForMatch(matchId);
      res.json({ vote: vote || null });
    } catch (error: any) {
      console.error("[Routes] Vote fetch error:", error.message);
      res.status(500).json({ error: error.message || "Failed to fetch vote" });
    }
  });

  app.get("/api/votes", async (req, res) => {
    try {
      const votes = await storage.getAllVotes();
      res.json({ votes });
    } catch (error: any) {
      console.error("[Routes] Votes fetch error:", error.message);
      res.status(500).json({ error: error.message || "Failed to fetch votes" });
    }
  });

  // Prediction records and accuracy endpoints
  app.get("/api/prediction-records", async (req, res) => {
    try {
      const records = await storage.getPredictionRecords();
      res.json({ records });
    } catch (error: any) {
      console.error("[Routes] Prediction records error:", error.message);
      res.status(500).json({ error: error.message || "Failed to fetch prediction records" });
    }
  });

  app.get("/api/daily-accuracy", async (req, res) => {
    try {
      const data = await storage.getDailyAccuracyData();
      res.json({ data });
    } catch (error: any) {
      console.error("[Routes] Daily accuracy error:", error.message);
      res.status(500).json({ error: error.message || "Failed to fetch daily accuracy" });
    }
  });

  app.get("/api/user-stats", async (req, res) => {
    try {
      const stats = await storage.getUserStats();
      res.json({ stats });
    } catch (error: any) {
      console.error("[Routes] User stats error:", error.message);
      res.status(500).json({ error: error.message || "Failed to fetch user stats" });
    }
  });

  // Smart data collection with deduplication
  app.post("/api/collect-data", async (req, res) => {
    try {
      if (!isApiConfigured()) {
        return res.status(400).json({ error: "API not configured" });
      }
      
      const logs: string[] = [];
      logs.push("데이터 수집 시작...");
      
      // Load existing training data
      const trainingData = await loadTrainingData();
      const existingIds = getExistingFixtureIds(trainingData);
      logs.push(`기존 저장된 경기: ${existingIds.size}개`);
      
      // Define date ranges for 2023-24 season (August 2023 to May 2024)
      // We'll use multiple smaller date ranges to avoid hitting API limits
      const dateRanges = [
        { from: "2023-08-11", to: "2023-08-31" },
        { from: "2023-09-01", to: "2023-09-30" },
        { from: "2023-10-01", to: "2023-10-31" },
        { from: "2023-11-01", to: "2023-11-30" },
        { from: "2023-12-01", to: "2023-12-31" },
        { from: "2024-01-01", to: "2024-01-31" },
        { from: "2024-02-01", to: "2024-02-29" },
        { from: "2024-03-01", to: "2024-03-31" },
        { from: "2024-04-01", to: "2024-04-30" },
        { from: "2024-05-01", to: "2024-05-19" },
      ];
      
      // Fetch standings once for the season
      const standings = await fetchStandingsForSeason(2023);
      
      let newlySaved = 0;
      let skippedDuplicates = 0;
      let totalChecked = 0;
      let errors = 0;
      
      for (const range of dateRanges) {
        if (newlySaved >= DAILY_QUOTA) {
          logs.push(`일일 할당량 (${DAILY_QUOTA}개) 도달. 수집 중단.`);
          break;
        }
        
        try {
          logs.push(`${range.from} ~ ${range.to} 기간 확인 중...`);
          const fixtures = await fetchCompletedFixtures(range.from, range.to, 2023);
          
          for (const fixture of fixtures) {
            if (newlySaved >= DAILY_QUOTA) break;
            
            totalChecked++;
            
            // Check for duplicate
            if (existingIds.has(fixture.fixtureId)) {
              skippedDuplicates++;
              continue;
            }
            
            // Get team standings
            const homeStanding = standings.get(fixture.homeTeamId);
            const awayStanding = standings.get(fixture.awayTeamId);
            
            // Create new training match entry
            const newMatch: StoredTrainingMatch = {
              fixtureId: fixture.fixtureId,
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              homeScore: fixture.homeScore,
              awayScore: fixture.awayScore,
              actualResult: fixture.actualResult,
              date: fixture.date,
              venue: fixture.venue,
              homeRank: homeStanding?.rank || 10,
              awayRank: awayStanding?.rank || 10,
              homeForm: homeStanding?.form || "DDDDD",
              awayForm: awayStanding?.form || "DDDDD",
              collectedAt: new Date().toISOString(),
            };
            
            trainingData.matches.push(newMatch);
            existingIds.add(fixture.fixtureId);
            newlySaved++;
          }
        } catch (error: any) {
          errors++;
          logs.push(`${range.from} ~ ${range.to} 기간 오류: ${error.message}`);
        }
      }
      
      // Save updated training data
      if (newlySaved > 0) {
        await saveTrainingData(trainingData);
        logs.push(`training_set.json 저장 완료`);
      }
      
      logs.push(`총 ${totalChecked}개 경기 확인 완료`);
      logs.push(`${newlySaved}개 신규 저장, ${skippedDuplicates}개 중복 건너뜀`);
      
      const result: CollectionResult = {
        totalChecked,
        newlySaved,
        skippedDuplicates,
        errors,
        logs,
        quotaRemaining: DAILY_QUOTA - newlySaved,
      };
      
      res.json(result);
    } catch (error: any) {
      console.error("[Routes] Data collection error:", error.message);
      res.status(500).json({ error: error.message || "Failed to collect data" });
    }
  });

  // Mining scheduler state endpoint
  app.get("/api/mining-state", async (req, res) => {
    try {
      const state = getMiningState();
      res.json(state);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to get mining state" });
    }
  });

  // Manual trigger for mining (admin only)
  app.post("/api/trigger-mining", async (req, res) => {
    try {
      const state = await triggerManualMining();
      res.json(state);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to trigger mining" });
    }
  });

  // ============================================================
  // 🚀 BULK DATA COLLECTION APIs (Ultra Plan용)
  // ============================================================

  /**
   * 📦 Bulk Team Stats 수집
   * POST /api/admin/bulk-sync-team-stats?from=2023-08-01&to=2024-05-31&leagueId=39
   * 
   * - 지정된 기간의 모든 FT 경기에 대해 team stats 수집
   * - batchSize로 한 번에 처리할 경기 수 조절 (기본 50)
   * - delayMs로 API 호출 간 딜레이 조절 (기본 100ms)
   */
  app.post("/api/admin/bulk-sync-team-stats", async (req, res) => {
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

      // FT 상태인 fixture 중 아직 TeamStatSnapshot이 없는 것들
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

      // 이미 stats가 있는 fixture ID 목록
      const existingStats = await prisma.fixtureTeamStatSnapshot.findMany({
        select: { fixtureId: true },
        distinct: ["fixtureId"],
      });
      const existingFixtureIds = new Set(existingStats.map((s) => s.fixtureId));

      // 대상 fixture 조회
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

      // 아직 stats가 없는 fixture만 필터
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

      // 배치 처리
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

              // xg 필드 매핑 (expected_goals -> xg)
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

            // API 호출 간 딜레이
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

        // 배치 완료 로그
        console.log(`[bulk-sync-team-stats] Batch ${Math.floor(i / batchSize) + 1}: ${saved} saved, ${errors} errors`);
      }

      res.json({
        ok: true,
        totalFixtures: allFixtures.length,
        alreadyHaveStats: allFixtures.length - targetFixtures.length,
        processed: targetFixtures.length,
        saved,
        errors,
        errorDetails: errorDetails.slice(0, 10), // 처음 10개만 반환
      });
    } catch (error: any) {
      console.error("[bulk-sync-team-stats] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  /**
   * 📦 Bulk Features 빌드
   * POST /api/admin/bulk-build-features?from=2023-08-01&to=2024-05-31&leagueId=39
   * 
   * - stats가 준비된 경기들에 대해 FeatureSnapshot 생성
   */
  app.post("/api/admin/bulk-build-features", async (req, res) => {
    try {
      const from = String(req.query.from || "");
      const to = String(req.query.to || "");
      const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;
      const n = Number(req.query.n || 5); // 최근 N경기 평균
      const featureVersion = Number(req.query.v || 2);
      const force = req.query.force === "1";
      const limit = Number(req.query.limit || 1000);

      if (!from || !to) {
        return res.status(400).json({
          error: "from/to required",
          example: "/api/admin/bulk-build-features?from=2023-08-01&to=2024-05-31&leagueId=39",
        });
      }

      // 대상 fixture 조회
      const whereClause: any = {
        kickoffAt: { gte: new Date(from), lte: new Date(to) },
        status: "FT",
        homeGoals: { not: null },
        awayGoals: { not: null },
      };

      if (leagueId) {
        const league = await prisma.league.findFirst({
          where: { apiLeagueId: leagueId },
        });
        if (league) {
          whereClause.leagueId = league.id;
        }
      }

      const fixtures = await prisma.fixture.findMany({
        where: whereClause,
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
        take: limit,
      });

      // 이미 featureSnapshot이 있는 것 필터
      const existingFeatures = await prisma.fixtureFeatureSnapshot.findMany({
        where: { fixtureId: { in: fixtures.map((f) => f.id) } },
        select: { fixtureId: true, featureVersion: true },
      });
      const existingMap = new Map(existingFeatures.map((f) => [f.fixtureId.toString(), f.featureVersion]));

      function avg(nums: Array<number | null | undefined>) {
        const clean = nums.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        if (clean.length === 0) return null;
        return clean.reduce((a, b) => a + b, 0) / clean.length;
      }

      async function recentTeamStatsAvg(teamId: bigint, kickoffAt: Date, takeN: number) {
        const rows = await prisma.fixtureTeamStatSnapshot.findMany({
          where: {
            teamId,
            fixture: { kickoffAt: { lt: kickoffAt }, status: "FT" },
          },
          orderBy: { fixture: { kickoffAt: "desc" } },
          take: takeN,
        });

        return {
          count: rows.length,
          shotsTotal_avg: avg(rows.map((r) => r.shotsTotal)),
          shotsOnTarget_avg: avg(rows.map((r) => r.shotsOnTarget)),
          possessionPct_avg: avg(rows.map((r) => r.possessionPct)),
          passesTotal_avg: avg(rows.map((r) => r.passesTotal)),
          passAccuracyPct_avg: avg(rows.map((r) => r.passAccuracyPct)),
          fouls_avg: avg(rows.map((r) => r.fouls)),
          corners_avg: avg(rows.map((r) => r.corners)),
          yellowCards_avg: avg(rows.map((r) => r.yellowCards)),
          redCards_avg: avg(rows.map((r) => r.redCards)),
          xg_avg: avg(rows.map((r) => r.xg)),
        };
      }

      async function recentGoalsAvg(teamId: bigint, kickoffAt: Date, takeN: number) {
        const rows = await prisma.fixture.findMany({
          where: {
            kickoffAt: { lt: kickoffAt },
            status: "FT",
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          },
          orderBy: { kickoffAt: "desc" },
          take: takeN,
        });

        const gf: number[] = [];
        const ga: number[] = [];

        for (const r of rows) {
          const isHome = r.homeTeamId === teamId;
          const homeG = r.homeGoals ?? 0;
          const awayG = r.awayGoals ?? 0;
          gf.push(isHome ? homeG : awayG);
          ga.push(isHome ? awayG : homeG);
        }

        return {
          goalsFor_avg: gf.length ? gf.reduce((a, b) => a + b, 0) / gf.length : null,
          goalsAgainst_avg: ga.length ? ga.reduce((a, b) => a + b, 0) / ga.length : null,
        };
      }

      // ===== V3: 홈/원정 분리 성적 =====
      async function homeOnlyStats(teamId: bigint, kickoffAt: Date, takeN: number) {
        const rows = await prisma.fixture.findMany({
          where: {
            kickoffAt: { lt: kickoffAt },
            status: "FT",
            homeTeamId: teamId, // 홈 경기만
          },
          orderBy: { kickoffAt: "desc" },
          take: takeN,
          include: {
            teamStats: { where: { teamId: teamId } },
          },
        });

        const gf: number[] = [];
        const ga: number[] = [];
        const xg: number[] = [];
        let wins = 0;

        for (const r of rows) {
          gf.push(r.homeGoals ?? 0);
          ga.push(r.awayGoals ?? 0);
          if ((r.homeGoals ?? 0) > (r.awayGoals ?? 0)) wins++;
          const stat = r.teamStats?.[0];
          if (stat?.xg) xg.push(stat.xg);
        }

        return {
          goalsFor_atHome_avg: gf.length ? gf.reduce((a, b) => a + b, 0) / gf.length : null,
          goalsAgainst_atHome_avg: ga.length ? ga.reduce((a, b) => a + b, 0) / ga.length : null,
          xg_atHome_avg: xg.length ? xg.reduce((a, b) => a + b, 0) / xg.length : null,
          wins_atHome_pct: rows.length ? wins / rows.length : null,
        };
      }

      async function awayOnlyStats(teamId: bigint, kickoffAt: Date, takeN: number) {
        const rows = await prisma.fixture.findMany({
          where: {
            kickoffAt: { lt: kickoffAt },
            status: "FT",
            awayTeamId: teamId, // 원정 경기만
          },
          orderBy: { kickoffAt: "desc" },
          take: takeN,
          include: {
            teamStats: { where: { teamId: teamId } },
          },
        });

        const gf: number[] = [];
        const ga: number[] = [];
        const xg: number[] = [];
        let wins = 0;

        for (const r of rows) {
          gf.push(r.awayGoals ?? 0);
          ga.push(r.homeGoals ?? 0);
          if ((r.awayGoals ?? 0) > (r.homeGoals ?? 0)) wins++;
          const stat = r.teamStats?.[0];
          if (stat?.xg) xg.push(stat.xg);
        }

        return {
          goalsFor_atAway_avg: gf.length ? gf.reduce((a, b) => a + b, 0) / gf.length : null,
          goalsAgainst_atAway_avg: ga.length ? ga.reduce((a, b) => a + b, 0) / ga.length : null,
          xg_atAway_avg: xg.length ? xg.reduce((a, b) => a + b, 0) / xg.length : null,
          wins_atAway_pct: rows.length ? wins / rows.length : null,
        };
      }

      // ===== V3: 폼 (최근 N경기 승점 평균) =====
      async function recentForm(teamId: bigint, kickoffAt: Date, takeN: number) {
        const rows = await prisma.fixture.findMany({
          where: {
            kickoffAt: { lt: kickoffAt },
            status: "FT",
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          },
          orderBy: { kickoffAt: "desc" },
          take: takeN,
        });

        const points: number[] = [];

        for (const r of rows) {
          const isHome = r.homeTeamId === teamId;
          const homeG = r.homeGoals ?? 0;
          const awayG = r.awayGoals ?? 0;
          
          if (isHome) {
            if (homeG > awayG) points.push(3);      // 승
            else if (homeG === awayG) points.push(1); // 무
            else points.push(0);                     // 패
          } else {
            if (awayG > homeG) points.push(3);
            else if (awayG === homeG) points.push(1);
            else points.push(0);
          }
        }

        return points.length ? points.reduce((a, b) => a + b, 0) / points.length : null;
      }

      // ===== V4: 경기 텀 (휴식일) =====
      async function getDaysRest(teamId: bigint, kickoffAt: Date) {
        const lastMatch = await prisma.fixture.findFirst({
          where: {
            kickoffAt: { lt: kickoffAt },
            status: "FT",
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          },
          orderBy: { kickoffAt: "desc" },
        });

        if (!lastMatch) return null;
        
        const diffMs = kickoffAt.getTime() - lastMatch.kickoffAt.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return diffDays;
      }

      // ===== V4: 최근 14일 경기 수 =====
      async function getMatches14d(teamId: bigint, kickoffAt: Date) {
        const from = new Date(kickoffAt.getTime() - 14 * 24 * 60 * 60 * 1000);
        
        const count = await prisma.fixture.count({
          where: {
            kickoffAt: { gte: from, lt: kickoffAt },
            status: "FT",
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          },
        });

        return count;
      }

      // ===== V4: 유럽대회 피로 (UCL/Europa 최근 7일) =====
      async function getEuropean7d(teamId: bigint, kickoffAt: Date) {
        const from = new Date(kickoffAt.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // UCL (apiLeagueId: 2) + Europa (apiLeagueId: 3)
        const europeanLeagues = await prisma.league.findMany({
          where: { apiLeagueId: { in: [2, 3] } },
          select: { id: true },
        });
        const europeanLeagueIds = europeanLeagues.map(l => l.id);

        const count = await prisma.fixture.count({
          where: {
            kickoffAt: { gte: from, lt: kickoffAt },
            status: "FT",
            leagueId: { in: europeanLeagueIds },
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          },
        });

        return count;
      }

      // ===== V5: 상대전적 (H2H) 최근 2년 =====
      async function getH2H(homeTeamId: bigint, awayTeamId: bigint, kickoffAt: Date) {
        const twoYearsAgo = new Date(kickoffAt.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
        
        const matches = await prisma.fixture.findMany({
          where: {
            kickoffAt: { gte: twoYearsAgo, lt: kickoffAt },
            status: "FT",
            OR: [
              { homeTeamId: homeTeamId, awayTeamId: awayTeamId },
              { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
            ],
          },
          orderBy: { kickoffAt: "desc" },
        });

        if (matches.length === 0) {
          return {
            total: 0,
            homeWins: null,
            awayWins: null,
            draws: null,
            homeGoalsAvg: null,
            awayGoalsAvg: null,
            homeWinPct: null,
          };
        }

        let homeWins = 0;
        let awayWins = 0;
        let draws = 0;
        let homeGoals = 0;
        let awayGoals = 0;

        for (const m of matches) {
          const hGoals = m.homeGoals ?? 0;
          const aGoals = m.awayGoals ?? 0;
          
          // 현재 경기 기준 홈팀이 과거에 홈이었는지 원정이었는지
          const isCurrentHomeTeamHome = m.homeTeamId === homeTeamId;
          
          if (isCurrentHomeTeamHome) {
            homeGoals += hGoals;
            awayGoals += aGoals;
            if (hGoals > aGoals) homeWins++;
            else if (hGoals < aGoals) awayWins++;
            else draws++;
          } else {
            homeGoals += aGoals;
            awayGoals += hGoals;
            if (aGoals > hGoals) homeWins++;
            else if (aGoals < hGoals) awayWins++;
            else draws++;
          }
        }

        return {
          total: matches.length,
          homeWins,
          awayWins,
          draws,
          homeGoalsAvg: homeGoals / matches.length,
          awayGoalsAvg: awayGoals / matches.length,
          homeWinPct: homeWins / matches.length,
        };
      }

      let built = 0;
      let skipped = 0;
      let errors = 0;

      for (const fx of fixtures) {
        try {
          // 이미 있고 force가 아니면 skip
          const existingVersion = existingMap.get(fx.id.toString());
          if (existingVersion && existingVersion >= featureVersion && !force) {
            skipped++;
            continue;
          }

          // injuries count
          const homeInjuryCount = await prisma.fixtureInjury.count({
            where: { fixtureId: fx.id, teamId: fx.homeTeamId },
          });
          const awayInjuryCount = await prisma.fixtureInjury.count({
            where: { fixtureId: fx.id, teamId: fx.awayTeamId },
          });

          // weather
          const weather = await prisma.fixtureWeather.findUnique({
            where: { fixtureId: fx.id },
          });

          // team stats averages
          const homeStats = await recentTeamStatsAvg(fx.homeTeamId, fx.kickoffAt, n);
          const awayStats = await recentTeamStatsAvg(fx.awayTeamId, fx.kickoffAt, n);
          const homeGoals = await recentGoalsAvg(fx.homeTeamId, fx.kickoffAt, n);
          const awayGoals = await recentGoalsAvg(fx.awayTeamId, fx.kickoffAt, n);

          // V3: 홈/원정 분리 성적
          const homeAtHome = await homeOnlyStats(fx.homeTeamId, fx.kickoffAt, n);
          const awayAtAway = await awayOnlyStats(fx.awayTeamId, fx.kickoffAt, n);

          // V3: 폼 (최근 3, 5경기)
          const homeForm3 = await recentForm(fx.homeTeamId, fx.kickoffAt, 3);
          const homeForm5 = await recentForm(fx.homeTeamId, fx.kickoffAt, 5);
          const awayForm3 = await recentForm(fx.awayTeamId, fx.kickoffAt, 3);
          const awayForm5 = await recentForm(fx.awayTeamId, fx.kickoffAt, 5);

          // V4: 경기 텀/피로
          const homeDaysRest = await getDaysRest(fx.homeTeamId, fx.kickoffAt);
          const awayDaysRest = await getDaysRest(fx.awayTeamId, fx.kickoffAt);
          const homeMatches14d = await getMatches14d(fx.homeTeamId, fx.kickoffAt);
          const awayMatches14d = await getMatches14d(fx.awayTeamId, fx.kickoffAt);
          const homeEuropean7d = await getEuropean7d(fx.homeTeamId, fx.kickoffAt);
          const awayEuropean7d = await getEuropean7d(fx.awayTeamId, fx.kickoffAt);

          // V5: 상대전적 (H2H)
          const h2h = await getH2H(fx.homeTeamId, fx.awayTeamId, fx.kickoffAt);

          // V2: diff 계산
          const safeDiff = (a: number | null, b: number | null) =>
            a !== null && b !== null ? a - b : null;

          await prisma.fixtureFeatureSnapshot.upsert({
            where: { fixtureId: fx.id },
            update: {
              featureVersion,
              nMatches: n,
              builtAt: new Date(),
              kickoffAt: fx.kickoffAt,
              season: fx.season,
              leagueId: fx.leagueId,
              homeTeamId: fx.homeTeamId,
              awayTeamId: fx.awayTeamId,
              homeGoals: fx.homeGoals,
              awayGoals: fx.awayGoals,
              homeInjuryCount,
              awayInjuryCount,
              tempC: weather?.tempC ?? null,
              precipitationMm: weather?.precipitationMm ?? null,
              windKph: weather?.windKph ?? null,
              humidityPct: weather?.humidityPct ?? null,
              pressureHpa: weather?.pressureHpa ?? null,
              cloudCoverPct: weather?.cloudCoverPct ?? null,
              isDay: weather?.isDay ?? null,
              // Home stats
              home_shotsTotal_avg: homeStats.shotsTotal_avg,
              home_shotsOnTarget_avg: homeStats.shotsOnTarget_avg,
              home_possessionPct_avg: homeStats.possessionPct_avg,
              home_passesTotal_avg: homeStats.passesTotal_avg,
              home_passAccuracyPct_avg: homeStats.passAccuracyPct_avg,
              home_fouls_avg: homeStats.fouls_avg,
              home_corners_avg: homeStats.corners_avg,
              home_yellowCards_avg: homeStats.yellowCards_avg,
              home_redCards_avg: homeStats.redCards_avg,
              home_xg_avg: homeStats.xg_avg,
              home_goalsFor_avg: homeGoals.goalsFor_avg,
              home_goalsAgainst_avg: homeGoals.goalsAgainst_avg,
              // Away stats
              away_shotsTotal_avg: awayStats.shotsTotal_avg,
              away_shotsOnTarget_avg: awayStats.shotsOnTarget_avg,
              away_possessionPct_avg: awayStats.possessionPct_avg,
              away_passesTotal_avg: awayStats.passesTotal_avg,
              away_passAccuracyPct_avg: awayStats.passAccuracyPct_avg,
              away_fouls_avg: awayStats.fouls_avg,
              away_corners_avg: awayStats.corners_avg,
              away_yellowCards_avg: awayStats.yellowCards_avg,
              away_redCards_avg: awayStats.redCards_avg,
              away_xg_avg: awayStats.xg_avg,
              away_goalsFor_avg: awayGoals.goalsFor_avg,
              away_goalsAgainst_avg: awayGoals.goalsAgainst_avg,
              // V2: Diff features
              shotsTotal_diff: safeDiff(homeStats.shotsTotal_avg, awayStats.shotsTotal_avg),
              shotsOnTarget_diff: safeDiff(homeStats.shotsOnTarget_avg, awayStats.shotsOnTarget_avg),
              possessionPct_diff: safeDiff(homeStats.possessionPct_avg, awayStats.possessionPct_avg),
              passesTotal_diff: safeDiff(homeStats.passesTotal_avg, awayStats.passesTotal_avg),
              passAccuracyPct_diff: safeDiff(homeStats.passAccuracyPct_avg, awayStats.passAccuracyPct_avg),
              fouls_diff: safeDiff(homeStats.fouls_avg, awayStats.fouls_avg),
              corners_diff: safeDiff(homeStats.corners_avg, awayStats.corners_avg),
              yellowCards_diff: safeDiff(homeStats.yellowCards_avg, awayStats.yellowCards_avg),
              redCards_diff: safeDiff(homeStats.redCards_avg, awayStats.redCards_avg),
              xg_diff: safeDiff(homeStats.xg_avg, awayStats.xg_avg),
              injuryCount_diff: homeInjuryCount - awayInjuryCount,
              goalsFor_diff: safeDiff(homeGoals.goalsFor_avg, awayGoals.goalsFor_avg),
              goalsAgainst_diff: safeDiff(homeGoals.goalsAgainst_avg, awayGoals.goalsAgainst_avg),
              // V3: 홈/원정 분리 성적
              home_goalsFor_atHome_avg: homeAtHome.goalsFor_atHome_avg,
              home_goalsAgainst_atHome_avg: homeAtHome.goalsAgainst_atHome_avg,
              home_xg_atHome_avg: homeAtHome.xg_atHome_avg,
              home_wins_atHome_pct: homeAtHome.wins_atHome_pct,
              away_goalsFor_atAway_avg: awayAtAway.goalsFor_atAway_avg,
              away_goalsAgainst_atAway_avg: awayAtAway.goalsAgainst_atAway_avg,
              away_xg_atAway_avg: awayAtAway.xg_atAway_avg,
              away_wins_atAway_pct: awayAtAway.wins_atAway_pct,
              // V3: 폼
              home_form_last3: homeForm3,
              home_form_last5: homeForm5,
              away_form_last3: awayForm3,
              away_form_last5: awayForm5,
              // V3: 득점력/수비력 차이
              attack_diff: safeDiff(homeAtHome.goalsFor_atHome_avg, awayAtAway.goalsAgainst_atAway_avg),
              defense_diff: safeDiff(homeAtHome.goalsAgainst_atHome_avg, awayAtAway.goalsFor_atAway_avg),
              // V4: 경기 텀/피로
              home_days_rest: homeDaysRest,
              away_days_rest: awayDaysRest,
              rest_diff: homeDaysRest !== null && awayDaysRest !== null ? homeDaysRest - awayDaysRest : null,
              home_matches_14d: homeMatches14d,
              away_matches_14d: awayMatches14d,
              congestion_diff: awayMatches14d - homeMatches14d,
              home_european_7d: homeEuropean7d,
              away_european_7d: awayEuropean7d,
              european_diff: awayEuropean7d - homeEuropean7d,
              // V5: 상대전적 (H2H)
              h2h_total_matches: h2h.total,
              h2h_home_wins: h2h.homeWins,
              h2h_away_wins: h2h.awayWins,
              h2h_draws: h2h.draws,
              h2h_home_goals_avg: h2h.homeGoalsAvg,
              h2h_away_goals_avg: h2h.awayGoalsAvg,
              h2h_home_win_pct: h2h.homeWinPct,
            },
            create: {
              fixtureId: fx.id,
              featureVersion,
              nMatches: n,
              builtAt: new Date(),
              kickoffAt: fx.kickoffAt,
              season: fx.season,
              leagueId: fx.leagueId,
              homeTeamId: fx.homeTeamId,
              awayTeamId: fx.awayTeamId,
              homeGoals: fx.homeGoals,
              awayGoals: fx.awayGoals,
              homeInjuryCount,
              awayInjuryCount,
              tempC: weather?.tempC ?? null,
              precipitationMm: weather?.precipitationMm ?? null,
              windKph: weather?.windKph ?? null,
              humidityPct: weather?.humidityPct ?? null,
              pressureHpa: weather?.pressureHpa ?? null,
              cloudCoverPct: weather?.cloudCoverPct ?? null,
              isDay: weather?.isDay ?? null,
              home_shotsTotal_avg: homeStats.shotsTotal_avg,
              home_shotsOnTarget_avg: homeStats.shotsOnTarget_avg,
              home_possessionPct_avg: homeStats.possessionPct_avg,
              home_passesTotal_avg: homeStats.passesTotal_avg,
              home_passAccuracyPct_avg: homeStats.passAccuracyPct_avg,
              home_fouls_avg: homeStats.fouls_avg,
              home_corners_avg: homeStats.corners_avg,
              home_yellowCards_avg: homeStats.yellowCards_avg,
              home_redCards_avg: homeStats.redCards_avg,
              home_xg_avg: homeStats.xg_avg,
              home_goalsFor_avg: homeGoals.goalsFor_avg,
              home_goalsAgainst_avg: homeGoals.goalsAgainst_avg,
              away_shotsTotal_avg: awayStats.shotsTotal_avg,
              away_shotsOnTarget_avg: awayStats.shotsOnTarget_avg,
              away_possessionPct_avg: awayStats.possessionPct_avg,
              away_passesTotal_avg: awayStats.passesTotal_avg,
              away_passAccuracyPct_avg: awayStats.passAccuracyPct_avg,
              away_fouls_avg: awayStats.fouls_avg,
              away_corners_avg: awayStats.corners_avg,
              away_yellowCards_avg: awayStats.yellowCards_avg,
              away_redCards_avg: awayStats.redCards_avg,
              away_xg_avg: awayStats.xg_avg,
              away_goalsFor_avg: awayGoals.goalsFor_avg,
              away_goalsAgainst_avg: awayGoals.goalsAgainst_avg,
              shotsTotal_diff: safeDiff(homeStats.shotsTotal_avg, awayStats.shotsTotal_avg),
              shotsOnTarget_diff: safeDiff(homeStats.shotsOnTarget_avg, awayStats.shotsOnTarget_avg),
              possessionPct_diff: safeDiff(homeStats.possessionPct_avg, awayStats.possessionPct_avg),
              passesTotal_diff: safeDiff(homeStats.passesTotal_avg, awayStats.passesTotal_avg),
              passAccuracyPct_diff: safeDiff(homeStats.passAccuracyPct_avg, awayStats.passAccuracyPct_avg),
              fouls_diff: safeDiff(homeStats.fouls_avg, awayStats.fouls_avg),
              corners_diff: safeDiff(homeStats.corners_avg, awayStats.corners_avg),
              yellowCards_diff: safeDiff(homeStats.yellowCards_avg, awayStats.yellowCards_avg),
              redCards_diff: safeDiff(homeStats.redCards_avg, awayStats.redCards_avg),
              xg_diff: safeDiff(homeStats.xg_avg, awayStats.xg_avg),
              injuryCount_diff: homeInjuryCount - awayInjuryCount,
              goalsFor_diff: safeDiff(homeGoals.goalsFor_avg, awayGoals.goalsFor_avg),
              goalsAgainst_diff: safeDiff(homeGoals.goalsAgainst_avg, awayGoals.goalsAgainst_avg),
              // V3: 홈/원정 분리 성적
              home_goalsFor_atHome_avg: homeAtHome.goalsFor_atHome_avg,
              home_goalsAgainst_atHome_avg: homeAtHome.goalsAgainst_atHome_avg,
              home_xg_atHome_avg: homeAtHome.xg_atHome_avg,
              home_wins_atHome_pct: homeAtHome.wins_atHome_pct,
              away_goalsFor_atAway_avg: awayAtAway.goalsFor_atAway_avg,
              away_goalsAgainst_atAway_avg: awayAtAway.goalsAgainst_atAway_avg,
              away_xg_atAway_avg: awayAtAway.xg_atAway_avg,
              away_wins_atAway_pct: awayAtAway.wins_atAway_pct,
              // V3: 폼
              home_form_last3: homeForm3,
              home_form_last5: homeForm5,
              away_form_last3: awayForm3,
              away_form_last5: awayForm5,
              // V3: 득점력/수비력 차이
              attack_diff: safeDiff(homeAtHome.goalsFor_atHome_avg, awayAtAway.goalsAgainst_atAway_avg),
              defense_diff: safeDiff(homeAtHome.goalsAgainst_atHome_avg, awayAtAway.goalsFor_atAway_avg),
              // V4: 경기 텀/피로
              home_days_rest: homeDaysRest,
              away_days_rest: awayDaysRest,
              rest_diff: homeDaysRest !== null && awayDaysRest !== null ? homeDaysRest - awayDaysRest : null,
              home_matches_14d: homeMatches14d,
              away_matches_14d: awayMatches14d,
              congestion_diff: awayMatches14d - homeMatches14d,
              home_european_7d: homeEuropean7d,
              away_european_7d: awayEuropean7d,
              european_diff: awayEuropean7d - homeEuropean7d,
              // V5: 상대전적 (H2H)
              h2h_total_matches: h2h.total,
              h2h_home_wins: h2h.homeWins,
              h2h_away_wins: h2h.awayWins,
              h2h_draws: h2h.draws,
              h2h_home_goals_avg: h2h.homeGoalsAvg,
              h2h_away_goals_avg: h2h.awayGoalsAvg,
              h2h_home_win_pct: h2h.homeWinPct,
            },
          });

          built++;
        } catch (e: any) {
          errors++;
          console.error(`[bulk-build-features] Error for fixture ${fx.id}:`, e.message);
        }
      }

      res.json({
        ok: true,
        totalFixtures: fixtures.length,
        built,
        skipped,
        errors,
        featureVersion,
      });
    } catch (error: any) {
      console.error("[bulk-build-features] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ============================================================
  // 💰 미래 경기 배당 동기화 API
  // ============================================================
  app.post("/api/admin/sync-upcoming-odds", async (req, res) => {
    try {
      const days = Number(req.query.days || 7);
      
      const now = new Date();
      const toDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      
      // DB에서 배당 없는 미래 경기 조회
      const upcomingFixtures = await prisma.fixture.findMany({
        where: {
          kickoffAt: { gte: now, lte: toDate },
          status: { in: ["NS", "TBD"] },
          odds: null,
        },
        include: { league: true },
        orderBy: { kickoffAt: "asc" },
      });

      // 리그+날짜별로 그룹화
      const dateLeagueGroups = new Map<string, { 
        leagueApiId: number; 
        season: number; 
        date: string;
        fixtures: typeof upcomingFixtures 
      }>();
      
      for (const fx of upcomingFixtures) {
        const dateStr = fx.kickoffAt.toISOString().split("T")[0]; // YYYY-MM-DD
        const key = `${fx.league.apiLeagueId}_${dateStr}`;
        if (!dateLeagueGroups.has(key)) {
          dateLeagueGroups.set(key, { 
            leagueApiId: fx.league.apiLeagueId, 
            season: fx.season, 
            date: dateStr,
            fixtures: [] 
          });
        }
        dateLeagueGroups.get(key)!.fixtures.push(fx);
      }

      const results = {
        needsOdds: upcomingFixtures.length,
        groups: dateLeagueGroups.size,
        synced: 0,
        notFound: 0,
        errors: 0,
        details: [] as string[],
      };

      // 리그+날짜별로 배당 조회
      for (const [key, group] of dateLeagueGroups) {
        try {
          console.log(`[sync-odds] Fetching odds for league ${group.leagueApiId}, date ${group.date}...`);
          
          const oddsResponse = await axios.get("https://v3.football.api-sports.io/odds", {
            headers: { "x-apisports-key": process.env.API_SPORTS_KEY || "" },
            params: {
              league: group.leagueApiId,
              season: group.season,
              date: group.date,  // 날짜 추가!
            },
          });

          console.log(`[sync-odds] League ${group.leagueApiId} date ${group.date}: ${oddsResponse.data?.response?.length || 0} odds`);

          // apiFixtureId로 배당 매핑
          const oddsMap = new Map<number, { home: number; draw: number; away: number }>();
          for (const item of oddsResponse.data?.response || []) {
            const fixtureId = item.fixture?.id;
            if (!fixtureId) continue;

            const bookmaker = item.bookmakers?.[0];
            if (!bookmaker) continue;

            const matchWinnerBet = bookmaker.bets?.find((b: any) => b.name === "Match Winner");
            if (!matchWinnerBet) continue;

            const values = matchWinnerBet.values;
            const homeOdd = values.find((v: any) => v.value === "Home")?.odd;
            const drawOdd = values.find((v: any) => v.value === "Draw")?.odd;
            const awayOdd = values.find((v: any) => v.value === "Away")?.odd;

            if (homeOdd && drawOdd && awayOdd) {
              oddsMap.set(fixtureId, {
                home: parseFloat(homeOdd),
                draw: parseFloat(drawOdd),
                away: parseFloat(awayOdd),
              });
            }
          }

          // 디버깅
          const apiIds = Array.from(oddsMap.keys()).slice(0, 3);
          const dbIds = group.fixtures.map(f => f.apiFixtureId).slice(0, 3);
          console.log(`[sync-odds] API IDs: ${apiIds.join(", ")} | DB IDs: ${dbIds.join(", ")}`);

          results.details.push(`${group.date} 리그${group.leagueApiId}: ${oddsMap.size}개`);

          // DB 경기와 매칭
          for (const fx of group.fixtures) {
            const odd = oddsMap.get(fx.apiFixtureId);
            
            if (!odd) {
              results.notFound++;
              continue;
            }

            try {
              // 기존 배당 조회 (변동 비교용)
              const prevOdds = await prisma.fixtureOdds.findUnique({
                where: { fixtureId: fx.id },
              });

              const currentOdds = await prisma.fixtureOdds.upsert({
                where: { fixtureId: fx.id },
                update: {
                  home: odd.home,
                  draw: odd.draw,
                  away: odd.away,
                },
                create: {
                  fixtureId: fx.id,
                  home: odd.home,
                  draw: odd.draw,
                  away: odd.away,
                },
              });

              // OddsHistory 저장 (배당 변동 추적)
              const homeChange = prevOdds?.home ? odd.home - Number(prevOdds.home) : null;
              const drawChange = prevOdds?.draw ? odd.draw - Number(prevOdds.draw) : null;
              const awayChange = prevOdds?.away ? odd.away - Number(prevOdds.away) : null;

              await prisma.oddsHistory.create({
                data: {
                  oddsId: currentOdds.id,
                  home: odd.home,
                  draw: odd.draw,
                  away: odd.away,
                  homeChange: homeChange !== null ? Math.round(homeChange * 100) / 100 : null,
                  drawChange: drawChange !== null ? Math.round(drawChange * 100) / 100 : null,
                  awayChange: awayChange !== null ? Math.round(awayChange * 100) / 100 : null,
                },
              });

              results.synced++;
            } catch (err: any) {
              console.error(`[sync-odds] DB Error for ${fx.apiFixtureId}:`, err.message);
              results.errors++;
            }
          }
        } catch (err: any) {
          console.error(`[sync-odds] Error:`, err.message);
          results.errors++;
        }
      }

      res.json({
        ok: true,
        ...results,
        apiCallsUsed: dateLeagueGroups.size,
      });
    } catch (error: any) {
      console.error("[sync-odds] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ============================================================
  // 📊 미래 경기 피처 빌드 API (예측용)
  // ============================================================
  app.post("/api/admin/build-upcoming-features", async (req, res) => {
    try {
      const days = Number(req.query.days || 7);
      const featureVersion = Number(req.query.v || 5);
      const force = req.query.force === "1";
      const n = 5; // 최근 N경기 평균

      const now = new Date();
      const toDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      // 미래 경기 조회 (NS = Not Started)
      const fixtures = await prisma.fixture.findMany({
        where: {
          kickoffAt: { gte: now, lte: toDate },
          status: "NS",
        },
        select: {
          id: true,
          apiFixtureId: true,
          leagueId: true,
          season: true,
          kickoffAt: true,
          homeTeamId: true,
          awayTeamId: true,
        },
        orderBy: { kickoffAt: "asc" },
      });

      if (fixtures.length === 0) {
        return res.json({ ok: true, message: "No upcoming fixtures found", built: 0 });
      }

      // 이미 featureSnapshot이 있는 것 필터
      const existingFeatures = await prisma.fixtureFeatureSnapshot.findMany({
        where: { fixtureId: { in: fixtures.map((f) => f.id) } },
        select: { fixtureId: true, featureVersion: true },
      });
      const existingMap = new Map(existingFeatures.map((f) => [f.fixtureId.toString(), f.featureVersion]));

      function avg(nums: Array<number | null | undefined>) {
        const clean = nums.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        if (clean.length === 0) return null;
        return clean.reduce((a, b) => a + b, 0) / clean.length;
      }

      async function recentTeamStatsAvg(teamId: bigint, kickoffAt: Date, takeN: number) {
        const rows = await prisma.fixtureTeamStatSnapshot.findMany({
          where: {
            teamId,
            fixture: { kickoffAt: { lt: kickoffAt }, status: "FT" },
          },
          orderBy: { fixture: { kickoffAt: "desc" } },
          take: takeN,
        });
        return {
          shotsTotal_avg: avg(rows.map((r) => r.shotsTotal)),
          shotsOnTarget_avg: avg(rows.map((r) => r.shotsOnTarget)),
          possessionPct_avg: avg(rows.map((r) => r.possessionPct)),
          passesTotal_avg: avg(rows.map((r) => r.passesTotal)),
          passAccuracyPct_avg: avg(rows.map((r) => r.passAccuracyPct)),
          fouls_avg: avg(rows.map((r) => r.fouls)),
          corners_avg: avg(rows.map((r) => r.corners)),
          yellowCards_avg: avg(rows.map((r) => r.yellowCards)),
          redCards_avg: avg(rows.map((r) => r.redCards)),
          xg_avg: avg(rows.map((r) => r.xg)),
        };
      }

      async function recentTeamGoalsAvg(teamId: bigint, kickoffAt: Date, takeN: number) {
        const rows = await prisma.fixture.findMany({
          where: {
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
            kickoffAt: { lt: kickoffAt },
            status: "FT",
            homeGoals: { not: null },
            awayGoals: { not: null },
          },
          orderBy: { kickoffAt: "desc" },
          take: takeN,
        });
        const goalsForArr: number[] = [];
        const goalsAgainstArr: number[] = [];
        for (const r of rows) {
          if (r.homeTeamId === teamId) {
            goalsForArr.push(r.homeGoals!);
            goalsAgainstArr.push(r.awayGoals!);
          } else {
            goalsForArr.push(r.awayGoals!);
            goalsAgainstArr.push(r.homeGoals!);
          }
        }
        return { goalsFor_avg: avg(goalsForArr), goalsAgainst_avg: avg(goalsAgainstArr) };
      }

      async function homeAwayStats(teamId: bigint, kickoffAt: Date, takeN: number, isHome: boolean) {
        const rows = await prisma.fixture.findMany({
          where: {
            ...(isHome ? { homeTeamId: teamId } : { awayTeamId: teamId }),
            kickoffAt: { lt: kickoffAt },
            status: "FT",
            homeGoals: { not: null },
            awayGoals: { not: null },
          },
          include: {
            teamStats: { where: { teamId } },
          },
          orderBy: { kickoffAt: "desc" },
          take: takeN,
        });
        const goalsFor: number[] = [];
        const goalsAgainst: number[] = [];
        const xgArr: number[] = [];
        let wins = 0;
        for (const r of rows) {
          if (isHome) {
            goalsFor.push(r.homeGoals!);
            goalsAgainst.push(r.awayGoals!);
            if (r.homeGoals! > r.awayGoals!) wins++;
          } else {
            goalsFor.push(r.awayGoals!);
            goalsAgainst.push(r.homeGoals!);
            if (r.awayGoals! > r.homeGoals!) wins++;
          }
          const stat = r.teamStats?.[0];
          if (stat?.xg) xgArr.push(stat.xg);
        }
        const suffix = isHome ? "atHome" : "atAway";
        return {
          [`goalsFor_${suffix}_avg`]: avg(goalsFor),
          [`goalsAgainst_${suffix}_avg`]: avg(goalsAgainst),
          [`xg_${suffix}_avg`]: avg(xgArr),
          [`wins_${suffix}_pct`]: rows.length > 0 ? (wins / rows.length) * 100 : null,
        };
      }

      async function formPoints(teamId: bigint, kickoffAt: Date, lastN: number) {
        const rows = await prisma.fixture.findMany({
          where: {
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
            kickoffAt: { lt: kickoffAt },
            status: "FT",
            homeGoals: { not: null },
            awayGoals: { not: null },
          },
          orderBy: { kickoffAt: "desc" },
          take: lastN,
        });
        let pts = 0;
        for (const r of rows) {
          const isHome = r.homeTeamId === teamId;
          const gf = isHome ? r.homeGoals! : r.awayGoals!;
          const ga = isHome ? r.awayGoals! : r.homeGoals!;
          if (gf > ga) pts += 3;
          else if (gf === ga) pts += 1;
        }
        return rows.length > 0 ? pts / rows.length : null;
      }

      async function daysRest(teamId: bigint, kickoffAt: Date) {
        const prev = await prisma.fixture.findFirst({
          where: {
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
            kickoffAt: { lt: kickoffAt },
            status: "FT",
          },
          orderBy: { kickoffAt: "desc" },
        });
        if (!prev) return null;
        return Math.floor((kickoffAt.getTime() - prev.kickoffAt.getTime()) / (1000 * 60 * 60 * 24));
      }

      async function matchesInLast14Days(teamId: bigint, kickoffAt: Date) {
        const d14 = new Date(kickoffAt.getTime() - 14 * 24 * 60 * 60 * 1000);
        return prisma.fixture.count({
          where: {
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
            kickoffAt: { gte: d14, lt: kickoffAt },
            status: "FT",
          },
        });
      }

      async function europeanIn7Days(teamId: bigint, kickoffAt: Date) {
        const d7 = new Date(kickoffAt.getTime() - 7 * 24 * 60 * 60 * 1000);
        return prisma.fixture.count({
          where: {
            OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
            kickoffAt: { gte: d7, lt: kickoffAt },
            status: "FT",
            league: { apiLeagueId: { in: [2, 3] } },
          },
        });
      }

      async function h2hStats(homeTeamId: bigint, awayTeamId: bigint, kickoffAt: Date) {
        const twoYearsAgo = new Date(kickoffAt.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
        const matches = await prisma.fixture.findMany({
          where: {
            OR: [
              { homeTeamId, awayTeamId },
              { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
            ],
            kickoffAt: { gte: twoYearsAgo, lt: kickoffAt },
            status: "FT",
            homeGoals: { not: null },
            awayGoals: { not: null },
          },
          orderBy: { kickoffAt: "desc" },
          take: 10,
        });
        if (matches.length === 0) {
          return { total: 0, homeWins: 0, awayWins: 0, draws: 0, homeGoalsAvg: null, awayGoalsAvg: null, homeWinPct: null };
        }
        let homeWins = 0, awayWins = 0, draws = 0;
        const homeGoals: number[] = [], awayGoals: number[] = [];
        for (const m of matches) {
          const isHomeTeamHome = m.homeTeamId === homeTeamId;
          const hg = isHomeTeamHome ? m.homeGoals! : m.awayGoals!;
          const ag = isHomeTeamHome ? m.awayGoals! : m.homeGoals!;
          homeGoals.push(hg);
          awayGoals.push(ag);
          if (hg > ag) homeWins++;
          else if (ag > hg) awayWins++;
          else draws++;
        }
        return {
          total: matches.length,
          homeWins,
          awayWins,
          draws,
          homeGoalsAvg: avg(homeGoals),
          awayGoalsAvg: avg(awayGoals),
          homeWinPct: (homeWins / matches.length) * 100,
        };
      }

      function safeDiff(a: number | null, b: number | null) {
        if (a === null || b === null) return null;
        return a - b;
      }

      let built = 0, skipped = 0, errors = 0;

      for (const fx of fixtures) {
        const existVer = existingMap.get(fx.id.toString());
        if (!force && existVer && existVer >= featureVersion) {
          skipped++;
          continue;
        }

        try {
          const [homeStats, awayStats, homeGoals, awayGoals, homeAtHome, awayAtAway, homeForm3, homeForm5, awayForm3, awayForm5, homeDaysRest, awayDaysRest, homeMatches14d, awayMatches14d, homeEuropean7d, awayEuropean7d, h2h] = await Promise.all([
            recentTeamStatsAvg(fx.homeTeamId, fx.kickoffAt, n),
            recentTeamStatsAvg(fx.awayTeamId, fx.kickoffAt, n),
            recentTeamGoalsAvg(fx.homeTeamId, fx.kickoffAt, n),
            recentTeamGoalsAvg(fx.awayTeamId, fx.kickoffAt, n),
            homeAwayStats(fx.homeTeamId, fx.kickoffAt, n, true),
            homeAwayStats(fx.awayTeamId, fx.kickoffAt, n, false),
            formPoints(fx.homeTeamId, fx.kickoffAt, 3),
            formPoints(fx.homeTeamId, fx.kickoffAt, 5),
            formPoints(fx.awayTeamId, fx.kickoffAt, 3),
            formPoints(fx.awayTeamId, fx.kickoffAt, 5),
            daysRest(fx.homeTeamId, fx.kickoffAt),
            daysRest(fx.awayTeamId, fx.kickoffAt),
            matchesInLast14Days(fx.homeTeamId, fx.kickoffAt),
            matchesInLast14Days(fx.awayTeamId, fx.kickoffAt),
            europeanIn7Days(fx.homeTeamId, fx.kickoffAt),
            europeanIn7Days(fx.awayTeamId, fx.kickoffAt),
            h2hStats(fx.homeTeamId, fx.awayTeamId, fx.kickoffAt),
          ]);

          await prisma.fixtureFeatureSnapshot.upsert({
            where: { fixtureId: fx.id },
            update: { featureVersion, builtAt: new Date() },
            create: {
              fixtureId: fx.id,
              featureVersion,
              leagueId: fx.leagueId,
              season: fx.season,
              homeTeamId: fx.homeTeamId,
              awayTeamId: fx.awayTeamId,
              kickoffAt: fx.kickoffAt,
              home_shotsTotal_avg: homeStats.shotsTotal_avg,
              home_shotsOnTarget_avg: homeStats.shotsOnTarget_avg,
              home_possessionPct_avg: homeStats.possessionPct_avg,
              home_passesTotal_avg: homeStats.passesTotal_avg,
              home_passAccuracyPct_avg: homeStats.passAccuracyPct_avg,
              home_fouls_avg: homeStats.fouls_avg,
              home_corners_avg: homeStats.corners_avg,
              home_yellowCards_avg: homeStats.yellowCards_avg,
              home_redCards_avg: homeStats.redCards_avg,
              home_xg_avg: homeStats.xg_avg,
              home_goalsFor_avg: homeGoals.goalsFor_avg,
              home_goalsAgainst_avg: homeGoals.goalsAgainst_avg,
              away_shotsTotal_avg: awayStats.shotsTotal_avg,
              away_shotsOnTarget_avg: awayStats.shotsOnTarget_avg,
              away_possessionPct_avg: awayStats.possessionPct_avg,
              away_passesTotal_avg: awayStats.passesTotal_avg,
              away_passAccuracyPct_avg: awayStats.passAccuracyPct_avg,
              away_fouls_avg: awayStats.fouls_avg,
              away_corners_avg: awayStats.corners_avg,
              away_yellowCards_avg: awayStats.yellowCards_avg,
              away_redCards_avg: awayStats.redCards_avg,
              away_xg_avg: awayStats.xg_avg,
              away_goalsFor_avg: awayGoals.goalsFor_avg,
              away_goalsAgainst_avg: awayGoals.goalsAgainst_avg,
              shotsTotal_diff: safeDiff(homeStats.shotsTotal_avg, awayStats.shotsTotal_avg),
              shotsOnTarget_diff: safeDiff(homeStats.shotsOnTarget_avg, awayStats.shotsOnTarget_avg),
              possessionPct_diff: safeDiff(homeStats.possessionPct_avg, awayStats.possessionPct_avg),
              passesTotal_diff: safeDiff(homeStats.passesTotal_avg, awayStats.passesTotal_avg),
              passAccuracyPct_diff: safeDiff(homeStats.passAccuracyPct_avg, awayStats.passAccuracyPct_avg),
              fouls_diff: safeDiff(homeStats.fouls_avg, awayStats.fouls_avg),
              corners_diff: safeDiff(homeStats.corners_avg, awayStats.corners_avg),
              yellowCards_diff: safeDiff(homeStats.yellowCards_avg, awayStats.yellowCards_avg),
              redCards_diff: safeDiff(homeStats.redCards_avg, awayStats.redCards_avg),
              xg_diff: safeDiff(homeStats.xg_avg, awayStats.xg_avg),
              goalsFor_diff: safeDiff(homeGoals.goalsFor_avg, awayGoals.goalsFor_avg),
              goalsAgainst_diff: safeDiff(homeGoals.goalsAgainst_avg, awayGoals.goalsAgainst_avg),
              home_goalsFor_atHome_avg: (homeAtHome as any).goalsFor_atHome_avg,
              home_goalsAgainst_atHome_avg: (homeAtHome as any).goalsAgainst_atHome_avg,
              home_xg_atHome_avg: (homeAtHome as any).xg_atHome_avg,
              home_wins_atHome_pct: (homeAtHome as any).wins_atHome_pct,
              away_goalsFor_atAway_avg: (awayAtAway as any).goalsFor_atAway_avg,
              away_goalsAgainst_atAway_avg: (awayAtAway as any).goalsAgainst_atAway_avg,
              away_xg_atAway_avg: (awayAtAway as any).xg_atAway_avg,
              away_wins_atAway_pct: (awayAtAway as any).wins_atAway_pct,
              home_form_last3: homeForm3,
              home_form_last5: homeForm5,
              away_form_last3: awayForm3,
              away_form_last5: awayForm5,
              attack_diff: safeDiff((homeAtHome as any).goalsFor_atHome_avg, (awayAtAway as any).goalsAgainst_atAway_avg),
              defense_diff: safeDiff((homeAtHome as any).goalsAgainst_atHome_avg, (awayAtAway as any).goalsFor_atAway_avg),
              home_days_rest: homeDaysRest,
              away_days_rest: awayDaysRest,
              rest_diff: homeDaysRest !== null && awayDaysRest !== null ? homeDaysRest - awayDaysRest : null,
              home_matches_14d: homeMatches14d,
              away_matches_14d: awayMatches14d,
              congestion_diff: awayMatches14d - homeMatches14d,
              home_european_7d: homeEuropean7d,
              away_european_7d: awayEuropean7d,
              european_diff: awayEuropean7d - homeEuropean7d,
              h2h_total_matches: h2h.total,
              h2h_home_wins: h2h.homeWins,
              h2h_away_wins: h2h.awayWins,
              h2h_draws: h2h.draws,
              h2h_home_goals_avg: h2h.homeGoalsAvg,
              h2h_away_goals_avg: h2h.awayGoalsAvg,
              h2h_home_win_pct: h2h.homeWinPct,
            },
          });

          built++;
          console.log(`[build-upcoming] Built fixture ${fx.id} (${built}/${fixtures.length})`);
        } catch (e: any) {
          errors++;
          console.error(`[build-upcoming] Error for fixture ${fx.id}:`, e.message);
        }
      }

      res.json({
        ok: true,
        totalFixtures: fixtures.length,
        built,
        skipped,
        errors,
        featureVersion,
      });
    } catch (error: any) {
      console.error("[build-upcoming] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ============================================================
  // 📊 데이터 커버리지 대시보드 API
  // ============================================================
  app.get("/api/admin/data-coverage", async (req, res) => {
    try {
      const season = req.query.season ? Number(req.query.season) : undefined;

      // 1) 활성화된 리그 목록
      const leagues = await prisma.league.findMany({
        where: { enabled: true, ...(season ? { season } : {}) },
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      });

      const coverageByLeague: any[] = [];

      for (const league of leagues) {
        // 해당 리그의 Fixture 수
        const fixtures = await prisma.fixture.findMany({
          where: { leagueId: league.id },
          select: { id: true, status: true },
        });

        const fixtureIds = fixtures.map((f) => f.id);
        const totalFixtures = fixtures.length;
        const finishedFixtures = fixtures.filter((f) =>
          ["FT", "AET", "PEN"].includes(f.status)
        ).length;

        // TeamStatSnapshot 수 (경기당 2개가 정상: 홈/어웨이)
        const teamStatsCount = await prisma.fixtureTeamStatSnapshot.count({
          where: { fixtureId: { in: fixtureIds } },
        });

        // Weather 수
        const weatherCount = await prisma.fixtureWeather.count({
          where: { fixtureId: { in: fixtureIds } },
        });

        // Injuries 수 (경기 기준 distinct)
        const injuryFixtures = await prisma.fixtureInjury.groupBy({
          by: ["fixtureId"],
          where: { fixtureId: { in: fixtureIds } },
        });

        // Odds 수
        const oddsCount = await prisma.fixtureOdds.count({
          where: { fixtureId: { in: fixtureIds } },
        });

        // FeatureSnapshot 수
        const featureCount = await prisma.fixtureFeatureSnapshot.count({
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
          features: {
            count: featureCount,
            coveragePct: finishedFixtures > 0 ? Math.round((featureCount / finishedFixtures) * 100) : 0,
          },
        });
      }

      // 전체 합계
      const totals = {
        fixtures: coverageByLeague.reduce((sum, l) => sum + l.fixtures.total, 0),
        finishedFixtures: coverageByLeague.reduce((sum, l) => sum + l.fixtures.finished, 0),
        teamStats: coverageByLeague.reduce((sum, l) => sum + l.teamStats.count, 0),
        weather: coverageByLeague.reduce((sum, l) => sum + l.weather.count, 0),
        injuries: coverageByLeague.reduce((sum, l) => sum + l.injuries.fixturesWithData, 0),
        odds: coverageByLeague.reduce((sum, l) => sum + l.odds.count, 0),
        features: coverageByLeague.reduce((sum, l) => sum + l.features.count, 0),
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
          featuresCoveragePct: totals.finishedFixtures > 0
            ? Math.round((totals.features / totals.finishedFixtures) * 100)
            : 0,
        },
        byLeague: coverageByLeague,
      });
    } catch (error: any) {
      console.error("[data-coverage] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ============================================================
  // 📈 피처 품질 분석 API (상관계수 + 유의미성)
  // ============================================================
  app.get("/api/admin/feature-quality", async (req, res) => {
    try {
      const leagueId = req.query.leagueId ? Number(req.query.leagueId) : undefined;
      const minSamples = Number(req.query.minSamples || 50);

      // FeatureSnapshot 데이터 가져오기 (결과가 있는 것만)
      const whereClause: any = {
        homeGoals: { not: null },
        awayGoals: { not: null },
      };

      if (leagueId) {
        // apiLeagueId로 필터링
        const league = await prisma.league.findFirst({
          where: { apiLeagueId: leagueId },
        });
        if (league) {
          whereClause.leagueId = league.id;
        }
      }

      const snapshots = await prisma.fixtureFeatureSnapshot.findMany({
        where: whereClause,
        orderBy: { kickoffAt: "desc" },
        take: 5000, // 최대 5000개 샘플
      });

      if (snapshots.length < minSamples) {
        return res.json({
          ok: false,
          error: `샘플 부족: ${snapshots.length}개 (최소 ${minSamples}개 필요)`,
          sampleCount: snapshots.length,
        });
      }

      // 결과 라벨 생성: 홈승=1, 무=0, 원정승=-1
      const dataWithLabel = snapshots.map((s) => {
        const hg = s.homeGoals!;
        const ag = s.awayGoals!;
        const label = hg > ag ? 1 : hg < ag ? -1 : 0;
        return { ...s, label };
      });

      // 분석할 피처 목록
      const featuresToAnalyze = [
        // 홈팀 평균
        "home_shotsTotal_avg",
        "home_shotsOnTarget_avg",
        "home_possessionPct_avg",
        "home_passesTotal_avg",
        "home_passAccuracyPct_avg",
        "home_fouls_avg",
        "home_corners_avg",
        "home_yellowCards_avg",
        "home_redCards_avg",
        "home_xg_avg",
        "home_goalsFor_avg",
        "home_goalsAgainst_avg",
        // 어웨이팀 평균
        "away_shotsTotal_avg",
        "away_shotsOnTarget_avg",
        "away_possessionPct_avg",
        "away_passesTotal_avg",
        "away_passAccuracyPct_avg",
        "away_fouls_avg",
        "away_corners_avg",
        "away_yellowCards_avg",
        "away_redCards_avg",
        "away_xg_avg",
        "away_goalsFor_avg",
        "away_goalsAgainst_avg",
        // Diff (V2)
        "shotsTotal_diff",
        "shotsOnTarget_diff",
        "possessionPct_diff",
        "passesTotal_diff",
        "passAccuracyPct_diff",
        "fouls_diff",
        "corners_diff",
        "yellowCards_diff",
        "redCards_diff",
        "xg_diff",
        "goalsFor_diff",
        "goalsAgainst_diff",
        "injuryCount_diff",
        // 기타
        "homeInjuryCount",
        "awayInjuryCount",
        "tempC",
        "precipitationMm",
        "windKph",
        "humidityPct",
      ];

      // 피어슨 상관계수 계산 함수
      function pearsonCorrelation(x: number[], y: number[]): number | null {
        const n = x.length;
        if (n < 10) return null;

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
        const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
        const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt(
          (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
        );

        if (denominator === 0) return null;
        return numerator / denominator;
      }

      // 각 피처 분석
      const featureAnalysis: any[] = [];

      for (const feature of featuresToAnalyze) {
        // null이 아닌 데이터만 추출
        const validData = dataWithLabel.filter(
          (d) => (d as any)[feature] !== null && (d as any)[feature] !== undefined
        );

        const coverage = validData.length;
        const coveragePct = Math.round((coverage / dataWithLabel.length) * 100);

        if (coverage < 20) {
          featureAnalysis.push({
            feature,
            coverage,
            coveragePct,
            correlation: null,
            absCorrelation: null,
            significance: "❌ 데이터 부족",
            recommendation: "수집 필요",
          });
          continue;
        }

        const x = validData.map((d) => Number((d as any)[feature]));
        const y = validData.map((d) => d.label);

        const corr = pearsonCorrelation(x, y);

        let significance = "";
        let recommendation = "";
        const absCorr = corr !== null ? Math.abs(corr) : 0;

        if (corr === null) {
          significance = "❓ 계산 불가";
          recommendation = "데이터 확인 필요";
        } else if (absCorr >= 0.3) {
          significance = "✅ 강함";
          recommendation = "필수 피처";
        } else if (absCorr >= 0.15) {
          significance = "⚠️ 중간";
          recommendation = "사용 권장";
        } else if (absCorr >= 0.05) {
          significance = "🔸 약함";
          recommendation = "선택적 사용";
        } else {
          significance = "❌ 거의 없음";
          recommendation = "제외 고려";
        }

        featureAnalysis.push({
          feature,
          coverage,
          coveragePct,
          correlation: corr !== null ? Math.round(corr * 1000) / 1000 : null,
          absCorrelation: corr !== null ? Math.round(absCorr * 1000) / 1000 : null,
          significance,
          recommendation,
        });
      }

      // 상관계수 절댓값 기준 정렬
      featureAnalysis.sort((a, b) => {
        if (a.absCorrelation === null) return 1;
        if (b.absCorrelation === null) return -1;
        return b.absCorrelation - a.absCorrelation;
      });

      // 라벨 분포
      const labelDist = {
        homeWin: dataWithLabel.filter((d) => d.label === 1).length,
        draw: dataWithLabel.filter((d) => d.label === 0).length,
        awayWin: dataWithLabel.filter((d) => d.label === -1).length,
      };

      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        filter: { leagueId: leagueId || "all", minSamples },
        summary: {
          totalSamples: dataWithLabel.length,
          labelDistribution: {
            ...labelDist,
            homeWinPct: Math.round((labelDist.homeWin / dataWithLabel.length) * 100),
            drawPct: Math.round((labelDist.draw / dataWithLabel.length) * 100),
            awayWinPct: Math.round((labelDist.awayWin / dataWithLabel.length) * 100),
          },
          strongFeatures: featureAnalysis.filter((f) => f.significance === "✅ 강함").length,
          mediumFeatures: featureAnalysis.filter((f) => f.significance === "⚠️ 중간").length,
          weakFeatures: featureAnalysis.filter((f) => f.significance === "🔸 약함").length,
          uselessFeatures: featureAnalysis.filter((f) => f.significance === "❌ 거의 없음").length,
        },
        features: featureAnalysis,
        topRecommended: featureAnalysis
          .filter((f) => f.absCorrelation !== null && f.absCorrelation >= 0.1)
          .slice(0, 15)
          .map((f) => f.feature),
      });
    } catch (error: any) {
      console.error("[feature-quality] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ============================================================
  // 🎯 MVP: 예측 API
  // ============================================================

  /**
   * GET /api/predictions/upcoming
   * 다가오는 경기들의 AI 예측 제공
   */
  app.get("/api/predictions/upcoming", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const limit = parseInt(req.query.limit as string) || 100; // 100경기까지
      
      const now = new Date();
      const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      // 다가오는 경기 조회 (Odds + History, Weather 포함)
      const fixtures = await prisma.fixture.findMany({
        where: {
          kickoffAt: { gte: now, lte: endDate },
          status: { in: ["NS", "TBD"] }, // Not Started
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          league: true,
          odds: {
            include: {
              history: {
                orderBy: { recordedAt: "desc" },
                take: 1,
              },
            },
          },
          weather: true,
          featureSnapshot: true,
        },
        orderBy: { kickoffAt: "asc" },
        take: limit,
      });

      // 팀 ID 목록 추출 (standings 조회용)
      const teamIds = new Set<bigint>();
      const leagueSeasons = new Map<string, { leagueId: bigint; season: number }>();

      // 날씨 없는 경기 자동 수집 (Open-Meteo)
      const weatherMissing = fixtures.filter(fx => !fx.weather && fx.venueName);
      if (weatherMissing.length > 0) {
        console.log(`[predictions] 날씨 미수집 ${weatherMissing.length}경기 → 자동 수집 시도`);
        for (const fx of weatherMissing.slice(0, 10)) { // 최대 10개까지만
          try {
            const searchQuery = fx.venueCity || fx.venueName || "";
            const geoRes = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
              params: { name: searchQuery, count: 1 },
              timeout: 3000,
            });
            const loc = geoRes.data?.results?.[0];
            if (!loc) continue;

            const weatherRes = await axios.get("https://api.open-meteo.com/v1/forecast", {
              params: {
                latitude: loc.latitude,
                longitude: loc.longitude,
                current: "temperature_2m,weather_code,wind_speed_10m",
              },
              timeout: 3000,
            });
            const current = weatherRes.data?.current;
            if (!current) continue;

            const code = current.weather_code || 0;
            const condition = code <= 3 ? (code === 0 ? "Clear" : "Cloudy") 
              : code < 60 ? "Foggy" : code < 70 ? "Rain" : code < 80 ? "Snow" : "Storm";

            const created = await prisma.fixtureWeather.create({
              data: {
                fixtureId: fx.id,
                tempC: current.temperature_2m,
                condition,
                windKph: current.wind_speed_10m,
                weatherCode: code,
                lat: loc.latitude,
                lon: loc.longitude,
                provider: "open-meteo",
                source: "auto-predictions",
              },
            });
            // 메모리의 fixture에도 반영
            (fx as any).weather = created;
          } catch (e) {
            // 날씨 수집 실패는 무시 (필수 아님)
          }
        }
      }
      
      fixtures.forEach(fx => {
        teamIds.add(fx.homeTeamId);
        teamIds.add(fx.awayTeamId);
        const key = `${fx.leagueId}-${fx.season}`;
        if (!leagueSeasons.has(key)) {
          leagueSeasons.set(key, { leagueId: fx.leagueId, season: fx.season });
        }
      });

      // Standings 조회 (해당 리그/시즌의 팀들)
      const standingsMap = new Map<string, {
        rank: number;
        played: number;
        won: number;
        drawn: number;
        lost: number;
        form: string | null;
      }>();

      for (const { leagueId, season } of leagueSeasons.values()) {
        const standings = await prisma.standing.findMany({
          where: {
            leagueId,
            season,
            teamId: { in: Array.from(teamIds) },
          },
        });

        standings.forEach(s => {
          const key = `${s.teamId}-${s.leagueId}-${s.season}`;
          standingsMap.set(key, {
            rank: s.rank,
            played: s.played,
            won: s.won,
            drawn: s.drawn,
            lost: s.lost,
            form: s.form,
          });
        });
      }

      // 예측 결과 계산
      const predictions = [];
      
      // Python ML 서버에서 배치 예측 받아오기
      let mlPredictions: Map<string, { homeProb: number; drawProb: number; awayProb: number }> = new Map();
      
      // 피처가 있는 경기들 수집
      const fixturesWithFeatures = fixtures.filter(fx => fx.featureSnapshot);
      
      if (fixturesWithFeatures.length > 0) {
        try {
          // Python ML 서버 호출
          const mlPayload = {
            fixtures: fixturesWithFeatures.map(fx => {
              const s = fx.featureSnapshot!;
              return {
                fixtureId: fx.id.toString(),
                // V5 피처 전체
                home_shotsTotal_avg: s.home_shotsTotal_avg ?? 0,
                home_shotsOnTarget_avg: s.home_shotsOnTarget_avg ?? 0,
                home_possessionPct_avg: s.home_possessionPct_avg ?? 0,
                home_passAccuracyPct_avg: s.home_passAccuracyPct_avg ?? 0,
                home_corners_avg: s.home_corners_avg ?? 0,
                home_xg_avg: s.home_xg_avg ?? 0,
                home_goalsFor_avg: s.home_goalsFor_avg ?? 0,
                home_goalsAgainst_avg: s.home_goalsAgainst_avg ?? 0,
                away_shotsTotal_avg: s.away_shotsTotal_avg ?? 0,
                away_shotsOnTarget_avg: s.away_shotsOnTarget_avg ?? 0,
                away_possessionPct_avg: s.away_possessionPct_avg ?? 0,
                away_passAccuracyPct_avg: s.away_passAccuracyPct_avg ?? 0,
                away_corners_avg: s.away_corners_avg ?? 0,
                away_xg_avg: s.away_xg_avg ?? 0,
                away_goalsFor_avg: s.away_goalsFor_avg ?? 0,
                away_goalsAgainst_avg: s.away_goalsAgainst_avg ?? 0,
                shotsTotal_diff: s.shotsTotal_diff ?? 0,
                shotsOnTarget_diff: s.shotsOnTarget_diff ?? 0,
                possessionPct_diff: s.possessionPct_diff ?? 0,
                xg_diff: s.xg_diff ?? 0,
                goalsFor_diff: s.goalsFor_diff ?? 0,
                goalsAgainst_diff: s.goalsAgainst_diff ?? 0,
                homeInjuryCount: s.homeInjuryCount ?? 0,
                awayInjuryCount: s.awayInjuryCount ?? 0,
                // V3: 홈/원정 분리
                home_goalsFor_atHome_avg: s.home_goalsFor_atHome_avg ?? 0,
                home_goalsAgainst_atHome_avg: s.home_goalsAgainst_atHome_avg ?? 0,
                home_xg_atHome_avg: s.home_xg_atHome_avg ?? 0,
                home_wins_atHome_pct: s.home_wins_atHome_pct ?? 0,
                away_goalsFor_atAway_avg: s.away_goalsFor_atAway_avg ?? 0,
                away_goalsAgainst_atAway_avg: s.away_goalsAgainst_atAway_avg ?? 0,
                away_xg_atAway_avg: s.away_xg_atAway_avg ?? 0,
                away_wins_atAway_pct: s.away_wins_atAway_pct ?? 0,
                // V3: 폼
                home_form_last3: s.home_form_last3 ?? 0,
                home_form_last5: s.home_form_last5 ?? 0,
                away_form_last3: s.away_form_last3 ?? 0,
                away_form_last5: s.away_form_last5 ?? 0,
                attack_diff: s.attack_diff ?? 0,
                defense_diff: s.defense_diff ?? 0,
                // V4: 피로도
                home_days_rest: s.home_days_rest ?? 0,
                away_days_rest: s.away_days_rest ?? 0,
                rest_diff: s.rest_diff ?? 0,
                home_matches_14d: s.home_matches_14d ?? 0,
                away_matches_14d: s.away_matches_14d ?? 0,
                congestion_diff: s.congestion_diff ?? 0,
                // V5: H2H
                h2h_total_matches: s.h2h_total_matches ?? 0,
                h2h_home_wins: s.h2h_home_wins ?? 0,
                h2h_away_wins: s.h2h_away_wins ?? 0,
                h2h_draws: s.h2h_draws ?? 0,
                h2h_home_goals_avg: s.h2h_home_goals_avg ?? 0,
                h2h_away_goals_avg: s.h2h_away_goals_avg ?? 0,
                h2h_home_win_pct: s.h2h_home_win_pct ?? 0,
              };
            })
          };

          const mlResponse = await fetch("http://localhost:5001/predict/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mlPayload),
          });

          if (mlResponse.ok) {
            const mlResult = await mlResponse.json();
            if (mlResult.ok && mlResult.predictions) {
              for (const pred of mlResult.predictions) {
                mlPredictions.set(pred.fixtureId, {
                  homeProb: pred.homeProb,
                  drawProb: pred.drawProb,
                  awayProb: pred.awayProb,
                });
              }
            }
          }
        } catch (mlError) {
          console.log("[predictions] ML 서버 연결 실패, 폴백 사용:", mlError);
        }
      }
      
      for (const fx of fixtures) {
        const snapshot = fx.featureSnapshot;
        const odds = fx.odds;

        // 기본 확률 (피처 없을 때)
        let homeProb = 45;
        let drawProb = 28;
        let awayProb = 27;
        let hasFeatures = false;

        // ML 서버 예측 결과가 있으면 사용
        const mlPred = mlPredictions.get(fx.id.toString());
        if (mlPred) {
          hasFeatures = true;
          homeProb = mlPred.homeProb;
          drawProb = mlPred.drawProb;
          awayProb = mlPred.awayProb;
        } 
        // ML 서버 실패 시 폴백: 피처 기반 계산 (강화된 가중치)
        else if (snapshot) {
          hasFeatures = true;
          let hProb = 0.35;  // 기본 홈 어드밴티지
          let dProb = 0.28;
          let aProb = 0.37;

          // 폼 차이 반영 (가중치 강화: 0.15)
          const homeForm = snapshot.home_form_last5 || 1.0;
          const awayForm = snapshot.away_form_last5 || 1.0;
          const formDiff = homeForm - awayForm;
          hProb += formDiff * 0.15;
          aProb -= formDiff * 0.15;
          
          // 홈/원정 승률 반영 (가중치 강화: 0.2)
          if (snapshot.home_wins_atHome_pct) {
            hProb += (snapshot.home_wins_atHome_pct / 100 - 0.45) * 0.2;
          }
          if (snapshot.away_wins_atAway_pct) {
            aProb += (snapshot.away_wins_atAway_pct / 100 - 0.35) * 0.2;
          }
          
          // xG 차이 (가중치 강화: 0.1)
          if (snapshot.xg_diff !== null && snapshot.xg_diff !== undefined) {
            hProb += snapshot.xg_diff * 0.1;
            aProb -= snapshot.xg_diff * 0.08;
          }
          
          // 순위 차이 반영 (Standing 데이터 있으면)
          const homeRank = snapshot.home_rank || 10;
          const awayRank = snapshot.away_rank || 10;
          const rankDiff = awayRank - homeRank;  // 양수면 홈이 상위
          hProb += rankDiff * 0.02;
          aProb -= rankDiff * 0.02;
          
          // H2H 반영
          if (snapshot.h2h_home_win_pct && snapshot.h2h_total_matches && snapshot.h2h_total_matches >= 3) {
            hProb += (snapshot.h2h_home_win_pct / 100 - 0.4) * 0.1;
          }

          // 범위 제한 및 정규화
          hProb = Math.max(0.15, Math.min(0.75, hProb));
          dProb = Math.max(0.15, Math.min(0.40, dProb));
          aProb = Math.max(0.15, Math.min(0.75, aProb));

          const total = hProb + dProb + aProb;
          homeProb = Math.round((hProb / total) * 100);
          drawProb = Math.round((dProb / total) * 100);
          awayProb = 100 - homeProb - drawProb;
        }

        // 기대값 계산
        let ev = { home: 0, draw: 0, away: 0, best: "", bestValue: 0 };
        
        // 실제 배당 또는 추정 배당 사용
        let effectiveOdds = odds ? {
          home: Number(odds.home),
          draw: Number(odds.draw),
          away: Number(odds.away),
        } : {
          // 추정 배당 (마진 5% 가정)
          home: Math.round((1 / (homeProb / 100) * 0.95) * 100) / 100,
          draw: Math.round((1 / (drawProb / 100) * 0.95) * 100) / 100,
          away: Math.round((1 / (awayProb / 100) * 0.95) * 100) / 100,
        };

        ev.home = (homeProb / 100) * effectiveOdds.home - 1;
        ev.draw = (drawProb / 100) * effectiveOdds.draw - 1;
        ev.away = (awayProb / 100) * effectiveOdds.away - 1;
        
        if (ev.home >= ev.draw && ev.home >= ev.away) {
          ev.best = "home";
          ev.bestValue = ev.home;
        } else if (ev.draw >= ev.home && ev.draw >= ev.away) {
          ev.best = "draw";
          ev.bestValue = ev.draw;
        } else {
          ev.best = "away";
          ev.bestValue = ev.away;
        }

        // V9 추천 로직: 가장 높은 확률 기준
        const maxProb = Math.max(homeProb, drawProb, awayProb);
        const bestPick = homeProb >= drawProb && homeProb >= awayProb ? 'home' 
                       : awayProb >= homeProb && awayProb >= drawProb ? 'away' 
                       : 'draw';
        const bestEV = bestPick === 'home' ? ev.home : bestPick === 'away' ? ev.away : ev.draw;
        
        // V9 추천 조건:
        // - STRONG: 60%+ (⭐⭐⭐)
        // - MEDIUM: 55%+ (⭐⭐)
        // - EV > 0 추가 체크 (배당 있을 때)
        const isRecommended = odds 
          ? (maxProb >= 55 && bestEV > 0)  // 55%+ AND EV > 0
          : (maxProb >= 55);               // 배당 없으면 55% 이상
        
        const recommendationLevel = maxProb >= 60 ? 'STRONG' : maxProb >= 55 ? 'MEDIUM' : 'NONE';

        // standings 조회
        const homeStandingKey = `${fx.homeTeamId}-${fx.leagueId}-${fx.season}`;
        const awayStandingKey = `${fx.awayTeamId}-${fx.leagueId}-${fx.season}`;
        const homeStanding = standingsMap.get(homeStandingKey);
        const awayStanding = standingsMap.get(awayStandingKey);

        predictions.push({
          fixtureId: fx.id.toString(),
          kickoffAt: fx.kickoffAt,
          status: fx.status,
          league: {
            id: fx.league.id.toString(),
            name: fx.league.name,
            country: fx.league.country,
          },
          homeTeam: {
            id: fx.homeTeam.id.toString(),
            name: fx.homeTeam.name,
            shortName: fx.homeTeam.shortName,
            logoUrl: fx.homeTeam.logoUrl,
            standing: homeStanding ? {
              rank: homeStanding.rank,
              played: homeStanding.played,
              won: homeStanding.won,
              drawn: homeStanding.drawn,
              lost: homeStanding.lost,
              form: homeStanding.form,
            } : null,
          },
          awayTeam: {
            id: fx.awayTeam.id.toString(),
            name: fx.awayTeam.name,
            shortName: fx.awayTeam.shortName,
            logoUrl: fx.awayTeam.logoUrl,
            standing: awayStanding ? {
              rank: awayStanding.rank,
              played: awayStanding.played,
              won: awayStanding.won,
              drawn: awayStanding.drawn,
              lost: awayStanding.lost,
              form: awayStanding.form,
            } : null,
          },
          venue: {
            name: fx.venueName,
            city: fx.venueCity,
          },
          weather: fx.weather ? {
            temp: fx.weather.tempC,
            condition: fx.weather.condition,
            icon: fx.weather.icon,
          } : null,
          odds: odds ? {
            home: Number(odds.home),
            draw: Number(odds.draw),
            away: Number(odds.away),
            isEstimated: false,
            // 배당 변동 (OddsHistory 기반)
            trend: (() => {
              const latest = (odds as any).history?.[0];
              if (!latest) return null;
              return {
                home: Number(latest.homeChange) > 0 ? 'up' : Number(latest.homeChange) < 0 ? 'down' : 'same',
                draw: Number(latest.drawChange) > 0 ? 'up' : Number(latest.drawChange) < 0 ? 'down' : 'same',
                away: Number(latest.awayChange) > 0 ? 'up' : Number(latest.awayChange) < 0 ? 'down' : 'same',
              };
            })(),
            // 국내 배당 (베트맨 연동 데이터)
            domestic: odds.domestic ? odds.domestic : null,
          } : {
            home: effectiveOdds.home,
            draw: effectiveOdds.draw,
            away: effectiveOdds.away,
            isEstimated: true,
            trend: null,
            domestic: null,
          },
          prediction: {
            homeProb: Number(homeProb) || 45,
            drawProb: Number(drawProb) || 28,
            awayProb: Number(awayProb) || 27,
            expectedValue: {
              home: isNaN(ev.home) ? null : Math.round(ev.home * 1000) / 10,
              draw: isNaN(ev.draw) ? null : Math.round(ev.draw * 1000) / 10,
              away: isNaN(ev.away) ? null : Math.round(ev.away * 1000) / 10,
              best: ev.best,
              bestValue: isNaN(ev.bestValue) ? null : Math.round(ev.bestValue * 1000) / 10,
            },
            isRecommended,
            recommendationLevel,  // V9: 'STRONG' | 'MEDIUM' | 'NONE'
            bestPick,             // V9: 'home' | 'draw' | 'away'
            confidence: hasFeatures ? (recommendationLevel === 'STRONG' ? "HIGH" : recommendationLevel === 'MEDIUM' ? "MEDIUM" : "LOW") : "LOW",
            hasFeatures,
          },
          features: snapshot ? {
            homeForm: snapshot.home_form_last5,
            awayForm: snapshot.away_form_last5,
            homeWinPct: snapshot.home_wins_atHome_pct,
            h2hHomeWinPct: snapshot.h2h_home_win_pct,
            restDiff: snapshot.rest_diff,
            h2hMatches: snapshot.h2h_total_matches,
          } : null,
          // V9 분석 모듈 사용
          v9: analyzeMatchV9(
            { home: Number(homeProb) || 33.3, draw: Number(drawProb) || 33.3, away: Number(awayProb) || 33.3 },
            odds ? { home: Number(odds.home), draw: Number(odds.draw), away: Number(odds.away) } : effectiveOdds,
            snapshot
          ),
        });
      }

      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        totalFixtures: fixtures.length,
        predictions: predictions.length,
        data: predictions,
      });
    } catch (error: any) {
      console.error("[predictions/upcoming] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  /**
   * GET /api/predictions/:fixtureId
   * 특정 경기의 상세 예측
   */
  app.get("/api/predictions/:fixtureId", async (req, res) => {
    try {
      const fixtureId = BigInt(req.params.fixtureId);

      const fixture = await prisma.fixture.findUnique({
        where: { id: fixtureId },
        include: {
          homeTeam: true,
          awayTeam: true,
          league: true,
          odds: true,
          weather: true,
          featureSnapshot: true,
        },
      });

      if (!fixture) {
        return res.status(404).json({ ok: false, error: "Fixture not found" });
      }

      const snapshot = fixture.featureSnapshot;
      const odds = fixture.odds;

      // ── Standing 조회 ──
      const [homeStandingRow, awayStandingRow] = await Promise.all([
        prisma.standing.findFirst({
          where: { teamId: fixture.homeTeamId, leagueId: fixture.leagueId, season: fixture.season },
        }),
        prisma.standing.findFirst({
          where: { teamId: fixture.awayTeamId, leagueId: fixture.leagueId, season: fixture.season },
        }),
      ]);

      const toStanding = (s: any) => s ? {
        rank: s.rank, played: s.played, won: s.won, drawn: s.drawn, lost: s.lost, form: s.form,
      } : null;

      // ── ML 예측 ──
      let homeProb = 45, drawProb = 28, awayProb = 27;
      let hasFeatures = false;

      if (snapshot) {
        hasFeatures = true;
        try {
          const mlPayload = {
            fixtures: [{
              fixtureId: fixture.id.toString(),
              home_shotsTotal_avg: snapshot.home_shotsTotal_avg ?? 0,
              home_shotsOnTarget_avg: snapshot.home_shotsOnTarget_avg ?? 0,
              home_possessionPct_avg: snapshot.home_possessionPct_avg ?? 0,
              home_passAccuracyPct_avg: snapshot.home_passAccuracyPct_avg ?? 0,
              home_corners_avg: snapshot.home_corners_avg ?? 0,
              home_xg_avg: snapshot.home_xg_avg ?? 0,
              home_goalsFor_avg: snapshot.home_goalsFor_avg ?? 0,
              home_goalsAgainst_avg: snapshot.home_goalsAgainst_avg ?? 0,
              away_shotsTotal_avg: snapshot.away_shotsTotal_avg ?? 0,
              away_shotsOnTarget_avg: snapshot.away_shotsOnTarget_avg ?? 0,
              away_possessionPct_avg: snapshot.away_possessionPct_avg ?? 0,
              away_passAccuracyPct_avg: snapshot.away_passAccuracyPct_avg ?? 0,
              away_corners_avg: snapshot.away_corners_avg ?? 0,
              away_xg_avg: snapshot.away_xg_avg ?? 0,
              away_goalsFor_avg: snapshot.away_goalsFor_avg ?? 0,
              away_goalsAgainst_avg: snapshot.away_goalsAgainst_avg ?? 0,
              shotsTotal_diff: snapshot.shotsTotal_diff ?? 0,
              shotsOnTarget_diff: snapshot.shotsOnTarget_diff ?? 0,
              possessionPct_diff: snapshot.possessionPct_diff ?? 0,
              xg_diff: snapshot.xg_diff ?? 0,
              goalsFor_diff: snapshot.goalsFor_diff ?? 0,
              goalsAgainst_diff: snapshot.goalsAgainst_diff ?? 0,
              homeInjuryCount: snapshot.homeInjuryCount ?? 0,
              awayInjuryCount: snapshot.awayInjuryCount ?? 0,
              home_goalsFor_atHome_avg: snapshot.home_goalsFor_atHome_avg ?? 0,
              home_goalsAgainst_atHome_avg: snapshot.home_goalsAgainst_atHome_avg ?? 0,
              home_xg_atHome_avg: snapshot.home_xg_atHome_avg ?? 0,
              home_wins_atHome_pct: snapshot.home_wins_atHome_pct ?? 0,
              away_goalsFor_atAway_avg: snapshot.away_goalsFor_atAway_avg ?? 0,
              away_goalsAgainst_atAway_avg: snapshot.away_goalsAgainst_atAway_avg ?? 0,
              away_xg_atAway_avg: snapshot.away_xg_atAway_avg ?? 0,
              away_wins_atAway_pct: snapshot.away_wins_atAway_pct ?? 0,
              home_form_last3: snapshot.home_form_last3 ?? 0,
              home_form_last5: snapshot.home_form_last5 ?? 0,
              away_form_last3: snapshot.away_form_last3 ?? 0,
              away_form_last5: snapshot.away_form_last5 ?? 0,
              attack_diff: snapshot.attack_diff ?? 0,
              defense_diff: snapshot.defense_diff ?? 0,
              home_days_rest: snapshot.home_days_rest ?? 0,
              away_days_rest: snapshot.away_days_rest ?? 0,
              rest_diff: snapshot.rest_diff ?? 0,
              home_matches_14d: snapshot.home_matches_14d ?? 0,
              away_matches_14d: snapshot.away_matches_14d ?? 0,
              congestion_diff: snapshot.congestion_diff ?? 0,
              h2h_total_matches: snapshot.h2h_total_matches ?? 0,
              h2h_home_wins: snapshot.h2h_home_wins ?? 0,
              h2h_away_wins: snapshot.h2h_away_wins ?? 0,
              h2h_draws: snapshot.h2h_draws ?? 0,
              h2h_home_goals_avg: snapshot.h2h_home_goals_avg ?? 0,
              h2h_away_goals_avg: snapshot.h2h_away_goals_avg ?? 0,
              h2h_home_win_pct: snapshot.h2h_home_win_pct ?? 0,
            }]
          };

          const mlResponse = await fetch("http://localhost:5001/predict/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mlPayload),
          });

          if (mlResponse.ok) {
            const mlResult = await mlResponse.json();
            if (mlResult.ok && mlResult.predictions?.[0]) {
              const pred = mlResult.predictions[0];
              homeProb = pred.homeProb;
              drawProb = pred.drawProb;
              awayProb = pred.awayProb;
            }
          }
        } catch (mlError) {
          console.log("[predictions/:fixtureId] ML 서버 연결 실패, 폴백 사용");
          // 폴백: 피처 기반 간단 계산
          let hProb = 0.35, dProb = 0.28, aProb = 0.37;
          const homeForm = snapshot.home_form_last5 || 1.0;
          const awayForm = snapshot.away_form_last5 || 1.0;
          hProb += (homeForm - awayForm) * 0.15;
          aProb -= (homeForm - awayForm) * 0.15;
          if (snapshot.home_wins_atHome_pct) hProb += (snapshot.home_wins_atHome_pct / 100 - 0.45) * 0.2;
          if (snapshot.away_wins_atAway_pct) aProb += (snapshot.away_wins_atAway_pct / 100 - 0.35) * 0.2;
          if (snapshot.xg_diff !== null && snapshot.xg_diff !== undefined) {
            hProb += snapshot.xg_diff * 0.1;
            aProb -= snapshot.xg_diff * 0.08;
          }
          hProb = Math.max(0.15, Math.min(0.75, hProb));
          dProb = Math.max(0.15, Math.min(0.40, dProb));
          aProb = Math.max(0.15, Math.min(0.75, aProb));
          const total = hProb + dProb + aProb;
          homeProb = Math.round((hProb / total) * 100);
          drawProb = Math.round((dProb / total) * 100);
          awayProb = 100 - homeProb - drawProb;
        }
      }

      // ── EV 계산 ──
      const effectiveOdds = odds ? {
        home: Number(odds.home), draw: Number(odds.draw), away: Number(odds.away),
      } : {
        home: Math.round((1 / (homeProb / 100) * 0.95) * 100) / 100,
        draw: Math.round((1 / (drawProb / 100) * 0.95) * 100) / 100,
        away: Math.round((1 / (awayProb / 100) * 0.95) * 100) / 100,
      };

      const ev = {
        home: (homeProb / 100) * effectiveOdds.home - 1,
        draw: (drawProb / 100) * effectiveOdds.draw - 1,
        away: (awayProb / 100) * effectiveOdds.away - 1,
        best: "", bestValue: 0,
      };
      if (ev.home >= ev.draw && ev.home >= ev.away) { ev.best = "home"; ev.bestValue = ev.home; }
      else if (ev.draw >= ev.home && ev.draw >= ev.away) { ev.best = "draw"; ev.bestValue = ev.draw; }
      else { ev.best = "away"; ev.bestValue = ev.away; }

      // ── V9 분석 ──
      const v9 = analyzeMatchV9(
        { home: Number(homeProb) || 33.3, draw: Number(drawProb) || 33.3, away: Number(awayProb) || 33.3 },
        odds ? { home: Number(odds.home), draw: Number(odds.draw), away: Number(odds.away) } : effectiveOdds,
        snapshot
      );

      res.json({
        ok: true,
        fixture: {
          id: fixture.id.toString(),
          kickoffAt: fixture.kickoffAt,
          status: fixture.status,
          homeTeam: {
            id: fixture.homeTeam.id.toString(),
            name: fixture.homeTeam.name,
            shortName: fixture.homeTeam.shortName,
            logoUrl: fixture.homeTeam.logoUrl,
            standing: toStanding(homeStandingRow),
          },
          awayTeam: {
            id: fixture.awayTeam.id.toString(),
            name: fixture.awayTeam.name,
            shortName: fixture.awayTeam.shortName,
            logoUrl: fixture.awayTeam.logoUrl,
            standing: toStanding(awayStandingRow),
          },
          league: {
            id: fixture.league.id.toString(),
            name: fixture.league.name,
            country: fixture.league.country,
          },
          odds: odds ? {
            home: Number(odds.home), draw: Number(odds.draw), away: Number(odds.away),
            isEstimated: false,
          } : {
            home: effectiveOdds.home, draw: effectiveOdds.draw, away: effectiveOdds.away,
            isEstimated: true,
          },
          venue: { name: fixture.venueName, city: fixture.venueCity },
          weather: fixture.weather ? {
            temp: fixture.weather.tempC,
            condition: fixture.weather.condition,
            icon: fixture.weather.icon,
          } : null,
        },
        prediction: {
          homeProb: Number(homeProb) || 45,
          drawProb: Number(drawProb) || 28,
          awayProb: Number(awayProb) || 27,
          expectedValue: {
            home: isNaN(ev.home) ? null : Math.round(ev.home * 1000) / 10,
            draw: isNaN(ev.draw) ? null : Math.round(ev.draw * 1000) / 10,
            away: isNaN(ev.away) ? null : Math.round(ev.away * 1000) / 10,
            best: ev.best,
            bestValue: isNaN(ev.bestValue) ? null : Math.round(ev.bestValue * 1000) / 10,
          },
          hasFeatures,
        },
        v9,
        features: snapshot ? {
          homeForm3: snapshot.home_form_last3,
          homeForm5: snapshot.home_form_last5,
          awayForm3: snapshot.away_form_last3,
          awayForm5: snapshot.away_form_last5,
          homeWinsAtHome: snapshot.home_wins_atHome_pct,
          awayWinsAtAway: snapshot.away_wins_atAway_pct,
          homeGoalsAtHome: snapshot.home_goalsFor_atHome_avg,
          awayGoalsAtAway: snapshot.away_goalsFor_atAway_avg,
          homeGoalsFor: snapshot.home_goalsFor_avg,
          homeGoalsAgainst: snapshot.home_goalsAgainst_avg,
          awayGoalsFor: snapshot.away_goalsFor_avg,
          awayGoalsAgainst: snapshot.away_goalsAgainst_avg,
          homeDaysRest: snapshot.home_days_rest,
          awayDaysRest: snapshot.away_days_rest,
          restDiff: snapshot.rest_diff,
          h2hTotal: snapshot.h2h_total_matches,
          h2hHomeWins: snapshot.h2h_home_wins,
          h2hAwayWins: snapshot.h2h_away_wins,
          h2hDraws: snapshot.h2h_draws,
          h2hHomeWinPct: snapshot.h2h_home_win_pct,
          homeXg: snapshot.home_xg_avg,
          awayXg: snapshot.away_xg_avg,
          homeShotsOnTarget: snapshot.home_shotsOnTarget_avg,
          awayShotsOnTarget: snapshot.away_shotsOnTarget_avg,
          homePossession: snapshot.home_possessionPct_avg,
          awayPossession: snapshot.away_possessionPct_avg,
        } : null,
      });
    } catch (error: any) {
      console.error("[predictions/:fixtureId] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ============================================================
  // 🏟️ 팀 정보 (로고, shortName) 동기화 API
  // ============================================================
  app.post("/api/admin/sync-teams", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      
      // 로고가 없는 팀들 조회
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
        // API-Football 로고 URL은 규칙적!
        const logoUrl = `https://media.api-sports.io/football/teams/${team.apiTeamId}.png`;
        const shortName = team.name.substring(0, 3).toUpperCase();

        await prisma.team.update({
          where: { id: team.id },
          data: {
            logoUrl,
            shortName,
          },
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


  // ============================================================
  // 📊 데이터 통계 API
  // ============================================================
  app.get("/api/admin/data-counts", async (_req, res) => {
    try {
      const [fixtures, teams, featureSnapshots, odds, teamStats] = await Promise.all([
        prisma.fixture.count(),
        prisma.team.count(),
        prisma.fixtureFeatureSnapshot.count(),
        prisma.fixtureOdds.count(),
        prisma.fixtureTeamStatSnapshot.count(),
      ]);

      // 시즌별 피처 개수
      const featuresBySeason = await prisma.$queryRaw`
        SELECT 
          f.season,
          COUNT(fs.id) as count
        FROM "FixtureFeatureSnapshot" fs
        JOIN "Fixture" f ON fs."fixtureId" = f.id
        GROUP BY f.season
        ORDER BY f.season DESC
      `;

      res.json({
        ok: true,
        counts: {
          fixtures,
          teams,
          featureSnapshots,
          odds,
          teamStats,
        },
        featuresBySeason,
      });
    } catch (error: any) {
      console.error("[data-counts] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });


  // ============================================================
  // 🇰🇷 베트맨 국내배당 동기화 API
  // ============================================================
  // ===== 국내배당 자동 동기화 =====
  // Puppeteer 실제값 우선, 실패 시 해외배당 환산 폴백
  // 스케줄러에서 자동 실행 + 수동 트리거 가능
  // ============================================================
  app.post("/api/admin/sync-domestic-odds", async (req, res) => {
    try {
      const { syncDomesticOdds } = await import("./betman");
      const result = await syncDomesticOdds();

      res.json({
        ok: true,
        message: `국내배당 동기화 완료 [${result.method}] ${result.updated}경기 저장`,
        ...result,
      });
    } catch (error: any) {
      console.error("[sync-domestic-odds] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // ============================================================
  // 📊 공개 순위 조회 API (분석 탭용)
  // ============================================================
  app.get("/api/standings", async (req, res) => {
    try {
      const leagueApiId = req.query.leagueId ? Number(req.query.leagueId) : null;
      
      if (!leagueApiId) {
        return res.json({ ok: true, standings: [], message: "leagueId 파라미터 필요" });
      }

      // League 찾기
      const league = await prisma.league.findUnique({
        where: { apiLeagueId: leagueApiId },
      });

      if (!league) {
        return res.json({ ok: true, standings: [], message: "리그를 찾을 수 없습니다" });
      }

      // 시즌 자동 판별
      const season = getCurrentSeason(leagueApiId);

      const standings = await prisma.standing.findMany({
        where: {
          leagueId: league.id,
          season,
        },
        include: {
          team: {
            select: { name: true, shortName: true, logoUrl: true, apiTeamId: true },
          },
        },
        orderBy: { rank: "asc" },
      });

      res.json({
        ok: true,
        leagueId: leagueApiId,
        leagueName: league.name,
        season,
        standings: standings.map(s => ({
          rank: s.rank,
          teamName: s.team.name,
          teamShortName: s.team.shortName,
          teamLogo: s.team.logoUrl,
          teamApiId: s.team.apiTeamId,
          played: s.played,
          won: s.won,
          drawn: s.drawn,
          lost: s.lost,
          goalsFor: s.goalsFor,
          goalsAgainst: s.goalsAgainst,
          goalsDiff: s.goalDiff,
          points: s.points,
          form: s.form,
        })),
      });
    } catch (error: any) {
      console.error("[standings] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  // 하위 호환: 기존 sync-betman-odds도 동일하게 동작
  app.post("/api/admin/sync-betman-odds", async (req, res) => {
    try {
      const { syncDomesticOdds } = await import("./betman");
      const result = await syncDomesticOdds();
      res.json({ ok: true, message: `국내배당: ${result.method}, ${result.updated}건`, ...result });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });


  return httpServer;
}
