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

// Sport Types for Multi-Sport Support
export type SportType = 'soccer' | 'basketball' | 'baseball' | 'volleyball';

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
  sportType: SportType;
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

// API Response types
export interface MatchListResponse {
  matches: Match[];
  date: string;
  apiError?: string | null;
}

// Legacy types (kept for admin.tsx compatibility — will be removed when admin page is cleaned)
export type MatchResult = 'home_win' | 'draw' | 'away_win';
export type VariableType = 'fatigue' | 'injury' | 'weather' | 'form' | 'home_advantage';

export interface TuningWeight {
  variable: VariableType;
  originalWeight: number;
  adjustedWeight: number;
}

export interface TrainingResult {
  totalMatches: number;
  correctPredictions: number;
  initialAccuracy: number;
  adjustedAccuracy: number;
  significantErrors: number;
  tuningWeights: TuningWeight[];
  insights: string[];
  matchDetails: any[];
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

// Legacy types (kept for admin.tsx compatibility)
export type MiningStatus = 'success' | 'stopped' | 'error' | 'safe_mode';

export interface MiningState {
  lastRunTime: string | null;
  lastStatus: MiningStatus | null;
  lastMessage: string | null;
  totalCollectedToday: number;
  isRunning: boolean;
  logs: any[];
}

// ============================================================
// Radar Chart Engine Types
// ============================================================

export type RadarWindow = "last5" | "season";

export interface RadarAxisScores {
  attack: number;     // 공격력 1-10
  defense: number;    // 수비력 1-10
  control: number;    // 주도권 1-10
  venueEdge: number;  // 홈어드벤티지 1-10
  bigMatch: number;   // 강팀대응력 1-10
}

export interface RadarAxisDetail {
  a1: number | null; a2: number | null; a3: number | null; a4: number | null;
  d1: number | null; d2: number | null;
  c1: number | null; c2: number | null; c3: number | null;
  v1: number | null; v2: number | null;
  s1: number | null; s2: number | null;
}

export interface RadarOutput {
  hasXgData: boolean;
  window: RadarWindow;
  tierCoefficient: number;
  earlySeasonWarning: boolean;
  home: RadarAxisScores;
  away: RadarAxisScores;
  homeDetail: RadarAxisDetail;
  awayDetail: RadarAxisDetail;
}
