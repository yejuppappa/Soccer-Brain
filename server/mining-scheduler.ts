import cron from "node-cron";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import type { StandardizedMatch, MiningState, MiningLogEntry, MiningStatus } from "@shared/schema";
import { fetchCompletedFixtures, fetchStandingsForSeason, fetchFixtureStatistics } from "./api-football";
import { transformRawToStandardized, isAlreadyCollected } from "./data-transformer";

const TRAINING_SET_PATH = path.join(process.cwd(), "training_set.json");
const MINING_STATE_PATH = path.join(process.cwd(), "mining_state.json");
const SAFE_MODE_THRESHOLD = 5;
const DAILY_COLLECTION_LIMIT = 70000;

let miningState: MiningState = {
  lastRunTime: null,
  lastStatus: null,
  lastMessage: null,
  totalCollectedToday: 0,
  isRunning: false,
  logs: [],
};

function loadMiningState(): void {
  try {
    if (fs.existsSync(MINING_STATE_PATH)) {
      const data = fs.readFileSync(MINING_STATE_PATH, "utf-8");
      const loaded = JSON.parse(data);
      miningState = { ...miningState, ...loaded };
      
      const today = new Date().toISOString().split('T')[0];
      const lastRunDate = miningState.lastRunTime?.split('T')[0];
      if (lastRunDate !== today) {
        miningState.totalCollectedToday = 0;
      }
      
      miningState.logs = miningState.logs.slice(-20);
    }
  } catch (error) {
    console.log("[Mining] No existing mining state found, starting fresh");
  }
}

function saveMiningState(): void {
  try {
    fs.writeFileSync(MINING_STATE_PATH, JSON.stringify(miningState, null, 2));
  } catch (error) {
    console.error("[Mining] Failed to save mining state:", error);
  }
}

function loadTrainingSet(): StandardizedMatch[] {
  try {
    if (fs.existsSync(TRAINING_SET_PATH)) {
      const data = fs.readFileSync(TRAINING_SET_PATH, "utf-8");
      const parsed = JSON.parse(data);
      
      if (Array.isArray(parsed)) {
        return parsed.filter((m: any) => m.source_id || m.id);
      }
      if (parsed.matches && Array.isArray(parsed.matches)) {
        return parsed.matches;
      }
    }
  } catch (error) {
    console.error("[Mining] Failed to load training set:", error);
  }
  return [];
}

function saveTrainingSet(matches: StandardizedMatch[]): void {
  try {
    fs.writeFileSync(TRAINING_SET_PATH, JSON.stringify(matches, null, 2));
  } catch (error) {
    console.error("[Mining] Failed to save training set:", error);
  }
}

function addLogEntry(
  status: MiningStatus,
  message: string,
  matchesCollected: number = 0,
  duplicatesSkipped: number = 0,
  quotaRemaining: number = -1
): void {
  const entry: MiningLogEntry = {
    timestamp: new Date().toISOString(),
    status,
    message,
    matchesCollected,
    duplicatesSkipped,
    quotaRemaining,
  };
  
  miningState.logs.push(entry);
  miningState.logs = miningState.logs.slice(-20);
  miningState.lastRunTime = entry.timestamp;
  miningState.lastStatus = status;
  miningState.lastMessage = message;
  
  saveMiningState();
}

async function checkRateLimitSafe(): Promise<{ safe: boolean; remaining: number }> {
  const apiKey = process.env.API_SPORTS_KEY || "";
  if (!apiKey) return { safe: false, remaining: 0 };

  // ✅ remaining이 이 값보다 작으면 안전모드
  // (너가 원하는 값으로 조절 가능)
  const THRESHOLD = SAFE_MODE_THRESHOLD;

  try {
    // 1) 먼저 /status로 시도
    const statusRes = await axios.get("https://v3.football.api-sports.io/status", {
      headers: { "x-apisports-key": apiKey },
      timeout: 20000,
    });

    const statusRemaining = statusRes.data?.response?.requests?.remaining;
    if (Number.isFinite(Number(statusRemaining))) {
      const remaining = Number(statusRemaining);
      console.log(`[Mining] API quota remaining (status): ${remaining}`);
      return { safe: remaining >= THRESHOLD, remaining };
    }

    // 2) /status에서 remaining을 못 얻으면: 실제 엔드포인트 1번 호출해서 헤더로 확인
    const r = await axios.get("https://v3.football.api-sports.io/fixtures", {
      headers: { "x-apisports-key": apiKey },
      params: { league: 39, season: 2023, from: "2024-03-16", to: "2024-03-16" },
      timeout: 20000,
    });

    const h = r.headers ?? {};

    const remainingRaw =
      h["x-ratelimit-remaining"] ??
      h["x-rate-limit-remaining"] ??
      h["ratelimit-remaining"] ??
      h["x-requests-remaining"] ??
      h["requests-remaining"];

    const remaining = Number(remainingRaw);

    if (!Number.isFinite(remaining)) {
      // ✅ 헤더도 못 읽으면 "0"으로 처리하면 지금처럼 오작동하니까
      // 개발중엔 그냥 safe로 두자
      console.log("[Mining] RateLimit header missing; skipping safe-mode check");
      return { safe: true, remaining: 9999 };
    }

    console.log(`[Mining] API quota remaining (header): ${remaining}`);
    return { safe: remaining >= THRESHOLD, remaining };
  } catch (error: any) {
    console.error("[Mining] Rate limit check failed:", error?.message || error);
    return { safe: false, remaining: 0 };
  }
}


