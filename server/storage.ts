import { type User, type InsertUser, type Match, type Team, type Weather, type WeatherCondition, type WinDrawLossProbability, type Odds, type OddsTrend, type UserVote, type VoteChoice } from "@shared/schema";
import { randomUUID } from "crypto";
import { fetchNextFixtures, isApiConfigured } from "./api-football";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getMatches(): Promise<Match[]>;
  getMatchById(id: string): Promise<Match | undefined>;
  refreshMatchesFromApi(): Promise<void>;
  submitVote(matchId: string, choice: VoteChoice): Promise<UserVote>;
  getVoteForMatch(matchId: string): Promise<UserVote | undefined>;
  getAllVotes(): Promise<UserVote[]>;
}

function generateWeather(): Weather {
  const conditions: WeatherCondition[] = ['sunny', 'cloudy', 'rainy', 'snowy'];

  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  let temperature: number;

  switch (condition) {
    case 'sunny':
      temperature = Math.floor(Math.random() * 15) + 15;
      break;
    case 'cloudy':
      temperature = Math.floor(Math.random() * 10) + 10;
      break;
    case 'rainy':
      temperature = Math.floor(Math.random() * 8) + 8;
      break;
    case 'snowy':
      temperature = Math.floor(Math.random() * 5) - 2;
      break;
  }

  return {
    condition,
    temperature,
    icon: condition,
  };
}

function calculateBaseProbability(homeTeam: Team, awayTeam: Team): WinDrawLossProbability {
  const rankDiff = awayTeam.leagueRank - homeTeam.leagueRank;
  const homeRecentWins = homeTeam.recentResults.filter(r => r === 'W').length;
  const awayRecentWins = awayTeam.recentResults.filter(r => r === 'W').length;

  let homeWin = 35 + (rankDiff * 2) + (homeRecentWins * 2) - (awayRecentWins * 1);
  let awayWin = 35 - (rankDiff * 2) + (awayRecentWins * 2) - (homeRecentWins * 1);

  homeWin = Math.min(Math.max(homeWin, 15), 60);
  awayWin = Math.min(Math.max(awayWin, 15), 60);

  const draw = 100 - homeWin - awayWin;

  return { homeWin, draw, awayWin };
}

function generateRandomTrend(): OddsTrend {
  const trends: OddsTrend[] = ['up', 'down', 'stable'];
  return trends[Math.floor(Math.random() * trends.length)];
}

function calculateOddsFromProbability(probability: WinDrawLossProbability): Odds {
  const margin = 1.08;

  const overseasHome = Math.round((1 / (probability.homeWin / 100) * margin) * 100) / 100;
  const overseasDraw = Math.round((1 / (probability.draw / 100) * margin) * 100) / 100;
  const overseasAway = Math.round((1 / (probability.awayWin / 100) * margin) * 100) / 100;

  const domesticHome = Math.round((overseasHome - 0.1 - Math.random() * 0.1) * 100) / 100;
  const domesticDraw = Math.round((overseasDraw - 0.1 - Math.random() * 0.1) * 100) / 100;
  const domesticAway = Math.round((overseasAway - 0.1 - Math.random() * 0.1) * 100) / 100;

  return {
    domestic: [domesticHome, domesticDraw, domesticAway],
    overseas: [overseasHome, overseasDraw, overseasAway],
    domesticTrend: [generateRandomTrend(), generateRandomTrend(), generateRandomTrend()],
    overseasTrend: [generateRandomTrend(), generateRandomTrend(), generateRandomTrend()],
  };
}

