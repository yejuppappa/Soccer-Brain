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

// ✅ API-Sports quota(남은 요청 수) 헤더 로그 찍기
apiClient.interceptors.response.use(
  (res) => {
    // API-Sports는 응답 헤더에 limit/remaining 값을 넣어주는 경우가 많음
    const limit =
      res.headers["x-ratelimit-limit"] ??
      res.headers["x-requests-limit"] ??
      res.headers["x-rate-limit-limit"];

    const remaining =
      res.headers["x-ratelimit-remaining"] ??
      res.headers["x-requests-remaining"] ??
      res.headers["x-rate-limit-remaining"];

    const used =
      res.headers["x-ratelimit-used"] ??
      res.headers["x-requests-used"] ??
      res.headers["x-rate-limit-used"];

    // 어떤 엔드포인트를 호출했는지도 같이 찍어주기
    const url = `${res.config?.baseURL || ""}${res.config?.url || ""}`;

    // 값이 있을 때만 보기 좋게 출력
    if (limit || remaining || used) {
      console.log(
        `[API-Sports Quota] ${url} | limit=${limit ?? "?"} remaining=${remaining ?? "?"} used=${used ?? "?"}`
      );
    } else {
      // 헤더가 안 오는 경우도 있으니, 그 사실을 로그로 남김
      console.log(`[API-Sports Quota] ${url} | (no quota headers found)`);
    }

    return res;
  },
  (err) => Promise.reject(err)
);


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
      sportType: 'soccer' as const,
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

export interface RawFixtureData {
  fixtureId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  actualResult: 'home_win' | 'draw' | 'away_win';
  date: string;
  venue: string;
}

export async function fetchCompletedFixtures(
  fromDate: string,
  toDate: string,
  season: number = 2023
): Promise<RawFixtureData[]> {
  console.log(`[API-Football] Fetching completed fixtures from ${fromDate} to ${toDate}...`);
  
  try {
    const response = await apiClient.get("/fixtures", {
      params: {
        league: PREMIER_LEAGUE_ID,
        season,
        from: fromDate,
        to: toDate,
        status: "FT",
      },
    });
    
    console.log(`[API-Football] Response: ${response.data.results} fixtures`);
    
    const fixtures = response.data.response || [];
    
    return fixtures.map((fixture: any) => {
      const homeScore = fixture.goals?.home ?? 0;
      const awayScore = fixture.goals?.away ?? 0;
      
      let actualResult: 'home_win' | 'draw' | 'away_win';
      if (homeScore > awayScore) actualResult = 'home_win';
      else if (homeScore < awayScore) actualResult = 'away_win';
      else actualResult = 'draw';
      
      return {
        fixtureId: fixture.fixture.id,
        homeTeamId: fixture.teams.home.id,
        awayTeamId: fixture.teams.away.id,
        homeTeam: fixture.teams.home.name,
        awayTeam: fixture.teams.away.name,
        homeScore,
        awayScore,
        actualResult,
        date: fixture.fixture.date,
        venue: fixture.fixture.venue?.name || "Unknown",
      };
    });
  } catch (error: any) {
    console.error("[API-Football] fetchCompletedFixtures failed:", error.message);
    throw error;
  }
}

export async function fetchStandingsForSeason(season: number = 2023): Promise<Map<number, { rank: number; form: string }>> {
  const standings = new Map<number, { rank: number; form: string }>();
  
  try {
    const response = await apiClient.get("/standings", {
      params: {
        league: PREMIER_LEAGUE_ID,
        season,
      },
    });
    
    const standingsData = response.data.response?.[0]?.league?.standings?.[0] || [];
    standingsData.forEach((standing: ApiStanding) => {
      standings.set(standing.team.id, {
        rank: standing.rank,
        form: standing.form || "DDDDD",
      });
    });
    
    console.log(`[API-Football] Got standings for ${standings.size} teams`);
  } catch (error: any) {
    console.error("[API-Football] Standings fetch failed:", error.message);
  }
  
  return standings;
}

// 특정 리그의 standings 가져오기 (DB 저장용)
export interface LeagueStanding {
  teamId: number;
  teamName: string;
  rank: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  form: string | null;
}

