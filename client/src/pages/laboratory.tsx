import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Beaker, Play, CheckCircle2, XCircle, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import type { HistoricalMatch, BacktestResult, VariableType } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";

const resultLabels: Record<string, string> = {
  home_win: "홈승",
  draw: "무승부",
  away_win: "원정승",
};

const variableLabels: Record<VariableType, string> = {
  fatigue: "피로도",
  injury: "부상 변수",
  weather: "날씨 변수",
  form: "팀 폼",
  home_advantage: "홈 어드밴티지",
};

export default function Laboratory() {
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  const { data: historicalData, isLoading } = useQuery<{ matches: HistoricalMatch[] }>({
    queryKey: ["/api/historical-matches"],
  });

  const backtestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/backtest");
      return response.json();
    },
    onSuccess: (data: { result: BacktestResult }) => {
      setBacktestResult(data.result);
      setIsAnimating(false);
    },
  });

  const handleRunBacktest = async () => {
    setBacktestResult(null);
    setIsAnimating(true);
    setProcessedCount(0);

    const matches = historicalData?.matches || [];
    for (let i = 0; i <= matches.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      setProcessedCount(i);
    }

    backtestMutation.mutate();
  };

  const matches = historicalData?.matches || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold" data-testid="text-lab-title">실험실 (Laboratory)</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            과거 데이터로 AI 예측 엔진을 학습시킵니다
          </p>
        </div>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              백테스팅 시뮬레이션
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              2023-2024 시즌 프리미어리그 {matches.length}경기 데이터를 분석하여
              AI 예측 엔진의 변수 가중치를 자동으로 최적화합니다.
            </p>

            <Button
              onClick={handleRunBacktest}
              disabled={isAnimating || backtestMutation.isPending || isLoading}
              className="w-full"
              data-testid="button-run-backtest"
            >
              {isAnimating || backtestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  분석 중... ({processedCount}/{matches.length})
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  과거 데이터 시뮬레이션 시작
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <AnimatePresence>
          {backtestResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-primary/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    학습 완료
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-muted rounded-md p-3">
                      <div className="text-2xl font-bold">{backtestResult.totalMatches}</div>
                      <div className="text-xs text-muted-foreground">분석 경기</div>
                    </div>
                    <div className="bg-muted rounded-md p-3">
                      <div className="text-2xl font-bold text-primary">{backtestResult.accuracy}%</div>
                      <div className="text-xs text-muted-foreground">적중률</div>
                    </div>
                    <div className="bg-muted rounded-md p-3">
                      <div className="text-2xl font-bold text-destructive">{backtestResult.significantErrors}</div>
                      <div className="text-xs text-muted-foreground">주요 오류</div>
                    </div>
                  </div>

                  {backtestResult.tuningWeights.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        가중치 조정 내역
                      </h4>
                      {backtestResult.tuningWeights.map((weight, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-muted/50 rounded-md p-2 text-sm"
                          data-testid={`weight-adjustment-${index}`}
                        >
                          <span className="font-medium">{variableLabels[weight.variable]}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{weight.originalWeight.toFixed(2)}</span>
                            <TrendingUp className="h-3 w-3 text-primary" />
                            <span className="text-primary font-medium">{weight.adjustedWeight.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-border">
                    <h4 className="text-sm font-medium">분석 인사이트</h4>
                    {backtestResult.insights.map((insight, index) => (
                      <p
                        key={index}
                        className="text-sm text-muted-foreground bg-muted/30 rounded-md p-2"
                        data-testid={`insight-${index}`}
                      >
                        {insight}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">과거 경기 데이터 (2023-24 시즌)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm"
                    data-testid={`historical-match-${match.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{match.matchTitle}</div>
                      <div className="text-xs text-muted-foreground">{match.date}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={match.wasCorrect ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {match.wasCorrect ? (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {resultLabels[match.actualResult]}
                      </Badge>
                      {!match.wasCorrect && (
                        <span className="text-xs text-destructive">
                          -{match.errorMargin}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
