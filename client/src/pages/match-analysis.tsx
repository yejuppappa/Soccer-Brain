import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, AlertTriangle, CloudRain, Sun, Cloud, Snowflake, CheckCircle2, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProbabilityGaugeBar } from "@/components/probability-gauge-bar";
import { InsightCards, detectFactors } from "@/components/insight-cards";
import { OddsMovement } from "@/components/odds-movement";
import { AnalysisReport } from "@/components/analysis-report";
import { TeamRadarChart } from "@/components/team-radar-chart";
import { PredictedScore } from "@/components/predicted-score";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MatchAnalysisResponse, MatchAnalysis, WinDrawLossProbability, WeatherCondition, VoteChoice, UserVote, Team, Weather, Odds } from "@shared/schema";

const MOCK_TEAMS: { [key: string]: Omit<Team, 'recentResults' | 'topScorer' | 'lastMatchDaysAgo'> } = {
  "team-m1": { id: "team-m1", name: "Manchester City", shortName: "MCI", logoUrl: "https://media.api-sports.io/football/teams/50.png", leagueRank: 1 },
  "team-m2": { id: "team-m2", name: "Arsenal", shortName: "ARS", logoUrl: "https://media.api-sports.io/football/teams/42.png", leagueRank: 2 },
  "team-m3": { id: "team-m3", name: "Liverpool", shortName: "LIV", logoUrl: "https://media.api-sports.io/football/teams/40.png", leagueRank: 3 },
  "team-m4": { id: "team-m4", name: "Aston Villa", shortName: "AVL", logoUrl: "https://media.api-sports.io/football/teams/66.png", leagueRank: 4 },
  "team-m5": { id: "team-m5", name: "Tottenham", shortName: "TOT", logoUrl: "https://media.api-sports.io/football/teams/47.png", leagueRank: 5 },
  "team-m6": { id: "team-m6", name: "Chelsea", shortName: "CHE", logoUrl: "https://media.api-sports.io/football/teams/49.png", leagueRank: 6 },
  "team-m7": { id: "team-m7", name: "Newcastle", shortName: "NEW", logoUrl: "https://media.api-sports.io/football/teams/34.png", leagueRank: 7 },
  "team-m8": { id: "team-m8", name: "Manchester United", shortName: "MUN", logoUrl: "https://media.api-sports.io/football/teams/33.png", leagueRank: 8 },
  "team-m9": { id: "team-m9", name: "West Ham", shortName: "WHU", logoUrl: "https://media.api-sports.io/football/teams/48.png", leagueRank: 9 },
  "team-m10": { id: "team-m10", name: "Brighton", shortName: "BHA", logoUrl: "https://media.api-sports.io/football/teams/51.png", leagueRank: 10 },
  "team-m11": { id: "team-m11", name: "Real Madrid", shortName: "RMA", logoUrl: "https://media.api-sports.io/football/teams/541.png", leagueRank: 1 },
  "team-m12": { id: "team-m12", name: "Barcelona", shortName: "BAR", logoUrl: "https://media.api-sports.io/football/teams/529.png", leagueRank: 2 },
};

