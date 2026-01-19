import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Users, TrendingUp } from "lucide-react";

interface TeamStanding {
  rank: number;
  teamId: number;
  teamName: string;
  logoUrl: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalDiff: number;
  form: ('W' | 'D' | 'L')[];
}

interface TopScorer {
  rank: number;
  playerId: number;
  playerName: string;
  photoUrl: string;
  teamName: string;
  teamLogoUrl: string;
  goals: number;
  assists: number;
}

const MOCK_STANDINGS: TeamStanding[] = [
  { rank: 1, teamId: 40, teamName: "Liverpool", logoUrl: "https://media.api-sports.io/football/teams/40.png", played: 21, won: 14, drawn: 6, lost: 1, points: 48, goalDiff: 28, form: ['W', 'W', 'D', 'W', 'W'] },
  { rank: 2, teamId: 42, teamName: "Arsenal", logoUrl: "https://media.api-sports.io/football/teams/42.png", played: 21, won: 12, drawn: 6, lost: 3, points: 42, goalDiff: 24, form: ['W', 'D', 'W', 'L', 'W'] },
  { rank: 3, teamId: 50, teamName: "Man City", logoUrl: "https://media.api-sports.io/football/teams/50.png", played: 21, won: 12, drawn: 4, lost: 5, points: 40, goalDiff: 18, form: ['L', 'W', 'W', 'D', 'W'] },
  { rank: 4, teamId: 49, teamName: "Chelsea", logoUrl: "https://media.api-sports.io/football/teams/49.png", played: 21, won: 11, drawn: 5, lost: 5, points: 38, goalDiff: 16, form: ['W', 'D', 'D', 'W', 'L'] },
  { rank: 5, teamId: 34, teamName: "Newcastle", logoUrl: "https://media.api-sports.io/football/teams/34.png", played: 21, won: 11, drawn: 4, lost: 6, points: 37, goalDiff: 12, form: ['W', 'W', 'L', 'W', 'D'] },
  { rank: 6, teamId: 35, teamName: "Bournemouth", logoUrl: "https://media.api-sports.io/football/teams/35.png", played: 21, won: 10, drawn: 5, lost: 6, points: 35, goalDiff: 8, form: ['D', 'W', 'W', 'L', 'W'] },
  { rank: 7, teamId: 51, teamName: "Brighton", logoUrl: "https://media.api-sports.io/football/teams/51.png", played: 21, won: 9, drawn: 7, lost: 5, points: 34, goalDiff: 6, form: ['D', 'D', 'W', 'W', 'D'] },
  { rank: 8, teamId: 66, teamName: "Aston Villa", logoUrl: "https://media.api-sports.io/football/teams/66.png", played: 21, won: 9, drawn: 6, lost: 6, points: 33, goalDiff: 5, form: ['L', 'W', 'D', 'W', 'W'] },
  { rank: 9, teamId: 36, teamName: "Fulham", logoUrl: "https://media.api-sports.io/football/teams/36.png", played: 21, won: 8, drawn: 7, lost: 6, points: 31, goalDiff: 2, form: ['W', 'D', 'L', 'D', 'W'] },
  { rank: 10, teamId: 33, teamName: "Man United", logoUrl: "https://media.api-sports.io/football/teams/33.png", played: 21, won: 8, drawn: 5, lost: 8, points: 29, goalDiff: -2, form: ['L', 'D', 'W', 'L', 'W'] },
  { rank: 11, teamId: 47, teamName: "Tottenham", logoUrl: "https://media.api-sports.io/football/teams/47.png", played: 21, won: 8, drawn: 4, lost: 9, points: 28, goalDiff: 4, form: ['W', 'L', 'L', 'W', 'D'] },
  { rank: 12, teamId: 52, teamName: "Brentford", logoUrl: "https://media.api-sports.io/football/teams/52.png", played: 21, won: 8, drawn: 4, lost: 9, points: 28, goalDiff: -1, form: ['L', 'W', 'W', 'D', 'L'] },
  { rank: 13, teamId: 48, teamName: "West Ham", logoUrl: "https://media.api-sports.io/football/teams/48.png", played: 21, won: 7, drawn: 5, lost: 9, points: 26, goalDiff: -4, form: ['D', 'L', 'W', 'L', 'D'] },
  { rank: 14, teamId: 65, teamName: "Nott'm Forest", logoUrl: "https://media.api-sports.io/football/teams/65.png", played: 21, won: 6, drawn: 7, lost: 8, points: 25, goalDiff: -3, form: ['L', 'D', 'D', 'W', 'L'] },
  { rank: 15, teamId: 45, teamName: "Everton", logoUrl: "https://media.api-sports.io/football/teams/45.png", played: 21, won: 5, drawn: 7, lost: 9, points: 22, goalDiff: -8, form: ['D', 'L', 'D', 'L', 'W'] },
  { rank: 16, teamId: 46, teamName: "Leicester", logoUrl: "https://media.api-sports.io/football/teams/46.png", played: 21, won: 5, drawn: 6, lost: 10, points: 21, goalDiff: -10, form: ['L', 'L', 'W', 'D', 'L'] },
  { rank: 17, teamId: 39, teamName: "Wolves", logoUrl: "https://media.api-sports.io/football/teams/39.png", played: 21, won: 5, drawn: 6, lost: 10, points: 21, goalDiff: -12, form: ['D', 'L', 'L', 'W', 'L'] },
  { rank: 18, teamId: 57, teamName: "Ipswich", logoUrl: "https://media.api-sports.io/football/teams/57.png", played: 21, won: 3, drawn: 8, lost: 10, points: 17, goalDiff: -14, form: ['D', 'D', 'L', 'L', 'D'] },
  { rank: 19, teamId: 41, teamName: "Southampton", logoUrl: "https://media.api-sports.io/football/teams/41.png", played: 21, won: 2, drawn: 5, lost: 14, points: 11, goalDiff: -22, form: ['L', 'L', 'L', 'D', 'L'] },
  { rank: 20, teamId: 38, teamName: "Crystal Palace", logoUrl: "https://media.api-sports.io/football/teams/38.png", played: 21, won: 2, drawn: 5, lost: 14, points: 11, goalDiff: -18, form: ['L', 'D', 'L', 'L', 'L'] },
];

