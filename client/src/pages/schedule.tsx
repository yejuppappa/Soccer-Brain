import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Calendar, LayoutGrid, List, RefreshCw, Brain, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";

interface Prediction {
  fixtureId: string;
  kickoffAt: string;
  status: string;
  league: {
    id: string;
    name: string;
    country: string;
  };
  homeTeam: {
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string | null;
    logoUrl: string | null;
  };
  odds: {
    home: number;
    draw: number;
    away: number;
  } | null;
  prediction: {
    homeProb: number;
    drawProb: number;
    awayProb: number;
    expectedValue: {
      home: number;
      draw: number;
      away: number;
      best: string;
      bestValue: number;
    };
    isRecommended: boolean;
    confidence: string;
    hasFeatures: boolean;
  };
}

// 카드 뷰 컴포넌트
function MatchCardView({ match, onClick }: { match: Prediction; onClick: () => void }) {
  const kickoff = new Date(match.kickoffAt);
  const timeStr = kickoff.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const defaultLogo = "https://via.placeholder.com/40?text=⚽";

  return (
    <Card 
      className={`p-4 cursor-pointer hover:shadow-md transition-all ${match.prediction.isRecommended ? 'border-primary/50 bg-primary/5' : ''}`}
      onClick={onClick}
    >
      {/* 헤더: 시간 & 경기장 */}
      <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span>{timeStr}</span>
          <span>•</span>
          <span>{match.league.name}</span>
        </div>
        {match.prediction.isRecommended && (
          <Badge className="bg-primary text-[10px]">AI 추천</Badge>
        )}
      </div>

      {/* 팀 정보 & 배당 */}
      <div className="flex items-center justify-between mb-3">
        {/* 홈팀 */}
        <div className="flex items-center gap-2 flex-1">
          <img 
            src={match.homeTeam.logoUrl || defaultLogo} 
            className="w-10 h-10 object-contain"
            alt=""
            onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }}
          />
          <div>
            <div className="font-bold text-sm">{match.homeTeam.shortName || match.homeTeam.name}</div>
            <Badge variant="outline" className="text-[9px] mt-0.5 border-red-200 text-red-600 bg-red-50/50">홈</Badge>
          </div>
        </div>

        {/* 배당 */}
        <div className="text-center px-3">
          {match.odds ? (
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <div className="flex gap-2 font-mono">
                <span>{match.odds.home.toFixed(2)}</span>
                <span>{match.odds.draw.toFixed(2)}</span>
                <span>{match.odds.away.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">VS</span>
          )}
        </div>

        {/* 원정팀 */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="text-right">
            <div className="font-bold text-sm">{match.awayTeam.shortName || match.awayTeam.name}</div>
            <Badge variant="outline" className="text-[9px] mt-0.5 border-blue-200 text-blue-600 bg-blue-50/50">원정</Badge>
          </div>
          <img 
            src={match.awayTeam.logoUrl || defaultLogo} 
            className="w-10 h-10 object-contain"
            alt=""
            onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }}
          />
        </div>
      </div>

      {/* AI 예측 확률 */}
      <div className="bg-muted/30 rounded-lg p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Brain className="w-3 h-3" />
            <span>AI 예측</span>
          </div>
          {match.prediction.expectedValue.bestValue > 0 && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <Target className="w-3 h-3" />
              <span>+{match.prediction.expectedValue.bestValue}%</span>
            </div>
          )}
        </div>
        <div className="flex justify-between mt-2 text-sm">
          <div className="text-center flex-1">
            <div className={`font-bold ${match.prediction.homeProb >= 50 ? 'text-green-600' : ''}`}>
              {match.prediction.homeProb}%
            </div>
            <div className="text-[10px] text-muted-foreground">홈승</div>
          </div>
          <div className="text-center flex-1">
            <div className="font-bold text-muted-foreground">{match.prediction.drawProb}%</div>
            <div className="text-[10px] text-muted-foreground">무</div>
          </div>
          <div className="text-center flex-1">
            <div className={`font-bold ${match.prediction.awayProb >= 50 ? 'text-green-600' : ''}`}>
              {match.prediction.awayProb}%
            </div>
            <div className="text-[10px] text-muted-foreground">원정승</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// 리스트 뷰 컴포넌트
