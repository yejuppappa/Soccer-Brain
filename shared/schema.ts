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

// Weather Types
export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'snowy';

export interface Weather {
  condition: WeatherCondition;
  temperature: number;
  icon: string;
}

// Match and Team Types for Soccer Win Rate Simulator
export interface Team {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string;
  leagueRank: number;
  recentResults: ('W' | 'D' | 'L')[];
  topScorer: {
    name: string;
    goals: number;
    isInjured: boolean;
  };
  lastMatchDaysAgo: number;
}

export type OddsTrend = 'up' | 'down' | 'stable';

export interface Odds {
  domestic: [number, number, number];
  overseas: [number, number, number];
  domesticTrend: [OddsTrend, OddsTrend, OddsTrend]; // [homeWin, draw, awayWin] trend
  overseasTrend: [OddsTrend, OddsTrend, OddsTrend]; // [homeWin, draw, awayWin] trend
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  matchTime: string;
  venue: string;
  weather: Weather;
  odds: Odds;
}

// Win/Draw/Loss Probability Structure
export interface WinDrawLossProbability {
  homeWin: number;
  draw: number;
  awayWin: number;
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
  weather: Weather;
  odds: Odds;
  cores: {
    core1: AnalysisCore;
    core2Home: AnalysisCore;
    core2Away: AnalysisCore;
    core3Home: AnalysisCore;
    core3Away: AnalysisCore;
  };
  baseProbability: WinDrawLossProbability;
  adjustedProbability: WinDrawLossProbability;
}

// API Response types
export interface MatchListResponse {
  matches: Match[];
  date: string;
  apiError?: string | null;
}

export interface MatchAnalysisResponse {
  analysis: MatchAnalysis;
}

// Simulation State
export interface SimulationState {
  isRaining: boolean;
  homeTeamFatigued: boolean;
  homeKeyPlayerInjured: boolean;
  awayTeamFatigued: boolean;
  awayKeyPlayerInjured: boolean;
}

// Backtesting Types
export type MatchResult = 'home_win' | 'draw' | 'away_win';
export type VariableType = 'fatigue' | 'injury' | 'weather' | 'form' | 'home_advantage';

export interface HistoricalMatch {
  id: string;
  matchTitle: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  aiPrediction: number; // AI predicted home win probability
  predictedResult: MatchResult;
  actualResult: MatchResult;
  wasCorrect: boolean;
  errorMargin: number; // difference between prediction and actual
  primaryCause: VariableType;
  causeDescription: string;
}

export interface TuningWeight {
  variable: VariableType;
  originalWeight: number;
  adjustedWeight: number;
  adjustmentReason: string;
}

export interface BacktestResult {
  totalMatches: number;
  correctPredictions: number;
  accuracy: number;
  significantErrors: number; // predictions off by 30%+
  tuningWeights: TuningWeight[];
  insights: string[];
  completedAt: string;
}

export interface TrainingMatchTeam {
  name: string;
  ranking: number;
  form: string;
}

export interface TrainingMatch {
  id: number;
  homeTeam: TrainingMatchTeam;
  awayTeam: TrainingMatchTeam;
  homeScore: number;
  awayScore: number;
  date: string;
  venue?: string;
  actualResult: MatchResult;
}

export interface TrainingMatchDetail {
  id: string;
  matchTitle: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  date: string;
  actualResult: MatchResult;
  predictedResult: MatchResult;
  aiPrediction: number;
  wasCorrect: boolean;
  errorMargin: number;
  primaryCause: VariableType;
}

export interface TrainingResult {
  totalMatches: number;
  correctPredictions: number;
  initialAccuracy: number;
  adjustedAccuracy: number;
  significantErrors: number;
  tuningWeights: TuningWeight[];
  insights: string[];
  matchDetails: TrainingMatchDetail[];
  completedAt: string;
}
