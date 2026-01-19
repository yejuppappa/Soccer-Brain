import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Beaker, Zap, Trophy, Swords, Target, Shield, TrendingUp, Activity, Goal, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Match } from "@shared/schema";

const PREMIER_LEAGUE_TEAMS = [
  { id: "man_city", name: "맨체스터 시티", shortName: "맨시티", color: "#6CABDD" },
  { id: "arsenal", name: "아스널", shortName: "아스널", color: "#EF0107" },
  { id: "liverpool", name: "리버풀", shortName: "리버풀", color: "#C8102E" },
  { id: "man_utd", name: "맨체스터 유나이티드", shortName: "맨유", color: "#DA291C" },
  { id: "chelsea", name: "첼시", shortName: "첼시", color: "#034694" },
  { id: "tottenham", name: "토트넘 홋스퍼", shortName: "토트넘", color: "#132257" },
  { id: "newcastle", name: "뉴캐슬 유나이티드", shortName: "뉴캐슬", color: "#241F20" },
  { id: "brighton", name: "브라이튼", shortName: "브라이튼", color: "#0057B8" },
  { id: "aston_villa", name: "아스톤 빌라", shortName: "빌라", color: "#95BFE5" },
  { id: "west_ham", name: "웨스트햄 유나이티드", shortName: "웨스트햄", color: "#7A263A" },
  { id: "brentford", name: "브렌트포드", shortName: "브렌트포드", color: "#E30613" },
  { id: "fulham", name: "풀럼", shortName: "풀럼", color: "#000000" },
  { id: "crystal_palace", name: "크리스탈 팰리스", shortName: "팰리스", color: "#1B458F" },
  { id: "wolves", name: "울버햄튼", shortName: "울브스", color: "#FDB913" },
  { id: "everton", name: "에버튼", shortName: "에버튼", color: "#003399" },
  { id: "nottingham", name: "노팅엄 포레스트", shortName: "노팅엄", color: "#DD0000" },
  { id: "bournemouth", name: "본머스", shortName: "본머스", color: "#DA291C" },
  { id: "leicester", name: "레스터 시티", shortName: "레스터", color: "#003090" },
  { id: "ipswich", name: "입스위치 타운", shortName: "입스위치", color: "#3A64A3" },
  { id: "southampton", name: "사우샘프턴", shortName: "사우샘프턴", color: "#D71920" },
];

function generateTeamStats(teamId: string) {
  const hash = teamId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const seed = (n: number) => ((hash * n) % 100) / 100;
  
  return {
    attack: 55 + Math.floor(seed(1) * 40),
    defense: 55 + Math.floor(seed(2) * 40),
    organization: 55 + Math.floor(seed(3) * 40),
    form: 45 + Math.floor(seed(4) * 50),
    goalScoring: 50 + Math.floor(seed(5) * 45),
  };
}

function generateCommentary(homeTeam: string, awayTeam: string, homeScore: number, awayScore: number, stats: any) {
  const commentaries = [
    `${homeTeam}의 공격력이 ${awayTeam}의 수비를 뚫었습니다!`,
    `${awayTeam}의 역습이 날카롭게 들어갔습니다!`,
    `${homeTeam}의 조직력이 경기를 지배하고 있습니다.`,
    `${awayTeam}의 골 결정력이 빛을 발했습니다!`,
    `${homeTeam}의 폼이 최근 상승세입니다.`,
    `치열한 중원 싸움이 예상됩니다.`,
    `${homeScore > awayScore ? homeTeam : awayTeam}의 압도적인 경기력이 돋보입니다!`,
    `양 팀 모두 치열하게 승부를 펼쳤습니다.`,
  ];
  
  const idx = (stats.attack + stats.defense) % commentaries.length;
  return commentaries[idx];
}

interface SimulationResult {
  homeScore: number;
  awayScore: number;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  commentary: string;
  winner: 'home' | 'draw' | 'away';
}

