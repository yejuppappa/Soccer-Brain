/**
 * Phase A: 서비스 중인 27개 리그에 exposed=true 설정
 * - enabled=true인 리그는 exposed=true
 * - 나머지는 exposed=false
 */

import { prisma } from "../server/db.js";

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║          서비스 리그 exposed 설정                             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Step 1: enabled=true인 리그 조회
  const enabledLeagues = await prisma.league.findMany({
    where: { enabled: true },
    select: { id: true, name: true, apiLeagueId: true },
  });

  console.log(`✅ enabled=true 리그: ${enabledLeagues.length}개`);
  enabledLeagues.forEach((league) => {
    console.log(`   - ${league.name} (API ID: ${league.apiLeagueId})`);
  });

  // Step 2: exposed=true로 설정
  const result1 = await prisma.league.updateMany({
    where: { enabled: true },
    data: { exposed: true },
  });

  console.log(`\n✅ exposed=true 설정 완료: ${result1.count}개 리그`);

  // Step 3: enabled=false인 리그는 exposed=false
  const result2 = await prisma.league.updateMany({
    where: { enabled: false },
    data: { exposed: false },
  });

  console.log(`✅ exposed=false 설정 완료: ${result2.count}개 리그`);

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                     완료                                        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
