import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchHistoricalMatchesWithResults, isApiConfigured } from "./api-football";

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

  // New endpoint: Fetch real historical matches from API
  app.get("/api/training-data", async (req, res) => {
    try {
      if (!isApiConfigured()) {
        return res.status(400).json({ error: "API not configured" });
      }
      
      const matches = await fetchHistoricalMatchesWithResults();
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

  return httpServer;
}
