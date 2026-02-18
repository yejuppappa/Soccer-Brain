/**
 * 데이터 전수조사 (재수집 전 진단)
 */

import { prisma } from "../server/db.js";
import { fetchFixtureTeamStats } from "../server/api-football.js";

// normalizeTeamStats.ts의 현재 매핑
const CURRENT_MAPPING: Record<string, string> = {
  "Total Shots": "shotsTotal",
  "Shots on Goal": "shotsOnTarget",
  "Shots off Goal": "shotsOffTarget",
  "Ball Possession": "possessionPct",
  "Total passes": "passesTotal",
  "Passes accurate": "passesAccurate",
  "Passes %": "passAccuracyPct",
  "Fouls": "fouls",
  "Corner Kicks": "corners",
  "Offsides": "offsides",
  "Yellow Cards": "yellowCards",
  "Red Cards": "redCards",
  "Tackles": "tackles",
  "Interceptions": "interceptions",
  "Total duels": "duelsTotal",
  "Duels won": "duelsWon",
  "Goalkeeper Saves": "saves",
  "Expected Goals": "xg",      // 구 형식
  "expected_goals": "xg",      // 신 형식
};

// DB 스키마 필드
const DB_FIELDS = [
  'shotsTotal',
  'shotsOnTarget',
  'shotsOffTarget',
  'possessionPct',
  'passesTotal',
  'passesAccurate',
  'passAccuracyPct',
  'fouls',
  'corners',
  'offsides',
  'yellowCards',
  'redCards',
  'tackles',
  'interceptions',
  'duelsTotal',
  'duelsWon',
  'saves',
  'xg',
];

async function step1_fieldNameAudit() {
  console.log("\n" + "=".repeat(120));
  console.log("【1단계】필드명 변경 여부 전체 확인");
  console.log("=".repeat(120));

  // 2020-21 시즌 경기 1개
  const fixture2020 = await prisma.fixture.findFirst({
    where: {
      season: 2020,
      status: "FT",
      league: { enabled: true },
    },
    orderBy: { kickoffAt: "desc" },
    select: { apiFixtureId: true, season: true, kickoffAt: true },
  });

  // 2025-26 시즌 경기 1개
  const fixture2025 = await prisma.fixture.findFirst({
    where: {
      season: 2025,
      status: "FT",
      league: { enabled: true },
    },
    orderBy: { kickoffAt: "desc" },
    select: { apiFixtureId: true, season: true, kickoffAt: true },
  });

  if (!fixture2020 || !fixture2025) {
    console.log("\n⚠️  테스트용 경기를 찾을 수 없음");
    return;
  }

  console.log(`\n2020-21 시즌 샘플: ${fixture2020.apiFixtureId} (${fixture2020.kickoffAt.toISOString().split('T')[0]})`);
  console.log(`2025-26 시즌 샘플: ${fixture2025.apiFixtureId} (${fixture2025.kickoffAt.toISOString().split('T')[0]})`);

  // API 호출 1
  console.log("\n📡 API 호출 중 (1/2)...");
  const response2020 = await fetchFixtureTeamStats(fixture2020.apiFixtureId);
  const fields2020 = new Set<string>();
  const teamBlocks2020 = response2020.data?.response || [];
  if (teamBlocks2020.length > 0) {
    const stats2020 = teamBlocks2020[0].statistics || [];
    stats2020.forEach((s: any) => fields2020.add(s.type));
  }

  await new Promise(resolve => setTimeout(resolve, 350));

  // API 호출 2
  console.log("📡 API 호출 중 (2/2)...");
  const response2025 = await fetchFixtureTeamStats(fixture2025.apiFixtureId);
  const fields2025 = new Set<string>();
  const teamBlocks2025 = response2025.data?.response || [];
  if (teamBlocks2025.length > 0) {
    const stats2025 = teamBlocks2025[0].statistics || [];
    stats2025.forEach((s: any) => fields2025.add(s.type));
  }

  console.log("\n" + "-".repeat(120));
  console.log("📊 필드 비교 결과:");
  console.log("-".repeat(120));

  const allFields = new Set([...fields2020, ...fields2025]);
  const sorted = Array.from(allFields).sort();

  console.log("\n필드명                     | 2020-21 | 2025-26 | 매핑 상태       | DB 컬럼");
  console.log("-".repeat(120));

  const changedFields: string[] = [];
  const newFields: string[] = [];
  const removedFields: string[] = [];
  const unmappedFields: string[] = [];

  sorted.forEach(field => {
    const in2020 = fields2020.has(field);
    const in2025 = fields2025.has(field);
    const isMapped = Object.keys(CURRENT_MAPPING).includes(field);
    const dbColumn = CURRENT_MAPPING[field] || "N/A";

    const status2020 = in2020 ? "✅" : "❌";
    const status2025 = in2025 ? "✅" : "❌";
    const mappingStatus = isMapped ? "✅ 매핑됨" : "❌ 매핑 누락";

    console.log(
      `${field.padEnd(26)} | ${status2020.padEnd(7)} | ${status2025.padEnd(7)} | ${mappingStatus.padEnd(15)} | ${dbColumn}`
    );

    // 분류
    if (in2020 && !in2025) {
      removedFields.push(field);
    } else if (!in2020 && in2025) {
      newFields.push(field);
    } else if (in2020 && in2025 && !isMapped) {
      unmappedFields.push(field);
    }
  });

  console.log("-".repeat(120));

  // 요약
  console.log("\n📋 변경 사항 요약:");
  console.log("-".repeat(120));

  console.log(`\n🆕 신규 추가된 필드 (2025-26에만 존재): ${newFields.length}개`);
  if (newFields.length > 0) {
    newFields.forEach(f => console.log(`   - ${f}`));
  } else {
    console.log("   (없음)");
  }

  console.log(`\n🗑️  삭제된 필드 (2020-21에만 존재): ${removedFields.length}개`);
  if (removedFields.length > 0) {
    removedFields.forEach(f => console.log(`   - ${f}`));
  } else {
    console.log("   (없음)");
  }

  console.log(`\n⚠️  매핑 누락 필드 (양쪽에 존재하지만 매핑 안 됨): ${unmappedFields.length}개`);
  if (unmappedFields.length > 0) {
    unmappedFields.forEach(f => console.log(`   - ${f}`));
  } else {
    console.log("   (없음)");
  }

  console.log("\n" + "=".repeat(120));
}