const MOCK_TOP_SCORERS: TopScorer[] = [
  { rank: 1, playerId: 1100, playerName: "Mohamed Salah", photoUrl: "https://media.api-sports.io/football/players/306.png", teamName: "Liverpool", teamLogoUrl: "https://media.api-sports.io/football/teams/40.png", goals: 18, assists: 13 },
  { rank: 2, playerId: 1101, playerName: "Erling Haaland", photoUrl: "https://media.api-sports.io/football/players/1100.png", teamName: "Man City", teamLogoUrl: "https://media.api-sports.io/football/teams/50.png", goals: 16, assists: 4 },
  { rank: 3, playerId: 1102, playerName: "Cole Palmer", photoUrl: "https://media.api-sports.io/football/players/116177.png", teamName: "Chelsea", teamLogoUrl: "https://media.api-sports.io/football/teams/49.png", goals: 13, assists: 6 },
  { rank: 4, playerId: 1103, playerName: "Alexander Isak", photoUrl: "https://media.api-sports.io/football/players/184574.png", teamName: "Newcastle", teamLogoUrl: "https://media.api-sports.io/football/teams/34.png", goals: 12, assists: 3 },
  { rank: 5, playerId: 1104, playerName: "Bryan Mbeumo", photoUrl: "https://media.api-sports.io/football/players/161944.png", teamName: "Brentford", teamLogoUrl: "https://media.api-sports.io/football/teams/52.png", goals: 11, assists: 5 },
];

function FormIcon({ result }: { result: 'W' | 'D' | 'L' }) {
  const colors = {
    W: 'bg-green-500',
    D: 'bg-gray-400',
    L: 'bg-red-500'
  };
  
  return (
    <div 
      className={`w-5 h-5 rounded-full ${colors[result]} flex items-center justify-center`}
      title={result === 'W' ? '승' : result === 'D' ? '무' : '패'}
    >
      <span className="text-[10px] font-bold text-white">{result}</span>
    </div>
  );
}