function generateMockAnalysis(matchId: string): MatchAnalysis {
  const seed = matchId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rand = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const teamKeys = Object.keys(MOCK_TEAMS);
  const homeIdx = seed % teamKeys.length;
  let awayIdx = (seed + 3) % teamKeys.length;
  if (homeIdx === awayIdx) awayIdx = (awayIdx + 1) % teamKeys.length;

  const homeBase = MOCK_TEAMS[teamKeys[homeIdx]];
  const awayBase = MOCK_TEAMS[teamKeys[awayIdx]];

  const generateRecentResults = (offset: number): ('W' | 'D' | 'L')[] => {
    const results: ('W' | 'D' | 'L')[] = [];
    for (let i = 0; i < 5; i++) {
      const r = rand(offset + i);
      results.push(r < 0.5 ? 'W' : r < 0.75 ? 'D' : 'L');
    }
    return results;
  };

  const homeTeam: Team = {
    ...homeBase,
    recentResults: generateRecentResults(1),
    topScorer: { 
      name: "Erling Haaland", 
      goals: Math.floor(rand(10) * 15) + 10, 
      isInjured: rand(11) < 0.2 
    },
    lastMatchDaysAgo: Math.floor(rand(12) * 5) + 2,
  };

  const awayTeam: Team = {
    ...awayBase,
    recentResults: generateRecentResults(20),
    topScorer: { 
      name: "Bukayo Saka", 
      goals: Math.floor(rand(30) * 12) + 5, 
      isInjured: rand(31) < 0.15 
    },
    lastMatchDaysAgo: Math.floor(rand(32) * 6) + 1,
  };

  const weatherConditions: WeatherCondition[] = ['sunny', 'cloudy', 'rainy', 'snowy'];
  const weather: Weather = {
    condition: weatherConditions[seed % 4],
    temperature: Math.floor(rand(40) * 20) + 5,
    icon: weatherConditions[seed % 4],
  };

  const odds: Odds = {
    domestic: [1.8 + rand(50) * 2, 3.2 + rand(51) * 0.8, 2.5 + rand(52) * 2] as [number, number, number],
    overseas: [1.85 + rand(53) * 2, 3.3 + rand(54) * 0.8, 2.6 + rand(55) * 2] as [number, number, number],
    domesticTrend: [
      rand(60) < 0.3 ? 'down' : rand(60) < 0.6 ? 'stable' : 'up',
      rand(61) < 0.3 ? 'down' : rand(61) < 0.6 ? 'stable' : 'up',
      rand(62) < 0.3 ? 'down' : rand(62) < 0.6 ? 'stable' : 'up',
    ] as [("up" | "down" | "stable"), ("up" | "down" | "stable"), ("up" | "down" | "stable")],
    overseasTrend: [
      rand(70) < 0.3 ? 'down' : rand(70) < 0.6 ? 'stable' : 'up',
      rand(71) < 0.3 ? 'down' : rand(71) < 0.6 ? 'stable' : 'up',
      rand(72) < 0.3 ? 'down' : rand(72) < 0.6 ? 'stable' : 'up',
    ] as [("up" | "down" | "stable"), ("up" | "down" | "stable"), ("up" | "down" | "stable")],
  };

  const homeWinBase = 45 + (awayTeam.leagueRank - homeTeam.leagueRank) * 2;
  const awayWinBase = 35 - (awayTeam.leagueRank - homeTeam.leagueRank) * 2;
  const drawBase = 100 - homeWinBase - awayWinBase;

  return {
    matchId,
    homeTeam,
    awayTeam,
    weather,
    odds,
    lineup: {
      status: rand(80) < 0.3 ? 'confirmed' : 'predicted',
      confirmedAt: rand(80) < 0.3 ? new Date().toISOString() : undefined,
    },
    cores: {
      core1: {
        name: "기초 체력",
        description: `홈팀 ${homeTeam.leagueRank}위 vs 원정팀 ${awayTeam.leagueRank}위 기반 기본 승률`,
        baseValue: homeWinBase,
        adjustedValue: homeWinBase + Math.floor(rand(90) * 5),
        isActive: true,
      },
      core2Home: {
        name: "홈팀 피로도",
        description: `마지막 경기 ${homeTeam.lastMatchDaysAgo}일 전`,
        baseValue: homeTeam.lastMatchDaysAgo < 3 ? -12 : 0,
        adjustedValue: homeTeam.lastMatchDaysAgo < 3 ? -12 : 0,
        isActive: homeTeam.lastMatchDaysAgo < 3,
      },
      core2Away: {
        name: "원정팀 피로도", 
        description: `마지막 경기 ${awayTeam.lastMatchDaysAgo}일 전`,
        baseValue: awayTeam.lastMatchDaysAgo < 3 ? -10 : 0,
        adjustedValue: awayTeam.lastMatchDaysAgo < 3 ? -10 : 0,
        isActive: awayTeam.lastMatchDaysAgo < 3,
      },
      core3Home: {
        name: "홈팀 핵심 선수",
        description: homeTeam.topScorer.isInjured 
          ? `${homeTeam.topScorer.name} 부상으로 인해 결장`
          : `${homeTeam.topScorer.name} ${homeTeam.topScorer.goals}골 출전 예정`,
        baseValue: homeTeam.topScorer.isInjured ? -20 : 5,
        adjustedValue: homeTeam.topScorer.isInjured ? -20 : 5,
        isActive: true,
      },
      core3Away: {
        name: "원정팀 핵심 선수",
        description: awayTeam.topScorer.isInjured
          ? `${awayTeam.topScorer.name} 부상으로 인해 결장`
          : `${awayTeam.topScorer.name} ${awayTeam.topScorer.goals}골 출전 예정`,
        baseValue: awayTeam.topScorer.isInjured ? -18 : 3,
        adjustedValue: awayTeam.topScorer.isInjured ? -18 : 3,
        isActive: true,
      },
    },
    baseProbability: {
      homeWin: Math.min(70, Math.max(20, homeWinBase)),
      draw: Math.min(35, Math.max(15, drawBase)),
      awayWin: Math.min(60, Math.max(15, awayWinBase)),
    },
    adjustedProbability: {
      homeWin: Math.min(75, Math.max(15, homeWinBase + Math.floor(rand(100) * 10) - 5)),
      draw: Math.min(40, Math.max(10, drawBase + Math.floor(rand(101) * 6) - 3)),
      awayWin: Math.min(65, Math.max(10, awayWinBase + Math.floor(rand(102) * 10) - 5)),
    },
  };
}

