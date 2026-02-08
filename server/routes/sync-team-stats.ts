import { prisma } from "../../db";
import { fetchFixtureTeamStats } from "../../api-football";
import { normalizeTeamStats } from "../../utils/normalizeTeamStats";

export async function syncTeamStats(req, res) {
  const { from, to, force } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: "from / to query required" });
  }

  const fixtures = await prisma.fixture.findMany({
    where: {
      date: {
        gte: new Date(from),
        lte: new Date(to),
      },
      status: "FT",
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

        await prisma.fixtureTeamStatSnapshot.upsert({
          where: {
            fixtureId_teamId: {
              fixtureId: fixture.id,
              teamId: team.id,
            },
          },
          update: {
            raw: teamBlock,
            fetchedAt: new Date(),
            ...normalized,
          },
          create: {
            fixtureId: fixture.id,
            teamId: team.id,
            isHome: team.id === fixture.homeTeamId,
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
}