export default function Laboratory() {
  const [homeTeamId, setHomeTeamId] = useState<string>("");
  const [awayTeamId, setAwayTeamId] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const homeTeam = PREMIER_LEAGUE_TEAMS.find(t => t.id === homeTeamId);
  const awayTeam = PREMIER_LEAGUE_TEAMS.find(t => t.id === awayTeamId);

  const homeStats = useMemo(() => homeTeamId ? generateTeamStats(homeTeamId) : null, [homeTeamId]);
  const awayStats = useMemo(() => awayTeamId ? generateTeamStats(awayTeamId) : null, [awayTeamId]);

  const radarData = useMemo(() => {
    if (!homeStats || !awayStats) return [];
    return [
      { stat: "ATT", home: homeStats.attack, away: awayStats.attack, fullMark: 100 },
      { stat: "DEF", home: homeStats.defense, away: awayStats.defense, fullMark: 100 },
      { stat: "ORG", home: homeStats.organization, away: awayStats.organization, fullMark: 100 },
      { stat: "FORM", home: homeStats.form, away: awayStats.form, fullMark: 100 },
      { stat: "GOAL", home: homeStats.goalScoring, away: awayStats.goalScoring, fullMark: 100 },
    ];
  }, [homeStats, awayStats]);

  const handleSimulate = async () => {
    if (!homeTeam || !awayTeam || !homeStats || !awayStats) return;
    
    setIsSimulating(true);
    setResult(null);
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    const homeStrength = (homeStats.attack + homeStats.organization + homeStats.goalScoring + homeStats.form) / 4 + 5;
    const awayStrength = (awayStats.attack + awayStats.organization + awayStats.goalScoring + awayStats.form) / 4;

    const totalStrength = homeStrength + awayStrength;
    let homeWinProb = Math.round((homeStrength / totalStrength) * 100);
    let awayWinProb = Math.round((awayStrength / totalStrength) * 100);
    
    const drawAdjust = 15 + Math.floor(Math.abs(homeStrength - awayStrength) / 5);
    homeWinProb = Math.max(10, homeWinProb - drawAdjust / 2);
    awayWinProb = Math.max(10, awayWinProb - drawAdjust / 2);
    const drawProb = 100 - homeWinProb - awayWinProb;

    const random = Math.random() * 100;
    let winner: 'home' | 'draw' | 'away';
    let homeScore: number;
    let awayScore: number;

    if (random < homeWinProb) {
      winner = 'home';
      homeScore = 1 + Math.floor(Math.random() * 3);
      awayScore = Math.floor(Math.random() * homeScore);
    } else if (random < homeWinProb + drawProb) {
      winner = 'draw';
      homeScore = Math.floor(Math.random() * 3);
      awayScore = homeScore;
    } else {
      winner = 'away';
      awayScore = 1 + Math.floor(Math.random() * 3);
      homeScore = Math.floor(Math.random() * awayScore);
    }

    const commentary = generateCommentary(
      homeTeam.shortName, 
      awayTeam.shortName, 
      homeScore, 
      awayScore, 
      homeStats
    );

    setResult({
      homeScore,
      awayScore,
      homeWinProb,
      drawProb,
      awayWinProb,
      commentary,
      winner,
    });
    setIsSimulating(false);
  };

  const canSimulate = homeTeamId && awayTeamId && homeTeamId !== awayTeamId;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold" data-testid="text-lab-title">AI 가상 매치</h1>
            </div>
            <ThemeToggle />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            프리미어리그 팀들의 가상 대결을 시뮬레이션합니다
          </p>
        </div>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Swords className="h-4 w-4 text-primary" />
              팀 선택
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">홈팀</label>
                <Select value={homeTeamId} onValueChange={setHomeTeamId}>
                  <SelectTrigger data-testid="select-home-team">
                    <SelectValue placeholder="홈팀 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREMIER_LEAGUE_TEAMS.map((team) => (
                      <SelectItem 
                        key={team.id} 
                        value={team.id}
                        disabled={team.id === awayTeamId}
                      >
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">원정팀</label>
                <Select value={awayTeamId} onValueChange={setAwayTeamId}>
                  <SelectTrigger data-testid="select-away-team">
                    <SelectValue placeholder="원정팀 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {PREMIER_LEAGUE_TEAMS.map((team) => (
                      <SelectItem 
                        key={team.id} 
                        value={team.id}
                        disabled={team.id === homeTeamId}
                      >
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {homeTeam && awayTeam && (
              <div className="text-center py-2">
                <div className="flex items-center justify-center gap-4">
                  <span className="font-bold text-destructive">{homeTeam.shortName}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-bold text-primary">{awayTeam.shortName}</span>
                </div>
              </div>
            )}

            <Button
              onClick={handleSimulate}
              disabled={!canSimulate || isSimulating}
              className="w-full"
              size="lg"
              data-testid="button-simulate"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  AI 분석 중...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 mr-2" />
                  AI 가상 대결 시작
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {radarData.length > 0 && homeTeam && awayTeam && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                팀 전력 비교
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
                    <PolarAngleAxis 
                      dataKey="stat" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} 
                    />
                    <PolarRadiusAxis 
                      angle={30} 
                      domain={[0, 100]} 
                      tick={{ fontSize: 9 }}
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity={0.3}
                    />
                    <Radar
                      name={homeTeam.shortName}
                      dataKey="home"
                      stroke="hsl(var(--destructive))"
                      fill="hsl(var(--destructive))"
                      fillOpacity={0.3}
                    />
                    <Radar
                      name={awayTeam.shortName}
                      dataKey="away"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.3}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-5 gap-1 text-center text-xs mt-2">
                <div>
                  <Shield className="h-3 w-3 mx-auto text-muted-foreground" />
                  <span className="text-muted-foreground">ATT: 공격</span>
                </div>
                <div>
                  <Shield className="h-3 w-3 mx-auto text-muted-foreground" />
                  <span className="text-muted-foreground">DEF: 수비</span>
                </div>
                <div>
                  <Activity className="h-3 w-3 mx-auto text-muted-foreground" />
                  <span className="text-muted-foreground">ORG: 조직력</span>
                </div>
                <div>
                  <TrendingUp className="h-3 w-3 mx-auto text-muted-foreground" />
                  <span className="text-muted-foreground">FORM: 폼</span>
                </div>
                <div>
                  <Goal className="h-3 w-3 mx-auto text-muted-foreground" />
                  <span className="text-muted-foreground">GOAL: 결정력</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <AnimatePresence>
          {result && homeTeam && awayTeam && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="border-primary/50 overflow-hidden">
                <div className="bg-gradient-to-r from-destructive/20 via-background to-primary/20 p-6">
                  <div className="text-center mb-4">
                    <Badge variant="secondary" className="mb-2">AI 예측 결과</Badge>
                    <h3 className="text-lg font-bold">가상 대결 결과</h3>
                  </div>
                  
                  <div className="flex items-center justify-center gap-8">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-1">홈</div>
                      <div className="font-bold text-lg text-destructive">{homeTeam.shortName}</div>
                      <motion.div 
                        className="text-5xl font-bold mt-2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                      >
                        {result.homeScore}
                      </motion.div>
                    </div>
                    
                    <div className="text-2xl text-muted-foreground">-</div>
                    
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-1">원정</div>
                      <div className="font-bold text-lg text-primary">{awayTeam.shortName}</div>
                      <motion.div 
                        className="text-5xl font-bold mt-2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: "spring" }}
                      >
                        {result.awayScore}
                      </motion.div>
                    </div>
                  </div>

                  <motion.div 
                    className="mt-6 text-center"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Badge 
                      className={`text-base px-4 py-1 ${
                        result.winner === 'home' ? 'bg-destructive' :
                        result.winner === 'away' ? 'bg-primary' :
                        'bg-muted-foreground'
                      }`}
                      data-testid="badge-winner"
                    >
                      {result.winner === 'home' ? `${homeTeam.shortName} 승리` :
                       result.winner === 'away' ? `${awayTeam.shortName} 승리` :
                       '무승부'}
                    </Badge>
                  </motion.div>
                </div>

                <CardContent className="pt-4">
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div>
                      <div className="text-xl font-bold text-destructive">{result.homeWinProb}%</div>
                      <div className="text-xs text-muted-foreground">홈 승</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-muted-foreground">{result.drawProb}%</div>
                      <div className="text-xs text-muted-foreground">무승부</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-primary">{result.awayWinProb}%</div>
                      <div className="text-xs text-muted-foreground">원정 승</div>
                    </div>
                  </div>

                  <motion.div 
                    className="bg-muted/50 rounded-lg p-4 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    data-testid="text-commentary"
                  >
                    <Trophy className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
                    <p className="text-sm font-medium">{result.commentary}</p>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
