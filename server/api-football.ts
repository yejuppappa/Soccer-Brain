import axios from "axios";
import type { Match, Team, Weather, WeatherCondition, Odds, OddsTrend, WinDrawLossProbability } from "@shared/schema";

const API_BASE_URL = "https://v3.football.api-sports.io";
const PREMIER_LEAGUE_ID = 39;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "x-apisports-key": process.env.API_SPORTS_KEY || "",
  },
});

interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    venue: {
      name: string;
      city: string;
    };
    status: {
      short: string;
    };
  };
  league: {
    id: number;
    name: string;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
    };
    away: {
      id: number;
      name: string;
      logo: string;
    };
  };
}

interface ApiStanding {
  team: {
    id: number;
    name: string;
  };
  rank: number;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
  };
  form: string;
}

interface ApiOdds {
  bookmakers: Array<{
    bets: Array<{
      name: string;
      values: Array<{
        value: string;
        odd: string;
      }>;
    }>;
  }>;
}

function generateRandomTrend(): OddsTrend {
  const trends: OddsTrend[] = ['up', 'down', 'stable'];
  return trends[Math.floor(Math.random() * trends.length)];
}

function calculateBaseProbability(homeRank: number, awayRank: number, homeForm: string, awayForm: string): WinDrawLossProbability {
  const rankDiff = awayRank - homeRank;
  const homeRecentWins = (homeForm || "").split("").filter(r => r === 'W').length;
  const awayRecentWins = (awayForm || "").split("").filter(r => r === 'W').length;
  
  let homeWin = 35 + (rankDiff * 2) + (homeRecentWins * 2) - (awayRecentWins * 1);
  let awayWin = 35 - (rankDiff * 2) + (awayRecentWins * 2) - (homeRecentWins * 1);
  
  homeWin = Math.min(Math.max(homeWin, 15), 60);
  awayWin = Math.min(Math.max(awayWin, 15), 60);
  
  const draw = 100 - homeWin - awayWin;
  
  return { homeWin, draw, awayWin };
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
  
  return { condition, temperature, icon: condition };
}

function getTeamShortName(teamName: string): string {
  const shortNames: Record<string, string> = {
    "Manchester City": "MCI",
    "Arsenal": "ARS",
    "Liverpool": "LIV",
    "Chelsea": "CHE",
    "Manchester United": "MUN",
    "Tottenham": "TOT",
    "Newcastle": "NEW",
    "Aston Villa": "AVL",
    "Brighton": "BHA",
    "West Ham": "WHU",
    "Bournemouth": "BOU",
    "Fulham": "FUL",
    "Wolves": "WOL",
    "Crystal Palace": "CRY",
    "Brentford": "BRE",
    "Everton": "EVE",
    "Nottingham Forest": "NFO",
    "Luton": "LUT",
    "Burnley": "BUR",
    "Sheffield Utd": "SHU",
    "Leicester": "LEI",
    "Ipswich": "IPS",
    "Southampton": "SOU",
  };
  
  for (const [fullName, shortName] of Object.entries(shortNames)) {
    if (teamName.includes(fullName)) {
      return shortName;
    }
  }
  
  return teamName.substring(0, 3).toUpperCase();
}

function formToRecentResults(form: string): ('W' | 'D' | 'L')[] {
  return (form || "DDDDD").substring(0, 5).split("").map(char => {
    if (char === 'W') return 'W';
    if (char === 'D') return 'D';
    return 'L';
  }) as ('W' | 'D' | 'L')[];
}

