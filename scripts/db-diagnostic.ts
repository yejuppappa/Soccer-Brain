/**
 * Soccer-Brain DB 진단 스크립트
 * =============================
 * 서버 없이 독립 실행: npx tsx scripts/db-diagnostic.ts
 * 
 * 현재 데이터 상태를 진단하고 뭐가 비어있는지 보여줍니다.
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🧠 Soccer-Brain DB 진단 리포트");
  console.log("═══════════════════════════════════════════════\n");

  // 1. 테이블별 레코드 수
  console.log("📊 [1] 테이블별 레코드 수");
  console.log("─────────────────────────────────────");
  const counts = {
    leagues: await prisma.league.count(),
    teams: await prisma.team.count(),
    fixtures: await prisma.fixture.count(),
    fixturesCompleted: await prisma.fixture.count({ where: { status: "FT" } }),
    fixturesUpcoming: await prisma.fixture.count({ where: { status: { in: ["NS", "TBD"] } } }),
    teamStatSnapshots: await prisma.fixtureTeamStatSnapshot.count(),
    featureSnapshots: await prisma.fixtureFeatureSnapshot.count(),
    odds: await prisma.fixtureOdds.count(),
    oddsHistory: await prisma.oddsHistory.count(),
    injuries: await prisma.fixtureInjury.count(),
    weather: await prisma.fixtureWeather.count(),
    lineups: await prisma.fixtureLineup.count(),
    standings: await prisma.standing.count(),
    predictions: await prisma.prediction.count(),
  };
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k.padEnd(25)} ${String(v).padStart(8)}`);
  }

  // 2. 리그별 경기 수
  console.log("\n📋 [2] 리그별 경기 수 (FT 완료 / 전체)");
  console.log("─────────────────────────────────────");
  const leagues = await prisma.league.findMany({ orderBy: { priority: "desc" } });
  for (const lg of leagues) {
    const total = await prisma.fixture.count({ where: { leagueId: lg.id } });
    const ft = await prisma.fixture.count({ where: { leagueId: lg.id, status: "FT" } });
    console.log(`  ${lg.name.padEnd(30)} ${String(ft).padStart(5)} / ${String(total).padStart(5)}  (${lg.enabled ? '✅' : '❌'})`);
  }

  // 3. 시즌별 경기 수
  console.log("\n📅 [3] 시즌별 완료된 경기 수");
  console.log("─────────────────────────────────────");
  const seasons = await prisma.fixture.groupBy({
    by: ["season"],
    where: { status: "FT" },
    _count: { id: true },
    orderBy: { season: "asc" },
  });
  for (const s of seasons) {
    console.log(`  시즌 ${s.season}:  ${String(s._count.id).padStart(6)}경기`);
  }

  // 4. 스탯 커버리지 (완료된 경기 중 스탯이 있는 비율)
  console.log("\n🔍 [4] 완료된 경기 vs 스탯 스냅샷 커버리지");
  console.log("─────────────────────────────────────");
  const ftFixtures = await prisma.fixture.count({ where: { status: "FT" } });
  // 스탯이 있는 fixture 수 (홈+원정 2개이므로 /2)
  const fixturesWithStats = await prisma.fixtureTeamStatSnapshot.groupBy({
    by: ["fixtureId"],
    _count: { id: true },
  });
  const statsFixtureCount = fixturesWithStats.length;
  const statsCoverage = ftFixtures > 0 ? (statsFixtureCount / ftFixtures * 100).toFixed(1) : "0";
  console.log(`  완료된 경기:      ${ftFixtures}`);
  console.log(`  스탯 있는 경기:   ${statsFixtureCount}`);
  console.log(`  스탯 없는 경기:   ${ftFixtures - statsFixtureCount}`);
  console.log(`  커버리지:         ${statsCoverage}%`);

  // 5. xG NULL 비율
  console.log("\n⚡ [5] 스탯 필드 NULL 비율 (FixtureTeamStatSnapshot)");
  console.log("─────────────────────────────────────");
  const totalStats = await prisma.fixtureTeamStatSnapshot.count();
  if (totalStats > 0) {
    const xgNull = await prisma.fixtureTeamStatSnapshot.count({ where: { xg: null } });
    const shotsNull = await prisma.fixtureTeamStatSnapshot.count({ where: { shotsTotal: null } });
    const possNull = await prisma.fixtureTeamStatSnapshot.count({ where: { possessionPct: null } });
    const passAccNull = await prisma.fixtureTeamStatSnapshot.count({ where: { passAccuracyPct: null } });
    const cornersNull = await prisma.fixtureTeamStatSnapshot.count({ where: { corners: null } });

    const pct = (n: number) => `${(n / totalStats * 100).toFixed(1)}%`;
    console.log(`  전체 스탯 레코드: ${totalStats}`);
    console.log(`  xG NULL:          ${xgNull} (${pct(xgNull)})`);
    console.log(`  슈팅 NULL:        ${shotsNull} (${pct(shotsNull)})`);
    console.log(`  점유율 NULL:      ${possNull} (${pct(possNull)})`);
    console.log(`  패스정확도 NULL:  ${passAccNull} (${pct(passAccNull)})`);
    console.log(`  코너 NULL:        ${cornersNull} (${pct(cornersNull)})`);
  }

  // 6. 피처 스냅샷 NULL 비율
  console.log("\n🧬 [6] 피처 스냅샷 NULL 비율 (FixtureFeatureSnapshot)");
  console.log("─────────────────────────────────────");
  const totalFeatures = await prisma.fixtureFeatureSnapshot.count();
  if (totalFeatures > 0) {
    const fXgNull = await prisma.fixtureFeatureSnapshot.count({ where: { home_xg_avg: null } });
    const fFormNull = await prisma.fixtureFeatureSnapshot.count({ where: { home_form_last5: null } });
    const fH2hNull = await prisma.fixtureFeatureSnapshot.count({ where: { h2h_total_matches: null } });
    const fRestNull = await prisma.fixtureFeatureSnapshot.count({ where: { home_days_rest: null } });
    const fShotsNull = await prisma.fixtureFeatureSnapshot.count({ where: { home_shotsTotal_avg: null } });

    const pct = (n: number) => `${(n / totalFeatures * 100).toFixed(1)}%`;
    console.log(`  전체 피처 레코드: ${totalFeatures}`);
    console.log(`  home_xg_avg NULL:         ${fXgNull} (${pct(fXgNull)})`);
    console.log(`  home_shotsTotal_avg NULL:  ${fShotsNull} (${pct(fShotsNull)})`);
    console.log(`  home_form_last5 NULL:      ${fFormNull} (${pct(fFormNull)})`);
    console.log(`  h2h_total_matches NULL:    ${fH2hNull} (${pct(fH2hNull)})`);
    console.log(`  home_days_rest NULL:       ${fRestNull} (${pct(fRestNull)})`);
  }

  // 7. 스탯 없는 경기 샘플 (백필 대상)
  console.log("\n🔧 [7] 스탯 없는 FT 경기 (리그별, 백필 대상)");
  console.log("─────────────────────────────────────");
  for (const lg of leagues) {
    const ftInLeague = await prisma.fixture.count({ where: { leagueId: lg.id, status: "FT" } });
    
    // 스탯 있는 경기
    const withStats = await prisma.fixture.count({
      where: {
        leagueId: lg.id,
        status: "FT",
        teamStatSnapshots: { some: {} },
      },
    });
    
    const missing = ftInLeague - withStats;
    if (ftInLeague > 0) {
      console.log(`  ${lg.name.padEnd(30)} 스탯없음: ${String(missing).padStart(5)} / ${ftInLeague}  (${missing > 0 ? '⚠️ 백필 필요' : '✅'})`);
    }
  }

  // 8. 요약
  console.log("\n═══════════════════════════════════════════════");
  console.log("  📝 요약");
  console.log("═══════════════════════════════════════════════");
  
  const missingStats = ftFixtures - statsFixtureCount;
  if (missingStats > 0) {
    console.log(`  ⚠️  ${missingStats}경기 스탯 미수집 → 백필 필요`);
    console.log(`      예상 API 콜: ~${missingStats}콜 (경기당 1콜)`);
    console.log(`      실행: npx tsx scripts/backfill-stats.ts`);
  } else {
    console.log(`  ✅ 모든 FT 경기에 스탯 있음!`);
  }

  console.log("");
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
