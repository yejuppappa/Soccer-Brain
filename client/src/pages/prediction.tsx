import { Trash2, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { usePrediction, type PredictionType } from "@/context/prediction-context";

function getPredictionLabel(prediction: PredictionType): string {
  switch (prediction) {
    case 'home': return '승';
    case 'draw': return '무';
    case 'away': return '패';
  }
}

function getPredictionColor(prediction: PredictionType): string {
  switch (prediction) {
    case 'home': return 'bg-destructive text-destructive-foreground';
    case 'draw': return 'bg-muted text-muted-foreground';
    case 'away': return 'bg-primary text-primary-foreground';
  }
}

function getRiskAnalysis(totalOdds: number, totalProbability: number): { level: 'safe' | 'moderate' | 'risky'; message: string } {
  const expectedValue = totalOdds * (totalProbability / 100);
  
  if (totalProbability >= 50) {
    return {
      level: 'safe',
      message: `AI 분석 결과 적중 확률 ${totalProbability.toFixed(1)}%로 안정적인 전략입니다.`,
    };
  } else if (totalProbability >= 25) {
    return {
      level: 'moderate',
      message: `예상 수익률 ${totalOdds.toFixed(2)}배, 적중 확률 ${totalProbability.toFixed(1)}%의 균형 잡힌 전략입니다.`,
    };
  } else {
    return {
      level: 'risky',
      message: `고수익 ${totalOdds.toFixed(2)}배 전략이지만, 적중 확률 ${totalProbability.toFixed(1)}%로 위험도가 높습니다.`,
    };
  }
}

export default function Prediction() {
  const { selections, removeSelection, clearSelections, totalOdds, totalProbability } = usePrediction();

  const riskAnalysis = selections.length > 0 ? getRiskAnalysis(totalOdds, totalProbability) : null;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 bg-background/95 backdrop-blur border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">예측 전략</h1>
          {selections.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearSelections}
              className="text-muted-foreground"
              data-testid="button-clear-all"
            >
              전체 삭제
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {selections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">선택된 예측이 없습니다</h2>
            <p className="text-sm text-muted-foreground">
              분석 탭에서 경기의 승/무/패를 선택하세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selections.map((selection) => (
              <Card 
                key={selection.match.id} 
                className="p-4"
                data-testid={`prediction-card-${selection.match.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Avatar className="h-8 w-8 border border-border shrink-0">
                      <AvatarImage src={selection.match.homeTeam.logoUrl} alt={selection.match.homeTeam.name} />
                      <AvatarFallback className="text-[10px] font-bold">{selection.match.homeTeam.shortName}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">vs</span>
                    <Avatar className="h-8 w-8 border border-border shrink-0">
                      <AvatarImage src={selection.match.awayTeam.logoUrl} alt={selection.match.awayTeam.name} />
                      <AvatarFallback className="text-[10px] font-bold">{selection.match.awayTeam.shortName}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium break-keep leading-tight">
                        {selection.match.homeTeam.shortName} vs {selection.match.awayTeam.shortName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`${getPredictionColor(selection.prediction)} font-bold`}>
                      {getPredictionLabel(selection.prediction)}
                    </Badge>
                    <div className="text-right">
                      <p className="font-mono font-bold text-sm">{selection.odds.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{selection.selectedProbability}%</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSelection(selection.match.id)}
                      className="text-muted-foreground"
                      data-testid={`button-remove-${selection.match.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {selections.length > 0 && (
        <div className="fixed bottom-14 left-0 right-0 bg-background border-t border-border z-40">
          <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">총 예상 수익률</p>
                <p className="text-2xl font-bold font-mono">{totalOdds.toFixed(2)}배</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">AI 예상 적중률</p>
                <p className="text-2xl font-bold font-mono text-primary">{totalProbability.toFixed(1)}%</p>
              </div>
            </div>

            {riskAnalysis && (
              <div className={`flex items-start gap-2 p-3 rounded-md ${
                riskAnalysis.level === 'safe' 
                  ? 'bg-primary/10' 
                  : riskAnalysis.level === 'moderate' 
                    ? 'bg-warning/10' 
                    : 'bg-destructive/10'
              }`}>
                {riskAnalysis.level === 'safe' ? (
                  <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                    riskAnalysis.level === 'moderate' ? 'text-warning' : 'text-destructive'
                  }`} />
                )}
                <p className="text-xs">{riskAnalysis.message}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
