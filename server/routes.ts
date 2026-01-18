import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/matches", async (req, res) => {
    try {
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
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch matches" });
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

  return httpServer;
}
