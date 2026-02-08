/**
 * 🏟️ Soccer-Brain 리그 + 컵대회 등록 스크립트
 * 
 * 5대리그 + 베트맨 주요 리그 + 모든 주요 컵대회
 * 
 * 실행: npx tsx scripts/add-leagues.ts
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

// API-Football 리그/컵 ID 매핑
const LEAGUES = [
  // ══════════════════════════════════════════════
  // 5대 리그
  // ══════════════════════════════════════════════
  { apiLeagueId: 39,  name: "Premier League",           country: "England",     priority: 100 },
  { apiLeagueId: 140, name: "La Liga",                  country: "Spain",       priority: 95 },
  { apiLeagueId: 135, name: "Serie A",                  country: "Italy",       priority: 90 },
  { apiLeagueId: 78,  name: "Bundesliga",               country: "Germany",     priority: 85 },
  { apiLeagueId: 61,  name: "Ligue 1",                  country: "France",      priority: 80 },

  // ══════════════════════════════════════════════
  // 베트맨 주요 리그
  // ══════════════════════════════════════════════
  { apiLeagueId: 292, name: "K League 1",               country: "South Korea", priority: 75 },
  { apiLeagueId: 293, name: "K League 2",               country: "South Korea", priority: 70 },
  { apiLeagueId: 98,  name: "J1 League",                country: "Japan",       priority: 65 },
  { apiLeagueId: 88,  name: "Eredivisie",               country: "Netherlands", priority: 60 },
  { apiLeagueId: 94,  name: "Primeira Liga",            country: "Portugal",    priority: 55 },
  { apiLeagueId: 40,  name: "Championship",             country: "England",     priority: 50 },

  // ══════════════════════════════════════════════
  // 유럽 대륙 대회
  // ══════════════════════════════════════════════
  { apiLeagueId: 2,   name: "UEFA Champions League",    country: "World",       priority: 98 },
  { apiLeagueId: 3,   name: "UEFA Europa League",       country: "World",       priority: 88 },
  { apiLeagueId: 848, name: "UEFA Europa Conference League", country: "World",  priority: 78 },
  { apiLeagueId: 531, name: "UEFA Super Cup",           country: "World",       priority: 30 },

  // ══════════════════════════════════════════════
  // 잉글랜드 컵
  // ══════════════════════════════════════════════
  { apiLeagueId: 45,  name: "FA Cup",                   country: "England",     priority: 45 },
  { apiLeagueId: 48,  name: "EFL Cup (Carabao Cup)",    country: "England",     priority: 40 },

  // ══════════════════════════════════════════════
  // 스페인 컵
  // ══════════════════════════════════════════════
  { apiLeagueId: 143, name: "Copa del Rey",             country: "Spain",       priority: 44 },

  // ══════════════════════════════════════════════
  // 독일 컵
  // ══════════════════════════════════════════════
  { apiLeagueId: 81,  name: "DFB Pokal",                country: "Germany",     priority: 43 },

  // ══════════════════════════════════════════════
  // 이탈리아 컵
  // ══════════════════════════════════════════════
  { apiLeagueId: 137, name: "Coppa Italia",             country: "Italy",       priority: 42 },

  // ══════════════════════════════════════════════
  // 프랑스 컵
  // ══════════════════════════════════════════════
  { apiLeagueId: 66,  name: "Coupe de France",          country: "France",      priority: 41 },

  // ══════════════════════════════════════════════
  // 한국 컵
  // ══════════════════════════════════════════════
  { apiLeagueId: 294, name: "Korean FA Cup",            country: "South Korea", priority: 38 },

  // ══════════════════════════════════════════════
  // 아시아 대회
  // ══════════════════════════════════════════════
  { apiLeagueId: 17,  name: "AFC Champions League",     country: "World",       priority: 48 },
  { apiLeagueId: 18,  name: "AFC Cup",                  country: "World",       priority: 35 },

  // ══════════════════════════════════════════════
  // 일본 컵
  // ══════════════════════════════════════════════
  { apiLeagueId: 99,  name: "Emperor's Cup",            country: "Japan",       priority: 36 },
];

async function main() {
  console.log("\n🏟️ Soccer-Brain 리그 + 컵대회 등록\n");

  let added = 0;
  let skipped = 0;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // 캘린더 연도 리그/컵
  const calendarYearLeagues = new Set([292, 293, 98, 99, 294, 17, 18]);

  for (const league of LEAGUES) {
    const existing = await prisma.league.findUnique({
      where: { apiLeagueId: league.apiLeagueId },
    });

    if (existing) {
      await prisma.league.update({
        where: { apiLeagueId: league.apiLeagueId },
        data: {
          priority: league.priority,
          enabled: true,
          name: league.name,
          country: league.country,
        },
      });
      console.log(`  ⏭️ ${league.name} (${league.apiLeagueId}) — 이미 존재, 설정 업데이트`);
      skipped++;
    } else {
      const season = calendarYearLeagues.has(league.apiLeagueId)
        ? year
        : (month >= 7 ? year : year - 1);

      await prisma.league.create({
        data: {
          apiLeagueId: league.apiLeagueId,
          name: league.name,
          country: league.country,
          season,
          enabled: true,
          priority: league.priority,
        },
      });
      console.log(`  ✅ ${league.name} (${league.apiLeagueId}) — 추가 완료 (시즌 ${season})`);
      added++;
    }
  }

  console.log(`\n📊 결과: ${added}개 추가, ${skipped}개 기존 업데이트`);

  // 현재 전체 목록
  const allLeagues = await prisma.league.findMany({
    where: { enabled: true },
    orderBy: { priority: "desc" },
    select: { apiLeagueId: true, name: true, country: true, priority: true },
  });

  const cupIds = new Set([2, 3, 848, 531, 45, 48, 143, 81, 137, 66, 294, 17, 18, 99]);

  console.log("\n📋 등록된 전체 리그/컵:");
  console.log("─".repeat(60));
  for (const l of allLeagues) {
    const type = cupIds.has(l.apiLeagueId) ? "🏆" : "⚽";
    console.log(`  ${type} [${l.apiLeagueId}] ${l.name} (${l.country}) — P${l.priority}`);
  }

  console.log(`\n✅ 총 ${allLeagues.length}개 리그/컵 활성화!`);
  console.log(`   이제 백필을 실행하세요: npx tsx scripts/overnight-backfill.ts\n`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ 오류:", e);
  await prisma.$disconnect();
  process.exit(1);
});
