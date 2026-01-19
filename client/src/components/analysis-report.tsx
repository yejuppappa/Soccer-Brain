import { Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Team, Weather, WinDrawLossProbability } from "@shared/schema";

interface AnalysisReportProps {
  homeTeam: Team;
  awayTeam: Team;
  weather: Weather;
  probability: WinDrawLossProbability;
}

function generateHomeTeamAnalysis(homeTeam: Team, weather: Weather): string[] {
  const sentences: string[] = [];
  
  const homeWins = homeTeam.recentResults.filter(r => r === 'W').length;
  const homeWinRate = (homeWins / homeTeam.recentResults.length) * 100;
  const homeLosses = homeTeam.recentResults.filter(r => r === 'L').length;
  
  if (homeTeam.lastMatchDaysAgo < 3) {
    sentences.push(
      `${homeTeam.name}은(는) 지난 경기 이후 단 ${homeTeam.lastMatchDaysAgo}일밖에 쉬지 못했습니다. 후반전 체력 저하가 승부의 변수가 될 것입니다.`
    );
  }
  
  if (homeWinRate >= 60) {
    sentences.push(
      `최근 5경기에서 ${homeWins}승을 기록하며 보여준 상승세는 이번 홈 경기에서도 강력한 무기가 될 것입니다.`
    );
  }
  
  let streak = 0;
  for (const r of homeTeam.recentResults) {
    if (r === 'W') streak++;
    else break;
  }
  if (streak >= 3) {
    sentences.push(
      `${streak}연승의 기세를 몰아 홈에서 유리한 흐름을 이어갈 가능성이 높습니다.`
    );
  }
  
  let loseStreak = 0;
  for (const r of homeTeam.recentResults) {
    if (r === 'L') loseStreak++;
    else break;
  }
  if (loseStreak >= 3) {
    sentences.push(
      `${loseStreak}연패의 늪에 빠져 팀 사기가 바닥인 상황입니다. 홈 이점을 살리기 어려울 수 있습니다.`
    );
  }
  
  if (homeTeam.leagueRank <= 4) {
    sentences.push(
      `리그 ${homeTeam.leagueRank}위의 강호답게 안정적인 경기 운영이 기대됩니다.`
    );
  } else if (homeTeam.leagueRank >= 15) {
    sentences.push(
      `하위권(${homeTeam.leagueRank}위)에 머물고 있어 반드시 승점이 필요한 절박한 상황입니다.`
    );
  }
  
  if (sentences.length === 0) {
    sentences.push(
      `${homeTeam.name}은(는) 평균적인 컨디션으로 이번 홈 경기에 임할 것으로 보입니다.`
    );
  }
  
  return sentences;
}

function generateAwayTeamAnalysis(awayTeam: Team, weather: Weather): string[] {
  const sentences: string[] = [];
  
  const awayWins = awayTeam.recentResults.filter(r => r === 'W').length;
  const awayWinRate = (awayWins / awayTeam.recentResults.length) * 100;
  
  if (awayTeam.lastMatchDaysAgo < 3) {
    sentences.push(
      `${awayTeam.name} 역시 ${awayTeam.lastMatchDaysAgo}일 전 경기를 치렀습니다. 원정 이동까지 더해져 체력 관리가 관건입니다.`
    );
  }
  
  if (awayWinRate < 30) {
    sentences.push(
      `최근 승리를 거두지 못하며 팀 분위기가 침체되어 있습니다. 원정에서 반전을 노리기 쉽지 않아 보입니다.`
    );
  }
  
  if (awayWinRate >= 60) {
    sentences.push(
      `최근 ${awayWins}승의 좋은 폼을 유지하고 있어 원정에서도 충분히 경쟁력을 발휘할 수 있습니다.`
    );
  }
  
  let streak = 0;
  for (const r of awayTeam.recentResults) {
    if (r === 'W') streak++;
    else break;
  }
  if (streak >= 3) {
    sentences.push(
      `${streak}연승 행진을 이어가고 있어 자신감이 충만한 상태입니다.`
    );
  }
  
  let loseStreak = 0;
  for (const r of awayTeam.recentResults) {
    if (r === 'L') loseStreak++;
    else break;
  }
  if (loseStreak >= 3) {
    sentences.push(
      `${loseStreak}연패로 수비 조직력이 흔들리고 있으며, 원정에서 이를 회복하기는 어려워 보입니다.`
    );
  }
  
  if (awayTeam.leagueRank <= 4) {
    sentences.push(
      `리그 상위권(${awayTeam.leagueRank}위)의 전력을 보유하고 있어 원정에서도 두려울 것이 없습니다.`
    );
  } else if (awayTeam.leagueRank >= 15) {
    sentences.push(
      `하위권(${awayTeam.leagueRank}위)에서 헤매고 있어 원정에서 고전이 예상됩니다.`
    );
  }
  
  if (sentences.length === 0) {
    sentences.push(
      `${awayTeam.name}은(는) 특별한 악재 없이 원정 경기에 나설 예정입니다.`
    );
  }
  
  return sentences;
}

