import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Clock, MapPin, Users, LayoutList, Shield, Sparkles, Brain, Trophy, Table2, Star, Gem, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProbabilityGaugeBar } from "@/components/probability-gauge-bar";
import { TeamRadarChart } from "@/components/team-radar-chart";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VoteChoice } from "@shared/schema";

// --- TYPES ---
interface Player { id: number; name: string; number: number; pos: { t: string, l: string } }

interface V9Analysis {
  mlProb: { home: number; draw: number; away: number; };
  mlPick: { pick: 'home' | 'draw' | 'away'; pickProb: number; pickName: string; };
  recommendation: { level: 'STRONG' | 'MEDIUM' | 'NONE'; stars: number; reason: string; };
  drawWarning: { isClose: boolean; likelihood: number; message: string | null; };
  valueBet: { isValue: boolean; ev: number; message: string | null; };
}

interface Standing {
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  form: string | null;
}

interface FixtureData {
  fixture: {
    id: string;
    kickoffAt: string;
    status: string;
    homeTeam: { id: string; name: string; shortName: string; logoUrl: string; standing?: Standing | null; };
    awayTeam: { id: string; name: string; shortName: string; logoUrl: string; standing?: Standing | null; };
    league: { id: string; name: string; country: string; };
    odds: { home: number; draw: number; away: number; isEstimated?: boolean; } | null;
    venue?: { name: string | null; city: string | null; } | null;
    weather?: { temp: number | null; condition: string | null; icon?: string | null; } | null;
  };
  prediction?: {
    homeProb: number; drawProb: number; awayProb: number;
    expectedValue: { home: number | null; draw: number | null; away: number | null; best: string; bestValue: number | null; };
    hasFeatures: boolean;
  };
  v9?: V9Analysis;
  features: {
    homeForm3?: number;
    homeForm5?: number;
    awayForm3?: number;
    awayForm5?: number;
    homeWinsAtHome?: number;
    awayWinsAtAway?: number;
    homeGoalsAtHome?: number;
    awayGoalsAtAway?: number;
    homeGoalsFor?: number;
    homeGoalsAgainst?: number;
    awayGoalsFor?: number;
    awayGoalsAgainst?: number;
    homeDaysRest?: number;
    awayDaysRest?: number;
    restDiff?: number;
    h2hTotal?: number;
    h2hHomeWins?: number;
    h2hAwayWins?: number;
    h2hDraws?: number;
    h2hHomeWinPct?: number;
    homeXg?: number;
    awayXg?: number;
    homeShotsOnTarget?: number;
    awayShotsOnTarget?: number;
    homePossession?: number;
    awayPossession?: number;
  } | null;
}

// --- HELPER COMPONENTS ---