function WeatherIcon({ condition }: { condition: WeatherCondition }) {
  switch (condition) {
    case 'sunny':
      return <Sun className="h-4 w-4 text-amber-500" />;
    case 'cloudy':
      return <Cloud className="h-4 w-4 text-muted-foreground" />;
    case 'rainy':
      return <CloudRain className="h-4 w-4 text-blue-500" />;
    case 'snowy':
      return <Snowflake className="h-4 w-4 text-blue-400" />;
  }
}

export default function MatchAnalysis() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [showLineupNotice, setShowLineupNotice] = useState(false);
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);

  const isDemoId = params.id?.startsWith('demo-') || false;

  const { data, isLoading, error } = useQuery<MatchAnalysisResponse>({
    queryKey: ["/api/matches", params.id, "analysis"],
    enabled: !isDemoId,
  });

  // Fetch existing vote for this match
  const { data: voteData } = useQuery<{ vote: UserVote | null }>({
    queryKey: ["/api/votes", params.id],
    enabled: !!params.id && !isDemoId,
  });

  // Submit vote mutation
  const voteMutation = useMutation({
    mutationFn: async (choice: VoteChoice) => {
      return apiRequest("POST", "/api/votes", { matchId: params.id, choice });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/votes", params.id] });
    },
  });

  const analysis = useMemo(() => {
    if (isDemoId || error || (!isLoading && !data?.analysis)) {
      return generateMockAnalysis(params.id || 'demo-default');
    }
    return data?.analysis;
  }, [isDemoId, error, isLoading, data?.analysis, params.id]);

  const isDemo = isDemoId || error || (!isLoading && !data?.analysis);

  // Show lineup confirmation notice if confirmed
  useEffect(() => {
    if (analysis?.lineup?.status === 'confirmed') {
      setShowLineupNotice(true);
      const timer = setTimeout(() => setShowLineupNotice(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [analysis?.lineup?.status]);

  // Set selected vote from existing vote data
  useEffect(() => {
    if (voteData?.vote) {
      setSelectedVote(voteData.vote.choice);
    }
  }, [voteData]);

  const handleVote = (choice: VoteChoice) => {
    setSelectedVote(choice);
    voteMutation.mutate(choice);
  };

  const calculatedProbability = useMemo((): WinDrawLossProbability => {
    if (!analysis) return { homeWin: 33, draw: 34, awayWin: 33 };
    
    let { homeWin, draw, awayWin } = analysis.baseProbability;
    
    const factors = detectFactors(analysis.homeTeam, analysis.awayTeam, analysis.weather);
    
    for (const factor of factors) {
      const impactValue = parseInt(factor.impact.replace(/[^-\d]/g, '')) || 0;
      
      if (factor.team === 'home') {
        if (factor.type === 'positive') {
          homeWin += Math.abs(impactValue);
          awayWin -= Math.abs(impactValue) / 2;
          draw -= Math.abs(impactValue) / 2;
        } else if (factor.type === 'negative') {
          homeWin -= Math.abs(impactValue);
          awayWin += Math.abs(impactValue) / 2;
          draw += Math.abs(impactValue) / 2;
        }
      } else if (factor.team === 'away') {
        if (factor.type === 'positive') {
          awayWin += Math.abs(impactValue);
          homeWin -= Math.abs(impactValue) / 2;
          draw -= Math.abs(impactValue) / 2;
        } else if (factor.type === 'negative') {
          awayWin -= Math.abs(impactValue);
          homeWin += Math.abs(impactValue) / 2;
          draw += Math.abs(impactValue) / 2;
        }
      } else if (factor.team === 'match') {
        if (factor.icon === 'weather') {
          const rainBonus = 8;
          const homeReduction = Math.floor(rainBonus / 2);
          const awayReduction = rainBonus - homeReduction;
          homeWin -= homeReduction;
          awayWin -= awayReduction;
          draw += rainBonus;
        }
      }
    }
    
    homeWin = Math.max(5, Math.min(80, homeWin));
    awayWin = Math.max(5, Math.min(80, awayWin));
    draw = 100 - homeWin - awayWin;
    draw = Math.max(5, Math.min(60, draw));
    
    const total = homeWin + draw + awayWin;
    if (total !== 100) {
      const diff = 100 - total;
      draw += diff;
    }
    
    return { homeWin: Math.round(homeWin), draw: Math.round(draw), awayWin: Math.round(awayWin) };
  }, [analysis]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <h1 className="text-base font-bold truncate">
              {isLoading && !isDemoId ? "로딩 중..." : `${analysis?.homeTeam.name} vs ${analysis?.awayTeam.name}`}
            </h1>
            {isDemo && !isLoading && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/50 bg-amber-500/10">
                Demo
              </Badge>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {isLoading && !isDemoId ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : analysis ? (
          <div className="space-y-6">
            {/* Lineup Confirmation Notice Animation */}
            <AnimatePresence>
              {showLineupNotice && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-green-500/20 border border-green-500/40 rounded-lg p-3 flex items-center gap-2"
                  data-testid="notice-lineup-confirmed"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    확정 라인업 반영 완료
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lineup Status Badge */}
            <div className="flex justify-center" data-testid="badge-lineup-status">
              {analysis?.lineup?.status === 'confirmed' ? (
                <Badge className="bg-green-500 text-white border-0 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  확정 라인업
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  예상 라인업
                </Badge>
              )}
            </div>

            {/* Match Header with Weather */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={analysis!.homeTeam.logoUrl} 
                    alt={analysis!.homeTeam.name}
                    className="w-12 h-12 object-contain"
                  />
                  <div>
                    <div className="font-bold">{analysis!.homeTeam.name}</div>
                    <div className="text-xs text-muted-foreground">홈 | {analysis!.homeTeam.leagueRank}위</div>
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">vs</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <WeatherIcon condition={analysis!.weather.condition} />
                    <span>{analysis!.weather.temperature}°C</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold">{analysis!.awayTeam.name}</div>
                    <div className="text-xs text-muted-foreground">{analysis!.awayTeam.leagueRank}위 | 원정</div>
                  </div>
                  <img 
                    src={analysis!.awayTeam.logoUrl} 
                    alt={analysis!.awayTeam.name}
                    className="w-12 h-12 object-contain"
                  />
                </div>
              </div>

              {/* Recent Form Display */}
              <div className="flex justify-between text-xs">
                <div className="flex gap-1">
                  {analysis!.homeTeam.recentResults.map((result, i) => (
                    <span 
                      key={i}
                      className={`
                        w-5 h-5 rounded-full flex items-center justify-center font-bold text-white
                        ${result === 'W' ? 'bg-green-500' : result === 'D' ? 'bg-gray-400' : 'bg-red-500'}
                      `}
                    >
                      {result}
                    </span>
                  ))}
                </div>
                <span className="text-muted-foreground">최근 5경기</span>
                <div className="flex gap-1">
                  {analysis!.awayTeam.recentResults.map((result, i) => (
                    <span 
                      key={i}
                      className={`
                        w-5 h-5 rounded-full flex items-center justify-center font-bold text-white
                        ${result === 'W' ? 'bg-green-500' : result === 'D' ? 'bg-gray-400' : 'bg-red-500'}
                      `}
                    >
                      {result}
                    </span>
                  ))}
                </div>
              </div>
            </Card>

            {/* Team Power Radar Chart */}
            <TeamRadarChart
              homeTeam={analysis!.homeTeam}
              awayTeam={analysis!.awayTeam}
            />

            {/* Probability Analysis */}
            <Card className="p-6">
              <h3 className="font-bold text-center mb-4 text-lg">AI 승률 분석</h3>
              
              {/* AI Predicted Score Badge */}
              <div className="mb-4">
                <PredictedScore
                  homeTeam={analysis!.homeTeam}
                  awayTeam={analysis!.awayTeam}
                  probability={calculatedProbability}
                />
              </div>
              
              <ProbabilityGaugeBar
                probability={calculatedProbability}
                homeTeamName={analysis!.homeTeam.shortName}
                awayTeamName={analysis!.awayTeam.shortName}
              />
              
              <div className="mt-6 pt-4 border-t">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-2xl font-bold text-destructive">{calculatedProbability.homeWin}%</div>
                    <div className="text-xs text-muted-foreground mt-1">홈 승</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-muted-foreground">{calculatedProbability.draw}%</div>
                    <div className="text-xs text-muted-foreground mt-1">무승부</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">{calculatedProbability.awayWin}%</div>
                    <div className="text-xs text-muted-foreground mt-1">원정 승</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* AI Auto-Detected Insight Cards */}
            <InsightCards
              homeTeam={analysis!.homeTeam}
              awayTeam={analysis!.awayTeam}
              weather={analysis!.weather}
            />

            {/* Odds Movement Visualization */}
            <OddsMovement
              odds={analysis!.odds}
              homeTeamName={analysis!.homeTeam.shortName}
              awayTeamName={analysis!.awayTeam.shortName}
            />

            {/* Team Details */}
            <Card className="p-4 bg-muted/30">
              <h4 className="font-bold text-sm mb-4">팀 상세 정보</h4>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full bg-destructive" />
                    <span className="font-bold">{analysis?.homeTeam.name}</span>
                    <span className="text-xs text-muted-foreground">(홈)</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1 pl-5">
                    <p>리그 순위: {analysis?.homeTeam.leagueRank}위</p>
                    <p>최근 5경기: {analysis?.homeTeam.recentResults.join(" ")}</p>
                    <p>핵심 득점원: {analysis?.homeTeam.topScorer.name} ({analysis?.homeTeam.topScorer.goals}골)</p>
                    <p>마지막 경기: {analysis?.homeTeam.lastMatchDaysAgo}일 전</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full bg-primary" />
                    <span className="font-bold">{analysis?.awayTeam.name}</span>
                    <span className="text-xs text-muted-foreground">(원정)</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1 pl-5">
                    <p>리그 순위: {analysis?.awayTeam.leagueRank}위</p>
                    <p>최근 5경기: {analysis?.awayTeam.recentResults.join(" ")}</p>
                    <p>핵심 득점원: {analysis?.awayTeam.topScorer.name} ({analysis?.awayTeam.topScorer.goals}골)</p>
                    <p>마지막 경기: {analysis?.awayTeam.lastMatchDaysAgo}일 전</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Voting Section */}
            <Card className="p-6" data-testid="section-voting">
              <h3 className="font-bold text-center mb-4 text-lg">승부 예측 투표</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                이 경기의 결과를 예측해 보세요
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant={selectedVote === 'home' ? 'destructive' : 'outline'}
                  className="toggle-elevate flex flex-col gap-1"
                  onClick={() => handleVote('home')}
                  disabled={voteMutation.isPending}
                  data-testid="button-vote-home"
                >
                  <span className="text-lg font-bold">승</span>
                  <span className="text-xs">{analysis!.homeTeam.shortName}</span>
                </Button>
                <Button
                  variant={selectedVote === 'draw' ? 'secondary' : 'outline'}
                  className="toggle-elevate flex flex-col gap-1"
                  onClick={() => handleVote('draw')}
                  disabled={voteMutation.isPending}
                  data-testid="button-vote-draw"
                >
                  <span className="text-lg font-bold">무</span>
                  <span className="text-xs">무승부</span>
                </Button>
                <Button
                  variant={selectedVote === 'away' ? 'default' : 'outline'}
                  className="toggle-elevate flex flex-col gap-1"
                  onClick={() => handleVote('away')}
                  disabled={voteMutation.isPending}
                  data-testid="button-vote-away"
                >
                  <span className="text-lg font-bold">패</span>
                  <span className="text-xs">{analysis!.awayTeam.shortName}</span>
                </Button>
              </div>
              {selectedVote && (
                <div className="mt-4 text-center" data-testid="text-vote-status">
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    투표 완료
                  </Badge>
                </div>
              )}
            </Card>

            {/* AI Comprehensive Analysis Report */}
            <AnalysisReport
              homeTeam={analysis!.homeTeam}
              awayTeam={analysis!.awayTeam}
              weather={analysis!.weather}
              probability={calculatedProbability}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
