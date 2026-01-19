import { useQuery } from "@tanstack/react-query";
import { User, Settings, Moon, Info, HelpCircle, Target, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend
} from "recharts";
import type { UserStats } from "@shared/schema";

export default function My() {
  const { data: statsData, isLoading } = useQuery<{ stats: UserStats }>({
    queryKey: ["/api/user-stats"],
  });

  const stats = statsData?.stats;

  const comparisonData = stats ? [
    {
      name: '나의 적중률',
      accuracy: stats.userAccuracy,
      fill: 'hsl(var(--primary))',
    },
    {
      name: 'AI 적중률',
      accuracy: stats.aiAccuracy,
      fill: 'hsl(var(--chart-2))',
    },
  ] : [];

  const userWinning = stats && stats.userAccuracy > stats.aiAccuracy;
  const aiWinning = stats && stats.aiAccuracy > stats.userAccuracy;
  const isTie = stats && stats.userAccuracy === stats.aiAccuracy;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="font-bold text-lg">마이페이지</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Profile Section */}
        <Card className="p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <User className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="font-bold text-lg mb-1">게스트 사용자</h2>
          <p className="text-sm text-muted-foreground">로그인하여 더 많은 기능을 사용하세요</p>
        </Card>

        {/* Accuracy Comparison Chart */}
        <Card className="p-6" data-testid="card-accuracy-comparison">
          <h3 className="font-bold mb-4 flex items-center gap-2" data-testid="text-comparison-title">
            <Target className="h-5 w-5 text-primary" />
            나 vs AI 적중률 비교
          </h3>
          
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          ) : stats ? (
            <>
              <div className="h-48 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
                    <XAxis 
                      type="number" 
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      width={60}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value}%`, '적중률']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="accuracy" 
                      radius={[0, 4, 4, 0]}
                      barSize={30}
                    >
                      {comparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">나의 기록</span>
                  </div>
                  <div className="text-2xl font-bold text-primary">{stats.userAccuracy}%</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.userCorrect}/{stats.userTotal} 적중
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Trophy className="h-4 w-4 text-chart-2" />
                    <span className="text-sm font-medium">AI 기록</span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: 'hsl(var(--chart-2))' }}>{stats.aiAccuracy}%</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.aiCorrect}/{stats.aiTotal} 적중
                  </div>
                </div>
              </div>

              {/* Result Badge */}
              <div className="mt-4 text-center">
                {userWinning && (
                  <Badge className="bg-primary text-white">
                    축하합니다! AI보다 {stats.userAccuracy - stats.aiAccuracy}% 더 높은 적중률
                  </Badge>
                )}
                {aiWinning && (
                  <Badge variant="secondary">
                    AI가 {stats.aiAccuracy - stats.userAccuracy}% 더 높은 적중률
                  </Badge>
                )}
                {isTie && (
                  <Badge variant="outline">
                    AI와 동일한 적중률
                  </Badge>
                )}
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Target className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">투표 기록이 없습니다</p>
              <p className="text-xs mt-1">경기에서 승부 예측에 참여해 보세요</p>
            </div>
          )}
        </Card>

        {/* Menu Items */}
        <Card className="divide-y divide-border">
          <button 
            className="w-full flex items-center gap-3 p-4 text-left hover-elevate transition-colors"
            data-testid="button-settings"
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">설정</span>
          </button>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">다크 모드</span>
            </div>
            <ThemeToggle />
          </div>
          <button 
            className="w-full flex items-center gap-3 p-4 text-left hover-elevate transition-colors"
            data-testid="button-help"
          >
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">도움말</span>
          </button>
          <button 
            className="w-full flex items-center gap-3 p-4 text-left hover-elevate transition-colors"
            data-testid="button-info"
          >
            <Info className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">앱 정보</span>
          </button>
        </Card>

        <p className="text-center text-xs text-muted-foreground pt-4">
          Soccer Brain v1.0.0
        </p>
      </main>
    </div>
  );
}
