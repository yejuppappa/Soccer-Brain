import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Trophy } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import type { MatchListResponse, Team, WinDrawLossProbability } from "@shared/schema";

export default function MatchList() {
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<MatchListResponse>({
    queryKey: ["/api/matches"],
  });

  const calculateBaseProbability = (homeTeam: Team, awayTeam: Team): WinDrawLossProbability => {
    const rankDiff = awayTeam.leagueRank - homeTeam.leagueRank;
    const homeRecentWins = homeTeam.recentResults.filter(r => r === 'W').length;
    const awayRecentWins = awayTeam.recentResults.filter(r => r === 'W').length;
    
    let homeWin = 35 + (rankDiff * 2) + (homeRecentWins * 2) - (awayRecentWins * 1);
    let awayWin = 35 - (rankDiff * 2) + (awayRecentWins * 2) - (homeRecentWins * 1);
    
    homeWin = Math.min(Math.max(Math.round(homeWin), 15), 60);
    awayWin = Math.min(Math.max(Math.round(awayWin), 15), 60);
    const draw = 100 - homeWin - awayWin;
    
    return { homeWin, draw, awayWin };
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-destructive font-medium" data-testid="text-error">데이터를 불러오는데 실패했습니다</p>
          <p className="text-sm text-muted-foreground mt-2">잠시 후 다시 시도해주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold">축구 승률 분석</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1" data-testid="text-title">오늘의 경기</h2>
          <p className="text-sm text-muted-foreground">
            {data?.date || new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))
          ) : (
            data?.matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                probability={calculateBaseProbability(match.homeTeam, match.awayTeam)}
                onClick={() => navigate(`/match/${match.id}`)}
              />
            ))
          )}
        </div>

        {!isLoading && data?.matches.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium" data-testid="text-empty">오늘 예정된 경기가 없습니다</p>
          </div>
        )}
      </main>

    </div>
  );
}
