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
    const data = await fs.readFile(TRAINING_DATA_PATH, "utf-8");
    return JSON.parse(data);
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
}> {
  const data = await loadTrainingData();
  const teams = new Set<string>();
  data.matches.forEach(m => {
    teams.add(m.homeTeam);
    teams.add(m.awayTeam);
  });
  
  return {
    totalMatches: data.totalMatches,
    lastUpdated: data.lastUpdated,
    uniqueTeams: teams.size,
  };
}

export { DAILY_QUOTA, TRAINING_DATA_PATH };
