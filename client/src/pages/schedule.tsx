import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Calendar, ChevronRight, CloudRain, Sun, Cloud, Snowflake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import type { MatchListResponse, Match, WeatherCondition } from "@shared/schema";

const MOCK_TEAMS = [
  { id: "team-m1", name: "Manchester City", shortName: "MCI", logoUrl: "https://media.api-sports.io/football/teams/50.png", leagueRank: 1 },
  { id: "team-m2", name: "Arsenal", shortName: "ARS", logoUrl: "https://media.api-sports.io/football/teams/42.png", leagueRank: 2 },
  { id: "team-m3", name: "Liverpool", shortName: "LIV", logoUrl: "https://media.api-sports.io/football/teams/40.png", leagueRank: 3 },
  { id: "team-m4", name: "Aston Villa", shortName: "AVL", logoUrl: "https://media.api-sports.io/football/teams/66.png", leagueRank: 4 },
  { id: "team-m5", name: "Tottenham", shortName: "TOT", logoUrl: "https://media.api-sports.io/football/teams/47.png", leagueRank: 5 },
  { id: "team-m6", name: "Chelsea", shortName: "CHE", logoUrl: "https://media.api-sports.io/football/teams/49.png", leagueRank: 6 },
  { id: "team-m7", name: "Newcastle", shortName: "NEW", logoUrl: "https://media.api-sports.io/football/teams/34.png", leagueRank: 7 },
  { id: "team-m8", name: "Manchester United", shortName: "MUN", logoUrl: "https://media.api-sports.io/football/teams/33.png", leagueRank: 8 },
  { id: "team-m9", name: "West Ham", shortName: "WHU", logoUrl: "https://media.api-sports.io/football/teams/48.png", leagueRank: 9 },
  { id: "team-m10", name: "Brighton", shortName: "BHA", logoUrl: "https://media.api-sports.io/football/teams/51.png", leagueRank: 10 },
  { id: "team-m11", name: "Real Madrid", shortName: "RMA", logoUrl: "https://media.api-sports.io/football/teams/541.png", leagueRank: 1 },
  { id: "team-m12", name: "Barcelona", shortName: "BAR", logoUrl: "https://media.api-sports.io/football/teams/529.png", leagueRank: 2 },
  { id: "team-m13", name: "Atletico Madrid", shortName: "ATM", logoUrl: "https://media.api-sports.io/football/teams/530.png", leagueRank: 3 },
  { id: "team-m14", name: "Sevilla", shortName: "SEV", logoUrl: "https://media.api-sports.io/football/teams/536.png", leagueRank: 6 },
];

const MOCK_VENUES = [
  "Etihad Stadium", "Emirates Stadium", "Anfield", "Villa Park", "Tottenham Stadium",
  "Stamford Bridge", "St James' Park", "Old Trafford", "London Stadium", "AMEX Stadium",
  "Santiago Bernabéu", "Camp Nou", "Wanda Metropolitano", "Ramón Sánchez Pizjuán"
];

const WEATHER_CONDITIONS: WeatherCondition[] = ['sunny', 'cloudy', 'rainy', 'snowy'];

function generateMockMatches(): Match[] {
  const matches: Match[] = [];
  const usedPairs = new Set<string>();
  
  for (let i = 0; i < 20; i++) {
    let homeIdx = i % MOCK_TEAMS.length;
    let awayIdx = (i + 3) % MOCK_TEAMS.length;
    if (homeIdx === awayIdx) awayIdx = (awayIdx + 1) % MOCK_TEAMS.length;
    
    const pairKey = `${homeIdx}-${awayIdx}`;
    if (usedPairs.has(pairKey)) {
      awayIdx = (awayIdx + 2) % MOCK_TEAMS.length;
    }
    usedPairs.add(`${homeIdx}-${awayIdx}`);
    
    const home = MOCK_TEAMS[homeIdx];
    const away = MOCK_TEAMS[awayIdx];
    
    const dayOffset = Math.floor(i / 4);
    const matchDate = new Date();
    matchDate.setDate(matchDate.getDate() + dayOffset);
    const hour = 15 + (i % 3) * 2;
    matchDate.setHours(hour, 0, 0, 0);
    
    const recentResults = (): ("W" | "D" | "L")[] => {
      const results: ("W" | "D" | "L")[] = [];
      for (let j = 0; j < 5; j++) {
        const r = Math.random();
        results.push(r < 0.4 ? 'W' : r < 0.7 ? 'D' : 'L');
      }
      return results;
    };
    
    matches.push({
      id: `demo-match-${i + 1}`,
      homeTeam: {
        id: home.id,
        name: home.name,
        shortName: home.shortName,
        logoUrl: home.logoUrl,
        leagueRank: home.leagueRank,
        recentResults: recentResults(),
        topScorer: { name: "Demo Player", goals: 10, isInjured: false },
        lastMatchDaysAgo: Math.floor(Math.random() * 7) + 1,
      },
      awayTeam: {
        id: away.id,
        name: away.name,
        shortName: away.shortName,
        logoUrl: away.logoUrl,
        leagueRank: away.leagueRank,
        recentResults: recentResults(),
        topScorer: { name: "Demo Player", goals: 8, isInjured: false },
        lastMatchDaysAgo: Math.floor(Math.random() * 7) + 1,
      },
      matchTime: matchDate.toISOString(),
      venue: MOCK_VENUES[i % MOCK_VENUES.length],
      weather: {
        condition: WEATHER_CONDITIONS[i % WEATHER_CONDITIONS.length],
        temperature: 10 + Math.floor(Math.random() * 15),
        icon: WEATHER_CONDITIONS[i % WEATHER_CONDITIONS.length],
      },
      odds: {
        domestic: [2.5 + Math.random(), 3.2 + Math.random() * 0.5, 2.8 + Math.random()],
        overseas: [2.6 + Math.random(), 3.3 + Math.random() * 0.5, 2.9 + Math.random()],
        domesticTrend: [
          Math.random() < 0.3 ? 'down' : Math.random() < 0.6 ? 'stable' : 'up',
          Math.random() < 0.3 ? 'down' : Math.random() < 0.6 ? 'stable' : 'up',
          Math.random() < 0.3 ? 'down' : Math.random() < 0.6 ? 'stable' : 'up',
        ] as [("up" | "down" | "stable"), ("up" | "down" | "stable"), ("up" | "down" | "stable")],
        overseasTrend: [
          Math.random() < 0.3 ? 'down' : Math.random() < 0.6 ? 'stable' : 'up',
          Math.random() < 0.3 ? 'down' : Math.random() < 0.6 ? 'stable' : 'up',
          Math.random() < 0.3 ? 'down' : Math.random() < 0.6 ? 'stable' : 'up',
        ] as [("up" | "down" | "stable"), ("up" | "down" | "stable"), ("up" | "down" | "stable")],
      },
    });
  }
  
  return matches;
}

