import { Router } from "express";
import { storage } from "../storage";
import { submitVoteSchema } from "@shared/schema";
import { prisma } from "../db";
import { getCurrentSeason } from "./_helpers";

const router = Router();

// ── 레거시 매치 조회 ──
router.get("/matches", async (req, res) => {
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

// ── 공개 리그 목록 ──
router.get("/leagues", async (req, res) => {
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

// ── 공개 순위 조회 ──
router.get("/standings", async (req, res) => {
  try {
    const leagueApiId = req.query.leagueId ? Number(req.query.leagueId) : null;

    if (!leagueApiId) {
      return res.json({ ok: true, standings: [], message: "leagueId 파라미터 필요" });
    }

    const league = await prisma.league.findUnique({
      where: { apiLeagueId: leagueApiId },
    });

    if (!league) {
      return res.json({ ok: true, standings: [], message: "리그를 찾을 수 없습니다" });
    }

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

// ── 투표 ──
router.post("/votes", async (req, res) => {
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

router.get("/votes/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;
    const vote = await storage.getVoteForMatch(matchId);
    res.json({ vote: vote || null });
  } catch (error: any) {
    console.error("[Routes] Vote fetch error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch vote" });
  }
});

router.get("/votes", async (req, res) => {
  try {
    const votes = await storage.getAllVotes();
    res.json({ votes });
  } catch (error: any) {
    console.error("[Routes] Votes fetch error:", error.message);
    res.status(500).json({ error: error.message || "Failed to fetch votes" });
  }
});

export default router;
