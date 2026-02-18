/**
 * 데이터 무결성 검증 스크립트
 * - Arsenal, Brentford의 2024-25 EPL 경기 데이터 확인
 * - 실점 합계 크로스체크
 * - EPL 전체 팀의 데이터 누락 패턴 확인
 */

import { prisma } from "../server/db.js";

async function checkTeamData(teamApiId: number, teamName: string, expectedGoalsAgainst: number | null) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 ${teamName} (API Team ID: ${teamApiId}) - 2024-25 EPL 데이터 검증`);
  console.log("=".repeat(80));

  // 1. 팀 정보 찾기
  const team = await prisma.team.findFirst({
    where: { apiTeamId: teamApiId },
  });

  if (!team) {
    console.error(`❌ ${teamName} 팀을 찾을 수 없습니다`);
    return;
  }

  console.log(`\n팀 ID: ${team.id}`);

  // 2. EPL 리그 찾기
  const eplLeague = await prisma.league.findFirst({
    where: { apiLeagueId: 39 },
  });

  if (!eplLeague) {
    console.error("❌ EPL 리그를 찾을 수 없습니다");
    return;
  }

  // 3. 2024-25 시즌 경기 목록 (FixtureTeamStatSnapshot 기준)
  const statsSnapshots = await prisma.fixtureTeamStatSnapshot.findMany({
    where: {
      teamId: team.id,
      fixture: {
        leagueId: eplLeague.id,
        season: 2024,
        status: "FT",
      },
    },
    include: {
      fixture: {
        include: {
          homeTeam: true,
          awayTeam: true,
        },
      },
    },
    orderBy: {
      fixture: {
        kickoffAt: "asc",
      },
    },
  });

  console.log(`\n📋 FixtureTeamStatSnapshot 경기 목록 (총 ${statsSnapshots.length}개):\n`);
  console.log("날짜       | 홈팀 vs 원정팀 | 스코어 | 득점 | 실점");
  console.log("-".repeat(80));

  let totalGoalsFor = 0;
  let totalGoalsAgainst = 0;
  const fixtureIds = new Set<bigint>();

  for (const snap of statsSnapshots) {
    const fixture = snap.fixture;
    const isHome = fixture.homeTeamId === team.id;

    const goalsFor = isHome ? (fixture.homeGoals ?? 0) : (fixture.awayGoals ?? 0);
    const goalsAgainst = isHome ? (fixture.awayGoals ?? 0) : (fixture.homeGoals ?? 0);

    totalGoalsFor += goalsFor;
    totalGoalsAgainst += goalsAgainst;
    fixtureIds.add(fixture.id);

    const homeScore = fixture.homeGoals ?? "?";
    const awayScore = fixture.awayGoals ?? "?";
    const location = isHome ? "(H)" : "(A)";

    console.log(
      `${fixture.kickoffAt.toISOString().split("T")[0]} | ` +
      `${fixture.homeTeam.name} vs ${fixture.awayTeam.name} ${location} | ` +
      `${homeScore}-${awayScore} | ` +
      `${goalsFor} | ${goalsAgainst}`
    );
  }

  console.log("-".repeat(80));
  console.log(`합계: 득점 ${totalGoalsFor} | 실점 ${totalGoalsAgainst}`);

  // 4. 실점 합계 크로스체크
  console.log(`\n🔍 실점 합계 검증:`);
  console.log(`   - FixtureTeamStatSnapshot 기준: ${totalGoalsAgainst}`);

  if (expectedGoalsAgainst !== null) {
    console.log(`   - 예상값: ${expectedGoalsAgainst}`);
    if (totalGoalsAgainst === expectedGoalsAgainst) {
      console.log(`   ✅ 일치!`);
    } else {
      console.log(`   ❌ 불일치! 차이: ${Math.abs(totalGoalsAgainst - expectedGoalsAgainst)}`);
    }
  }

  // 5. Fixture 테이블과 비교 (실제 경기 수)
  const allFixtures = await prisma.fixture.findMany({
    where: {
      leagueId: eplLeague.id,
      season: 2024,
      status: "FT",
      OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
    },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
    orderBy: { kickoffAt: "asc" },
  });

  console.log(`\n📊 Fixture 테이블 기준 경기 수: ${allFixtures.length}개`);

  if (allFixtures.length !== statsSnapshots.length) {
    console.log(`   ⚠️  FixtureTeamStatSnapshot과 차이: ${Math.abs(allFixtures.length - statsSnapshots.length)}개`);

    // 누락된 경기 찾기
    const snapshotFixtureIds = new Set(statsSnapshots.map(s => s.fixtureId));
    const missingInSnapshot = allFixtures.filter(f => !snapshotFixtureIds.has(f.id));

    if (missingInSnapshot.length > 0) {
      console.log(`\n   ❌ FixtureTeamStatSnapshot에 누락된 경기 (${missingInSnapshot.length}개):`);
      for (const f of missingInSnapshot) {
        console.log(`      - ${f.kickoffAt.toISOString().split("T")[0]}: ${f.homeTeam.name} vs ${f.awayTeam.name}`);
      }
    }
  } else {
    console.log(`   ✅ Fixture와 FixtureTeamStatSnapshot 경기 수 일치`);
  }

  // 6. 실제 EPL 2024-25 시즌 경기 수 확인
  console.log(`\n📅 2024-25 EPL 시즌 정보:`);
  console.log(`   - 총 팀 수: 20팀`);
  console.log(`   - 예상 경기 수: 38경기/팀 (홈 19, 원정 19)`);

  if (allFixtures.length < 38) {
    console.log(`   ⚠️  현재 ${allFixtures.length}경기 (시즌 진행 중 또는 데이터 누락)`);
  } else if (allFixtures.length === 38) {
    console.log(`   ✅ 38경기 완료 (정상)`);
  } else {
    console.log(`   ⚠️  ${allFixtures.length}경기 (예상보다 많음, 중복 확인 필요)`);
  }

  return {
    teamName,
    statsCount: statsSnapshots.length,
    fixturesCount: allFixtures.length,
    goalsAgainst: totalGoalsAgainst,
  };
}

async function checkEPLTeamsDataCoverage() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 EPL 전체 팀 - FixtureTeamStatSnapshot 데이터 커버리지`);
  console.log("=".repeat(80));

  const eplLeague = await prisma.league.findFirst({
    where: { apiLeagueId: 39 },
  });

  if (!eplLeague) {
    console.error("❌ EPL 리그를 찾을 수 없습니다");
    return;
  }

  // EPL 팀 목록 (2024-25 시즌에 참여한 팀)
  const teams = await prisma.team.findMany({
    where: {
      homeFixtures: {
        some: {
          leagueId: eplLeague.id,
          season: 2024,
        },
      },
    },
    select: {
      id: true,
      name: true,
      apiTeamId: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(`\n총 ${teams.length}개 팀 발견\n`);

  const teamStats: Array<{
    name: string;
    fixturesCount: number;
    statsCount: number;
    difference: number;
  }> = [];

  for (const team of teams) {
    // Fixture 테이블에서 경기 수
    const fixturesCount = await prisma.fixture.count({
      where: {
        leagueId: eplLeague.id,
        season: 2024,
        status: "FT",
        OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
      },
    });

    // FixtureTeamStatSnapshot에서 경기 수
    const statsCount = await prisma.fixtureTeamStatSnapshot.count({
      where: {
        teamId: team.id,
        fixture: {
          leagueId: eplLeague.id,
          season: 2024,
          status: "FT",
        },
      },
    });

    const difference = fixturesCount - statsCount;

    teamStats.push({
      name: team.name,
      fixturesCount,
      statsCount,
      difference,
    });
  }

  // 결과 출력
  console.log("팀명                  | Fixtures | Stats | 차이");
  console.log("-".repeat(80));

  let hasIssues = false;

  for (const stat of teamStats) {
    const status = stat.difference === 0 ? "✅" : "❌";
    console.log(
      `${stat.name.padEnd(20)} | ${String(stat.fixturesCount).padStart(8)} | ` +
      `${String(stat.statsCount).padStart(5)} | ${String(stat.difference).padStart(4)} ${status}`
    );

    if (stat.difference !== 0) {
      hasIssues = true;
    }
  }

  console.log("-".repeat(80));

  if (hasIssues) {
    console.log(`\n⚠️  일부 팀에서 Fixture와 FixtureTeamStatSnapshot 경기 수 불일치 발견`);
    console.log(`   → 누락된 경기의 stats를 수집해야 합니다`);
  } else {
    console.log(`\n✅ 모든 팀의 Fixture와 FixtureTeamStatSnapshot 경기 수 일치`);
  }

  // 통계 요약
  const avgFixtures = teamStats.reduce((sum, t) => sum + t.fixturesCount, 0) / teamStats.length;
  const avgStats = teamStats.reduce((sum, t) => sum + t.statsCount, 0) / teamStats.length;

  console.log(`\n📈 통계 요약:`);
  console.log(`   평균 Fixtures/팀: ${avgFixtures.toFixed(1)}`);
  console.log(`   평균 Stats/팀: ${avgStats.toFixed(1)}`);
  console.log(`   예상 경기 수: 38경기/팀`);

  if (avgFixtures < 38) {
    console.log(`   ⚠️  시즌 진행 중 (${(avgFixtures / 38 * 100).toFixed(1)}% 완료)`);
  }
}

async function main() {
  console.log("\n🔍 데이터 무결성 검증 시작\n");

  // 1. Arsenal 검증 (실점 17 예상)
  await checkTeamData(42, "Arsenal", 17);

  // 2. Brentford 검증 (실점 34 예상)
  await checkTeamData(55, "Brentford", 34);

  // 3. EPL 전체 팀 데이터 커버리지
  await checkEPLTeamsDataCoverage();

  console.log(`\n${"=".repeat(80)}`);
  console.log(`✅ 데이터 무결성 검증 완료`);
  console.log("=".repeat(80));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
