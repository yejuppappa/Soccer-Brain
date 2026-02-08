/**
 * Soccer-Brain 과거 데이터 백필 스크립트
 * ========================================
 * 서버 없이 독립 실행:
 * 
 *   npx tsx scripts/backfill-stats.ts
 *   npx tsx scripts/backfill-stats.ts --league=39 --season=2022
 *   npx tsx scripts/backfill-stats.ts --limit=500
 *   npx tsx scripts/backfill-stats.ts --dry-run
 * 
 * 기능:
 *   - 완료된(FT) 경기 중 스탯이 없는 경기를 찾아서
 *   - API-Football에서 경기 통계를 가져와서
 *   - FixtureTeamStatSnapshot에 저장
 *   - 중단해도 다시 실행하면 이어서 진행 (이미 있는 건 스킵)
 * 
 * API 콜: 경기당 1콜 (슈팅, 점유율, xG 등 한번에)
 * 70,000콜/일이면 하룻밤에 전체 백필 가능
 */

import { PrismaClient } from "@prisma/client";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

const API_BASE = "https://v3.football.api-sports.io";
const API_KEY = process.env.API_SPORTS_KEY || "";
const DELAY_MS = 350; // 초당 ~3콜 (안전 마진)

// ============================================================
// CLI 인자 파싱
// ============================================================
function parseArgs() {
  const args: Record<string, string> = {};
  process.argv.slice(2).forEach(arg => {
    const [key, val] = arg.replace("--", "").split("=");
    args[key] = val || "true";
  });
  return {
    league: args.league ? parseInt(args.league) : undefined,    // API league ID (39=EPL, 140=LaLiga 등)
    season: args.season ? parseInt(args.season) : undefined,
    limit: args.limit ? parseInt(args.limit) : 10000,
    dryRun: args["dry-run"] === "true",
  };
}

// ============================================================
// API-Football 호출
// ============================================================
const api = axios.create({
  baseURL: API_BASE,
  headers: { "x-apisports-key": API_KEY },
});

interface StatItem {
  type: string;
  value: string | number | null;
}

async function fetchStats(apiFixtureId: number): Promise<Array<{
  team: { id: number; name: string };
  statistics: StatItem[];
}>> {
  const res = await api.get("/fixtures/statistics", {
    params: { fixture: apiFixtureId },
  });

  // 남은 콜 수 로깅
  const remaining = res.headers["x-ratelimit-remaining"] || res.headers["x-requests-remaining"];
  if (remaining) {
    process.stdout.write(` [남은콜: ${remaining}]`);
  }

  return res.data?.response || [];
}

function getVal(stats: StatItem[], type: string): any {
  return stats.find(s => s.type === type)?.value;
}

