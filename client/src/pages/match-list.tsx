import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Trophy, Loader2, AlertCircle } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MatchListResponse, Team, WinDrawLossProbability } from "@shared/schema";

interface ApiErrorResponse {
  error: string;
  apiError: string;
  matches: [];
  date: string;
}

export default function MatchList() {
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<MatchListResponse, Error, MatchListResponse | ApiErrorResponse>({
    queryKey: ["/api/matches"],
    retry: false,
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

  const apiError = (data as ApiErrorResponse)?.apiError;
  
  if (error || apiError) {
    const errorMsg = apiError || error?.message || "Unknown error";
    return (
      <div className="min-h-screen bg-background p-4">
        <header className="sticky top-0 z-50 bg-background border-b mb-6">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-bold">축구 승률 분석</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        
        <div className="max-w-lg mx-auto">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>API Error</AlertTitle>
            <AlertDescription className="mt-2 font-mono text-xs break-all" data-testid="text-api-error">
              {errorMsg}
            </AlertDescription>
          </Alert>
          
          <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
            <p className="text-destructive font-bold text-lg mb-2">API 연동 실패</p>
            <p className="text-destructive/80 text-sm mb-4">
              Fallback(Mock Data)이 비활성화된 상태입니다. 아래 에러 내용을 확인하세요.
            </p>
            <pre className="bg-background text-foreground p-3 rounded text-xs overflow-auto whitespace-pre-wrap" data-testid="text-error-detail">
              {errorMsg}
            </pre>
          </div>
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
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm" data-testid="text-loading">데이터 불러오는 중...</p>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </div>
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
