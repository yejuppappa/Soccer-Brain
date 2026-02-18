import { Router } from "express";
import axios from "axios";
import { prisma } from "../../db";

const router = Router();

// ── 배당 수집 스텁 ──
router.post("/sync-odds", async (req, res) => {
  res.json({ ok: true, message: "sync-odds route is reachable" });
});

// ── 예정 경기 배당 수집 ──
router.post("/sync-upcoming-odds", async (req, res) => {
  try {
    const days = Number(req.query.days || 7);

    const now = new Date();
    const toDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const upcomingFixtures = await prisma.fixture.findMany({
      where: {
        kickoffAt: { gte: now, lte: toDate },
        status: { in: ["NS", "TBD"] },
        odds: null,
      },
      include: { league: true },
      orderBy: { kickoffAt: "asc" },
    });

    const dateLeagueGroups = new Map<string, {
      leagueApiId: number;
      season: number;
      date: string;
      fixtures: typeof upcomingFixtures
    }>();

    for (const fx of upcomingFixtures) {
      const dateStr = fx.kickoffAt.toISOString().split("T")[0];
      const key = `${fx.league.apiLeagueId}_${dateStr}`;
      if (!dateLeagueGroups.has(key)) {
        dateLeagueGroups.set(key, {
          leagueApiId: fx.league.apiLeagueId,
          season: fx.season,
          date: dateStr,
          fixtures: [] as typeof upcomingFixtures
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

    for (const [key, group] of dateLeagueGroups) {
      try {
        console.log(`[sync-odds] Fetching odds for league ${group.leagueApiId}, date ${group.date}...`);

        const oddsResponse = await axios.get("https://v3.football.api-sports.io/odds", {
          headers: { "x-apisports-key": process.env.API_SPORTS_KEY || "" },
          params: {
            league: group.leagueApiId,
            season: group.season,
            date: group.date,
          },
        });

        console.log(`[sync-odds] League ${group.leagueApiId} date ${group.date}: ${oddsResponse.data?.response?.length || 0} odds`);

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

        const apiIds = Array.from(oddsMap.keys()).slice(0, 3);
        const dbIds = group.fixtures.map(f => f.apiFixtureId).slice(0, 3);
        console.log(`[sync-odds] API IDs: ${apiIds.join(", ")} | DB IDs: ${dbIds.join(", ")}`);

        results.details.push(`${group.date} 리그${group.leagueApiId}: ${oddsMap.size}개`);

        for (const fx of group.fixtures) {
          const odd = oddsMap.get(fx.apiFixtureId);

          if (!odd) {
            results.notFound++;
            continue;
          }

          try {
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

export default router;
