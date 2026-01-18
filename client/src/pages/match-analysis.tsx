import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedProbabilityChart } from "@/components/animated-probability-chart";
import { CoreAnalysisCard } from "@/components/core-analysis-card";
import { ThemeToggle } from "@/components/theme-toggle";
import type { MatchAnalysisResponse, AnalysisCore } from "@shared/schema";

export default function MatchAnalysis() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  
  const [awayTeamFatigued, setAwayTeamFatigued] = useState(false);
  const [keyPlayerInjured, setKeyPlayerInjured] = useState(false);
  const [previousProbability, setPreviousProbability] = useState<number | undefined>(undefined);

  const { data, isLoading, error } = useQuery<MatchAnalysisResponse>({
    queryKey: ["/api/matches", params.id, "analysis"],
  });

  const analysis = data?.analysis;

  const calculatedProbability = useMemo(() => {
    if (!analysis) return 0;
    
    let probability = analysis.baseWinProbability;
    
    if (awayTeamFatigued) {
      probability -= 12;
    }
    
    if (keyPlayerInjured) {
      probability -= 20;
    }
    
    return Math.min(Math.max(probability, 5), 95);
  }, [analysis, awayTeamFatigued, keyPlayerInjured]);

  const cores = useMemo((): { core1: AnalysisCore; core2: AnalysisCore; core3: AnalysisCore } => {
    if (!analysis) {
      return {
        core1: { name: "", description: "", baseValue: 0, adjustedValue: 0, isActive: false },
        core2: { name: "", description: "", baseValue: 0, adjustedValue: 0, isActive: false },
        core3: { name: "", description: "", baseValue: 0, adjustedValue: 0, isActive: false },
      };
    }

    return {
      core1: {
        ...analysis.cores.core1,
        isActive: true,
      },
      core2: {
        ...analysis.cores.core2,
        adjustedValue: awayTeamFatigued ? -12 : 0,
        isActive: awayTeamFatigued,
        description: awayTeamFatigued 
          ? "홈 팀의 휴식 부족 (3일 미만)으로 경기력 저하" 
          : "홈 팀 충분한 휴식, 피로도 변수 없음",
      },
      core3: {
        ...analysis.cores.core3,
        adjustedValue: keyPlayerInjured ? -20 : 0,
        isActive: keyPlayerInjured,
        description: keyPlayerInjured 
          ? `핵심 선수 ${analysis.homeTeam.topScorer.name} 부상으로 득점력 약화` 
          : `핵심 선수 ${analysis.homeTeam.topScorer.name} 정상 출전 가능`,
      },
    };
  }, [analysis, awayTeamFatigued, keyPlayerInjured]);

  useEffect(() => {
    if (analysis) {
      setPreviousProbability(calculatedProbability);
    }
  }, [awayTeamFatigued, keyPlayerInjured]);

  const handleFatigueToggle = (checked: boolean) => {
    setPreviousProbability(calculatedProbability);
    setAwayTeamFatigued(checked);
  };

  const handleInjuryToggle = (checked: boolean) => {
    setPreviousProbability(calculatedProbability);
    setKeyPlayerInjured(checked);
  };

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
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-4">
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

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <>
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </>
        ) : (
          <>
            <Card className="p-6">
              <AnimatedProbabilityChart
                probability={calculatedProbability}
                previousProbability={previousProbability}
                showChange={previousProbability !== undefined && previousProbability !== calculatedProbability}
              />
            </Card>

            <Card className="p-4" data-testid="card-controls">
              <h3 className="font-bold text-sm mb-4 text-muted-foreground">시뮬레이션 변수 조절</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label 
                      htmlFor="fatigue-switch" 
                      className="font-medium cursor-pointer"
                    >
                      홈팀 휴식 부족
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      휴식 3일 미만 시 승률 -12%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {awayTeamFatigued && (
                      <span className="text-xs font-bold text-destructive">-12%</span>
                    )}
                    <Switch
                      id="fatigue-switch"
                      checked={awayTeamFatigued}
                      onCheckedChange={handleFatigueToggle}
                      data-testid="switch-fatigue"
                    />
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label 
                      htmlFor="injury-switch" 
                      className="font-medium cursor-pointer"
                    >
                      핵심 선수 부상
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      득점 1위 선수 결장 시 승률 -20%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {keyPlayerInjured && (
                      <span className="text-xs font-bold text-destructive">-20%</span>
                    )}
                    <Switch
                      id="injury-switch"
                      checked={keyPlayerInjured}
                      onCheckedChange={handleInjuryToggle}
                      data-testid="switch-injury"
                    />
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              <h3 className="font-bold text-sm text-muted-foreground px-1">Triple Core 분석</h3>
              <CoreAnalysisCard core={cores.core1} coreNumber={1} />
              <CoreAnalysisCard core={cores.core2} coreNumber={2} />
              <CoreAnalysisCard core={cores.core3} coreNumber={3} />
            </div>

            <Card className="p-4 bg-muted/50">
              <h4 className="font-bold text-sm mb-3">팀 정보</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">홈 팀</p>
                  <p className="font-bold">{analysis?.homeTeam.name}</p>
                  <p className="text-xs text-muted-foreground">
                    리그 {analysis?.homeTeam.leagueRank}위 | 최근 5경기: {analysis?.homeTeam.recentResults.join("")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">원정 팀</p>
                  <p className="font-bold">{analysis?.awayTeam.name}</p>
                  <p className="text-xs text-muted-foreground">
                    리그 {analysis?.awayTeam.leagueRank}위 | 최근 5경기: {analysis?.awayTeam.recentResults.join("")}
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
