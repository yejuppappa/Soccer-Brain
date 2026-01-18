import { type User, type InsertUser, type Match, type Team, type MatchAnalysis, type AnalysisCore, type Weather, type WeatherCondition, type WinDrawLossProbability } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getMatches(): Promise<Match[]>;
  getMatchById(id: string): Promise<Match | undefined>;
  getMatchAnalysis(matchId: string): Promise<MatchAnalysis | undefined>;
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

const mockTeams: Team[] = [
  {
    id: "team-1",
    name: "맨체스터 시티",
    shortName: "MCI",
    leagueRank: 1,
    recentResults: ["W", "W", "D", "W", "W"],
    topScorer: { name: "홀란드", goals: 18, isInjured: false },
    lastMatchDaysAgo: 4,
  },
  {
    id: "team-2",
    name: "아스날",
    shortName: "ARS",
    leagueRank: 2,
    recentResults: ["W", "W", "W", "D", "W"],
    topScorer: { name: "사카", goals: 12, isInjured: false },
    lastMatchDaysAgo: 3,
  },
  {
    id: "team-3",
    name: "리버풀",
    shortName: "LIV",
    leagueRank: 3,
    recentResults: ["W", "D", "W", "W", "L"],
    topScorer: { name: "살라", goals: 15, isInjured: false },
    lastMatchDaysAgo: 5,
  },
  {
    id: "team-4",
    name: "첼시",
    shortName: "CHE",
    leagueRank: 6,
    recentResults: ["D", "W", "L", "W", "D"],
    topScorer: { name: "팔머", goals: 11, isInjured: false },
    lastMatchDaysAgo: 2,
  },
  {
    id: "team-5",
    name: "맨체스터 유나이티드",
    shortName: "MUN",
    leagueRank: 7,
    recentResults: ["L", "W", "D", "L", "W"],
    topScorer: { name: "호일룬", goals: 8, isInjured: false },
    lastMatchDaysAgo: 4,
  },
  {
    id: "team-6",
    name: "토트넘",
    shortName: "TOT",
    leagueRank: 5,
    recentResults: ["W", "L", "W", "W", "D"],
    topScorer: { name: "손흥민", goals: 14, isInjured: false },
    lastMatchDaysAgo: 3,
  },
  {
    id: "team-7",
    name: "뉴캐슬",
    shortName: "NEW",
    leagueRank: 4,
    recentResults: ["W", "W", "D", "W", "W"],
    topScorer: { name: "이삭", goals: 10, isInjured: false },
    lastMatchDaysAgo: 6,
  },
  {
    id: "team-8",
    name: "애스턴 빌라",
    shortName: "AVL",
    leagueRank: 8,
    recentResults: ["W", "D", "W", "L", "W"],
    topScorer: { name: "왓킨스", goals: 9, isInjured: false },
    lastMatchDaysAgo: 4,
  },
  {
    id: "team-9",
    name: "브라이튼",
    shortName: "BHA",
    leagueRank: 9,
    recentResults: ["D", "D", "W", "L", "D"],
    topScorer: { name: "미토마", goals: 7, isInjured: false },
    lastMatchDaysAgo: 5,
  },
  {
    id: "team-10",
    name: "웨스트햄",
    shortName: "WHU",
    leagueRank: 10,
    recentResults: ["L", "W", "L", "W", "L"],
    topScorer: { name: "보웬", goals: 8, isInjured: false },
    lastMatchDaysAgo: 3,
  },
];

const today = new Date();
const mockMatches: Match[] = [
  {
    id: "match-1",
    homeTeam: mockTeams[0],
    awayTeam: mockTeams[1],
    matchTime: new Date(today.setHours(15, 0, 0, 0)).toISOString(),
    venue: "에티하드 스타디움",
    weather: generateWeather(),
  },
  {
    id: "match-2",
    homeTeam: mockTeams[2],
    awayTeam: mockTeams[3],
    matchTime: new Date(today.setHours(17, 30, 0, 0)).toISOString(),
    venue: "안필드",
    weather: generateWeather(),
  },
  {
    id: "match-3",
    homeTeam: mockTeams[4],
    awayTeam: mockTeams[5],
    matchTime: new Date(today.setHours(20, 0, 0, 0)).toISOString(),
    venue: "올드 트래퍼드",
    weather: generateWeather(),
  },
  {
    id: "match-4",
    homeTeam: mockTeams[6],
    awayTeam: mockTeams[7],
    matchTime: new Date(today.setHours(21, 0, 0, 0)).toISOString(),
    venue: "세인트 제임스 파크",
    weather: generateWeather(),
  },
  {
    id: "match-5",
    homeTeam: mockTeams[8],
    awayTeam: mockTeams[9],
    matchTime: new Date(today.setHours(22, 30, 0, 0)).toISOString(),
    venue: "아멕스 스타디움",
    weather: generateWeather(),
  },
];

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

function calculateCore1(homeTeam: Team, awayTeam: Team): AnalysisCore {
  const rankDiff = awayTeam.leagueRank - homeTeam.leagueRank;
  const homeRecentWins = homeTeam.recentResults.filter(r => r === 'W').length;
  const awayRecentWins = awayTeam.recentResults.filter(r => r === 'W').length;
  const baseValue = Math.round((rankDiff * 2) + (homeRecentWins - awayRecentWins) * 2);
  
  return {
    name: "기초 체력",
    description: `홈 ${homeTeam.leagueRank}위(최근 ${homeRecentWins}승) vs 원정 ${awayTeam.leagueRank}위(최근 ${awayRecentWins}승)`,
    baseValue,
    adjustedValue: baseValue,
    isActive: true,
  };
}

function createCore2(team: Team, isHome: boolean): AnalysisCore {
  const teamType = isHome ? "홈팀" : "원정팀";
  return {
    name: `${teamType} 피로도`,
    description: `${team.name} 휴식 ${team.lastMatchDaysAgo}일`,
    baseValue: 0,
    adjustedValue: 0,
    isActive: false,
  };
}

function createCore3(team: Team, isHome: boolean): AnalysisCore {
  const teamType = isHome ? "홈팀" : "원정팀";
  return {
    name: `${teamType} 핵심 선수`,
    description: `${team.topScorer.name} (${team.topScorer.goals}골)`,
    baseValue: 0,
    adjustedValue: 0,
    isActive: false,
  };
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private matches: Map<string, Match>;

  constructor() {
    this.users = new Map();
    this.matches = new Map();
    
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

  async getMatchAnalysis(matchId: string): Promise<MatchAnalysis | undefined> {
    const match = await this.getMatchById(matchId);
    if (!match) return undefined;

    const baseProbability = calculateBaseProbability(match.homeTeam, match.awayTeam);
    const core1 = calculateCore1(match.homeTeam, match.awayTeam);
    const core2Home = createCore2(match.homeTeam, true);
    const core2Away = createCore2(match.awayTeam, false);
    const core3Home = createCore3(match.homeTeam, true);
    const core3Away = createCore3(match.awayTeam, false);

    return {
      matchId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      weather: match.weather,
      cores: {
        core1,
        core2Home,
        core2Away,
        core3Home,
        core3Away,
      },
      baseProbability,
      adjustedProbability: { ...baseProbability },
    };
  }
}

export const storage = new MemStorage();
