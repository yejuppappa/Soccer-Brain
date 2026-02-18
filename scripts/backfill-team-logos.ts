/**
 * Team logoUrl null 백필 스크립트
 * logoUrl이 null인 팀들의 로고를 API-Football에서 수집하여 업데이트
 */
import { PrismaClient } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();

const API_BASE_URL = "https://v3.football.api-sports.io";
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "x-apisports-key": process.env.API_SPORTS_KEY || "" },
});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // 1. logoUrl IS NULL 건수 파악
  const nullCount = await prisma.team.count({ where: { logoUrl: null } });
  console.log(`[Team Logo] logoUrl이 null인 팀: ${nullCount}건`);

  if (nullCount === 0) {
    console.log("[Team Logo] 백필할 팀 없음. 종료.");
    return;
  }

  // 2. null인 팀 목록 조회
  const teamsWithNull = await prisma.team.findMany({
    where: { logoUrl: null },
    select: { id: true, apiTeamId: true, name: true },
  });

  // 100건 이상이면 보고만
  if (teamsWithNull.length > 100) {
    console.log(`[Team Logo] ⚠ ${teamsWithNull.length}건 — 100건 초과로 보고만 합니다.`);
    console.log("[Team Logo] 수동 실행이 필요합니다 (DRY_RUN=false 환경변수 설정).");
    if (process.env.DRY_RUN !== "false") {
      return;
    }
  }

  // 3. API-Football로 로고 URL 수집 & 업데이트
  let updated = 0;
  let failed = 0;

  for (const team of teamsWithNull) {
    try {
      const resp = await apiClient.get("/teams", { params: { id: team.apiTeamId } });
      const logo = resp.data?.response?.[0]?.team?.logo;

      if (logo) {
        await prisma.team.update({
          where: { id: team.id },
          data: { logoUrl: logo },
        });
        updated++;
        console.log(`  ✓ ${team.name} (apiTeamId=${team.apiTeamId}) → ${logo}`);
      } else {
        failed++;
        console.log(`  ✗ ${team.name} (apiTeamId=${team.apiTeamId}) — API에 로고 없음`);
      }

      // rate limiting: 150ms 간격
      await sleep(150);
    } catch (err: any) {
      failed++;
      console.log(`  ✗ ${team.name} (apiTeamId=${team.apiTeamId}) — 에러: ${err.message}`);
      await sleep(500);
    }
  }

  console.log(`\n[Team Logo] 완료: 업데이트 ${updated}건, 실패 ${failed}건`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
