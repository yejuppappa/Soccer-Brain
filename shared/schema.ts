import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Match and Team Types for Soccer Win Rate Simulator

export interface Team {
  id: string;
  name: string;
  shortName: string;
  leagueRank: number;
  recentResults: ('W' | 'D' | 'L')[]; // Last 5 matches
  topScorer: {
    name: string;
    goals: number;
    isInjured: boolean;
  };
  lastMatchDaysAgo: number; // Days since last match
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  matchTime: string; // ISO date string
  venue: string;
}

export interface AnalysisCore {
  name: string;
  description: string;
  baseValue: number;
  adjustedValue: number;
  isActive: boolean;
}

export interface MatchAnalysis {
  matchId: string;
  homeTeam: Team;
  awayTeam: Team;
  cores: {
    core1: AnalysisCore; // Base performance
    core2: AnalysisCore; // Fatigue factor
    core3: AnalysisCore; // Key player factor
  };
  baseWinProbability: number;
  adjustedWinProbability: number;
  awayTeamFatigued: boolean;
  keyPlayerInjured: boolean;
}

// API Response types
export interface MatchListResponse {
  matches: Match[];
  date: string;
}

export interface MatchAnalysisResponse {
  analysis: MatchAnalysis;
}

// Request types for analysis adjustments
export interface AnalysisAdjustmentRequest {
  matchId: string;
  awayTeamFatigued: boolean;
  keyPlayerInjured: boolean;
}