function getDateRangeForCollection(): { from: string; to: string } {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  
  return {
    from: "2023-08-11",
    to: "2024-05-19",
  };
}

async function runMiningTask(): Promise<void> {
  if (miningState.isRunning) {
    console.log("[Mining] Mining already in progress, skipping");
    return;
  }

  if (!process.env.API_SPORTS_KEY) {
    addLogEntry('error', 'API key not configured');
    console.log("[Mining] API key not configured, skipping mining");
    return;
  }

  miningState.isRunning = true;
  saveMiningState();

  console.log("[Mining] Starting automated mining task...");
  
  try {
    const rateCheck = await checkRateLimitSafe();
    
    if (!rateCheck.safe) {
      addLogEntry('safe_mode', `안전 모드 발동: API 한도 ${rateCheck.remaining}회 미만`, 0, 0, rateCheck.remaining);
      console.log("[Mining] SAFE MODE: API quota below threshold, stopping");
      miningState.isRunning = false;
      saveMiningState();
      return;
    }

    const existingMatches = loadTrainingSet();
    const existingSourceIds = new Set(existingMatches.map(m => m.source_id || m.id?.replace('std-', '')));
    
    console.log(`[Mining] Existing training set has ${existingMatches.length} matches`);

    const dateRange = getDateRangeForCollection();
    const standings = await fetchStandingsForSeason(2023);
    
    const monthRanges = [
      { from: "2023-08-11", to: "2023-08-31" },
      { from: "2023-09-01", to: "2023-09-30" },
      { from: "2023-10-01", to: "2023-10-31" },
      { from: "2023-11-01", to: "2023-11-30" },
      { from: "2023-12-01", to: "2023-12-31" },
      { from: "2024-01-01", to: "2024-01-31" },
      { from: "2024-02-01", to: "2024-02-29" },
      { from: "2024-03-01", to: "2024-03-31" },
      { from: "2024-04-01", to: "2024-04-30" },
      { from: "2024-05-01", to: "2024-05-19" },
    ];

    let newCollected = 0;
    let duplicatesSkipped = 0;
    const newMatches: StandardizedMatch[] = [];
    const dailyLimit = DAILY_COLLECTION_LIMIT - miningState.totalCollectedToday;

    for (const range of monthRanges) {
      if (newCollected >= dailyLimit) {
        console.log(`[Mining] Daily limit reached (${dailyLimit}), stopping`);
        break;
      }

      const latestCheck = await checkRateLimitSafe();
      if (!latestCheck.safe) {
        addLogEntry('safe_mode', `안전 모드 발동 (수집 중): 남은 한도 ${latestCheck.remaining}`, newCollected, duplicatesSkipped, latestCheck.remaining);
        break;
      }

      try {
        const rawFixtures = await fetchCompletedFixtures(range.from, range.to, 2023);
        
        for (const raw of rawFixtures) {
          if (newCollected >= dailyLimit) break;
          
          const sourceId = String(raw.fixtureId);
          if (existingSourceIds.has(sourceId)) {
            duplicatesSkipped++;
            continue;
          }

          const homeStanding = standings.get(raw.homeTeamId);
          const awayStanding = standings.get(raw.awayTeamId);

          const standardized = transformRawToStandardized(
            raw,
            homeStanding?.rank || 10,
            awayStanding?.rank || 10,
            homeStanding?.form || "DDDDD",
            awayStanding?.form || "DDDDD"
          );

          newMatches.push(standardized);
          existingSourceIds.add(sourceId);
          newCollected++;
        }
      } catch (error: any) {
        console.error(`[Mining] Error fetching range ${range.from}-${range.to}:`, error.message);
      }
    }

    if (newMatches.length > 0) {
      const allMatches = [...existingMatches, ...newMatches];
      saveTrainingSet(allMatches);
      miningState.totalCollectedToday += newCollected;
    }

    const finalCheck = await checkRateLimitSafe();
    addLogEntry(
      'success',
      `자동 수집 완료: ${newCollected}개 신규, ${duplicatesSkipped}개 중복 스킵`,
      newCollected,
      duplicatesSkipped,
      finalCheck.remaining
    );

    console.log(`[Mining] Completed: ${newCollected} new, ${duplicatesSkipped} skipped`);

  } catch (error: any) {
    addLogEntry('error', `수집 오류: ${error.message}`);
    console.error("[Mining] Mining task failed:", error);
  } finally {
    miningState.isRunning = false;
    saveMiningState();
  }
}

export function getMiningState(): MiningState {
  loadMiningState();
  return { ...miningState };
}

export function initMiningScheduler(): void {
  loadMiningState();
  
  console.log("[Mining] Scheduling daily mining task at 00:00 UTC");
  cron.schedule("0 0 * * *", () => {
    console.log("[Mining] Cron triggered: Starting daily mining");
    miningState.totalCollectedToday = 0;
    runMiningTask();
  }, {
    timezone: "UTC"
  });

  //console.log("[Mining] Running initial mining check on server start...");
  //setTimeout(() => {
  //  runMiningTask();
  //}, 5000);
}

export async function triggerManualMining(): Promise<MiningState> {
  await runMiningTask();
  return getMiningState();
}