export async function fetchStandingsForLeague(leagueId: number, season: number): Promise<LeagueStanding[]> {
  try {
    const response = await apiClient.get("/standings", {
      params: {
        league: leagueId,
        season,
      },
    });
    
    const standingsData = response.data.response?.[0]?.league?.standings?.[0] || [];
    
    return standingsData.map((s: any) => ({
      teamId: s.team.id,
      teamName: s.team.name,
      rank: s.rank,
      points: s.points ?? 0,
      played: s.all?.played ?? 0,
      won: s.all?.win ?? 0,
      drawn: s.all?.draw ?? 0,
      lost: s.all?.lose ?? 0,
      goalsFor: s.all?.goals?.for ?? 0,
      goalsAgainst: s.all?.goals?.against ?? 0,
      goalDiff: s.goalsDiff ?? 0,
      form: s.form || null,
    }));
  } catch (error: any) {
    console.error(`[API-Football] Standings fetch failed for league ${leagueId}:`, error.message);
    return [];
  }
}

// Fetch detailed statistics for a specific fixture
export interface FixtureStatistics {
  team: { id: number; name: string };
  statistics: Array<{ type: string; value: string | number | null }>;
}

export async function fetchFixtureStatistics(fixtureId: number): Promise<FixtureStatistics[]> {
  try {
    const response = await apiClient.get("/fixtures/statistics", {
      params: { fixture: fixtureId },
    });
    
    return response.data.response || [];
  } catch (error: any) {
    console.error(`[API-Football] Stats fetch failed for fixture ${fixtureId}:`, error.message);
    throw error;
  }
}

// Fetch lineup data for a specific fixture
export interface FixtureLineup {
  team: { id: number; name: string; logo: string };
  formation: string;
  startXI: Array<{ player: { id: number; name: string; number: number; pos: string } }>;
  substitutes: Array<{ player: { id: number; name: string; number: number; pos: string } }>;
  coach: { id: number; name: string };
}

export async function fetchFixtureLineups(fixtureId: number): Promise<FixtureLineup[]> {
  try {
    const response = await apiClient.get("/fixtures/lineups", {
      params: { fixture: fixtureId },
    });
    
    return response.data.response || [];
  } catch (error: any) {
    console.error(`[API-Football] Lineups fetch failed for fixture ${fixtureId}:`, error.message);
    throw error;
  }
}

// Batch fetch fixtures with full data (statistics, lineups, events) using ids parameter
// API-Football allows fetching multiple fixtures at once with ids=123-456-789 format
export interface BatchFixtureData {
  fixtureId: number;
  statistics: FixtureStatistics[];
  lineups: FixtureLineup[];
  events: Array<{
    time: { elapsed: number };
    team: { id: number; name: string };
    player: { id: number; name: string };
    type: string;
    detail: string;
  }>;
}