function WeatherIcon({ condition }: { condition: WeatherCondition }) {
  switch (condition) {
    case 'sunny':
      return <Sun className="h-3.5 w-3.5 text-amber-500" />;
    case 'cloudy':
      return <Cloud className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'rainy':
      return <CloudRain className="h-3.5 w-3.5 text-blue-500" />;
    case 'snowy':
      return <Snowflake className="h-3.5 w-3.5 text-blue-400" />;
  }
}

export default function Schedule() {
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<MatchListResponse>({
    queryKey: ["/api/matches"],
  });

  const { matches, isDemo } = useMemo(() => {
    if (data?.matches && data.matches.length > 0) {
      return { matches: data.matches, isDemo: false };
    }
    return { matches: generateMockMatches(), isDemo: true };
  }, [data?.matches]);

  const displayDate = useMemo(() => {
    if (data?.date) return data.date;
    const now = new Date();
    return now.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, [data?.date]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-lg">경기 일정</h1>
            {isDemo && !isLoading && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/50 bg-amber-500/10">
                Demo
              </Badge>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        <p className="text-sm text-muted-foreground mb-4" data-testid="text-date">
          {displayDate}
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : matches.length > 0 ? (
          <div className="space-y-3">
            {matches.map((match) => (
              <Card
                key={match.id}
                className="p-4 cursor-pointer hover-elevate"
                onClick={() => navigate(`/match/${match.id}`)}
                data-testid={`card-match-${match.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <img 
                          src={match.homeTeam.logoUrl} 
                          alt={match.homeTeam.name}
                          className="w-8 h-8 object-contain"
                        />
                        <div>
                          <div className="font-medium text-sm">{match.homeTeam.name}</div>
                          <div className="text-xs text-muted-foreground">{match.homeTeam.leagueRank}위</div>
                        </div>
                      </div>
                      
                      <span className="text-xs text-muted-foreground px-2">vs</span>
                      
                      <div className="flex items-center gap-2">
                        <img 
                          src={match.awayTeam.logoUrl} 
                          alt={match.awayTeam.name}
                          className="w-8 h-8 object-contain"
                        />
                        <div>
                          <div className="font-medium text-sm">{match.awayTeam.name}</div>
                          <div className="text-xs text-muted-foreground">{match.awayTeam.leagueRank}위</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{match.venue}</span>
                      <span>·</span>
                      <div className="flex items-center gap-1">
                        <WeatherIcon condition={match.weather.condition} />
                        <span>{match.weather.temperature}°C</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-1">
                      {match.homeTeam.recentResults.slice(0, 3).map((r, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={`w-5 h-5 p-0 flex items-center justify-center text-[10px] font-bold ${
                            r === 'W' ? 'bg-green-500/20 text-green-600 border-green-500/30' :
                            r === 'L' ? 'bg-red-500/20 text-red-600 border-red-500/30' :
                            'bg-gray-500/20 text-gray-600 border-gray-500/30'
                          }`}
                        >
                          {r}
                        </Badge>
                      ))}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center text-muted-foreground">
            <p>예정된 경기가 없습니다</p>
          </Card>
        )}
      </main>
    </div>
  );
}