async function step2_nullCoverageAudit() {
  console.log("\n" + "=".repeat(120));
  console.log("【2단계】시즌별 × 리그별 null 현황 전수조사");
  console.log("=".repeat(120));

  const seasons = [2020, 2021, 2022, 2023, 2024, 2025];

  const activeLeagues = await prisma.league.findMany({
    where: { enabled: true },
    select: { id: true, name: true, apiLeagueId: true },
    orderBy: { name: "asc" },
  });

  console.log(`\n활성 리그: ${activeLeagues.length}개`);
  console.log(`시즌 범위: 2020-21 ~ 2025-26`);
  console.log(`검증 필드: ${DB_FIELDS.length}개\n`);

  interface LeagueSeasonCoverage {
    leagueName: string;
    season: number;
    totalMatches: number;
    fieldCoverage: Map<string, number>;
  }

  const results: LeagueSeasonCoverage[] = [];

  for (const league of activeLeagues) {
    for (const season of seasons) {
      const totalMatches = await prisma.fixtureTeamStatSnapshot.count({
        where: {
          fixture: {
            leagueId: league.id,
            season: season,
            status: "FT",
          },
        },
      });

      if (totalMatches === 0) continue;

      const fieldCoverage = new Map<string, number>();

      for (const field of DB_FIELDS) {
        const withData = await prisma.fixtureTeamStatSnapshot.count({
          where: {
            fixture: {
              leagueId: league.id,
              season: season,
              status: "FT",
            },
            [field]: { not: null },
          },
        });

        const coverage = (withData / totalMatches) * 100;
        fieldCoverage.set(field, coverage);
      }

      results.push({
        leagueName: league.name,
        season,
        totalMatches,
        fieldCoverage,
      });
    }
  }

  // 리그별로 그룹핑해서 출력
  console.log("=".repeat(120));
  console.log("📊 리그별 × 시즌별 × 필드별 커버리지");
  console.log("=".repeat(120));

  const leagueNames = [...new Set(results.map(r => r.leagueName))];

  for (const leagueName of leagueNames) {
    const leagueResults = results.filter(r => r.leagueName === leagueName);

    if (leagueResults.length === 0) continue;

    console.log(`\n【${leagueName}】`);
    console.log("-".repeat(120));

    // 헤더
    const header = "필드명".padEnd(20) + " | " +
      seasons.map(s => `${s}-${String(s+1).slice(-2)}`).join(" | ");
    console.log(header);
    console.log("-".repeat(120));

    // 각 필드별 시즌 커버리지
    for (const field of DB_FIELDS) {
      const row = field.padEnd(20) + " | " +
        seasons.map(season => {
          const result = leagueResults.find(r => r.season === season);
          if (!result) return "    N/A  ";

          const coverage = result.fieldCoverage.get(field) || 0;
          const coverageStr = coverage.toFixed(0) + "%";

          if (coverage === 100) {
            return coverageStr.padStart(9);
          } else if (coverage >= 90) {
            return (coverageStr + " 🟡").padStart(9);
          } else if (coverage > 0) {
            return (coverageStr + " 🔴").padStart(9);
          } else {
            return (coverageStr + " ⚫").padStart(9);
          }
        }).join(" | ");

      console.log(row);
    }

    // 경기 수
    console.log("-".repeat(120));
    const matchCountRow = "총 경기 수".padEnd(20) + " | " +
      seasons.map(season => {
        const result = leagueResults.find(r => r.season === season);
        return result ? String(result.totalMatches).padStart(9) : "      0  ";
      }).join(" | ");
    console.log(matchCountRow);
  }

  console.log("\n" + "=".repeat(120));
}