export async function fetchBatchFixtures(fixtureIds: number[]): Promise<BatchFixtureData[]> {
  if (fixtureIds.length === 0) return [];
  
  // API-Football uses dash-separated IDs format: ids=123-456-789
  const idsParam = fixtureIds.join("-");
  console.log(`[API-Football] Batch fetching ${fixtureIds.length} fixtures: ${idsParam}`);
  
  try {
    const response = await apiClient.get("/fixtures", {
      params: {
        ids: idsParam,
      },
    });
    
    console.log(`[API-Football] Batch response: ${response.data.results} fixtures`);
    
    const fixtures = response.data.response || [];
    
    return fixtures.map((fixture: any) => ({
      fixtureId: fixture.fixture.id,
      statistics: fixture.statistics || [],
      lineups: fixture.lineups || [],
      events: fixture.events || [],
    }));
  } catch (error: any) {
    console.error(`[API-Football] Batch fetch failed:`, error.message);
    throw error;
  }
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

export interface RangeFixtureRow {
  fixtureId: number;
  date: string;
  status: string;
  venue?: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  venueName?: string | null;
  venueCity?: string | null;
}

export async function fetchFixturesByDateRange(args: {
  leagueId: number;
  season: number;
  from: string; // "YYYY-MM-DD"
  to: string;   // "YYYY-MM-DD"
}): Promise<RangeFixtureRow[]> {
  const { leagueId, season, from, to } = args;

  const res = await apiClient.get("/fixtures", {
    params: { league: leagueId, season, from, to },
  });
  const fixtures = res.data.response || [];
  


  return fixtures.map((f: any) => ({
    fixtureId: f.fixture.id,
    date: f.fixture.date,
    status: f.fixture.status?.short || "NS",
  
    // ✅ venue 정보 추가
    venue: f.fixture.venue?.name || undefined,
    venueName: f.fixture.venue?.name ?? null,
    venueCity: f.fixture.venue?.city ?? null,
  
    homeTeamId: f.teams.home.id,
    awayTeamId: f.teams.away.id,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    homeScore: f.goals?.home ?? undefined,
    awayScore: f.goals?.away ?? undefined,
  }));
  

}
export async function fetchFixtureTeamStats(apiFixtureId: number) {
  return apiClient.get("/fixtures/statistics", {
    params: { fixture: apiFixtureId },
  });
}

/**
 * 특정 경기의 실제 배당 조회
 */
export async function fetchOddsForFixture(fixtureId: number): Promise<{
  home: number;
  draw: number;
  away: number;
  bookmaker?: string;
  allBookmakers?: Array<{ bookmaker: string; home: number; draw: number; away: number }>;
} | null> {
  try {
    const res = await apiClient.get("/odds", {
      params: {
        fixture: fixtureId,
      },
    });

    console.log(`[fetchOddsForFixture] fixture=${fixtureId}, response count=${res.data?.response?.length || 0}`);
    
    const data = res.data?.response?.[0];
    if (!data?.bookmakers?.length) {
      console.log(`[fetchOddsForFixture] No bookmakers for fixture ${fixtureId}`);
      return null;
    }

    // ✅ 모든 북메이커의 Match Winner 배당 파싱
    const allBookmakers: Array<{ bookmaker: string; home: number; draw: number; away: number }> = [];
    
    for (const bm of data.bookmakers) {
      const matchWinnerBet = bm.bets?.find((b: any) => b.name === "Match Winner");
      if (!matchWinnerBet) continue;

      const values = matchWinnerBet.values;
      const homeOdd = values.find((v: any) => v.value === "Home")?.odd;
      const drawOdd = values.find((v: any) => v.value === "Draw")?.odd;
      const awayOdd = values.find((v: any) => v.value === "Away")?.odd;

      if (homeOdd && drawOdd && awayOdd) {
        allBookmakers.push({
          bookmaker: bm.name || bm.id?.toString() || "Unknown",
          home: parseFloat(homeOdd),
          draw: parseFloat(drawOdd),
          away: parseFloat(awayOdd),
        });
      }
    }

    if (allBookmakers.length === 0) {
      console.log(`[fetchOddsForFixture] No valid Match Winner odds found`);
      return null;
    }

    console.log(`[fetchOddsForFixture] Parsed ${allBookmakers.length} bookmakers: ${allBookmakers.map(b => b.bookmaker).join(', ')}`);

    // 대표 북메이커 선택 (Bet365 > Pinnacle > 첫 번째)
    const representative = 
      allBookmakers.find(b => b.bookmaker.toLowerCase().includes('bet365')) ||
      allBookmakers.find(b => b.bookmaker.toLowerCase().includes('pinnacle')) ||
      allBookmakers[0];

    return {
      home: representative.home,
      draw: representative.draw,
      away: representative.away,
      bookmaker: representative.bookmaker,
      allBookmakers,
    };
  } catch (err) {
    console.error(`[fetchOddsForFixture] Error for fixture ${fixtureId}:`, err);
    return null;
  }
}

/**
 * 날짜 범위의 모든 경기 배당 일괄 조회
 */
export async function fetchOddsByDate(date: string): Promise<Array<{
  fixtureId: number;
  home: number;
  draw: number;
  away: number;
}>> {
  try {
    const res = await apiClient.get("/odds", {
      params: {
        date: date,  // YYYY-MM-DD
        bookmaker: 8,  // Bet365
      },
    });

    const results: Array<{
      fixtureId: number;
      home: number;
      draw: number;
      away: number;
    }> = [];

    for (const item of res.data?.response || []) {
      const fixtureId = item.fixture?.id;
      if (!fixtureId) continue;

      const bookmaker = item.bookmakers?.[0];
      if (!bookmaker) continue;

      const matchWinnerBet = bookmaker.bets?.find(
        (b: any) => b.name === "Match Winner"
      );
      if (!matchWinnerBet) continue;

      const values = matchWinnerBet.values;
      const homeOdd = values.find((v: any) => v.value === "Home")?.odd;
      const drawOdd = values.find((v: any) => v.value === "Draw")?.odd;
      const awayOdd = values.find((v: any) => v.value === "Away")?.odd;

      if (homeOdd && drawOdd && awayOdd) {
        results.push({
          fixtureId,
          home: parseFloat(homeOdd),
          draw: parseFloat(drawOdd),
          away: parseFloat(awayOdd),
        });
      }
    }

    return results;
  } catch (err) {
    console.error(`[fetchOddsByDate] Error for date ${date}:`, err);
    return [];
  }
}