export async function fetchNextFixtures(): Promise<Match[]> {
  console.log("[API-Football] Starting fetchNextFixtures...");
  console.log("[API-Football] API Key configured:", !!process.env.API_SPORTS_KEY);
  console.log("[API-Football] API Key prefix:", process.env.API_SPORTS_KEY?.substring(0, 8) + "...");
  
  // Free plans only allow 2022-2024 seasons
  // Season 2023 = 2023-2024 Premier League season
  const season = 2023;
  console.log("[API-Football] Using season:", season, "(2023-2024 Premier League)");
  
  let fixturesResponse;
  try {
    // Free plan doesn't support next/last parameters, use date range
    // Use Premier League matchday dates from March 2024 (definitely had matches)
    fixturesResponse = await apiClient.get("/fixtures", {
      params: {
        league: PREMIER_LEAGUE_ID,
        season: season,
        from: "2024-03-16",
        to: "2024-03-20",
      },
    });
    
    console.log("[API-Football] Response status:", fixturesResponse.status);
    console.log("[API-Football] Response errors:", JSON.stringify(fixturesResponse.data.errors));
    console.log("[API-Football] Response results count:", fixturesResponse.data.results);
  } catch (error: any) {
    console.error("[API-Football] ===== API CALL FAILED =====");
    console.error("[API-Football] Status:", error.response?.status);
    console.error("[API-Football] StatusText:", error.response?.statusText);
    console.error("[API-Football] Error data:", JSON.stringify(error.response?.data));
    console.error("[API-Football] Error message:", error.message);
    console.error("[API-Football] ===========================");
    throw new Error(`API_CALL_FAILED: ${error.response?.status || 'NETWORK'} - ${error.message}`);
  }
  
  const fixtures: ApiFixture[] = fixturesResponse.data.response || [];
  
  if (fixtures.length === 0) {
    console.log("[API-Football] No upcoming fixtures found from API");
    return [];
  }
  
  console.log("[API-Football] Got", fixtures.length, "fixtures, now fetching standings...");
  
  let standings: Map<number, ApiStanding> = new Map();
  try {
    const standingsResponse = await apiClient.get("/standings", {
      params: {
        league: PREMIER_LEAGUE_ID,
        season: season,
      },
    });
    
    const standingsData = standingsResponse.data.response?.[0]?.league?.standings?.[0] || [];
    standingsData.forEach((standing: ApiStanding) => {
      standings.set(standing.team.id, standing);
    });
    console.log("[API-Football] Got standings for", standings.size, "teams");
  } catch (error: any) {
    console.error("[API-Football] Standings fetch failed:", error.message);
  }
  
  const matches: Match[] = fixtures.map((fixture, index) => {
    const homeStanding = standings.get(fixture.teams.home.id);
    const awayStanding = standings.get(fixture.teams.away.id);
    
    const homeTeam: Team = {
      id: `team-${fixture.teams.home.id}`,
      name: fixture.teams.home.name,
      shortName: getTeamShortName(fixture.teams.home.name),
      logoUrl: fixture.teams.home.logo,
      leagueRank: homeStanding?.rank || 10,
      recentResults: formToRecentResults(homeStanding?.form || ""),
      topScorer: {
        name: "Unknown",
        goals: 0,
        isInjured: false,
      },
      lastMatchDaysAgo: Math.floor(Math.random() * 7) + 1,
    };
    
    const awayTeam: Team = {
      id: `team-${fixture.teams.away.id}`,
      name: fixture.teams.away.name,
      shortName: getTeamShortName(fixture.teams.away.name),
      logoUrl: fixture.teams.away.logo,
      leagueRank: awayStanding?.rank || 10,
      recentResults: formToRecentResults(awayStanding?.form || ""),
      topScorer: {
        name: "Unknown",
        goals: 0,
        isInjured: false,
      },
      lastMatchDaysAgo: Math.floor(Math.random() * 7) + 1,
    };
    
    const probability = calculateBaseProbability(
      homeTeam.leagueRank,
      awayTeam.leagueRank,
      homeStanding?.form || "",
      awayStanding?.form || ""
    );
    
    return {
      id: `match-${fixture.fixture.id}`,
      homeTeam,
      awayTeam,
      matchTime: fixture.fixture.date,
      venue: fixture.fixture.venue?.name || "Unknown Venue",
      weather: generateWeather(),
      odds: calculateOddsFromProbability(probability),
    };
  });
  
  console.log("[API-Football] Successfully built", matches.length, "matches");
  return matches;
}

export function isApiConfigured(): boolean {
  return !!process.env.API_SPORTS_KEY;
}

export interface HistoricalMatchWithResult {
  id: string;
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
}

export async function fetchHistoricalMatchesWithResults(): Promise<HistoricalMatchWithResult[]> {
  console.log("[API-Football] Fetching historical matches with results...");
  
  // Free plans only allow 2022-2024 seasons
  const season = 2023;
  
  let fixturesResponse;
  try {
    // Get finished matches from a specific date range in 2023-24 season
    fixturesResponse = await apiClient.get("/fixtures", {
      params: {
        league: PREMIER_LEAGUE_ID,
        season: season,
        from: "2024-03-01",
        to: "2024-03-31",
        status: "FT", // Finished matches only
      },
    });
    
    console.log("[API-Football] Historical fixtures response:", fixturesResponse.data.results);
  } catch (error: any) {
    console.error("[API-Football] Historical fixtures fetch failed:", error.message);
    throw error;
  }
  
  const fixtures = fixturesResponse.data.response || [];
  
  if (fixtures.length === 0) {
    console.log("[API-Football] No historical fixtures found");
    return [];
  }
  
  // Fetch standings for team rankings
  let standings: Map<number, { rank: number; form: string }> = new Map();
  try {
    const standingsResponse = await apiClient.get("/standings", {
      params: {
        league: PREMIER_LEAGUE_ID,
        season: season,
      },
    });
    
    const standingsData = standingsResponse.data.response?.[0]?.league?.standings?.[0] || [];
    standingsData.forEach((standing: ApiStanding) => {
      standings.set(standing.team.id, {
        rank: standing.rank,
        form: standing.form || "DDDDD",
      });
    });
  } catch (error: any) {
    console.error("[API-Football] Standings fetch failed:", error.message);
  }
  
  const matches: HistoricalMatchWithResult[] = fixtures.map((fixture: any) => {
    const homeScore = fixture.goals?.home ?? 0;
    const awayScore = fixture.goals?.away ?? 0;
    
    let actualResult: 'home_win' | 'draw' | 'away_win';
    if (homeScore > awayScore) {
      actualResult = 'home_win';
    } else if (homeScore < awayScore) {
      actualResult = 'away_win';
    } else {
      actualResult = 'draw';
    }
    
    const homeStanding = standings.get(fixture.teams.home.id);
    const awayStanding = standings.get(fixture.teams.away.id);
    
    return {
      id: `hist-${fixture.fixture.id}`,
      homeTeam: fixture.teams.home.name,
      awayTeam: fixture.teams.away.name,
      homeScore,
      awayScore,
      actualResult,
      date: fixture.fixture.date,
      venue: fixture.fixture.venue?.name || "Unknown",
      homeRank: homeStanding?.rank || 10,
      awayRank: awayStanding?.rank || 10,
      homeForm: homeStanding?.form || "DDDDD",
      awayForm: awayStanding?.form || "DDDDD",
    };
  });
  
  console.log("[API-Football] Fetched", matches.length, "historical matches with results");
  return matches;
}
