import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProbabilityGaugeBar } from "@/components/probability-gauge-bar";
import { TeamPanel } from "@/components/team-panel";
import { WeatherPanel } from "@/components/weather-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import type { MatchAnalysisResponse, WinDrawLossProbability } from "@shared/schema";

export default function MatchAnalysis() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  
  const [isRaining, setIsRaining] = useState(false);
  const [homeTeamFatigued, setHomeTeamFatigued] = useState(false);
  const [homeKeyPlayerInjured, setHomeKeyPlayerInjured] = useState(false);
  const [awayTeamFatigued, setAwayTeamFatigued] = useState(false);
  const [awayKeyPlayerInjured, setAwayKeyPlayerInjured] = useState(false);

  const { data, isLoading, error } = useQuery<MatchAnalysisResponse>({
    queryKey: ["/api/matches", params.id, "analysis"],
  });

  const analysis = data?.analysis;

  const calculatedProbability = useMemo((): WinDrawLossProbability => {
    if (!analysis) return { homeWin: 33, draw: 34, awayWin: 33 };
    
    let { homeWin, draw, awayWin } = analysis.baseProbability;
    
    if (isRaining) {
      const rainBonus = 8;
      const homeReduction = Math.floor(rainBonus / 2);
      const awayReduction = rainBonus - homeReduction;
      homeWin -= homeReduction;
      awayWin -= awayReduction;
      draw += rainBonus;
    }
    
    if (homeTeamFatigued) {
      homeWin -= 10;
      draw += 5;
      awayWin += 5;
    }
    
    if (homeKeyPlayerInjured) {
      homeWin -= 15;
      draw += 7;
      awayWin += 8;
    }
    
    if (awayTeamFatigued) {
      awayWin -= 10;
      draw += 5;
      homeWin += 5;
    }
    
    if (awayKeyPlayerInjured) {
      awayWin -= 15;
      draw += 7;
      homeWin += 8;
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
  }, [analysis, isRaining, homeTeamFatigued, homeKeyPlayerInjured, awayTeamFatigued, awayKeyPlayerInjured]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium" data-testid="text-error">분석 데이터를 불러오는데 실패했습니다</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-bold flex-1 text-center truncate">
            {isLoading ? "로딩 중..." : `${analysis?.homeTeam.name} vs ${analysis?.awayTeam.name}`}
          </h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <div className="grid lg:grid-cols-3 gap-4">
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-[1fr_2fr_1fr] gap-6">
              <div className="order-2 lg:order-1">
                <TeamPanel
                  team={analysis!.homeTeam}
                  isHome={true}
                  isFatigued={homeTeamFatigued}
                  isKeyPlayerInjured={homeKeyPlayerInjured}
                  onFatigueChange={setHomeTeamFatigued}
                  onInjuryChange={setHomeKeyPlayerInjured}
                />
              </div>

              <div className="order-1 lg:order-2">
                <Card className="p-6">
                  <h3 className="font-bold text-center mb-6 text-lg">승률 분석</h3>
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
              </div>

              <div className="order-3 lg:order-3">
                <TeamPanel
                  team={analysis!.awayTeam}
                  isHome={false}
                  isFatigued={awayTeamFatigued}
                  isKeyPlayerInjured={awayKeyPlayerInjured}
                  onFatigueChange={setAwayTeamFatigued}
                  onInjuryChange={setAwayKeyPlayerInjured}
                />
              </div>
            </div>

            <WeatherPanel
              weather={analysis!.weather}
              isRaining={isRaining}
              onRainChange={setIsRaining}
            />

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
          </div>
        )}
      </main>
    </div>
  );
}
