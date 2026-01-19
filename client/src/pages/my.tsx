import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  User, Settings, Moon, Info, HelpCircle, Target, Trophy, 
  LogOut, Vote, Star, ChevronRight, Loader2
} from "lucide-react";
import { SiKakaotalk, SiNaver, SiGoogle } from "react-icons/si";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Cell
} from "recharts";
import type { UserStats } from "@shared/schema";

interface MockUserProfile {
  nickname: string;
  profileImage?: string;
  joinDate: string;
}

const mockProfile: MockUserProfile = {
  nickname: "축구도사",
  joinDate: "2024.01.15",
};

const mockUserStats: UserStats = {
  userAccuracy: 45,
  aiAccuracy: 78,
  userCorrect: 9,
  userTotal: 20,
  aiCorrect: 16,
  aiTotal: 20,
  totalVotes: 20,
};

export default function My() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState<string | null>(null);

  const { data: statsData, isLoading } = useQuery<{ stats: UserStats }>({
    queryKey: ["/api/user-stats"],
  });

  const stats = useMemo(() => {
    if (statsData?.stats) return statsData.stats;
    if (isLoggedIn) return mockUserStats;
    return null;
  }, [statsData?.stats, isLoggedIn]);

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

  const handleSocialLogin = (provider: string) => {
    setIsLoggingIn(provider);
    setTimeout(() => {
      setIsLoggingIn(null);
      setIsLoggedIn(true);
    }, 1000);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-background border-b">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <h1 className="font-bold text-lg">마이페이지</h1>
            <ThemeToggle />
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center mx-auto">
                <Trophy className="h-12 w-12 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Soccer Brain</h2>
                <p className="text-muted-foreground">
                  AI와 승부를 겨뤄보세요!
                </p>
              </div>
            </div>

            <Card className="w-full p-6 space-y-4" data-testid="card-login">
              <p className="text-center text-sm text-muted-foreground mb-4">
                소셜 계정으로 간편 로그인
              </p>

              <Button
                className="w-full h-12 text-base font-medium"
                style={{ backgroundColor: '#FEE500', color: '#000000' }}
                onClick={() => handleSocialLogin('kakao')}
                disabled={isLoggingIn !== null}
                data-testid="button-login-kakao"
              >
                {isLoggingIn === 'kakao' ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <SiKakaotalk className="h-5 w-5 mr-2" />
                )}
                카카오로 시작하기
              </Button>

              <Button
                className="w-full h-12 text-base font-medium"
                style={{ backgroundColor: '#03C75A', color: '#FFFFFF' }}
                onClick={() => handleSocialLogin('naver')}
                disabled={isLoggingIn !== null}
                data-testid="button-login-naver"
              >
                {isLoggingIn === 'naver' ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <SiNaver className="h-4 w-4 mr-2" />
                )}
                네이버로 시작하기
              </Button>

              <Button
                variant="outline"
                className="w-full h-12 text-base font-medium border-2"
                onClick={() => handleSocialLogin('google')}
                disabled={isLoggingIn !== null}
                data-testid="button-login-google"
              >
                {isLoggingIn === 'google' ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <SiGoogle className="h-4 w-4 mr-2" />
                )}
                Google로 시작하기
              </Button>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              로그인하면 나의 예측 기록을 저장하고<br />
              AI와 적중률을 비교할 수 있어요
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="font-bold text-lg">마이페이지</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <Card className="p-6" data-testid="card-profile">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg" data-testid="text-nickname">{mockProfile.nickname}</h2>
              <p className="text-sm text-muted-foreground">
                가입일: {mockProfile.joinDate}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-1" />
              로그아웃
            </Button>
          </div>
        </Card>

        <Card className="p-6" data-testid="card-stats">
          <h3 className="font-bold mb-4 flex items-center gap-2" data-testid="text-stats-title">
            <Target className="h-5 w-5 text-primary" />
            나의 성적표
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
                    <Trophy className="h-4 w-4" style={{ color: 'hsl(var(--chart-2))' }} />
                    <span className="text-sm font-medium">AI 기록</span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: 'hsl(var(--chart-2))' }}>{stats.aiAccuracy}%</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.aiCorrect}/{stats.aiTotal} 적중
                  </div>
                </div>
              </div>

              <div className="mt-4 text-center">
                {userWinning && (
                  <Badge className="bg-green-500 text-white border-0">
                    축하합니다! AI보다 {stats.userAccuracy - stats.aiAccuracy}% 더 높은 적중률
                  </Badge>
                )}
                {aiWinning && (
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                    AI가 {stats.aiAccuracy - stats.userAccuracy}% 앞서고 있어요
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
              <p className="text-sm">아직 예측 기록이 없습니다</p>
              <p className="text-xs mt-1">경기 예측에 참여해 보세요</p>
            </div>
          )}
        </Card>

        <Card className="divide-y divide-border" data-testid="card-activity">
          <h3 className="font-bold p-4 pb-2">나의 활동</h3>
          
          <Link href="/schedule">
            <button 
              className="w-full flex items-center justify-between gap-3 p-4 text-left hover-elevate transition-colors"
              data-testid="button-my-votes"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Vote className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="font-medium">내가 투표한 경기</span>
                  <p className="text-xs text-muted-foreground">나의 예측 기록 보기</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </Link>

          <Link href="/schedule">
            <button 
              className="w-full flex items-center justify-between gap-3 p-4 text-left hover-elevate transition-colors"
              data-testid="button-favorites"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <Star className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <span className="font-medium">찜한 경기</span>
                  <p className="text-xs text-muted-foreground">관심 경기 모아보기</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </Link>
        </Card>

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