function StandingsTable() {
  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-12 gap-1 px-3 py-2 text-xs text-muted-foreground font-medium border-b">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-4">팀</div>
        <div className="col-span-1 text-center">경기</div>
        <div className="col-span-1 text-center">승점</div>
        <div className="col-span-1 text-center">득실</div>
        <div className="col-span-4 text-center">최근 5경기</div>
      </div>
      
      {/* Rows */}
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-0.5">
          {MOCK_STANDINGS.map((team) => (
            <div 
              key={team.teamId}
              className="grid grid-cols-12 gap-1 px-3 py-2.5 items-center hover-elevate"
              data-testid={`row-standing-${team.rank}`}
            >
              <div className="col-span-1 text-center flex items-center gap-1">
                {team.rank <= 4 && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                {team.rank >= 18 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                <span className="text-sm font-semibold text-foreground">
                  {team.rank}
                </span>
              </div>
              <div className="col-span-4 flex items-center gap-2 min-w-0">
                <img 
                  src={team.logoUrl} 
                  alt={team.teamName}
                  className="w-6 h-6 flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.src = 'https://via.placeholder.com/24';
                  }}
                />
                <span className="text-sm font-medium truncate">{team.teamName}</span>
              </div>
              <div className="col-span-1 text-center text-sm text-muted-foreground">{team.played}</div>
              <div className="col-span-1 text-center text-sm font-bold">{team.points}</div>
              <div className="col-span-1 text-center text-sm text-muted-foreground">
                {team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}
              </div>
              <div className="col-span-4 flex justify-center gap-0.5">
                {team.form.map((result, idx) => (
                  <FormIcon key={idx} result={result} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-2 text-xs text-muted-foreground border-t">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>챔피언스리그</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span>강등권</span>
        </div>
      </div>
    </div>
  );
}

function TopPlayersSection() {
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <h3 className="font-semibold">득점 순위 TOP 5</h3>
      </div>
      
      <div className="space-y-3">
        {MOCK_TOP_SCORERS.map((player) => (
          <Card 
            key={player.playerId}
            className={`overflow-hidden ${player.rank === 1 ? 'border-yellow-500/50 bg-yellow-500/5' : ''}`}
            data-testid={`card-player-${player.rank}`}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {/* Rank Badge */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  player.rank === 1 ? 'bg-yellow-500 text-white' :
                  player.rank === 2 ? 'bg-gray-300 text-gray-700' :
                  player.rank === 3 ? 'bg-amber-700 text-white' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {player.rank}
                </div>
                
                {/* Player Photo */}
                <div className="relative">
                  <img 
                    src={player.photoUrl}
                    alt={player.playerName}
                    className="w-12 h-12 rounded-full object-cover bg-muted"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/48';
                    }}
                  />
                  <img 
                    src={player.teamLogoUrl}
                    alt={player.teamName}
                    className="w-4 h-4 absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                
                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{player.playerName}</p>
                  <p className="text-xs text-muted-foreground">{player.teamName}</p>
                </div>
                
                {/* Stats */}
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <span className="text-xl font-bold text-foreground">{player.goals}</span>
                    <span className="text-xs text-muted-foreground">골</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{player.assists} 도움</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Additional Stats Preview */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">이번 시즌 통계</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">621</p>
              <p className="text-xs text-muted-foreground">총 득점</p>
            </div>
            <div>
              <p className="text-2xl font-bold">2.96</p>
              <p className="text-xs text-muted-foreground">경기당 골</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">47%</p>
              <p className="text-xs text-muted-foreground">홈 승률</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LeaguePage() {
  const [activeTab, setActiveTab] = useState('standings');
  
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img 
              src="https://media.api-sports.io/football/leagues/39.png"
              alt="Premier League"
              className="w-8 h-8"
            />
            <div>
              <h1 className="text-lg font-bold" data-testid="text-page-title">리그</h1>
              <p className="text-xs text-muted-foreground">Premier League 2024-25</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            20팀
          </Badge>
        </div>
        
        {/* Sub Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-10 rounded-none bg-transparent border-b">
            <TabsTrigger 
              value="standings"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              data-testid="tab-standings"
            >
              순위표
            </TabsTrigger>
            <TabsTrigger 
              value="players"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              data-testid="tab-players"
            >
              선수 순위
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="standings" className="mt-0">
            <StandingsTable />
          </TabsContent>
          
          <TabsContent value="players" className="mt-0">
            <TopPlayersSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
