import { promises as fs } from "fs";
import path from "path";

export interface StoredTrainingMatch {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  actualResult: 'home_win' | 'draw' | 'away_win';
  date: string;
  venue: string;
  homeRank: number;
  awayRank: number;
  homeForm: string;
  awayForm: string;
  collectedAt: string;
}

export interface TrainingDataSet {
  lastUpdated: string;
  totalMatches: number;
  matches: StoredTrainingMatch[];
}

export interface CollectionResult {
  totalChecked: number;
  newlySaved: number;
  skippedDuplicates: number;
  errors: number;
  logs: string[];
  quotaRemaining: number;
}

const TRAINING_DATA_PATH = path.join(process.cwd(), "training_set.json");
const DAILY_QUOTA = 80;

export async function loadTrainingData(): Promise<TrainingDataSet> {
  try {
    const rawData = await fs.readFile(TRAINING_DATA_PATH, "utf-8");
    const data: TrainingDataSet = JSON.parse(rawData);
    
    // Auto-deduplicate on load: keep only unique fixture IDs
    const seen = new Set<number>();
    const uniqueMatches: StoredTrainingMatch[] = [];
    
    for (const match of data.matches) {
      if (!seen.has(match.fixtureId)) {
        seen.add(match.fixtureId);
        uniqueMatches.push(match);
      }
    }
    
    // If duplicates were found, save cleaned data
    if (uniqueMatches.length !== data.matches.length) {
      console.log(`[TrainingData] Auto-cleaned ${data.matches.length - uniqueMatches.length} duplicates. Unique: ${uniqueMatches.length}`);
      data.matches = uniqueMatches;
      data.totalMatches = uniqueMatches.length;
      data.lastUpdated = new Date().toISOString();
      await fs.writeFile(TRAINING_DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
    }
    
    // Always ensure totalMatches reflects actual array length
    data.totalMatches = data.matches.length;
    
    return data;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      const emptyData: TrainingDataSet = {
        lastUpdated: new Date().toISOString(),
        totalMatches: 0,
        matches: [],
      };
      return emptyData;
    }
    throw error;
  }
}

export async function saveTrainingData(data: TrainingDataSet): Promise<void> {
  data.lastUpdated = new Date().toISOString();
  data.totalMatches = data.matches.length;
  await fs.writeFile(TRAINING_DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function getExistingFixtureIds(data: TrainingDataSet): Set<number> {
  return new Set(data.matches.map(m => m.fixtureId));
}

export async function getTrainingDataStats(): Promise<{
  totalMatches: number;
  lastUpdated: string;
  uniqueTeams: number;
  highQualityCount: number;
  basicDataCount: number;
}> {
  const data = await loadTrainingData();
  const teams = new Set<string>();
  let highQualityCount = 0;
  let basicDataCount = 0;
  
  data.matches.forEach(m => {
    teams.add(m.homeTeam);
    teams.add(m.awayTeam);
    
    // Check for statistics or lineups (high quality data)
    const hasStats = (m as any).statistics && Array.isArray((m as any).statistics) && (m as any).statistics.length > 0;
    const hasLineups = (m as any).lineups && Array.isArray((m as any).lineups) && (m as any).lineups.length > 0;
    
    if (hasStats || hasLineups) {
      highQualityCount++;
    } else {
      basicDataCount++;
    }
  });
  
  return {
    totalMatches: data.totalMatches,
    lastUpdated: data.lastUpdated,
    uniqueTeams: teams.size,
    highQualityCount,
    basicDataCount,
  };
}

export { DAILY_QUOTA, TRAINING_DATA_PATH };