function ConfidenceBadge({ level, stars }: { level: string; stars: number }) {
  const colors: Record<string, string> = {
    STRONG: 'bg-green-500/10 text-green-600 border-green-500/30',
    MEDIUM: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    NONE: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
  };
  const labels: Record<string, string> = {
    STRONG: '높은 신뢰도',
    MEDIUM: '보통 신뢰도',
    NONE: '낮은 신뢰도',
  };
  
  return (
    <Badge variant="outline" className={`${colors[level] || colors.NONE} gap-1`}>
      {[...Array(stars)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
      {[...Array(Math.max(0, 3 - stars))].map((_, i) => <Star key={i + stars} className="w-3 h-3" />)}
      <span className="ml-1">{labels[level] || level}</span>
    </Badge>
  );
}

function ValueBetBadge({ valueBet }: { valueBet: V9Analysis['valueBet'] | null }) {
  if (!valueBet || !valueBet.isValue) return null;
  
  return (
    <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 rounded-lg p-3 mt-3">
      <div className="flex items-center gap-2 mb-1">
        <Gem className="w-4 h-4 text-amber-500" />
        <span className="font-bold text-sm text-amber-600">💎 배당가치 베팅</span>
      </div>
      <p className="text-xs text-muted-foreground">
        기대수익률 <span className="font-bold text-green-600">+{valueBet.ev.toFixed(1)}%</span> — AI 확률 대비 배당이 좋습니다
      </p>
    </div>
  );
}

function StatRow({ label, homeValue, awayValue, highlight }: { label: string, homeValue: string | number, awayValue: string | number, highlight?: boolean }) {
  return (
    <div className={`grid grid-cols-[1fr_100px_1fr] text-xs py-2.5 border-b border-border/50 last:border-0 ${highlight ? 'bg-muted/30 font-medium' : ''}`}>
      <div className="text-center text-foreground">{homeValue}</div>
      <div className="text-center text-muted-foreground bg-muted/20 mx-2 rounded flex items-center justify-center h-full">{label}</div>
      <div className="text-center text-foreground">{awayValue}</div>
    </div>
  );
}

function generateLineup(isHome: boolean): Player[] {
  const homePos = [
    { t: '93%', l: '50%' },
    { t: '82%', l: '15%' }, { t: '82%', l: '38%' }, { t: '82%', l: '62%' }, { t: '82%', l: '85%' },
    { t: '68%', l: '30%' }, { t: '65%', l: '50%' }, { t: '68%', l: '70%' },
    { t: '55%', l: '20%' }, { t: '53%', l: '50%' }, { t: '55%', l: '80%' },
  ];
  
  const awayPos = [
    { t: '7%', l: '50%' },
    { t: '18%', l: '15%' }, { t: '18%', l: '38%' }, { t: '18%', l: '62%' }, { t: '18%', l: '85%' },
    { t: '32%', l: '30%' }, { t: '35%', l: '50%' }, { t: '32%', l: '70%' },
    { t: '45%', l: '20%' }, { t: '47%', l: '50%' }, { t: '45%', l: '80%' },
  ];

  const positions = isHome ? homePos : awayPos;
  const names = ["GK", "RB", "CB", "CB", "LB", "CM", "CM", "CM", "RW", "ST", "LW"];

  return positions.map((pos, i) => ({
    id: i,
    name: names[i] || `Player ${i}`,
    number: i === 0 ? 1 : i + 2,
    pos
  }));
}

function WhiteTacticalBoard({ homeTeam, awayTeam }: { homeTeam: any, awayTeam: any }) {
  const homeLineup = generateLineup(true);
  const awayLineup = generateLineup(false);
  
  return (
    <div className="relative w-full aspect-[3/4.2] bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-border/50 shadow-sm select-none">
      <div className="absolute inset-6 border-2 border-slate-100 dark:border-slate-800 rounded-sm" /> 
      <div className="absolute top-1/2 left-6 right-6 h-0.5 bg-slate-100 dark:bg-slate-800" /> 
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border-2 border-slate-100 dark:border-slate-800 rounded-full" /> 
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-56 h-28 border-b-2 border-l-2 border-r-2 border-slate-100 dark:border-slate-800" />
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-24 h-12 border-b-2 border-l-2 border-r-2 border-slate-100 dark:border-slate-800" />
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-56 h-28 border-t-2 border-l-2 border-r-2 border-slate-100 dark:border-slate-800" />
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-24 h-12 border-t-2 border-l-2 border-r-2 border-slate-100 dark:border-slate-800" />

      {awayLineup.map((p: Player) => (
        <div key={`a-${p.id}`} className="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 z-10" style={{ top: p.pos.t, left: p.pos.l }}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-sm border-2 border-white dark:border-zinc-800 flex items-center justify-center text-[10px] font-bold text-white">
            {p.number}
          </div>
          <span className="mt-0.5 text-[9px] font-bold text-slate-500 dark:text-slate-400">{p.name}</span>
        </div>
      ))}

      {homeLineup.map((p: Player) => (
        <div key={`h-${p.id}`} className="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 z-10" style={{ top: p.pos.t, left: p.pos.l }}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-sm border-2 border-white dark:border-zinc-800 flex items-center justify-center text-[10px] font-bold text-white">
            {p.number}
          </div>
          <span className="mt-0.5 text-[9px] font-bold text-slate-500 dark:text-slate-400">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <Skeleton className="h-6 w-48 mx-auto" />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </main>
    </div>
  );
}

// --- MAIN COMPONENT ---

export default function MatchAnalysis() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);

  // API 호출
  const { data, isLoading, error } = useQuery<FixtureData>({
    queryKey: ["/api/predictions", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/predictions/${params.id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!params.id,
  });

  const voteMutation = useMutation({
    mutationFn: async (choice: VoteChoice) => {
      return apiRequest("POST", "/api/votes", { matchId: params.id, choice });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/votes", params.id] });
    },
  });

  const handleBack = () => {
    if (window.history.length > 1) window.history.back();
    else navigate("/");
  };

  const handleVote = (choice: VoteChoice) => {
    setSelectedVote(choice);
    voteMutation.mutate(choice);
  };

  if (isLoading) return <LoadingSkeleton />;
  
  if (error || !data?.fixture) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">경기를 찾을 수 없습니다</h2>
          <p className="text-muted-foreground mb-4">요청하신 경기 정보가 없거나 로드에 실패했습니다.</p>
          <Button onClick={handleBack}>돌아가기</Button>
        </Card>
      </div>
    );
  }

  const { fixture, v9, prediction, features } = data;
  const odds = fixture.odds;

  // V9 분석 결과 또는 prediction 폴백 또는 기본값
  const homeProb = v9?.mlProb.home ?? prediction?.homeProb ?? 45;
  const drawProb = v9?.mlProb.draw ?? prediction?.drawProb ?? 28;
  const awayProb = v9?.mlProb.away ?? prediction?.awayProb ?? 27;
  
  const mlPick = v9?.mlPick ?? { pick: 'home' as const, pickProb: homeProb, pickName: '홈 승' };
  const recommendation = v9?.recommendation ?? { level: 'NONE' as const, stars: 0, reason: '데이터 부족' };
  const valueBet = v9?.valueBet ?? null;
  const drawWarning = v9?.drawWarning ?? null;

  // AI 선택에 따른 팀명
  const aiPickTeamName = mlPick.pick === 'home' 
    ? fixture.homeTeam.name 
    : mlPick.pick === 'away' 
      ? fixture.awayTeam.name 
      : '무승부';

  // 경기 시간 포맷
  const kickoffDate = new Date(fixture.kickoffAt);
  const kickoffTime = kickoffDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const kickoffDateStr = kickoffDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

  // 레이더 차트용 팀 데이터
  const homeTeamData = {
    id: fixture.homeTeam.id,
    name: fixture.homeTeam.name,
    shortName: fixture.homeTeam.shortName || fixture.homeTeam.name.slice(0, 3).toUpperCase(),
    logoUrl: fixture.homeTeam.logoUrl,
    color: "from-red-400 to-red-600",
    attack: features?.homeGoalsFor ?? 1.5,
    defense: features?.homeGoalsAgainst ? 3 - features.homeGoalsAgainst : 2,
    form: features?.homeForm5 ?? 1.5,
    organization: features?.homeWinsAtHome ?? 50,
    goalScoring: features?.homeGoalsAtHome ?? 1.5,
  };

  const awayTeamData = {
    id: fixture.awayTeam.id,
    name: fixture.awayTeam.name,
    shortName: fixture.awayTeam.shortName || fixture.awayTeam.name.slice(0, 3).toUpperCase(),
    logoUrl: fixture.awayTeam.logoUrl,
    color: "from-blue-400 to-blue-600",
    attack: features?.awayGoalsFor ?? 1.3,
    defense: features?.awayGoalsAgainst ? 3 - features.awayGoalsAgainst : 1.8,
    form: features?.awayForm5 ?? 1.3,
    organization: features?.awayWinsAtAway ?? 40,
    goalScoring: features?.awayGoalsAtAway ?? 1.2,
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* 1. Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={handleBack} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col items-center">
            <h1 className="text-sm font-bold flex items-center gap-1">
              {fixture.homeTeam.name} <span className="text-muted-foreground text-xs font-normal">vs</span> {fixture.awayTeam.name}
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
              <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {fixture.league.name}</span>
              <span className="w-px h-2 bg-border" />
              <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {kickoffDateStr} {kickoffTime}</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        
        {/* 2. Top Summary Card */}
        <Card className="overflow-hidden border border-border shadow-sm">
          <div className="p-5 bg-background">
            <div className="flex justify-between items-center mb-6">
              {/* 홈팀 */}
              <div className="text-center w-1/3 flex flex-col items-center">
                <div className="relative">
                  <img src={fixture.homeTeam.logoUrl} className="w-14 h-14 object-contain" alt={fixture.homeTeam.name} />
                  <Badge variant="outline" className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] border-red-200 text-red-600 bg-background px-1.5 h-4">홈</Badge>
                </div>
                <div className="font-bold text-base mt-3 leading-none">{fixture.homeTeam.name}</div>
              </div>
              
              {/* 배당 정보 */}
              <div className="text-center w-1/3 flex flex-col items-center gap-2">
                <div className="text-3xl font-black text-muted-foreground/30 italic">VS</div>
                {odds && (
                  <div className="bg-muted/30 rounded px-3 py-1.5 border border-border/50">
                    <div className="grid grid-cols-3 gap-x-3 text-[11px] items-center text-center">
                      <span className="font-bold">{odds.home.toFixed(2)}</span>
                      <span className="font-bold">{odds.draw.toFixed(2)}</span>
                      <span className="font-bold">{odds.away.toFixed(2)}</span>
                      <span className="text-[9px] text-muted-foreground">홈</span>
                      <span className="text-[9px] text-muted-foreground">무</span>
                      <span className="text-[9px] text-muted-foreground">원정</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 원정팀 */}
              <div className="text-center w-1/3 flex flex-col items-center">
                <div className="relative">
                  <img src={fixture.awayTeam.logoUrl} className="w-14 h-14 object-contain" alt={fixture.awayTeam.name} />
                  <Badge variant="outline" className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] border-blue-200 text-blue-600 bg-background px-1.5 h-4">원정</Badge>
                </div>
                <div className="font-bold text-base mt-3 leading-none">{fixture.awayTeam.name}</div>
              </div>
            </div>

            {/* 확률 바 */}
            <div className="flex items-center gap-1 mb-2">
              <div 
                className="h-8 bg-red-500/10 border border-red-500/20 rounded-l flex items-center justify-between px-3 text-red-600"
                style={{ flex: homeProb }}
              >
                <span className="text-xs font-bold">홈승</span>
                <span className="text-sm font-black">{homeProb.toFixed(0)}%</span>
              </div>
              <div 
                className="h-8 bg-muted border-y border-border flex items-center justify-between px-2 text-muted-foreground"
                style={{ flex: drawProb }}
              >
                <span className="text-[10px]">무</span>
                <span className="text-xs font-bold">{drawProb.toFixed(0)}%</span>
              </div>
              <div 
                className="h-8 bg-blue-500/10 border border-blue-500/20 rounded-r flex items-center justify-between px-3 text-blue-600"
                style={{ flex: awayProb }}
              >
                <span className="text-xs font-bold">원정승</span>
                <span className="text-sm font-black">{awayProb.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* AI 예상 영역 */}
          <div className="bg-primary/5 p-4 border-t border-primary/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-primary font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>V9 AI 선택</span>
                </div>
                <ConfidenceBadge level={recommendation.level} stars={recommendation.stars} />
              </div>
              <div className="text-lg font-black text-foreground">
                {aiPickTeamName} {mlPick.pick === 'draw' ? '' : '승'}
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <Brain className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed">
                <span className="font-bold text-primary">{aiPickTeamName}</span>
                {mlPick.pick === 'draw' ? '가 나올 것으로 예상됩니다.' : '의 승리가 예상됩니다.'}
                <span className="text-muted-foreground ml-1">(ML 확률 {mlPick.pickProb.toFixed(0)}%)</span>
              </p>
            </div>
            
            {/* 박빙 경기 경고 */}
            {drawWarning?.isClose && drawWarning.message && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{drawWarning.message}</span>
              </div>
            )}
            
            {/* 가치 베팅 배지 */}
            <ValueBetBadge valueBet={valueBet} />
          </div>
        </Card>

        {/* 3. TABS */}
        <Tabs defaultValue="ai" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-11 mb-2 bg-muted/50 p-1">
            <TabsTrigger value="ai" className="text-[11px] gap-1.5 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              <Brain className="w-3.5 h-3.5" /> AI 분석
            </TabsTrigger>
            <TabsTrigger value="detail" className="text-[11px] gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <LayoutList className="w-3.5 h-3.5" /> 상세 정보
            </TabsTrigger>
            <TabsTrigger value="league" className="text-[11px] gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Trophy className="w-3.5 h-3.5" /> 리그 순위
            </TabsTrigger>
            <TabsTrigger value="lineup" className="text-[11px] gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Users className="w-3.5 h-3.5" /> 라인업
            </TabsTrigger>
          </TabsList>

          {/* === TAB 1: AI Analysis === */}
          <TabsContent value="ai" className="space-y-4 animate-in fade-in-50">
            
            {/* 5각형 레이더 차트 */}
            <TeamRadarChart
              homeTeam={homeTeamData}
              awayTeam={awayTeamData}
            />

            {/* AI 승률 분석 */}
            <Card className="p-5 shadow-sm">
              <h3 className="font-bold text-sm text-center mb-4 flex items-center justify-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                AI 승률 정밀 분석
              </h3>
              <ProbabilityGaugeBar
                probability={{ homeWin: homeProb, draw: drawProb, awayWin: awayProb }}
                homeTeamName={fixture.homeTeam.shortName || fixture.homeTeam.name.slice(0, 3)}
                awayTeamName={fixture.awayTeam.shortName || fixture.awayTeam.name.slice(0, 3)}
              />
              
              {/* 핵심 변수 */}
              {features && (
                <div className="mt-6 space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> 핵심 변수
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {/* 홈팀 */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-red-600">{fixture.homeTeam.shortName || 'HOME'} 핵심 변수</div>
                      {features.homeForm5 && features.homeForm5 > 1.5 && (
                        <Badge variant="secondary" className="text-[10px]">📈 폼 상승 (+{((features.homeForm5 - 1.5) * 10).toFixed(0)}%)</Badge>
                      )}
                      {features.homeDaysRest && features.homeDaysRest >= 5 && (
                        <Badge variant="secondary" className="text-[10px]">😴 충분한 휴식</Badge>
                      )}
                      {features.homeWinsAtHome && features.homeWinsAtHome > 60 && (
                        <Badge variant="secondary" className="text-[10px]">🏠 강한 홈 성적</Badge>
                      )}
                    </div>
                    {/* 원정팀 */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-blue-600">{fixture.awayTeam.shortName || 'AWAY'} 핵심 변수</div>
                      {features.awayForm5 && features.awayForm5 > 1.5 && (
                        <Badge variant="secondary" className="text-[10px]">📈 폼 상승 (+{((features.awayForm5 - 1.5) * 10).toFixed(0)}%)</Badge>
                      )}
                      {features.awayDaysRest && features.awayDaysRest >= 5 && (
                        <Badge variant="secondary" className="text-[10px]">😴 충분한 휴식</Badge>
                      )}
                      {features.awayWinsAtAway && features.awayWinsAtAway > 50 && (
                        <Badge variant="secondary" className="text-[10px]">✈️ 강한 원정 성적</Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* 투표 */}
            <Card className="p-6">
              <h3 className="font-bold text-center mb-4 text-sm">승부 예측 투표</h3>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant={selectedVote === 'home' ? 'destructive' : 'outline'}
                  className="h-12 flex flex-col gap-0.5"
                  onClick={() => handleVote('home')}
                  disabled={voteMutation.isPending}
                >
                  <span className="text-lg font-bold">승</span>
                  <span className="text-[10px] opacity-70">{fixture.homeTeam.shortName || 'HOME'}</span>
                </Button>
                <Button
                  variant={selectedVote === 'draw' ? 'secondary' : 'outline'}
                  className="h-12 flex flex-col gap-0.5"
                  onClick={() => handleVote('draw')}
                  disabled={voteMutation.isPending}
                >
                  <span className="text-lg font-bold">무</span>
                  <span className="text-[10px] opacity-70">무승부</span>
                </Button>
                <Button
                  variant={selectedVote === 'away' ? 'default' : 'outline'}
                  className="h-12 flex flex-col gap-0.5"
                  onClick={() => handleVote('away')}
                  disabled={voteMutation.isPending}
                >
                  <span className="text-lg font-bold">패</span>
                  <span className="text-[10px] opacity-70">{fixture.awayTeam.shortName || 'AWAY'}</span>
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* === TAB 2: Match Detail === */}
          <TabsContent value="detail" className="space-y-6 animate-in fade-in-50">
            <Card className="p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2 border-b pb-2">
                <Table2 className="h-4 w-4 text-muted-foreground" />
                팀 시즌 통계
              </h3>
              
              <div className="bg-muted/50 rounded-t-lg p-2 grid grid-cols-[1fr_100px_1fr] text-xs font-bold text-center text-muted-foreground">
                <div className="text-red-600">{fixture.homeTeam.name}</div>
                <div>구분</div>
                <div className="text-blue-600">{fixture.awayTeam.name}</div>
              </div>
              
              <div className="bg-background border rounded-b-lg px-2">
                {features ? (
                  <>
                    <StatRow 
                      label="최근 5경기 폼" 
                      homeValue={features.homeForm5?.toFixed(2) ?? '-'} 
                      awayValue={features.awayForm5?.toFixed(2) ?? '-'} 
                    />
                    <StatRow 
                      label="홈/원정 승률" 
                      homeValue={features.homeWinsAtHome ? `${features.homeWinsAtHome.toFixed(0)}%` : '-'} 
                      awayValue={features.awayWinsAtAway ? `${features.awayWinsAtAway.toFixed(0)}%` : '-'} 
                      highlight 
                    />
                    <StatRow 
                      label="평균 득점" 
                      homeValue={features.homeGoalsFor?.toFixed(2) ?? '-'} 
                      awayValue={features.awayGoalsFor?.toFixed(2) ?? '-'} 
                    />
                    <StatRow 
                      label="평균 실점" 
                      homeValue={features.homeGoalsAgainst?.toFixed(2) ?? '-'} 
                      awayValue={features.awayGoalsAgainst?.toFixed(2) ?? '-'} 
                    />
                    <StatRow 
                      label="휴식일" 
                      homeValue={features.homeDaysRest ? `${features.homeDaysRest}일` : '-'} 
                      awayValue={features.awayDaysRest ? `${features.awayDaysRest}일` : '-'} 
                    />
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    통계 데이터가 없습니다
                  </div>
                )}
              </div>
            </Card>

            {/* H2H 상대전적 */}
            {features?.h2hTotal && features.h2hTotal > 0 && (
              <Card className="p-4">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2 border-b pb-2">
                  <LayoutList className="h-4 w-4 text-muted-foreground" />
                  상대 전적 (최근 {features.h2hTotal}경기)
                </h3>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">
                    {features.h2hHomeWins ?? 0}승 {features.h2hDraws ?? 0}무 {features.h2hAwayWins ?? 0}패
                  </Badge>
                  <span className={`text-xs font-bold ${(features.h2hHomeWinPct ?? 0) > 50 ? 'text-red-600' : 'text-blue-600'}`}>
                    {(features.h2hHomeWinPct ?? 0) > 50 ? '홈팀 우세' : (features.h2hHomeWinPct ?? 0) < 50 ? '원정팀 우세' : '균형'}
                  </span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                  <div 
                    className="bg-red-500" 
                    style={{ width: `${features.h2hHomeWinPct ?? 0}%` }} 
                  />
                  <div 
                    className="bg-gray-400" 
                    style={{ width: `${features.h2hTotal ? (features.h2hDraws ?? 0) / features.h2hTotal * 100 : 0}%` }} 
                  />
                  <div 
                    className="bg-blue-500" 
                    style={{ width: `${100 - (features.h2hHomeWinPct ?? 0) - (features.h2hTotal ? (features.h2hDraws ?? 0) / features.h2hTotal * 100 : 0)}%` }} 
                  />
                </div>
              </Card>
            )}
          </TabsContent>

          {/* === TAB 3: League Table === */}
          <TabsContent value="league" className="animate-in fade-in-50">
            <Card className="p-4">
              <h3 className="font-bold text-sm mb-4">{fixture.league.name} 순위</h3>
              {(fixture.homeTeam.standing || fixture.awayTeam.standing) ? (
                <div className="space-y-3">
                  {/* 홈팀 순위 */}
                  {fixture.homeTeam.standing && (
                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200/50">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-black text-red-600 w-8 text-center">{fixture.homeTeam.standing.rank}</div>
                        <div>
                          <div className="font-bold text-sm">{fixture.homeTeam.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {fixture.homeTeam.standing.played}경기 · {fixture.homeTeam.standing.won}승 {fixture.homeTeam.standing.drawn}무 {fixture.homeTeam.standing.lost}패
                          </div>
                        </div>
                      </div>
                      {fixture.homeTeam.standing.form && (
                        <div className="flex gap-0.5">
                          {fixture.homeTeam.standing.form.split('').slice(-5).map((r, i) => (
                            <span key={i} className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center text-white ${
                              r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-gray-400' : 'bg-red-500'
                            }`}>{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* 원정팀 순위 */}
                  {fixture.awayTeam.standing && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-black text-blue-600 w-8 text-center">{fixture.awayTeam.standing.rank}</div>
                        <div>
                          <div className="font-bold text-sm">{fixture.awayTeam.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {fixture.awayTeam.standing.played}경기 · {fixture.awayTeam.standing.won}승 {fixture.awayTeam.standing.drawn}무 {fixture.awayTeam.standing.lost}패
                          </div>
                        </div>
                      </div>
                      {fixture.awayTeam.standing.form && (
                        <div className="flex gap-0.5">
                          {fixture.awayTeam.standing.form.split('').slice(-5).map((r, i) => (
                            <span key={i} className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center text-white ${
                              r === 'W' ? 'bg-green-500' : r === 'D' ? 'bg-gray-400' : 'bg-red-500'
                            }`}>{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-center py-10 text-muted-foreground bg-muted/20 rounded">
                  <Trophy className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p>리그 순위 데이터가 아직 없습니다</p>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* === TAB 4: Lineups === */}
          <TabsContent value="lineup" className="animate-in fade-in-50">
            <Card className="p-0 overflow-hidden border-0 bg-transparent">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  선발 라인업
                </h3>
                <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600 bg-amber-500/10">
                  <Clock className="w-3 h-3"/>
                  예상 라인업
                </Badge>
              </div>
              
              <WhiteTacticalBoard 
                homeTeam={fixture.homeTeam} 
                awayTeam={fixture.awayTeam}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
