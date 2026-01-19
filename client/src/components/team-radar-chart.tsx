import { useMemo } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { Team } from "@shared/schema";

interface TeamRadarChartProps {
  homeTeam: Team;
  awayTeam: Team;
}

interface PowerStat {
  stat: string;
  fullName: string;
  home: number;
  away: number;
}

function calculateTeamPower(team: Team): { attack: number; defense: number; organization: number; form: number; goal: number } {
  const wins = team.recentResults.filter(r => r === 'W').length;
  const draws = team.recentResults.filter(r => r === 'D').length;
  const losses = team.recentResults.filter(r => r === 'L').length;
  
  const formScore = ((wins * 3 + draws) / 15) * 100;
  
  const rankScore = Math.max(0, 100 - (team.leagueRank - 1) * 5);
  
  const goalScore = Math.min(100, 50 + team.topScorer.goals * 5);
  
  let winStreak = 0;
  for (const r of team.recentResults) {
    if (r === 'W') winStreak++;
    else break;
  }
  const momentumBonus = winStreak * 8;
  
  const attack = Math.min(100, Math.round(rankScore * 0.4 + goalScore * 0.4 + formScore * 0.2));
  const defense = Math.min(100, Math.round(rankScore * 0.5 + (100 - losses * 15) * 0.5));
  const organization = Math.min(100, Math.round(rankScore * 0.6 + formScore * 0.4));
  const form = Math.min(100, Math.round(formScore + momentumBonus));
  const goal = Math.min(100, Math.round(goalScore));
  
  return { attack, defense, organization, form, goal };
}

export function TeamRadarChart({ homeTeam, awayTeam }: TeamRadarChartProps) {
  const data = useMemo((): PowerStat[] => {
    const homePower = calculateTeamPower(homeTeam);
    const awayPower = calculateTeamPower(awayTeam);
    
    return [
      { stat: 'ATT', fullName: '공격력', home: homePower.attack, away: awayPower.attack },
      { stat: 'DEF', fullName: '수비력', home: homePower.defense, away: awayPower.defense },
      { stat: 'ORG', fullName: '조직력', home: homePower.organization, away: awayPower.organization },
      { stat: 'FORM', fullName: '최근기세', home: homePower.form, away: awayPower.form },
      { stat: 'GOAL', fullName: '득점력', home: homePower.goal, away: awayPower.goal },
    ];
  }, [homeTeam, awayTeam]);

  return (
    <Card className="p-4" data-testid="panel-radar-chart">
      <h3 className="font-bold text-center mb-2 text-sm">양 팀 전력 비교</h3>
      <div className="h-[250px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid 
              stroke="hsl(var(--muted-foreground))" 
              strokeOpacity={0.3}
            />
            <PolarAngleAxis 
              dataKey="stat" 
              tick={{ 
                fill: 'hsl(var(--foreground))', 
                fontSize: 11,
                fontWeight: 600
              }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 100]} 
              tick={{ fontSize: 9 }}
              tickCount={5}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={0.3}
            />
            <Radar
              name={homeTeam.shortName}
              dataKey="home"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Radar
              name={awayTeam.shortName}
              dataKey="away"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Legend 
              wrapperStyle={{ 
                fontSize: '12px',
                paddingTop: '8px'
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-1">
        <span>ATT: 공격력</span>
        <span>DEF: 수비력</span>
        <span>ORG: 조직력</span>
      </div>
      <div className="flex justify-center gap-4 text-xs text-muted-foreground">
        <span>FORM: 최근기세</span>
        <span>GOAL: 득점력</span>
      </div>
    </Card>
  );
}
