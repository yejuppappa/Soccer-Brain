import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║          📊 Soccer-Brain 데이터 현황 리포트             ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  // 1. 전체 요약
  const totalFixtures = await prisma.fixture.count();
  const totalFT = await prisma.fixture.count({ where: { status: "FT" } });
  const totalStats = await prisma.fixtureTeamStatSnapshot.count();
  const uniqueStatsFixtures = await prisma.fixture.count({ where: { teamStats: { some: {} } } });
  const totalTeams = await prisma.team.count();
  const activeLeagues = await prisma.league.count({ where: { enabled: true } });

  console.log("── 전체 요약 ──────────────────────────────────────────");
  console.log(`  총 경기 수:        ${totalFixtures.toLocaleString()}`);
  console.log(`  종료(FT) 경기:     ${totalFT.toLocaleString()}`);
  console.log(`  스탯 보유 경기:    ${uniqueStatsFixtures.toLocaleString()} (${(uniqueStatsFixtures/totalFT*100).toFixed(1)}%)`);
  console.log(`  팀 수:             ${totalTeams.toLocaleString()}`);
  console.log(`  활성 리그/컵:      ${activeLeagues}`);

  // 2. 리그별 상세
  const leagues = await prisma.league.findMany({
    where: { enabled: true },
    orderBy: { priority: "desc" },
    select: { id: true, name: true, apiLeagueId: true, priority: true },
  });

  console.log("\n── 리그별 상세 현황 ───────────────────────────────────");
  console.log("  리그                          | 총경기 |  FT  | 스탯 | 시즌범위");
  console.log("  " + "─".repeat(80));

  for (const league of leagues) {
    const fixtures = await prisma.fixture.count({ where: { leagueId: league.id } });
    const ft = await prisma.fixture.count({ where: { leagueId: league.id, status: "FT" } });
    const stats = await prisma.fixture.count({ where: { leagueId: league.id, teamStats: { some: {} } } });

    const seasons = await prisma.fixture.groupBy({
      by: ["season"],
      where: { leagueId: league.id },
      _count: true,
      orderBy: { season: "asc" },
    });

    const seasonRange = seasons.length > 0
      ? `${seasons[0].season}~${seasons[seasons.length - 1].season} (${seasons.length}시즌)`
      : "없음";

    const name = league.name.padEnd(30);
    console.log(`  ${name} | ${String(fixtures).padStart(5)} | ${String(ft).padStart(4)} | ${String(stats).padStart(4)} | ${seasonRange}`);
  }

  // 3. 시즌별 분포
  console.log("\n── 시즌별 경기 분포 ───────────────────────────────────");
  const seasonDist = await prisma.fixture.groupBy({
    by: ["season"],
    _count: true,
    orderBy: { season: "asc" },
  });

  for (const s of seasonDist) {
    const bar = "█".repeat(Math.round(s._count / 200));
    console.log(`  ${s.season}: ${String(s._count).padStart(6)}경기 ${bar}`);
  }

  // 4. 스탯 커버리지 (FT인데 스탯 없는 경기)
  const ftNoStats = await prisma.fixture.count({
    where: {
      status: "FT",
      leagueId: { in: leagues.map(l => l.id) },
      teamStats: { none: {} },
    },
  });

  console.log("\n── 백필 잔여 작업 ─────────────────────────────────────");
  console.log(`  FT인데 스탯 없음:    ${ftNoStats.toLocaleString()}경기 (다음 백필 대상)`);

  // 5. 배당 데이터
  try {
    const oddsCount = await prisma.fixtureOdds.count();
    const bmOddsCount = await prisma.bookmakerOdds.count();
    const bmSnapshotCount = await prisma.bookmakerOddsSnapshot.count();
    console.log("\n── 배당 데이터 ────────────────────────────────────────");
    console.log(`  기본 배당 (FixtureOdds):       ${oddsCount.toLocaleString()}`);
    console.log(`  북메이커 배당 (BookmakerOdds):  ${bmOddsCount.toLocaleString()}`);
    console.log(`  배당 스냅샷:                    ${bmSnapshotCount.toLocaleString()}`);
  } catch {
    console.log("\n  (배당 테이블 없음)");
  }

  console.log("\n✅ 리포트 완료!\n");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ 오류:", e);
  await prisma.$disconnect();
});
