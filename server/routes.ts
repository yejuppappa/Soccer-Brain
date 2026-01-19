import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchHistoricalMatchesWithResults, fetchCompletedFixtures, fetchStandingsForSeason, isApiConfigured, fetchBatchFixtures } from "./api-football";
import { 
  loadTrainingData, 
  saveTrainingData, 
  getExistingFixtureIds, 
  getTrainingDataStats,
  getMatchesWithoutStats,
  enrichMatchWithData,
  DAILY_QUOTA,
  type StoredTrainingMatch,
  type CollectionResult,
  type EnrichedData,
} from "./training-data-manager";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/matches", async (req, res) => {
    try {
      await storage.refreshMatchesFromApi();
      
      const matches = await storage.getMatches();
      const today = new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });
      
      res.json({
        matches,
        date: today,
        apiError: null,
      });
    } catch (error: any) {
      const errorMessage = error?.message || "Unknown error";
      console.error("[Routes] /api/matches error:", errorMessage);
      
      res.status(500).json({ 
        error: "API_ERROR",
        apiError: errorMessage,
        matches: [],
        date: new Date().toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        }),
      });
    }
  });

  app.get("/api/matches/:id/analysis", async (req, res) => {
    try {
      const { id } = req.params;
      const analysis = await storage.getMatchAnalysis(id);
      
      if (!analysis) {
        return res.status(404).json({ error: "Match not found" });
      }
      
      res.json({ analysis });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch match analysis" });
    }
  });

  app.get("/api/historical-matches", async (req, res) => {
    try {
      const matches = await storage.getHistoricalMatches();
      res.json({ matches });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch historical matches" });
    }
  });

  app.post("/api/backtest", async (req, res) => {
    try {
      const result = await storage.runBacktest();
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: "Failed to run backtest" });
    }
  });

  // Training data endpoint: Load from training_set.json (synced with data collection)
  app.get("/api/training-data", async (req, res) => {
    try {
      // Load from training_set.json with auto-deduplication
      const storedData = await loadTrainingData();
      
      // Convert stored format to training format for frontend
      const matches = storedData.matches.map(m => ({
        id: m.fixtureId,
        homeTeam: { name: m.homeTeam, ranking: m.homeRank, form: m.homeForm },
        awayTeam: { name: m.awayTeam, ranking: m.awayRank, form: m.awayForm },
        date: m.date,
        venue: m.venue,
        actualResult: m.actualResult,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      }));
      
      console.log(`[Routes] Training data loaded: ${matches.length} unique matches from training_set.json`);
      res.json({ matches, count: matches.length });
    } catch (error: any) {
      console.error("[Routes] Training data fetch error:", error.message);
      res.status(500).json({ error: error.message || "Failed to fetch training data" });
    }
  });

  // New endpoint: Run training with real API data
  app.post("/api/train", async (req, res) => {
    try {
      if (!isApiConfigured()) {
        return res.status(400).json({ error: "API not configured" });
      }
      
      console.log("[Routes] Starting training with real API data...");
      const matches = await fetchHistoricalMatchesWithResults();
      
      if (matches.length === 0) {
        return res.status(400).json({ error: "No training data available" });
      }
      
      const result = await storage.runTrainingWithRealData(matches);
      res.json({ result });
    } catch (error: any) {
      console.error("[Routes] Training error:", error.message);
      res.status(500).json({ error: error.message || "Failed to run training" });
    }
  });

  // Get current training data stats
  app.get("/api/training-set/stats", async (req, res) => {
    try {
      const stats = await getTrainingDataStats();
      res.json(stats);
    } catch (error: any) {
      console.error("[Routes] Training set stats error:", error.message);
      res.status(500).json({ error: error.message || "Failed to get training set stats" });
    }
  });

  // Get all stored training data
  app.get("/api/training-set", async (req, res) => {
    try {
      const data = await loadTrainingData();
      res.json(data);
    } catch (error: any) {
      console.error("[Routes] Training set load error:", error.message);
      res.status(500).json({ error: error.message || "Failed to load training set" });
    }
  });

  // Download training data as backup file
  app.get("/api/training-set/download", async (req, res) => {
    try {
      const data = await loadTrainingData();
      
      if (data.totalMatches === 0) {
        return res.status(404).json({ error: "NO_DATA", message: "백업할 데이터가 없습니다" });
      }
      
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `soccer_ai_backup_${dateStr}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify(data, null, 2));
    } catch (error: any) {
      console.error("[Routes] Training set download error:", error.message);
      res.status(500).json({ error: error.message || "Failed to download training set" });
    }
  });

  // Batch enrich data with statistics and lineups (10 matches per API call)
  // Optimized: 1 API call = 10 matches, 100 calls/day = 1000+ matches
  app.post("/api/enrich-data", async (req, res) => {
    const BATCH_SIZE = 10; // 10 matches per API call
    const MAX_BATCHES = 10; // Max 10 batches = 100 matches per run
    
    try {
      if (!isApiConfigured()) {
        return res.status(400).json({ error: "API not configured" });
      }
      
      const logs: string[] = [];
      logs.push("배치 고도화 시작...");
      
      // Load training data
      const trainingData = await loadTrainingData();
      const allMatchesToEnrich = getMatchesWithoutStats(trainingData, BATCH_SIZE * MAX_BATCHES);
      
      if (allMatchesToEnrich.length === 0) {
        logs.push("이미 모든 데이터가 고품질입니다!");
        return res.json({
          enriched: 0,
          errors: 0,
          total: trainingData.totalMatches,
          logs,
        });
      }
      
      // Split into chunks of 10
      const chunks: typeof allMatchesToEnrich[] = [];
      for (let i = 0; i < allMatchesToEnrich.length; i += BATCH_SIZE) {
        chunks.push(allMatchesToEnrich.slice(i, i + BATCH_SIZE));
      }
      
      logs.push(`고도화 대상: ${allMatchesToEnrich.length}개 경기 (${chunks.length}개 배치)`);
      logs.push(`배치 크기: ${BATCH_SIZE}개씩, API 호출: ${chunks.length}회 예정`);
      
      let enriched = 0;
      let errors = 0;
      
      for (let batchIndex = 0; batchIndex < chunks.length; batchIndex++) {
        const chunk = chunks[batchIndex];
        const fixtureIds = chunk.map(m => m.fixtureId);
        const processed = (batchIndex + 1) * BATCH_SIZE;
        const total = allMatchesToEnrich.length;
        
        logs.push(`\n배치 처리 중... (${Math.min(processed, total)}/${total})`);
        logs.push(`  IDs: ${fixtureIds.join(", ")}`);
        
        try {
          // Single API call for batch of fixtures
          const batchData = await fetchBatchFixtures(fixtureIds);
          
          // 1 second delay between batches to avoid rate limiting
          if (batchIndex < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Merge each fixture's data
          for (const data of batchData) {
            const match = chunk.find(m => m.fixtureId === data.fixtureId);
            if (!match) continue;
            
            const enrichedData: EnrichedData = {
              statistics: data.statistics,
              lineups: data.lineups,
              enrichedAt: new Date().toISOString(),
            };
            
            const success = await enrichMatchWithData(trainingData, data.fixtureId, enrichedData);
            
            if (success) {
              enriched++;
              const hasStats = data.statistics.length > 0;
              const hasLineups = data.lineups.length > 0;
              logs.push(`  ✅ ${match.homeTeam} vs ${match.awayTeam}: 통계=${hasStats ? '있음' : '없음'}, 라인업=${hasLineups ? '있음' : '없음'}`);
            } else {
              errors++;
            }
          }
          
          // Check for fixtures that weren't in the response
          const returnedIds = new Set(batchData.map(d => d.fixtureId));
          for (const match of chunk) {
            if (!returnedIds.has(match.fixtureId)) {
              errors++;
              logs.push(`  ⚠️ ${match.homeTeam} vs ${match.awayTeam}: 데이터 없음 (ID: ${match.fixtureId})`);
            }
          }
          
        } catch (error: any) {
          errors += chunk.length;
          logs.push(`  ❌ 배치 API 오류: ${error.message}`);
        }
      }
      
      // Save updated training data
      await saveTrainingData(trainingData);
      
      logs.push(`\n=============================`);
      logs.push(`고도화 완료!`);
      logs.push(`  업그레이드: ${enriched}개 경기`);
      logs.push(`  API 호출: ${chunks.length}회 (예상 비용 절감: ${(allMatchesToEnrich.length * 2) - chunks.length}회)`);
      if (errors > 0) {
        logs.push(`  오류: ${errors}건`);
      }
      
      res.json({
        enriched,
        errors,
        total: trainingData.totalMatches,
        logs,
      });
    } catch (error: any) {
      console.error("[Routes] Enrich data error:", error.message);
      res.status(500).json({ error: error.message || "Failed to enrich data" });
    }
  });

  // Smart data collection with deduplication
  app.post("/api/collect-data", async (req, res) => {
    try {
      if (!isApiConfigured()) {
        return res.status(400).json({ error: "API not configured" });
      }
      
      const logs: string[] = [];
      logs.push("데이터 수집 시작...");
      
      // Load existing training data
      const trainingData = await loadTrainingData();
      const existingIds = getExistingFixtureIds(trainingData);
      logs.push(`기존 저장된 경기: ${existingIds.size}개`);
      
      // Define date ranges for 2023-24 season (August 2023 to May 2024)
      // We'll use multiple smaller date ranges to avoid hitting API limits
      const dateRanges = [
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
      
      // Fetch standings once for the season
      const standings = await fetchStandingsForSeason(2023);
      
      let newlySaved = 0;
      let skippedDuplicates = 0;
      let totalChecked = 0;
      let errors = 0;
      
      for (const range of dateRanges) {
        if (newlySaved >= DAILY_QUOTA) {
          logs.push(`일일 할당량 (${DAILY_QUOTA}개) 도달. 수집 중단.`);
          break;
        }
        
        try {
          logs.push(`${range.from} ~ ${range.to} 기간 확인 중...`);
          const fixtures = await fetchCompletedFixtures(range.from, range.to, 2023);
          
          for (const fixture of fixtures) {
            if (newlySaved >= DAILY_QUOTA) break;
            
            totalChecked++;
            
            // Check for duplicate
            if (existingIds.has(fixture.fixtureId)) {
              skippedDuplicates++;
              continue;
            }
            
            // Get team standings
            const homeStanding = standings.get(fixture.homeTeamId);
            const awayStanding = standings.get(fixture.awayTeamId);
            
            // Create new training match entry
            const newMatch: StoredTrainingMatch = {
              fixtureId: fixture.fixtureId,
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              homeScore: fixture.homeScore,
              awayScore: fixture.awayScore,
              actualResult: fixture.actualResult,
              date: fixture.date,
              venue: fixture.venue,
              homeRank: homeStanding?.rank || 10,
              awayRank: awayStanding?.rank || 10,
              homeForm: homeStanding?.form || "DDDDD",
              awayForm: awayStanding?.form || "DDDDD",
              collectedAt: new Date().toISOString(),
            };
            
            trainingData.matches.push(newMatch);
            existingIds.add(fixture.fixtureId);
            newlySaved++;
          }
        } catch (error: any) {
          errors++;
          logs.push(`${range.from} ~ ${range.to} 기간 오류: ${error.message}`);
        }
      }
      
      // Save updated training data
      if (newlySaved > 0) {
        await saveTrainingData(trainingData);
        logs.push(`training_set.json 저장 완료`);
      }
      
      logs.push(`총 ${totalChecked}개 경기 확인 완료`);
      logs.push(`${newlySaved}개 신규 저장, ${skippedDuplicates}개 중복 건너뜀`);
      
      const result: CollectionResult = {
        totalChecked,
        newlySaved,
        skippedDuplicates,
        errors,
        logs,
        quotaRemaining: DAILY_QUOTA - newlySaved,
      };
      
      res.json(result);
    } catch (error: any) {
      console.error("[Routes] Data collection error:", error.message);
      res.status(500).json({ error: error.message || "Failed to collect data" });
    }
  });

  return httpServer;
}
