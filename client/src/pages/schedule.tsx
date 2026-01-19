import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Calendar, CloudRain, Sun, Cloud, Snowflake, ChevronRight } from "lucide-react";
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

interface ExtendedMatch extends Match {
  aiProb: {
    home: number;
    draw: number;
    away: number;
  };
}

function generateMockMatches(): ExtendedMatch[] {
  const matches: ExtendedMatch[] = [];
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

    // Generate AI probabilities that sum to 100%
    const homeBase = 30 + Math.floor(Math.random() * 40); // 30-70%
    const drawBase = 15 + Math.floor(Math.random() * 20); // 15-35%
    const awayBase = 100 - homeBase - drawBase;
    // Ensure all are positive
    const homeProb = Math.max(10, homeBase);
    const drawProb = Math.max(10, drawBase);
    const awayProb = Math.max(10, 100 - homeProb - drawProb);
    // Normalize to exactly 100
    const total = homeProb + drawProb + awayProb;
    const aiProb = {
      home: Math.round((homeProb / total) * 100),
      draw: Math.round((drawProb / total) * 100),
      away: 100 - Math.round((homeProb / total) * 100) - Math.round((drawProb / total) * 100),
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
      aiProb,
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

// Trend arrow with colored text (red=up/rising odds, blue=down/falling odds)
function TrendArrow({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <span className="text-red-500 font-medium ml-0.5">▲</span>;
  if (trend === 'down') return <span className="text-blue-500 font-medium ml-0.5">▼</span>;
  return null;
}

interface OddsButtonProps {
  label: string;
  domesticOdds: number;
  overseasOdds: number;
  aiProb: number;
  trend: 'up' | 'down' | 'stable';
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  testId: string;
}

function OddsButton({ label, domesticOdds, overseasOdds, aiProb, trend, isSelected, onClick, testId }: OddsButtonProps) {
  return (
    <div className="h-[88px]">
      <Button
        variant={isSelected ? "default" : "outline"}
        onClick={onClick}
        data-testid={testId}
        className="w-full h-full flex flex-col items-center justify-center gap-0 px-1"
      >
        {/* Label */}
        <span className={`text-[10px] mb-0.5 ${isSelected ? 'opacity-80' : 'text-muted-foreground'}`}>
          {label}
        </span>
        
        {/* Main: Domestic Odds + Trend Arrow */}
        <div className="flex items-center justify-center">
          <span className="font-bold text-xl">
            {domesticOdds.toFixed(2)}
          </span>
          {!isSelected && <TrendArrow trend={trend} />}
        </div>
        
        {/* Sub: EU Odds */}
        <span className={`text-[10px] mt-0.5 ${isSelected ? 'opacity-70' : 'text-muted-foreground/70'}`}>
          (EU {overseasOdds.toFixed(2)})
        </span>
        
        {/* AI Probability Bar */}
        <div className="w-full px-1 mt-1.5">
          <div className={`h-1 rounded-full overflow-hidden ${isSelected ? 'bg-primary-foreground/30' : 'bg-muted'}`}>
            <div 
              className={`h-full rounded-full transition-all ${isSelected ? 'bg-primary-foreground/80' : 'bg-blue-500 dark:bg-blue-400'}`}
              style={{ width: `${aiProb}%` }}
            />
          </div>
          <span className={`text-[9px] block text-center mt-0.5 ${isSelected ? 'opacity-70' : 'text-muted-foreground/60'}`}>
            AI {aiProb}%
          </span>
        </div>
      </Button>
    </div>
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
      // Add AI probabilities to API matches (normalized to 100%)
      return { 
        matches: data.matches.map(m => {
          const homeBase = 30 + Math.floor(Math.random() * 40);
          const drawBase = 15 + Math.floor(Math.random() * 20);
          const awayBase = 15 + Math.floor(Math.random() * 30);
          const total = homeBase + drawBase + awayBase;
          return {
            ...m,
            aiProb: {
              home: Math.round((homeBase / total) * 100),
              draw: Math.round((drawBase / total) * 100),
              away: 100 - Math.round((homeBase / total) * 100) - Math.round((drawBase / total) * 100),
            }
          };
        }) as ExtendedMatch[], 
        isDemo: false 
      };
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
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatTime(match.matchTime)}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground truncate">{match.venue}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
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
                  
                  {/* Odds Buttons - Professional Grid Layout */}
                  <div className="px-3 py-3 border-t bg-muted/20">
                    <div className="grid grid-cols-3 gap-2">
                      <OddsButton
                        label="홈승"
                        domesticOdds={match.odds.domestic[0]}
                        overseasOdds={match.odds.overseas[0]}
                        aiProb={match.aiProb.home}
                        trend={match.odds.domesticTrend[0]}
                        isSelected={currentPick?.selection === 'home'}
                        onClick={(e) => handleOddsClick(match, 'home', match.odds.domestic[0], e)}
                        testId={`button-odds-home-${match.id}`}
                      />
                      <OddsButton
                        label="무승부"
                        domesticOdds={match.odds.domestic[1]}
                        overseasOdds={match.odds.overseas[1]}
                        aiProb={match.aiProb.draw}
                        trend={match.odds.domesticTrend[1]}
                        isSelected={currentPick?.selection === 'draw'}
                        onClick={(e) => handleOddsClick(match, 'draw', match.odds.domestic[1], e)}
                        testId={`button-odds-draw-${match.id}`}
                      />
                      <OddsButton
                        label="원정승"
                        domesticOdds={match.odds.domestic[2]}
                        overseasOdds={match.odds.overseas[2]}
                        aiProb={match.aiProb.away}
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
