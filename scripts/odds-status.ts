import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║          💰 Soccer-Brain 배당 수집 현황 리포트          ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  // 1. 전체 배당 요약
  const oddsCount = await prisma.fixtureOdds.count();
  const bmOddsCount = await prisma.bookmakerOdds.count();
  const bmSnapshotCount = await prisma.bookmakerOddsSnapshot.count();

  console.log("── 전체 배당 요약 ─────────────────────────────────────");
  console.log(`  기본 배당 (FixtureOdds):        ${oddsCount.toLocaleString()}`);
  console.log(`  북메이커별 배당 (BookmakerOdds): ${bmOddsCount.toLocaleString()}`);
  console.log(`  배당 스냅샷 (시계열):            ${bmSnapshotCount.toLocaleString()}`);

  // 2. 스냅샷 시간대별 분포 (최근 48시간)
  const now = new Date();
  const h48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const h6ago = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const h1ago = new Date(now.getTime() - 1 * 60 * 60 * 1000);

  const snap48h = await prisma.bookmakerOddsSnapshot.count({ where: { recordedAt: { gte: h48ago } } });
  const snap24h = await prisma.bookmakerOddsSnapshot.count({ where: { recordedAt: { gte: h24ago } } });
  const snap6h = await prisma.bookmakerOddsSnapshot.count({ where: { recordedAt: { gte: h6ago } } });
  const snap1h = await prisma.bookmakerOddsSnapshot.count({ where: { recordedAt: { gte: h1ago } } });

  console.log("\n── 스냅샷 수집 추이 ───────────────────────────────────");
  console.log(`  최근 1시간:   ${snap1h.toLocaleString()}건`);
  console.log(`  최근 6시간:   ${snap6h.toLocaleString()}건`);
  console.log(`  최근 24시간:  ${snap24h.toLocaleString()}건`);
  console.log(`  최근 48시간:  ${snap48h.toLocaleString()}건`);

  // 3. 최근 스냅샷 시간 확인 (10분 간격 확인)
  const latestSnapshots = await prisma.bookmakerOddsSnapshot.findMany({
    orderBy: { recordedAt: "desc" },
    take: 5,
    select: { recordedAt: true, home: true, draw: true, away: true },
  });

  if (latestSnapshots.length > 0) {
    console.log("\n── 최근 스냅샷 (최신 5개) ─────────────────────────────");
    for (const s of latestSnapshots) {
      const time = s.recordedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      console.log(`  ${time}  |  H:${s.home} D:${s.draw} A:${s.away}`);
    }

    const latest = latestSnapshots[0].recordedAt;
    const minutesAgo = Math.round((now.getTime() - latest.getTime()) / 1000 / 60);
    console.log(`\n  ⏰ 마지막 스냅샷: ${minutesAgo}분 전`);
    if (minutesAgo > 15) {
      console.log("  ⚠️ 10분 이상 수집 안 됨! GitHub Actions 확인 필요");
    } else {
      console.log("  ✅ 정상 수집 중");
    }
  } else {
    console.log("\n  ⚠️ 스냅샷 데이터 없음!");
  }

  // 4. 리그별 배당 보유 현황
  const leagues = await prisma.league.findMany({
    where: { enabled: true },
    orderBy: { priority: "desc" },
    select: { id: true, name: true, apiLeagueId: true },
  });

  console.log("\n── 리그별 배당 보유 현황 ──────────────────────────────");
  console.log("  리그                          | 기본배당 | BM배당 | 상태");
  console.log("  " + "─".repeat(65));

  for (const league of leagues) {
    const fixtures = await prisma.fixture.findMany({
      where: { leagueId: league.id },
      select: { id: true },
    });
    const fIds = fixtures.map(f => f.id);

    if (fIds.length === 0) continue;

    const odds = await prisma.fixtureOdds.count({
      where: { fixtureId: { in: fIds } },
    });
    const bmOdds = await prisma.bookmakerOdds.count({
      where: { fixtureId: { in: fIds } },
    });

    const status = odds > 0 ? (bmOdds > 0 ? "✅ 수집중" : "⚠️ BM없음") : "❌ 배당없음";
    const name = league.name.padEnd(30);
    console.log(`  ${name} | ${String(odds).padStart(6)} | ${String(bmOdds).padStart(6)} | ${status}`);
  }

  // 5. 북메이커별 배당 분포
  console.log("\n── 북메이커별 배당 수 ─────────────────────────────────");
  const bmDist = await prisma.bookmakerOdds.groupBy({
    by: ["bookmaker"],
    _count: true,
    orderBy: { _count: { bookmaker: "desc" } },
  });

  for (const bm of bmDist) {
    const snapCount = await prisma.bookmakerOddsSnapshot.count({
      where: { bookmakerOdds: { bookmaker: bm.bookmaker } },
    });
    console.log(`  ${bm.bookmaker.padEnd(25)} | 배당: ${String(bm._count).padStart(4)} | 스냅샷: ${String(snapCount).padStart(5)}`);
  }

  // 6. 다가오는 경기 배당 현황
  const upcoming = await prisma.fixture.findMany({
    where: {
      status: "NS",
      kickoffAt: { gte: now },
      leagueId: { in: leagues.map(l => l.id) },
    },
    include: {
      league: { select: { name: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      odds: true,
      bookmakerOdds: { select: { bookmaker: true } },
    },
    orderBy: { kickoffAt: "asc" },
    take: 15,
  });

  console.log("\n── 다가오는 경기 배당 현황 (최근 15경기) ──────────────");
  for (const f of upcoming) {
    const date = f.kickoffAt.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });
    const time = f.kickoffAt.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
    const match = `${f.homeTeam.name} vs ${f.awayTeam.name}`.substring(0, 35).padEnd(35);
    const oddsStr = f.odds ? `H:${f.odds.home} D:${f.odds.draw} A:${f.odds.away}` : "배당없음";
    const bmCount = f.bookmakerOdds.length;
    console.log(`  ${date} ${time} | ${f.league.name.substring(0, 12).padEnd(12)} | ${match} | ${oddsStr} | BM:${bmCount}`);
  }

  console.log("\n✅ 배당 리포트 완료!\n");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ 오류:", e);
  await prisma.$disconnect();
});
