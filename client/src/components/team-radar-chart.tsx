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

// V7 Features 기반 팀 데이터 타입
interface TeamData {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string;
  color?: string;
  attack: number;      // homeGoalsFor / awayGoalsFor
  defense: number;     // 3 - goalsAgainst
  form: number;        // Form5 (최근 5경기 평균 승점)
  organization: number; // WinsAtHome / WinsAtAway (%)
  goalScoring: number; // GoalsAtHome / GoalsAtAway
}

interface TeamRadarChartProps {
  homeTeam: TeamData;
  awayTeam: TeamData;
}

interface PowerStat {
  stat: string;
  fullName: string;
  home: number;
  away: number;
}

// V7 features 기반 파워 계산
function calculateTeamPower(team: TeamData): { attack: number; defense: number; organization: number; form: number; goal: number } {
  // attack: 평균 득점 기반 (0-3골 → 0-100점)
  const attack = Math.min(100, Math.round((team.attack / 3) * 100));
  
  // defense: 실점 기반 (낮을수록 좋음, 이미 3 - goalsAgainst로 변환됨)
  const defense = Math.min(100, Math.round((team.defense / 3) * 100));
  
  // organization: 홈/원정 승률 (0-100%)
  const organization = Math.min(100, Math.round(team.organization));
  
  // form: 최근 5경기 평균 승점 (0-3점 → 0-100점)
  const form = Math.min(100, Math.round((team.form / 3) * 100));
  
  // goal: 홈/원정 평균 득점 (0-3골 → 0-100점)
  const goal = Math.min(100, Math.round((team.goalScoring / 3) * 100));
  
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
                fontWeight: 500 
              }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 100]} 
              tick={false}
              axisLine={false}
            />
            <Radar
              name={homeTeam.shortName || homeTeam.name.slice(0, 3)}
              dataKey="home"
              stroke="hsl(var(--chart-1))"
              fill="hsl(var(--chart-1))"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Radar
              name={awayTeam.shortName || awayTeam.name.slice(0, 3)}
              dataKey="away"
              stroke="hsl(var(--chart-2))"
              fill="hsl(var(--chart-2))"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Legend 
              wrapperStyle={{ 
                paddingTop: '12px',
                fontSize: '12px'
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      
      {/* 수치 비교 테이블 */}
      <div className="mt-3 space-y-1.5 text-xs">
        {data.map((item) => (
          <div key={item.stat} className="flex items-center justify-between px-2">
            <span className="w-16 text-right font-medium" style={{ color: 'hsl(var(--chart-1))' }}>
              {item.home}
            </span>
            <span className="flex-1 text-center text-muted-foreground">
              {item.fullName}
            </span>
            <span className="w-16 text-left font-medium" style={{ color: 'hsl(var(--chart-2))' }}>
              {item.away}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
