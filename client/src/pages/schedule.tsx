import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Calendar, TrendingDown, TrendingUp, Minus, CloudRain, Sun, Cloud, Snowflake, Flame, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSport } from "@/contexts/sport-context";
import { usePicks } from "@/contexts/pick-context";
import { SportPlaceholder } from "@/components/sport-placeholder";
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
      sportType: 'soccer',
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
        domestic: [1.5 + Math.random() * 1.5, 3.2 + Math.random() * 0.8, 2.5 + Math.random() * 2],
        overseas: [1.6 + Math.random() * 1.5, 3.3 + Math.random() * 0.8, 2.6 + Math.random() * 2],
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

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  switch (trend) {
    case 'down':
      return <TrendingDown className="h-3 w-3 text-red-500" />;
    case 'up':
      return <TrendingUp className="h-3 w-3 text-green-500" />;
    case 'stable':
      return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
}

interface OddsButtonProps {
  label: string;
  odds: number;
  trend: 'up' | 'down' | 'stable';
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  testId: string;
}

function OddsButton({ label, odds, trend, isSelected, onClick, testId }: OddsButtonProps) {
  return (
    <Button
      variant={isSelected ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-0.5 relative"
      data-testid={testId}
    >
      {trend === 'down' && (
        <Badge 
          variant="destructive" 
          className="absolute -top-2 -right-1 text-[8px] px-1 py-0 h-4"
        >
          <Flame className="h-2.5 w-2.5 mr-0.5" />
          HOT
        </Badge>
      )}
      <span className="text-[10px] opacity-70">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-bold text-sm">{odds.toFixed(2)}</span>
        <TrendIcon trend={trend} />
      </div>
    </Button>
  );
}

export default function Schedule() {
  const [, navigate] = useLocation();
  const { currentSport } = useSport();
  const { togglePick, getPickForMatch } = usePicks();

  const { data, isLoading } = useQuery<MatchListResponse>({
    queryKey: ["/api/matches"],
    enabled: currentSport === 'soccer',
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

  if (currentSport !== 'soccer') {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-background border-b">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h1 className="font-bold text-lg">경기 일정</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <SportPlaceholder />
      </div>
    );
  }

  const handleOddsClick = (match: Match, selection: 'home' | 'draw' | 'away', odds: number, e: React.MouseEvent) => {
    e.stopPropagation();
    togglePick({
      matchId: match.id,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      matchTime: match.matchTime,
      selection,
      odds,
      league: "Premier League"
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("ko-KR", { hour: '2-digit', minute: '2-digit' });
  };

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
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : matches.length > 0 ? (
          <div className="space-y-3">
            {matches.map((match) => {
              const currentPick = getPickForMatch(match.id);
              
              return (
                <Card
                  key={match.id}
                  className="overflow-hidden"
                  data-testid={`card-match-${match.id}`}
                >
                  <div 
                    className="p-3 cursor-pointer hover-elevate"
                    onClick={() => navigate(`/match/${match.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatTime(match.matchTime)}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{match.venue}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <WeatherIcon condition={match.weather.condition} />
                        <span className="text-xs text-muted-foreground">{match.weather.temperature}°C</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <img 
                          src={match.homeTeam.logoUrl} 
                          alt={match.homeTeam.name}
                          className="w-8 h-8 object-contain shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{match.homeTeam.shortName || match.homeTeam.name}</div>
                          <div className="text-xs text-muted-foreground">{match.homeTeam.leagueRank}위</div>
                        </div>
                      </div>
                      
                      <span className="text-lg font-bold text-muted-foreground px-3">VS</span>
                      
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                        <div className="min-w-0 text-right">
                          <div className="font-medium text-sm truncate">{match.awayTeam.shortName || match.awayTeam.name}</div>
                          <div className="text-xs text-muted-foreground">{match.awayTeam.leagueRank}위</div>
                        </div>
                        <img 
                          src={match.awayTeam.logoUrl} 
                          alt={match.awayTeam.name}
                          className="w-8 h-8 object-contain shrink-0"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-3 pb-3 border-t pt-3 bg-muted/30">
                    <div className="flex gap-2">
                      <OddsButton
                        label="홈승"
                        odds={match.odds.domestic[0]}
                        trend={match.odds.domesticTrend[0]}
                        isSelected={currentPick?.selection === 'home'}
                        onClick={(e) => handleOddsClick(match, 'home', match.odds.domestic[0], e)}
                        testId={`button-odds-home-${match.id}`}
                      />
                      <OddsButton
                        label="무승부"
                        odds={match.odds.domestic[1]}
                        trend={match.odds.domesticTrend[1]}
                        isSelected={currentPick?.selection === 'draw'}
                        onClick={(e) => handleOddsClick(match, 'draw', match.odds.domestic[1], e)}
                        testId={`button-odds-draw-${match.id}`}
                      />
                      <OddsButton
                        label="원정승"
                        odds={match.odds.domestic[2]}
                        trend={match.odds.domesticTrend[2]}
                        isSelected={currentPick?.selection === 'away'}
                        onClick={(e) => handleOddsClick(match, 'away', match.odds.domestic[2], e)}
                        testId={`button-odds-away-${match.id}`}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
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
