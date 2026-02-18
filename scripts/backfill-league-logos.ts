/**
 * League logoUrl 백필 스크립트
 * API-Football /leagues 엔드포인트에서 enabled 리그의 로고 URL을 수집하여 DB 업데이트
 */
import { PrismaClient } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();

const API_BASE_URL = "https://v3.football.api-sports.io";
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "x-apisports-key": process.env.API_SPORTS_KEY || "" },
});

async function main() {
  // 1. enabled 리그 조회
  const leagues = await prisma.league.findMany({
    where: { enabled: true },
    select: { id: true, apiLeagueId: true, name: true, logoUrl: true },
  });
  console.log(`[League Logo] enabled 리그 ${leagues.length}개`);

  // 2. API-Football에서 리그 정보 수집 (한 번의 호출로 모든 리그 가져오기)
  const apiLeagueIds = leagues.map(l => l.apiLeagueId);
  const logoMap = new Map<number, string>();

  // API-Football /leagues는 id 파라미터로 한 건씩만 가능하므로, 시즌별로 호출
  // 대신 current=true 로 현재 시즌 전체를 가져올 수 있음
  const resp = await apiClient.get("/leagues", { params: { current: "true" } });
  const apiLeagues = resp.data?.response || [];
  console.log(`[League Logo] API 응답 리그 수: ${apiLeagues.length}`);

  for (const item of apiLeagues) {
    const apiId = item.league?.id;
    const logo = item.league?.logo;
    if (apiId && logo) {
      logoMap.set(apiId, logo);
    }
  }

  // 3. DB 업데이트
  let updated = 0;
  let skipped = 0;
  for (const league of leagues) {
    const logo = logoMap.get(league.apiLeagueId);
    if (logo) {
      await prisma.league.update({
        where: { id: league.id },
        data: { logoUrl: logo },
      });
      updated++;
      console.log(`  ✓ ${league.name} (apiId=${league.apiLeagueId}) → ${logo}`);
    } else {
      skipped++;
      console.log(`  ✗ ${league.name} (apiId=${league.apiLeagueId}) — API 응답에 없음`);
    }
  }

  console.log(`\n[League Logo] 완료: 업데이트 ${updated}건, 스킵 ${skipped}건`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
