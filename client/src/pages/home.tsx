import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, Brain, TrendingDown, Flame, ChevronRight, Sparkles, Megaphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import type { MatchListResponse, Match } from "@shared/schema";

function calculateWinProbability(match: Match): { probability: number; winner: 'home' | 'away' | 'draw' } {
  const homeRank = match.homeTeam.leagueRank;
  const awayRank = match.awayTeam.leagueRank;
  
  const homeWins = match.homeTeam.recentResults.filter(r => r === 'W').length;
  const awayWins = match.awayTeam.recentResults.filter(r => r === 'W').length;
  
  let homeScore = (21 - homeRank) * 3 + homeWins * 8 + 10;
  let awayScore = (21 - awayRank) * 3 + awayWins * 8;
  
  const total = homeScore + awayScore;
  const homeWinProb = Math.round((homeScore / total) * 100);
  const awayWinProb = Math.round((awayScore / total) * 100);
  
  if (homeWinProb >= awayWinProb + 5) {
    return { probability: homeWinProb, winner: 'home' };
  } else if (awayWinProb >= homeWinProb + 5) {
    return { probability: awayWinProb, winner: 'away' };
  }
  return { probability: Math.max(homeWinProb, awayWinProb), winner: 'draw' };
}

function generatePredictedScore(match: Match, probability: number): string {
  const seed = match.id.charCodeAt(6) + probability;
  const rand = Math.sin(seed) * 10000;
  const r = rand - Math.floor(rand);
  
  if (probability >= 70) {
    const winnerGoals = Math.min(4, Math.max(2, Math.round(2 + r)));
    const loserGoals = Math.round(r);
    return `${winnerGoals} - ${loserGoals}`;
  }
  const goals = Math.round(1 + r);
  return `${goals} - ${goals}`;
}

export default function Home() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<MatchListResponse>({
    queryKey: ["/api/matches"],
  });

  const topPicks = useMemo(() => {
    if (!data?.matches) return [];
    
    return data.matches
      .map(match => ({
        match,
        ...calculateWinProbability(match)
      }))
      .filter(item => item.probability >= 70)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3);
  }, [data?.matches]);

  const droppingOdds = useMemo(() => {
    if (!data?.matches) return [];
    
    return data.matches
      .filter(match => {
        const trends = match.odds.domesticTrend;
        return trends.includes('down');
      })
      .slice(0, 4);
  }, [data?.matches]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Soccer Brain</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button 
              className="p-2 rounded-full hover:bg-muted transition-colors"
              data-testid="button-notifications"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-6">
        {/* Ticker Banner */}
        <div 
          className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg p-3"
          data-testid="ticker-banner"
        >
          <div className="flex items-center gap-2 text-sm">
            <Megaphone className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-amber-700 dark:text-amber-400">
              어제 AI 예측 적중률 80% 달성! (4/5)
            </span>
          </div>
        </div>

        {/* Section 1: AI Top Picks */}
        <section data-testid="section-top-picks">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-5 w-5 text-orange-500" />
            <h2 className="font-bold text-base">AI 추천 승부</h2>
            <Badge variant="secondary" className="text-xs">Top Picks</Badge>
          </div>

          {isLoading ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-36 w-64 flex-shrink-0 rounded-xl" />
              ))}
            </div>
          ) : topPicks.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {topPicks.map(({ match, probability, winner }) => (
                <Card
                  key={match.id}
                  className="flex-shrink-0 w-64 p-4 cursor-pointer hover-elevate"
                  onClick={() => navigate(`/match/${match.id}`)}
                  data-testid={`card-top-pick-${match.id}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <img 
                        src={match.homeTeam.logoUrl} 
                        alt={match.homeTeam.shortName}
                        className="w-8 h-8 object-contain"
                      />
                      <span className="text-xs font-medium">vs</span>
                      <img 
                        src={match.awayTeam.logoUrl} 
                        alt={match.awayTeam.shortName}
                        className="w-8 h-8 object-contain"
                      />
                    </div>
                    <Badge 
                      className={`${
                        probability >= 70 
                          ? 'bg-green-500' 
                          : 'bg-blue-500'
                      } text-white border-0`}
                    >
                      {probability}%
                    </Badge>
                  </div>
                  
                  <div className="text-sm font-medium mb-1">
                    {match.homeTeam.shortName} vs {match.awayTeam.shortName}
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-3">
                    {winner === 'home' ? `${match.homeTeam.shortName} 승 예상` : 
                     winner === 'away' ? `${match.awayTeam.shortName} 승 예상` : '박빙 승부'}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Sparkles className="h-3 w-3" />
                      예상: {generatePredictedScore(match, probability)}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center text-muted-foreground">
              <p className="text-sm">현재 추천 승부가 없습니다</p>
            </Card>
          )}
        </section>

        {/* Section 2: Dropping Odds */}
        <section data-testid="section-dropping-odds">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-5 w-5 text-red-500" />
            <h2 className="font-bold text-base">배당 급락 포착</h2>
            <Badge variant="destructive" className="text-xs">HOT</Badge>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : droppingOdds.length > 0 ? (
            <div className="space-y-2">
              {droppingOdds.map((match) => {
                const homeDropping = match.odds.domesticTrend[0] === 'down';
                const awayDropping = match.odds.domesticTrend[2] === 'down';
                
                return (
                  <Card
                    key={match.id}
                    className="p-3 cursor-pointer hover-elevate"
                    onClick={() => navigate(`/match/${match.id}`)}
                    data-testid={`card-dropping-${match.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <img 
                            src={match.homeTeam.logoUrl} 
                            alt={match.homeTeam.shortName}
                            className="w-6 h-6 object-contain"
                          />
                          <span className="text-sm font-medium">{match.homeTeam.shortName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">vs</span>
                        <div className="flex items-center gap-1">
                          <img 
                            src={match.awayTeam.logoUrl} 
                            alt={match.awayTeam.shortName}
                            className="w-6 h-6 object-contain"
                          />
                          <span className="text-sm font-medium">{match.awayTeam.shortName}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {homeDropping && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            {match.homeTeam.shortName} {match.odds.domestic[0].toFixed(2)} 
                            <TrendingDown className="h-3 w-3" />
                          </Badge>
                        )}
                        {awayDropping && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            {match.awayTeam.shortName} {match.odds.domestic[2].toFixed(2)}
                            <TrendingDown className="h-3 w-3" />
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-6 text-center text-muted-foreground">
              <p className="text-sm">현재 배당 급락 경기가 없습니다</p>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
