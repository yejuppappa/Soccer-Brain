import { AlertTriangle, Home, Plane, CloudRain, Snowflake, TrendingUp, TrendingDown, Zap, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Team, Weather } from "@shared/schema";

export interface DetectedFactor {
  id: string;
  type: 'positive' | 'negative' | 'neutral';
  team: 'home' | 'away' | 'match';
  label: string;
  description: string;
  impact: string;
  icon: 'fatigue' | 'home_strong' | 'away_weak' | 'weather' | 'streak' | 'form';
}

interface InsightCardsProps {
  homeTeam: Team;
  awayTeam: Team;
  weather: Weather;
}

function detectFactors(homeTeam: Team, awayTeam: Team, weather: Weather): DetectedFactor[] {
  const factors: DetectedFactor[] = [];

  // 🔴 피로 누적 (Rest Shortage): < 3 days rest
  if (homeTeam.lastMatchDaysAgo < 3) {
    factors.push({
      id: 'home-fatigue',
      type: 'negative',
      team: 'home',
      label: '피로 누적',
      description: `${homeTeam.lastMatchDaysAgo}일 전 경기`,
      impact: '-10%',
      icon: 'fatigue',
    });
  }

  if (awayTeam.lastMatchDaysAgo < 3) {
    factors.push({
      id: 'away-fatigue',
      type: 'negative',
      team: 'away',
      label: '피로 누적',
      description: `${awayTeam.lastMatchDaysAgo}일 전 경기`,
      impact: '-10%',
      icon: 'fatigue',
    });
  }

  // 🟢 홈 깡패 (Home Strong): Home win rate >= 60% (approximated from recent results)
  const homeWins = homeTeam.recentResults.filter(r => r === 'W').length;
  const homeWinRate = (homeWins / homeTeam.recentResults.length) * 100;
  if (homeWinRate >= 60) {
    factors.push({
      id: 'home-strong',
      type: 'positive',
      team: 'home',
      label: '홈 깡패',
      description: `최근 ${homeWins}승 ${homeTeam.recentResults.length - homeWins}패`,
      impact: '+5%',
      icon: 'home_strong',
    });
  }

  // 🔴 원정 약세 (Away Weak): Away win rate < 30%
  const awayWins = awayTeam.recentResults.filter(r => r === 'W').length;
  const awayWinRate = (awayWins / awayTeam.recentResults.length) * 100;
  if (awayWinRate < 30) {
    factors.push({
      id: 'away-weak',
      type: 'negative',
      team: 'away',
      label: '원정 약세',
      description: `최근 ${awayWins}승 ${awayTeam.recentResults.length - awayWins}패`,
      impact: '-8%',
      icon: 'away_weak',
    });
  }

  // 🌧️ 악천후 (Bad Weather): Rain or Snow
  if (weather.condition === 'rainy' || weather.condition === 'snowy') {
    factors.push({
      id: 'bad-weather',
      type: 'neutral',
      team: 'match',
      label: weather.condition === 'rainy' ? '비 예보' : '눈 예보',
      description: `${weather.temperature}°C`,
      impact: '무 +8%',
      icon: 'weather',
    });
  }

  // 🔥 연승 중 (Win Streak): 3+ consecutive wins
  const homeStreak = countStreak(homeTeam.recentResults, 'W');
  if (homeStreak >= 3) {
    factors.push({
      id: 'home-streak',
      type: 'positive',
      team: 'home',
      label: `${homeStreak}연승 중`,
      description: '기세 상승',
      impact: '+3%',
      icon: 'streak',
    });
  }

  const awayStreak = countStreak(awayTeam.recentResults, 'W');
  if (awayStreak >= 3) {
    factors.push({
      id: 'away-streak',
      type: 'positive',
      team: 'away',
      label: `${awayStreak}연승 중`,
      description: '기세 상승',
      impact: '+3%',
      icon: 'streak',
    });
  }

  // 📉 연패 중 (Lose Streak): 3+ consecutive losses
  const homeLoseStreak = countStreak(homeTeam.recentResults, 'L');
  if (homeLoseStreak >= 3) {
    factors.push({
      id: 'home-lose-streak',
      type: 'negative',
      team: 'home',
      label: `${homeLoseStreak}연패 중`,
      description: '슬럼프',
      impact: '-5%',
      icon: 'form',
    });
  }

  const awayLoseStreak = countStreak(awayTeam.recentResults, 'L');
  if (awayLoseStreak >= 3) {
    factors.push({
      id: 'away-lose-streak',
      type: 'negative',
      team: 'away',
      label: `${awayLoseStreak}연패 중`,
      description: '슬럼프',
      impact: '-5%',
      icon: 'form',
    });
  }

  return factors;
}

