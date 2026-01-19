import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Team, WinDrawLossProbability } from "@shared/schema";

interface PredictedScoreProps {
  homeTeam: Team;
  awayTeam: Team;
  probability: WinDrawLossProbability;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generatePredictedScore(
  homeTeam: Team,
  awayTeam: Team,
  probability: WinDrawLossProbability
): { home: number; away: number } {
  const { homeWin, draw, awayWin } = probability;
  
  const seed = homeTeam.id.charCodeAt(5) + awayTeam.id.charCodeAt(5) + homeWin + awayWin;
  const randomFactor = seededRandom(seed);
  
  const homeGoalPower = homeTeam.topScorer.goals / 10;
  const awayGoalPower = awayTeam.topScorer.goals / 10;
  
  const homeWins = homeTeam.recentResults.filter(r => r === 'W').length;
  const awayWins = awayTeam.recentResults.filter(r => r === 'W').length;
  
  let homeGoals = 0;
  let awayGoals = 0;
  
  const randomAdjust = Math.floor(randomFactor * 2);
  
  if (homeWin >= awayWin + 20) {
    homeGoals = Math.min(4, Math.max(1, Math.round(1.5 + homeGoalPower + homeWins * 0.2 + randomFactor)));
    awayGoals = Math.max(0, Math.round(0.3 + awayGoalPower * 0.5 + (randomFactor > 0.6 ? 1 : 0)));
  } else if (awayWin >= homeWin + 20) {
    homeGoals = Math.max(0, Math.round(0.3 + homeGoalPower * 0.5 + (randomFactor > 0.7 ? 1 : 0)));
    awayGoals = Math.min(4, Math.max(1, Math.round(1.5 + awayGoalPower + awayWins * 0.2 + randomFactor)));
  } else if (draw >= 30 || Math.abs(homeWin - awayWin) < 10) {
    const baseGoals = Math.round(1 + randomFactor * 1.5);
    homeGoals = baseGoals;
    awayGoals = baseGoals;
  } else if (homeWin > awayWin) {
    homeGoals = Math.min(3, Math.max(1, Math.round(1 + homeGoalPower + (homeWin - awayWin) / 30 + randomFactor * 0.5)));
    awayGoals = Math.max(0, Math.round(0.5 + awayGoalPower * 0.6 + (randomAdjust > 0 ? 1 : 0)));
  } else {
    homeGoals = Math.max(0, Math.round(0.5 + homeGoalPower * 0.6 + (randomAdjust > 0 ? 1 : 0)));
    awayGoals = Math.min(3, Math.max(1, Math.round(1 + awayGoalPower + (awayWin - homeWin) / 30 + randomFactor * 0.5)));
  }
  
  return { home: homeGoals, away: awayGoals };
}

export function PredictedScore({ homeTeam, awayTeam, probability }: PredictedScoreProps) {
  const score = useMemo(() => {
    return generatePredictedScore(homeTeam, awayTeam, probability);
  }, [homeTeam, awayTeam, probability]);

  return (
    <div className="flex items-center justify-center gap-2" data-testid="badge-predicted-score">
      <Badge 
        variant="secondary" 
        className="bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0 px-3 py-1.5 text-sm font-bold shadow-lg"
      >
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
        AI 예상 스코어: {score.home} - {score.away}
      </Badge>
    </div>
  );
}