function MatchListView({ match, onClick }: { match: Prediction; onClick: () => void }) {
  const kickoff = new Date(match.kickoffAt);
  const timeStr = kickoff.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const defaultLogo = "https://via.placeholder.com/24?text=⚽";

  const bestPick = match.prediction.homeProb >= match.prediction.awayProb ? "홈" : "원정";
  const bestProb = Math.max(match.prediction.homeProb, match.prediction.awayProb);

  return (
    <Card 
      className={`p-3 cursor-pointer hover:shadow-md transition-all ${match.prediction.isRecommended ? 'border-primary/50' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {/* 시간 */}
        <div className="text-xs text-muted-foreground w-12 text-center">
          {timeStr}
        </div>

        {/* 팀 정보 */}
        <div className="flex-1 flex items-center gap-2">
          <img 
            src={match.homeTeam.logoUrl || defaultLogo} 
            className="w-6 h-6 object-contain"
            alt=""
            onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }}
          />
          <span className="text-sm font-medium truncate max-w-[70px]">
            {match.homeTeam.shortName || match.homeTeam.name}
          </span>
          <span className="text-xs text-muted-foreground">vs</span>
          <span className="text-sm font-medium truncate max-w-[70px]">
            {match.awayTeam.shortName || match.awayTeam.name}
          </span>
          <img 
            src={match.awayTeam.logoUrl || defaultLogo} 
            className="w-6 h-6 object-contain"
            alt=""
            onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }}
          />
        </div>

        {/* AI 예측 */}
        <div className="flex items-center gap-2">
          <Badge 
            variant={match.prediction.isRecommended ? "default" : "outline"}
            className={`text-[10px] ${match.prediction.isRecommended ? 'bg-green-600' : ''}`}
          >
            {bestPick} {bestProb}%
          </Badge>
        </div>
      </div>
    </Card>
  );
}

// 로딩 스켈레톤
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1,2,3,4,5].map(i => (
        <Skeleton key={i} className="h-[140px] w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function Schedule() {
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/predictions/upcoming?days=7&limit=50");
      const data = await res.json();
      
      if (data.ok) {
        setPredictions(data.data);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const displayDate = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // 날짜별 그룹핑
  const groupedByDate = predictions.reduce((acc, match) => {
    const date = new Date(match.kickoffAt).toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(match);
    return acc;
  }, {} as Record<string, Prediction[]>);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-background border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-lg">경기 일정</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchPredictions} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* 날짜 & 뷰 모드 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-muted-foreground">{displayDate}</p>
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 ${viewMode === 'card' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 ${viewMode === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 로딩 */}
        {loading && <LoadingSkeleton />}

        {/* 에러 */}
        {error && (
          <Card className="p-4 border-red-200 bg-red-50 text-center">
            <p className="text-red-600 text-sm mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchPredictions}>
              다시 시도
            </Button>
          </Card>
        )}

        {/* 경기 목록 */}
        {!loading && !error && predictions.length > 0 && (
          <div className="space-y-6">
            {Object.entries(groupedByDate).map(([date, matches]) => (
              <div key={date}>
                <h3 className="text-sm font-bold text-muted-foreground mb-2 sticky top-14 bg-background py-1">
                  📅 {date} ({matches.length}경기)
                </h3>
                <div className="space-y-2">
                  {matches.map((match) => (
                    viewMode === 'card' ? (
                      <MatchCardView 
                        key={match.fixtureId}
                        match={match}
                        onClick={() => navigate(`/match/${match.fixtureId}`)}
                      />
                    ) : (
                      <MatchListView
                        key={match.fixtureId}
                        match={match}
                        onClick={() => navigate(`/match/${match.fixtureId}`)}
                      />
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 경기 없음 */}
        {!loading && !error && predictions.length === 0 && (
          <Card className="p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">예정된 경기가 없습니다</p>
          </Card>
        )}
      </main>
    </div>
  );
}