function countStreak(results: ('W' | 'D' | 'L')[], target: 'W' | 'L'): number {
  let count = 0;
  for (const result of results) {
    if (result === target) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function FactorIcon({ icon, type }: { icon: DetectedFactor['icon']; type: DetectedFactor['type'] }) {
  const colorClass = type === 'positive' ? 'text-green-500' : type === 'negative' ? 'text-red-500' : 'text-blue-500';
  
  switch (icon) {
    case 'fatigue':
      return <AlertTriangle className={`h-4 w-4 ${colorClass}`} />;
    case 'home_strong':
      return <Home className={`h-4 w-4 ${colorClass}`} />;
    case 'away_weak':
      return <Plane className={`h-4 w-4 ${colorClass}`} />;
    case 'weather':
      return <CloudRain className={`h-4 w-4 ${colorClass}`} />;
    case 'streak':
      return <TrendingUp className={`h-4 w-4 ${colorClass}`} />;
    case 'form':
      return <TrendingDown className={`h-4 w-4 ${colorClass}`} />;
    default:
      return <Zap className={`h-4 w-4 ${colorClass}`} />;
  }
}

export function InsightCards({ homeTeam, awayTeam, weather }: InsightCardsProps) {
  const factors = detectFactors(homeTeam, awayTeam, weather);
  
  const homeFactors = factors.filter(f => f.team === 'home');
  const awayFactors = factors.filter(f => f.team === 'away');
  const matchFactors = factors.filter(f => f.team === 'match');

  if (factors.length === 0) {
    return (
      <Card className="p-4 bg-muted/30">
        <div className="text-center text-muted-foreground text-sm">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
          특이 변수 없음 - 정상적인 경기 컨디션
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="panel-insights">
      <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" />
        AI 자동 분석 결과
      </h3>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Home Team Factors */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            <span className="text-xs font-medium text-muted-foreground">{homeTeam.shortName} 핵심 변수</span>
          </div>
          {homeFactors.length === 0 ? (
            <div className="text-xs text-muted-foreground pl-4">감지된 변수 없음</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {homeFactors.map(factor => (
                <Badge
                  key={factor.id}
                  variant="outline"
                  className={`
                    flex items-center gap-1.5 py-1.5 px-3
                    ${factor.type === 'positive' 
                      ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400' 
                      : 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400'}
                  `}
                  data-testid={`badge-factor-${factor.id}`}
                >
                  <FactorIcon icon={factor.icon} type={factor.type} />
                  <span className="font-medium">{factor.label}</span>
                  <span className="text-xs opacity-70">({factor.impact})</span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Away Team Factors */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2 md:justify-end">
            <span className="text-xs font-medium text-muted-foreground">{awayTeam.shortName} 핵심 변수</span>
            <span className="w-2 h-2 rounded-full bg-primary" />
          </div>
          {awayFactors.length === 0 ? (
            <div className="text-xs text-muted-foreground md:text-right">감지된 변수 없음</div>
          ) : (
            <div className="flex flex-wrap gap-2 md:justify-end">
              {awayFactors.map(factor => (
                <Badge
                  key={factor.id}
                  variant="outline"
                  className={`
                    flex items-center gap-1.5 py-1.5 px-3
                    ${factor.type === 'positive' 
                      ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400' 
                      : 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400'}
                  `}
                  data-testid={`badge-factor-${factor.id}`}
                >
                  <FactorIcon icon={factor.icon} type={factor.type} />
                  <span className="font-medium">{factor.label}</span>
                  <span className="text-xs opacity-70">({factor.impact})</span>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Match-level Factors (Weather) */}
      {matchFactors.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="flex flex-wrap gap-2 justify-center">
            {matchFactors.map(factor => (
              <Badge
                key={factor.id}
                variant="outline"
                className="flex items-center gap-1.5 py-1.5 px-3 border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                data-testid={`badge-factor-${factor.id}`}
              >
                {factor.icon === 'weather' && (weather.condition === 'snowy' ? <Snowflake className="h-4 w-4" /> : <CloudRain className="h-4 w-4" />)}
                <span className="font-medium">{factor.label}</span>
                <span className="text-xs opacity-70">{factor.description}</span>
                <span className="text-xs opacity-70">({factor.impact})</span>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export { detectFactors };
