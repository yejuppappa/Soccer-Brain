/**
 * 활성 리그 목록 조회
 */

import { prisma } from "../server/db.js";

async function main() {
  const leagues = await prisma.league.findMany({
    where: { enabled: true },
    select: {
      id: true,
      name: true,
      apiLeagueId: true,
      country: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(`\n활성 리그 (enabled=true): ${leagues.length}개\n`);
  console.log("ID   | API ID | 리그명                          | 국가");
  console.log("-".repeat(80));

  leagues.forEach((league) => {
    console.log(
      `${String(league.id).padStart(4)} | ` +
      `${String(league.apiLeagueId).padStart(6)} | ` +
      `${league.name.padEnd(30)} | ` +
      `${league.country || "N/A"}`
    );
  });

  console.log("-".repeat(80));
  console.log(`\n총 ${leagues.length}개 리그\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
