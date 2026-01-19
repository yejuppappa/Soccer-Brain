import { useQuery } from "@tanstack/react-query";
import { Trophy, TrendingUp, Check, X, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine 
} from "recharts";
import type { PredictionRecord, DailyAccuracy } from "@shared/schema";

function ResultIcon({ prediction, actual }: { prediction: string; actual: string }) {
  const isCorrect = prediction === actual;
  if (isCorrect) {
    return <Check className="h-4 w-4 text-green-500" />;
  }
  return <X className="h-4 w-4 text-destructive" />;
}

function formatResult(result: string): string {
  switch (result) {
    case 'home': return '홈 승';
    case 'draw': return '무승부';
    case 'away': return '원정 승';
    default: return result;
  }
}

export default function History() {
  const { data: recordsData, isLoading: recordsLoading } = useQuery<{ records: PredictionRecord[] }>({
    queryKey: ["/api/prediction-records"],
  });

  const { data: dailyData, isLoading: dailyLoading } = useQuery<{ data: DailyAccuracy[] }>({
    queryKey: ["/api/daily-accuracy"],
  });

  const records = recordsData?.records || [];
  const dailyAccuracy = dailyData?.data || [];

  const correctPredictions = records.filter(r => r.aiPrediction === r.actualResult).length;
  const totalPredictions = records.length;
  const overallAccuracy = totalPredictions > 0 ? Math.round((correctPredictions / totalPredictions) * 100) : 0;

  const isLoading = recordsLoading || dailyLoading;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="font-bold text-lg">적중 내역</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        ) : (
          <>
            {/* Overall Stats */}
            <Card className="p-6" data-testid="card-overall-stats">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  AI 종합 적중률
                </h2>
                <Badge variant="secondary" className="text-lg font-bold">
                  {overallAccuracy}%
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-500">{correctPredictions}</div>
                  <div className="text-xs text-muted-foreground">적중</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-destructive">{totalPredictions - correctPredictions}</div>
                  <div className="text-xs text-muted-foreground">실패</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{totalPredictions}</div>
                  <div className="text-xs text-muted-foreground">총 예측</div>
                </div>
              </div>
            </Card>

            {/* Accuracy Line Chart */}
            <Card className="p-6" data-testid="card-accuracy-chart">
              <h3 className="font-bold mb-4 flex items-center gap-2" data-testid="text-chart-title">
                <TrendingUp className="h-5 w-5 text-primary" />
                일별 적중률 추이
              </h3>
              {dailyAccuracy.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyAccuracy} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => `${value}%`}
                        className="text-muted-foreground"
                      />
                      <Tooltip 
                        formatter={(value: number) => [`${value}%`, '적중률']}
                        labelFormatter={(label) => {
                          const date = new Date(label);
                          return `${date.getMonth() + 1}월 ${date.getDate()}일`;
                        }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <ReferenceLine 
                        y={50} 
                        stroke="hsl(var(--muted-foreground))" 
                        strokeDasharray="5 5" 
                        label={{ value: '50%', position: 'right', fontSize: 10 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="accuracy" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  아직 데이터가 없습니다
                </div>
              )}
            </Card>

            {/* Recent Predictions */}
            <Card className="p-6" data-testid="card-recent-predictions">
              <h3 className="font-bold mb-4" data-testid="text-recent-title">최근 예측 결과</h3>
              {records.length > 0 ? (
                <div className="space-y-3">
                  {records.slice(0, 10).map((record, index) => (
                    <div 
                      key={record.matchId || index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                      data-testid={`row-prediction-${index}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm truncate">
                          {record.homeTeam} vs {record.awayTeam}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          AI: {formatResult(record.aiPrediction)} / 실제: {formatResult(record.actualResult)}
                        </div>
                      </div>
                      <ResultIcon 
                        prediction={record.aiPrediction} 
                        actual={record.actualResult} 
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Minus className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">예측 기록이 없습니다</p>
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