function generateWeatherAnalysis(weather: Weather): string | null {
  const condition = (weather.condition || '').toLowerCase();
  
  if (condition.includes('rain')) {
    return `경기 당일 비가 예보되어 있습니다. 젖은 그라운드에서는 패스 미스가 늘고 예측 불가능한 상황이 연출될 수 있어, 무승부 확률이 높아집니다.`;
  }
  
  if (condition.includes('snow')) {
    return `눈 예보가 있어 경기장 상태가 좋지 않을 수 있습니다. 양 팀 모두 기술적인 플레이보다 수비적인 전략을 택할 가능성이 높습니다.`;
  }
  
  if (weather.temperature < 5) {
    return `기온이 ${weather.temperature}°C로 낮아 선수들의 부상 위험이 증가할 수 있습니다.`;
  }
  
  return null;
}

function generateConclusion(
  homeTeam: Team,
  awayTeam: Team,
  probability: WinDrawLossProbability
): string {
  const { homeWin, draw, awayWin } = probability;
  const diff = Math.abs(homeWin - awayWin);
  
  if (homeWin >= awayWin + 20) {
    return `객관적인 전력과 데이터상, ${homeTeam.name}의 무난한 홈 승리가 예상됩니다. 홈 어드밴티지와 최근 폼을 고려할 때 ${homeWin}%의 승률은 신뢰할 수 있는 수치입니다.`;
  }
  
  if (awayWin >= homeWin + 20) {
    return `원정팀 ${awayTeam.name}이(가) 오히려 우세한 것으로 분석됩니다. 리그 순위와 최근 경기력을 종합하면 원정 승리 가능성이 ${awayWin}%로 높게 나타납니다.`;
  }
  
  if (draw >= 30 || diff < 10) {
    return `양 팀의 전력이 팽팽하여 치열한 접전 끝에 무승부 가능성이 높습니다. 어느 쪽도 쉽게 물러서지 않을 것으로 보이며, 신중한 베팅이 필요합니다.`;
  }
  
  if (homeWin > awayWin) {
    return `근소하지만 ${homeTeam.name}이(가) 홈에서 유리한 고지를 점하고 있습니다. 다만 ${diff}% 차이는 변수에 따라 뒤집힐 수 있는 범위입니다.`;
  }
  
  return `${awayTeam.name}이(가) 원정에서 약간 우세하지만, 홈팀의 이점을 무시할 수 없습니다. 변수가 많은 경기가 될 것으로 예상됩니다.`;
}

export function AnalysisReport({ homeTeam, awayTeam, weather, probability }: AnalysisReportProps) {
  const homeAnalysis = generateHomeTeamAnalysis(homeTeam, weather);
  const awayAnalysis = generateAwayTeamAnalysis(awayTeam, weather);
  const weatherAnalysis = generateWeatherAnalysis(weather);
  const conclusion = generateConclusion(homeTeam, awayTeam, probability);
  
  return (
    <Card 
      className="p-5 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 border-zinc-800"
      data-testid="panel-analysis-report"
    >
      <div className="flex items-center gap-2 mb-4">
        <Bot className="h-5 w-5 text-emerald-400" />
        <h3 className="font-bold text-base text-zinc-100">AI 종합 분석 리포트</h3>
      </div>
      
      <div className="space-y-4 text-sm leading-relaxed">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-medium text-zinc-400">{homeTeam.name} 분석</span>
          </div>
          <p className="text-zinc-300 pl-4" data-testid="text-home-analysis">
            {homeAnalysis.join(' ')}
          </p>
        </div>
        
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-xs font-medium text-zinc-400">{awayTeam.name} 분석</span>
          </div>
          <p className="text-zinc-300 pl-4" data-testid="text-away-analysis">
            {awayAnalysis.join(' ')}
          </p>
        </div>
        
        {weatherAnalysis && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-xs font-medium text-zinc-400">기상 영향</span>
            </div>
            <p className="text-zinc-300 pl-4" data-testid="text-weather-analysis">
              {weatherAnalysis}
            </p>
          </div>
        )}
        
        <div className="pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-400">종합 결론</span>
          </div>
          <p className="text-zinc-200 pl-4 font-medium" data-testid="text-conclusion">
            {conclusion}
          </p>
        </div>
      </div>
    </Card>
  );
}
