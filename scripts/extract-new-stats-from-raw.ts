/**
 * Phase A: 기존 raw JSON에서 4개 신규 필드 추출 + 업데이트
 * - shotsInsideBox
 * - shotsOutsideBox
 * - blockedShots
 * - goalsPrevented
 */

import { prisma } from "../server/db.js";
import { normalizeTeamStats } from "../server/utils/normalizeTeamStats.js";
import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
const PROGRESS_LOG = path.join(LOG_DIR, "extract-new-stats-progress.log");

// 로그 디렉토리 생성
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(PROGRESS_LOG, logMessage);
}

async function main() {
  const startTime = Date.now();

  log("╔══════════════════════════════════════════════════════════════╗");
  log("║   Phase A: 기존 raw JSON에서 4개 신규 필드 추출           ║");
  log("╚══════════════════════════════════════════════════════════════╝");

  // Step 1: raw가 있는 모든 FixtureTeamStatSnapshot 조회
  log("\n=== raw JSON이 있는 레코드 조회 ===");

  const records = await prisma.fixtureTeamStatSnapshot.findMany({
    where: {
      raw: { not: null },
    },
    select: {
      id: true,
      raw: true,
    },
  });

  log(`총 ${records.length}개 레코드 발견`);

  if (records.length === 0) {
    log("✅ 업데이트할 레코드 없음");
    await prisma.$disconnect();
    return;
  }

  // Step 2: 각 레코드의 raw에서 statistics 추출 + 업데이트
  log("\n=== 신규 필드 추출 시작 ===");

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    try {
      const rawData = record.raw as any;
      const statistics = rawData?.statistics || [];

      if (statistics.length === 0) {
        skippedCount++;
        continue;
      }

      // normalizeTeamStats로 파싱
      const { normalized } = normalizeTeamStats(statistics);

      // 4개 필드만 추출
      const shotsInsideBox = normalized.shotsInsideBox ?? null;
      const shotsOutsideBox = normalized.shotsOutsideBox ?? null;
      const blockedShots = normalized.blockedShots ?? null;
      const goalsPrevented = normalized.goalsPrevented ?? null;

      // 하나라도 값이 있으면 업데이트
      if (
        shotsInsideBox !== null ||
        shotsOutsideBox !== null ||
        blockedShots !== null ||
        goalsPrevented !== null
      ) {
        await prisma.fixtureTeamStatSnapshot.update({
          where: { id: record.id },
          data: {
            shotsInsideBox,
            shotsOutsideBox,
            blockedShots,
            goalsPrevented,
          },
        });

        updatedCount++;
      } else {
        skippedCount++;
      }

      // 100개마다 진행률 로그
      if ((i + 1) % 100 === 0 || i === records.length - 1) {
        const progress = ((i + 1) / records.length * 100).toFixed(1);
        const elapsed = (Date.now() - startTime) / 1000 / 60;
        const eta = (elapsed / (i + 1)) * (records.length - i - 1);

        log(
          `[${i + 1}/${records.length}] ${progress}% | ` +
          `업데이트: ${updatedCount} | 스킵: ${skippedCount} | ` +
          `경과: ${elapsed.toFixed(1)}분 | ETA: ${eta.toFixed(1)}분`
        );
      }
    } catch (error: any) {
      errorCount++;
      console.error(`❌ Record ${record.id} 처리 실패: ${error.message}`);
    }
  }

  // 최종 결과
  const totalTime = (Date.now() - startTime) / 1000 / 60;

  log("\n╔══════════════════════════════════════════════════════════════╗");
  log("║                     추출 완료                                   ║");
  log("╚══════════════════════════════════════════════════════════════╝");
  log(`총 레코드 수: ${records.length}`);
  log(`업데이트: ${updatedCount}`);
  log(`스킵: ${skippedCount} (신규 필드 없음)`);
  log(`에러: ${errorCount}`);
  log(`성공률: ${((updatedCount / records.length) * 100).toFixed(1)}%`);
  log(`총 소요 시간: ${totalTime.toFixed(1)}분`);

  await prisma.$disconnect();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  log("\n\n🛑 사용자에 의해 중단됨");
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log("\n\n🛑 시스템에 의해 중단됨");
  await prisma.$disconnect();
  process.exit(0);
});

main().catch((e) => {
  log(`\n❌ 치명적 오류: ${e.message}`);
  console.error(e);
  process.exit(1);
});