const mockTeams: Team[] = [
  {
    id: "team-1",
    name: "맨체스터 시티",
    shortName: "MCI",
    logoUrl: "https://via.placeholder.com/40/6CABDD/ffffff?text=MCI",
    leagueRank: 1,
    recentResults: ["W", "W", "D", "W", "W"],
    topScorer: { name: "홀란드", goals: 18, isInjured: false },
    lastMatchDaysAgo: 4,
  },
  {
    id: "team-2",
    name: "아스날",
    shortName: "ARS",
    logoUrl: "https://via.placeholder.com/40/EF0107/ffffff?text=ARS",
    leagueRank: 2,
    recentResults: ["W", "W", "W", "D", "W"],
    topScorer: { name: "사카", goals: 12, isInjured: false },
    lastMatchDaysAgo: 3,
  },
  {
    id: "team-3",
    name: "리버풀",
    shortName: "LIV",
    logoUrl: "https://via.placeholder.com/40/C8102E/ffffff?text=LIV",
    leagueRank: 3,
    recentResults: ["W", "D", "W", "W", "L"],
    topScorer: { name: "살라", goals: 15, isInjured: false },
    lastMatchDaysAgo: 5,
  },
  {
    id: "team-4",
    name: "첼시",
    shortName: "CHE",
    logoUrl: "https://via.placeholder.com/40/034694/ffffff?text=CHE",
    leagueRank: 6,
    recentResults: ["D", "W", "L", "W", "D"],
    topScorer: { name: "팔머", goals: 11, isInjured: false },
    lastMatchDaysAgo: 2,
  },
  {
    id: "team-5",
    name: "맨체스터 유나이티드",
    shortName: "MUN",
    logoUrl: "https://via.placeholder.com/40/DA291C/ffffff?text=MUN",
    leagueRank: 7,
    recentResults: ["L", "W", "D", "L", "W"],
    topScorer: { name: "호일룬", goals: 8, isInjured: false },
    lastMatchDaysAgo: 4,
  },
  {
    id: "team-6",
    name: "토트넘",
    shortName: "TOT",
    logoUrl: "https://via.placeholder.com/40/132257/ffffff?text=TOT",
    leagueRank: 5,
    recentResults: ["W", "L", "W", "W", "D"],
    topScorer: { name: "손흥민", goals: 14, isInjured: false },
    lastMatchDaysAgo: 3,
  },
  {
    id: "team-7",
    name: "뉴캐슬",
    shortName: "NEW",
    logoUrl: "https://via.placeholder.com/40/241F20/ffffff?text=NEW",
    leagueRank: 4,
    recentResults: ["W", "W", "D", "W", "W"],
    topScorer: { name: "이삭", goals: 10, isInjured: false },
    lastMatchDaysAgo: 6,
  },
  {
    id: "team-8",
    name: "애스턴 빌라",
    shortName: "AVL",
    logoUrl: "https://via.placeholder.com/40/670E36/ffffff?text=AVL",
    leagueRank: 8,
    recentResults: ["W", "D", "W", "L", "W"],
    topScorer: { name: "왓킨스", goals: 9, isInjured: false },
    lastMatchDaysAgo: 4,
  },
  {
    id: "team-9",
    name: "브라이튼",
    shortName: "BHA",
    logoUrl: "https://via.placeholder.com/40/0057B8/ffffff?text=BHA",
    leagueRank: 9,
    recentResults: ["D", "D", "W", "L", "D"],
    topScorer: { name: "미토마", goals: 7, isInjured: false },
    lastMatchDaysAgo: 5,
  },
  {
    id: "team-10",
    name: "웨스트햄",
    shortName: "WHU",
    logoUrl: "https://via.placeholder.com/40/7A263A/ffffff?text=WHU",
    leagueRank: 10,
    recentResults: ["L", "W", "L", "W", "L"],
    topScorer: { name: "보웬", goals: 8, isInjured: false },
    lastMatchDaysAgo: 3,
  },
];

const today = new Date();

function createMatch(id: string, homeTeam: Team, awayTeam: Team, hours: number, minutes: number, venue: string): Match {
  const probability = calculateBaseProbability(homeTeam, awayTeam);
  const matchDate = new Date(today);
  matchDate.setHours(hours, minutes, 0, 0);

  return {
    id,
    sportType: 'soccer' as const,
    homeTeam,
    awayTeam,
    matchTime: matchDate.toISOString(),
    venue,
    weather: generateWeather(),
    odds: calculateOddsFromProbability(probability),
  };
}

const mockMatches: Match[] = [
  createMatch("match-1", mockTeams[0], mockTeams[1], 15, 0, "에티하드 스타디움"),
  createMatch("match-2", mockTeams[2], mockTeams[3], 17, 30, "안필드"),
  createMatch("match-3", mockTeams[4], mockTeams[5], 20, 0, "올드 트래퍼드"),
  createMatch("match-4", mockTeams[6], mockTeams[7], 21, 0, "세인트 제임스 파크"),
  createMatch("match-5", mockTeams[8], mockTeams[9], 22, 30, "아멕스 스타디움"),
];

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private matches: Map<string, Match>;
  private lastApiFetch: number = 0;
  private userVotes: Map<string, UserVote>;

  constructor() {
    this.users = new Map();
    this.matches = new Map();
    this.userVotes = new Map();

    mockMatches.forEach(match => {
      this.matches.set(match.id, match);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getMatches(): Promise<Match[]> {
    return Array.from(this.matches.values());
  }

  async getMatchById(id: string): Promise<Match | undefined> {
    return this.matches.get(id);
  }

  private lastApiError: string | null = null;

  getLastApiError(): string | null {
    return this.lastApiError;
  }

  async refreshMatchesFromApi(): Promise<void> {
    if (!isApiConfigured()) {
      const msg = "API_SPORTS_KEY not configured in environment";
      console.error("[Storage] " + msg);
      this.lastApiError = msg;
      throw new Error(msg);
    }

    const now = Date.now();
    if (now - this.lastApiFetch < CACHE_TTL_MS && this.lastApiError === null) {
      console.log("[Storage] Using cached API data (TTL not expired)");
      return;
    }

    console.log("[Storage] Calling fetchNextFixtures...");
    const apiMatches = await fetchNextFixtures();

    if (apiMatches.length > 0) {
      this.matches.clear();
      apiMatches.forEach(match => {
        this.matches.set(match.id, match);
      });
      this.lastApiFetch = now;
      this.lastApiError = null;
      console.log(`[Storage] Successfully loaded ${apiMatches.length} matches from API`);
    } else {
      const msg = "API returned 0 fixtures (no upcoming matches found)";
      console.log("[Storage] " + msg);
      this.lastApiError = msg;
      throw new Error(msg);
    }
  }

  async submitVote(matchId: string, choice: VoteChoice): Promise<UserVote> {
    const vote: UserVote = {
      id: randomUUID(),
      matchId,
      choice,
      votedAt: new Date().toISOString(),
    };
    this.userVotes.set(matchId, vote);
    return vote;
  }

  async getVoteForMatch(matchId: string): Promise<UserVote | undefined> {
    return this.userVotes.get(matchId);
  }

  async getAllVotes(): Promise<UserVote[]> {
    return Array.from(this.userVotes.values());
  }
}

export const storage = new MemStorage();