async function step3_recollectionEstimate() {
  console.log("\n" + "=".repeat(120));
  console.log("【3단계】재수집 규모 산정");
  console.log("=".repeat(120));

  const seasons = [2020, 2021, 2022, 2023, 2024, 2025];

  // xG null 경기 수 (시즌별, 리그별)
  console.log("\n📊 xG null 경기 현황 (시즌별 × 리그별):");
  console.log("-".repeat(120));

  const activeLeagues = await prisma.league.findMany({
    where: { enabled: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  interface XgNullCount {
    leagueName: string;
    season: number;
    totalMatches: number;
    xgNullCount: number;
  }

  const xgNullResults: XgNullCount[] = [];

  for (const league of activeLeagues) {
    for (const season of seasons) {
      const totalMatches = await prisma.fixtureTeamStatSnapshot.count({
        where: {
          fixture: {
            leagueId: league.id,
            season: season,
            status: "FT",
          },
        },
      });

      if (totalMatches === 0) continue;

      const xgNullCount = await prisma.fixtureTeamStatSnapshot.count({
        where: {
          fixture: {
            leagueId: league.id,
            season: season,
            status: "FT",
          },
          xg: null,
        },
      });

      if (xgNullCount > 0) {
        xgNullResults.push({
          leagueName: league.name,
          season,
          totalMatches,
          xgNullCount,
        });
      }
    }
  }

  console.log("\n리그명                              | 시즌      | 전체 경기 | xG null | 비율");
  console.log("-".repeat(120));

  let totalXgNull = 0;

  xgNullResults.forEach(result => {
    const ratio = (result.xgNullCount / result.totalMatches) * 100;
    console.log(
      `${result.leagueName.padEnd(35)} | ` +
      `${result.season}-${String(result.season+1).slice(-2)} | ` +
      `${String(result.totalMatches).padStart(9)} | ` +
      `${String(result.xgNullCount).padStart(7)} | ` +
      `${ratio.toFixed(1)}%`
    );
    totalXgNull += result.xgNullCount;
  });

  console.log("-".repeat(120));
  console.log(`총 xG null 스냅샷: ${totalXgNull}개`);

  // 경기 단위로 환산 (스냅샷 2개 = 경기 1개)
  const uniqueFixturesWithXgNull = await prisma.fixture.count({
    where: {
      status: "FT",
      season: { in: seasons },
      league: { enabled: true },
      teamStats: {
        some: { xg: null },
      },
    },
  });

  console.log(`재수집 필요 경기: ${uniqueFixturesWithXgNull}개`);

  // API 쿼터 계산
  const DAILY_QUOTA = 70000;
  const daysNeeded = Math.ceil(uniqueFixturesWithXgNull / DAILY_QUOTA);

  console.log("\n" + "-".repeat(120));
  console.log("📅 재수집 소요 시간 산정:");
  console.log("-".repeat(120));
  console.log(`   API 일일 쿼터: ${DAILY_QUOTA.toLocaleString()}건`);
  console.log(`   재수집 필요 경기: ${uniqueFixturesWithXgNull.toLocaleString()}개`);
  console.log(`   경기당 API 호출: 1회`);
  console.log(`   예상 소요 일수: ${daysNeeded}일`);

  if (daysNeeded === 0) {
    console.log(`   ✅ 재수집 불필요 (모든 데이터 정상)`);
  } else if (daysNeeded === 1) {
    console.log(`   ✅ 1일 내 완료 가능`);
  } else {
    console.log(`   ⚠️  ${daysNeeded}일 소요 예상`);
  }

  console.log("\n" + "=".repeat(120));
}

async function main() {
  console.log("\n🔍 데이터 전수조사 시작");
  console.log("목적: 재수집 전 현황 파악 (읽기 전용 + API 2회만)");

  await step1_fieldNameAudit();
  await step2_nullCoverageAudit();
  await step3_recollectionEstimate();

  console.log("\n✅ 전수조사 완료\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
