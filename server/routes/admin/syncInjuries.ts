import { Router } from "express";
import axios from "axios";
import { prisma } from "../../lib/prisma";

const router = Router();

router.post("/sync-injuries", async (req, res) => {
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");

  if (!from || !to) {
    return res.status(400).json({ error: "from / to query required" });
  }

  try {
    const apiRes = await axios.get("https://v3.football.api-sports.io/injuries", {
      params: { from, to },
      headers: {
        "x-apisports-key": process.env.API_FOOTBALL_KEY!,
      },
    });

    const injuries = apiRes.data?.response ?? [];

    let saved = 0;
    let skipped = 0;

    for (const item of injuries) {
      // 1) 우리 DB에서 fixture 찾기 (apiFixtureId 기준)
      const fixture = await prisma.fixture.findUnique({
        where: { apiFixtureId: item?.fixture?.id },
      });

      if (!fixture) {
        skipped++;
        continue;
      }

      // 2) playerId는 있으면 연결, 없으면 null
      const apiPlayerId = item?.player?.id ?? null;
      const playerName = item?.player?.name ?? "UNKNOWN";

      const player =
        apiPlayerId
          ? await prisma.player.findUnique({
              where: { apiPlayerId },
            })
          : null;

      // 3) upsert (네가 만든 unique키 그대로 사용)
      await prisma.fixtureInjury.upsert({
        where: {
          fixtureId_teamId_apiPlayerId_playerName: {
            fixtureId: fixture.id,
            teamId: item?.team?.id,
            apiPlayerId,
            playerName,
          },
        },
        update: {
          status: item?.reason ?? null,
          reason: item?.type ?? null,
          raw: item,
          playerId: player?.id ?? null,
        },
        create: {
          fixtureId: fixture.id,
          teamId: item?.team?.id,
          apiPlayerId,
          playerName,
          status: item?.reason ?? null,
          reason: item?.type ?? null,
          raw: item,
          playerId: player?.id ?? null,
        },
      });

      saved++;
    }

    return res.json({ saved, skipped });
  } catch (e: any) {
    console.error(e?.response?.data ?? e);
    return res.status(500).json({ error: "sync-injuries failed" });
  }
});

export default router;

