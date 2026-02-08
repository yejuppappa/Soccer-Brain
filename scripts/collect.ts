/**
 * 🤖 Soccer Brain 독립 데이터 수집기
 * 
 * GitHub Actions 또는 CLI에서 직접 실행 가능.
 * Express 서버 없이 Neon DB + API-Football만으로 동작.
 * 
 * 사용법:
 *   npx tsx scripts/collect.ts <task> [task2] [task3]
 * 
 * 가능한 태스크:
 *   fixtures    - 경기 일정 동기화
 *   standings   - 순위표 동기화
 *   odds        - 배당 + 북메이커 스냅샷
 *   results     - 경기 결과 + 통계
 *   injuries    - 부상자 명단
 *   lineups     - 라인업
 *   weather     - 날씨 업데이트
 *   domestic    - 국내배당 (Puppeteer → 환산 폴백)
 *   all         - 전부 실행 (domestic 제외)
 * 
 * 예시:
 *   npx tsx scripts/collect.ts odds              # 배당만
 *   npx tsx scripts/collect.ts standings odds     # 순위 + 배당
 *   npx tsx scripts/collect.ts all                # 전체
 */

import { prisma } from "../server/db";
import {
  syncFixtures,
  syncStandings,
  syncOddsWithHistory,
  syncResultsAndStats,
  syncInjuries,
  syncLineups,
  syncWeatherUpdates,
} from "../server/unified-scheduler";

const TASKS: Record<string, () => Promise<any>> = {
  fixtures: syncFixtures,
  standings: syncStandings,
  odds: syncOddsWithHistory,
  results: syncResultsAndStats,
  injuries: syncInjuries,
  lineups: syncLineups,
  weather: syncWeatherUpdates,
  domestic: async () => {
    const { syncDomesticOdds } = await import("../server/betman");
    return syncDomesticOdds();
  },
};

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("사용법: npx tsx scripts/collect.ts <task> [task2] ...");
    console.log("태스크:", Object.keys(TASKS).join(", "), ", all");
    process.exit(1);
  }

  // "all" → domestic 제외 전부
  const taskNames = args.includes("all")
    ? Object.keys(TASKS).filter((t) => t !== "domestic")
    : args;

  const unknown = taskNames.filter((t) => !TASKS[t]);
  if (unknown.length > 0) {
    console.error(`❌ 알 수 없는 태스크: ${unknown.join(", ")}`);
    process.exit(1);
  }

  console.log(`\n🤖 Soccer Brain 수집기 시작`);
  console.log(`📋 태스크: ${taskNames.join(", ")}`);
  console.log(`⏰ ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}\n`);

  const results: Record<string, { ok: boolean; data?: any; error?: string; ms: number }> = {};

  for (const name of taskNames) {
    const start = Date.now();
    try {
      const data = await TASKS[name]();
      results[name] = { ok: true, data, ms: Date.now() - start };
      console.log(`✅ ${name}: ${JSON.stringify(data)} (${results[name].ms}ms)`);
    } catch (err: any) {
      results[name] = { ok: false, error: err.message, ms: Date.now() - start };
      console.error(`❌ ${name}: ${err.message} (${results[name].ms}ms)`);
    }
  }

  // 요약
  const succeeded = Object.values(results).filter((r) => r.ok).length;
  const failed = Object.values(results).filter((r) => !r.ok).length;
  console.log(`\n📊 완료: ${succeeded} 성공, ${failed} 실패\n`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("💥 치명적 오류:", err);
  await prisma.$disconnect();
  process.exit(1);
});