// ============================================================
// 메인
// ============================================================
async function main() {
  if (!API_KEY) {
    console.error("❌ API_SPORTS_KEY가 .env에 없습니다!");
    process.exit(1);
  }

  const opts = parseArgs();
  
  console.log("═══════════════════════════════════════════════");
  console.log("  🔄 Soccer-Brain 과거 스탯 백필");
  console.log("═══════════════════════════════════════════════");
  console.log(`  리그 필터: ${opts.league || "전체"}`);
  console.log(`  시즌 필터: ${opts.season || "전체"}`);
  console.log(`  최대 처리: ${opts.limit}경기`);
  console.log(`  드라이런:  ${opts.dryRun}`);
  console.log("═══════════════════════════════════════════════\n");

  // 스탯 없는 FT 경기 찾기
  const where: any = {
    status: "FT",
    teamStatSnapshots: { none: {} }, // 스탯이 하나도 없는 경기
  };

  if (opts.league) {
    where.league = { apiLeagueId: opts.league };
  }
  if (opts.season) {
    where.season = opts.season;
  }

  const fixtures = await prisma.fixture.findMany({
    where,
    include: {
      league: { select: { name: true, apiLeagueId: true } },
      homeTeam: { select: { id: true, apiTeamId: true, name: true } },
      awayTeam: { select: { id: true, apiTeamId: true, name: true } },
    },
    orderBy: { kickoffAt: "asc" },
    take: opts.limit,
  });

  console.log(`📊 백필 대상: ${fixtures.length}경기\n`);

  if (fixtures.length === 0) {
    console.log("✅ 백필할 경기가 없습니다! 모든 FT 경기에 스탯이 있습니다.");
    await prisma.$disconnect();
    return;
  }

  if (opts.dryRun) {
    console.log("🔍 드라이런 모드 - 처음 10개만 표시:\n");
    fixtures.slice(0, 10).forEach(f => {
      console.log(`  ${f.kickoffAt.toISOString().slice(0, 10)} | ${f.league.name} | ${f.homeTeam.name} vs ${f.awayTeam.name} (API: ${f.apiFixtureId})`);
    });
    if (fixtures.length > 10) console.log(`  ... 외 ${fixtures.length - 10}경기`);
    console.log(`\n실제 실행: npx tsx scripts/backfill-stats.ts ${opts.league ? `--league=${opts.league}` : ''} ${opts.season ? `--season=${opts.season}` : ''}`);
    await prisma.$disconnect();
    return;
  }

  // 진행
  let success = 0, failed = 0, noData = 0;
  const startTime = Date.now();

  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    const progress = `[${i + 1}/${fixtures.length}]`;
    
    process.stdout.write(
      `${progress} ${f.kickoffAt.toISOString().slice(0, 10)} ${f.homeTeam.name} vs ${f.awayTeam.name}`
    );

    try {
      const stats = await fetchStats(f.apiFixtureId);

      if (!stats || stats.length === 0) {
        process.stdout.write(` → ⚪ 데이터 없음\n`);
        noData++;
        await delay(DELAY_MS);
        continue;
      }

      for (const teamStats of stats) {
        const isHome = teamStats.team.id === f.homeTeam.apiTeamId;
        const team = isHome ? f.homeTeam : f.awayTeam;
        const s = teamStats.statistics;

        await prisma.fixtureTeamStatSnapshot.upsert({
          where: {
            fixtureId_teamId: { fixtureId: f.id, teamId: team.id },
          },
          update: {
            shotsTotal: parseInt(getVal(s, "Total Shots")) || null,
            shotsOnTarget: parseInt(getVal(s, "Shots on Goal")) || null,
            shotsOffTarget: parseInt(getVal(s, "Shots off Goal")) || null,
            possessionPct: parseFloat(getVal(s, "Ball Possession")?.replace?.("%", "")) || null,
            passesTotal: parseInt(getVal(s, "Total passes")) || null,
            passesAccurate: parseInt(getVal(s, "Passes accurate")) || null,
            passAccuracyPct: parseFloat(getVal(s, "Passes %")?.replace?.("%", "")) || null,
            fouls: parseInt(getVal(s, "Fouls")) || null,
            corners: parseInt(getVal(s, "Corner Kicks")) || null,
            offsides: parseInt(getVal(s, "Offsides")) || null,
            yellowCards: parseInt(getVal(s, "Yellow Cards")) || null,
            redCards: parseInt(getVal(s, "Red Cards")) || null,
            saves: parseInt(getVal(s, "Goalkeeper Saves")) || null,
            xg: parseFloat(getVal(s, "expected_goals")) || null,
            raw: teamStats as any,
            fetchedAt: new Date(),
          },
          create: {
            fixtureId: f.id,
            teamId: team.id,
            isHome,
            shotsTotal: parseInt(getVal(s, "Total Shots")) || null,
            shotsOnTarget: parseInt(getVal(s, "Shots on Goal")) || null,
            shotsOffTarget: parseInt(getVal(s, "Shots off Goal")) || null,
            possessionPct: parseFloat(getVal(s, "Ball Possession")?.replace?.("%", "")) || null,
            passesTotal: parseInt(getVal(s, "Total passes")) || null,
            passesAccurate: parseInt(getVal(s, "Passes accurate")) || null,
            passAccuracyPct: parseFloat(getVal(s, "Passes %")?.replace?.("%", "")) || null,
            fouls: parseInt(getVal(s, "Fouls")) || null,
            corners: parseInt(getVal(s, "Corner Kicks")) || null,
            offsides: parseInt(getVal(s, "Offsides")) || null,
            yellowCards: parseInt(getVal(s, "Yellow Cards")) || null,
            redCards: parseInt(getVal(s, "Red Cards")) || null,
            saves: parseInt(getVal(s, "Goalkeeper Saves")) || null,
            xg: parseFloat(getVal(s, "expected_goals")) || null,
            raw: teamStats as any,
          },
        });
      }

      success++;
      process.stdout.write(` → ✅\n`);
    } catch (err: any) {
      failed++;
      process.stdout.write(` → ❌ ${err.message?.slice(0, 60)}\n`);

      // 429 Too Many Requests → 잠시 대기
      if (err.response?.status === 429) {
        console.log("  ⏳ API 제한 도달. 60초 대기...");
        await delay(60000);
      }
    }

    await delay(DELAY_MS);

    // 100건마다 중간 리포트
    if ((i + 1) % 100 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (success + failed + noData) / elapsed * 60;
      console.log(`\n  ── 중간 리포트: ✅${success} ❌${failed} ⚪${noData} | ${rate.toFixed(0)}건/분 ──\n`);
    }
  }

  // 최종 리포트
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log("\n═══════════════════════════════════════════════");
  console.log("  📊 백필 완료!");
  console.log("═══════════════════════════════════════════════");
  console.log(`  ✅ 성공: ${success}경기`);
  console.log(`  ❌ 실패: ${failed}경기`);
  console.log(`  ⚪ 데이터 없음: ${noData}경기`);
  console.log(`  ⏱️ 소요: ${totalTime}분`);
  console.log(`  📡 API 콜: ~${success + failed + noData}콜`);
  
  if (noData > 0) {
    console.log(`\n  ℹ️  "데이터 없음" ${noData}건은 API-Football에 해당 경기 통계가`);
    console.log(`     없는 것입니다 (오래된 경기이거나 해당 리그 미지원).`);
    console.log(`     이 경기들의 xG 등 고급 스탯은 원래 사용할 수 없습니다.`);
  }

  await prisma.$disconnect();
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(e => { console.error(e); process.exit(1); });
