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
  lineup?: LineupInfo;
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
  lineup?: LineupInfo;
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

// Lineup Status Types
export type LineupStatus = 'predicted' | 'confirmed';

export interface LineupInfo {
  status: LineupStatus;
  confirmedAt?: string;
}

// User Vote Types
export type VoteChoice = 'home' | 'draw' | 'away';

export const voteChoiceSchema = z.enum(['home', 'draw', 'away']);

export const submitVoteSchema = z.object({
  matchId: z.string().min(1, "matchId is required"),
  choice: voteChoiceSchema,
});

export type SubmitVoteInput = z.infer<typeof submitVoteSchema>;

export interface UserVote {
  id: string;
  matchId: string;
  choice: VoteChoice;
  votedAt: string;
}

// Prediction Record for tracking accuracy
export interface PredictionRecord {
  id: string;
  matchId: string;
  matchTitle: string;
  date: string;
  aiPrediction: VoteChoice;
  userPrediction?: VoteChoice;
  actualResult?: VoteChoice;
  aiCorrect?: boolean;
  userCorrect?: boolean;
}

// Daily Accuracy Stats for chart
export interface DailyAccuracy {
  date: string;
  totalMatches: number;
  aiCorrect: number;
  userCorrect: number;
}

// User Stats for My page comparison
export interface UserStats {
  totalVotes: number;
  userTotal: number;
  userCorrect: number;
  userAccuracy: number;
  aiTotal: number;
  aiCorrect: number;
  aiAccuracy: number;
}

// ============================================
// Standardized Training Data Format
// ============================================
// This is our vendor-agnostic data format.
// When switching data providers (API), only update the transformer - not the training set.

export type StandardizedResult = 'W' | 'D' | 'L'; // Home team perspective

export interface StandardizedTeamStats {
  attack: number;     // 0-100, offensive capability
  defense: number;    // 0-100, defensive capability  
  organization: number; // 0-100, team coordination/structure
  form: number;       // 0-100, recent performance
  ranking: number;    // League position (1-20)
}

export interface StandardizedMatch {
  id: string;                    // Unique identifier (e.g., "std-{fixtureId}")
  match_date: string;            // ISO date string
  home_team: string;             // Team name
  away_team: string;             // Team name
  home_score: number;            // Final score
  away_score: number;            // Final score
  home_stats: StandardizedTeamStats;
  away_stats: StandardizedTeamStats;
  result: StandardizedResult;    // From home team perspective: W=home win, D=draw, L=home loss
  venue?: string;                // Stadium name
  source: string;                // Data source identifier (e.g., "api-football-v3")
  source_id: string;             // Original ID from source (e.g., fixture ID)
  collected_at: string;          // When this data was collected
  quality: 'basic' | 'enriched'; // Data quality level
}

// Auto Mining Scheduler Types
export type MiningStatus = 'success' | 'stopped' | 'error' | 'safe_mode';

export interface MiningLogEntry {
  timestamp: string;
  status: MiningStatus;
  message: string;
  matchesCollected: number;
  duplicatesSkipped: number;
  quotaRemaining: number;
}

export interface MiningState {
  lastRunTime: string | null;
  lastStatus: MiningStatus | null;
  lastMessage: string | null;
  totalCollectedToday: number;
  isRunning: boolean;
  logs: MiningLogEntry[];
}
