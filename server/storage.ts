import { type User, type InsertUser, type Match, type Team, type MatchAnalysis, type AnalysisCore } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getMatches(): Promise<Match[]>;
  getMatchById(id: string): Promise<Match | undefined>;
  getMatchAnalysis(matchId: string): Promise<MatchAnalysis | undefined>;
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
  },
  {
    id: "match-2",
    homeTeam: mockTeams[2],
    awayTeam: mockTeams[3],
    matchTime: new Date(today.setHours(17, 30, 0, 0)).toISOString(),
    venue: "안필드",
  },
  {
    id: "match-3",
    homeTeam: mockTeams[4],
    awayTeam: mockTeams[5],
    matchTime: new Date(today.setHours(20, 0, 0, 0)).toISOString(),
    venue: "올드 트래퍼드",
  },
  {
    id: "match-4",
    homeTeam: mockTeams[6],
    awayTeam: mockTeams[7],
    matchTime: new Date(today.setHours(21, 0, 0, 0)).toISOString(),
    venue: "세인트 제임스 파크",
  },
  {
    id: "match-5",
    homeTeam: mockTeams[8],
    awayTeam: mockTeams[9],
    matchTime: new Date(today.setHours(22, 30, 0, 0)).toISOString(),
    venue: "아멕스 스타디움",
  },
];

function calculateCore1(homeTeam: Team, awayTeam: Team): AnalysisCore {
  const rankDiff = awayTeam.leagueRank - homeTeam.leagueRank;
  const recentWins = homeTeam.recentResults.filter(r => r === 'W').length;
  const baseValue = Math.round((rankDiff * 2) + (recentWins * 3));
  
  return {
    name: "기초 체력",
    description: `홈 팀 리그 ${homeTeam.leagueRank}위, 최근 5경기 ${recentWins}승 기록`,
    baseValue,
    adjustedValue: baseValue,
    isActive: true,
  };
}

function calculateCore2(awayTeam: Team, isFatigued: boolean): AnalysisCore {
  const adjustedValue = isFatigued ? 12 : 0;
  
  return {
    name: "피로도 변수",
    description: isFatigued 
      ? `원정 팀 휴식 ${awayTeam.lastMatchDaysAgo}일로 피로 누적` 
      : `원정 팀 충분한 휴식 (${awayTeam.lastMatchDaysAgo}일)`,
    baseValue: 0,
    adjustedValue,
    isActive: isFatigued,
  };
}

function calculateCore3(homeTeam: Team, isInjured: boolean): AnalysisCore {
  const adjustedValue = isInjured ? -20 : 0;
  
  return {
    name: "핵심 선수 변수",
    description: isInjured 
      ? `${homeTeam.topScorer.name} (${homeTeam.topScorer.goals}골) 부상 결장` 
      : `${homeTeam.topScorer.name} (${homeTeam.topScorer.goals}골) 정상 출전`,
    baseValue: 0,
    adjustedValue,
    isActive: isInjured,
  };
}

function calculateBaseWinProbability(homeTeam: Team, awayTeam: Team): number {
  const rankDiff = awayTeam.leagueRank - homeTeam.leagueRank;
  const recentWins = homeTeam.recentResults.filter(r => r === 'W').length;
  const baseProb = 50 + (rankDiff * 2) + (recentWins * 3);
  return Math.min(Math.max(baseProb, 25), 85);
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

    const baseWinProbability = calculateBaseWinProbability(match.homeTeam, match.awayTeam);
    const awayTeamFatigued = match.awayTeam.lastMatchDaysAgo < 3;
    const keyPlayerInjured = match.homeTeam.topScorer.isInjured;

    const core1 = calculateCore1(match.homeTeam, match.awayTeam);
    const core2 = calculateCore2(match.awayTeam, awayTeamFatigued);
    const core3 = calculateCore3(match.homeTeam, keyPlayerInjured);

    let adjustedProbability = baseWinProbability;
    if (awayTeamFatigued) adjustedProbability += 12;
    if (keyPlayerInjured) adjustedProbability -= 20;
    adjustedProbability = Math.min(Math.max(adjustedProbability, 5), 95);

    return {
      matchId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      cores: {
        core1,
        core2,
        core3,
      },
      baseWinProbability,
      adjustedWinProbability: adjustedProbability,
      awayTeamFatigued,
      keyPlayerInjured,
    };
  }
}

export const storage = new MemStorage();
