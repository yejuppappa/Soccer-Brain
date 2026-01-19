import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Calendar, ChevronRight, CloudRain, Sun, Cloud, Snowflake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import type { MatchListResponse, WeatherCondition } from "@shared/schema";

function WeatherIcon({ condition }: { condition: WeatherCondition }) {
  switch (condition) {
    case 'sunny':
      return <Sun className="h-3.5 w-3.5 text-amber-500" />;
    case 'cloudy':
      return <Cloud className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'rainy':
      return <CloudRain className="h-3.5 w-3.5 text-blue-500" />;
    case 'snowy':
      return <Snowflake className="h-3.5 w-3.5 text-blue-400" />;
  }
}

export default function Schedule() {
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<MatchListResponse>({
    queryKey: ["/api/matches"],
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-lg">경기 일정</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {data?.date && (
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-date">
            {data.date}
          </p>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Card className="p-6 text-center text-destructive">
            <p>경기 데이터를 불러오는데 실패했습니다</p>
          </Card>
        ) : data?.matches && data.matches.length > 0 ? (
          <div className="space-y-3">
            {data.matches.map((match) => (
              <Card
                key={match.id}
                className="p-4 cursor-pointer hover-elevate"
                onClick={() => navigate(`/match/${match.id}`)}
                data-testid={`card-match-${match.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <img 
                          src={match.homeTeam.logoUrl} 
                          alt={match.homeTeam.name}
                          className="w-8 h-8 object-contain"
                        />
                        <div>
                          <div className="font-medium text-sm">{match.homeTeam.name}</div>
                          <div className="text-xs text-muted-foreground">{match.homeTeam.leagueRank}위</div>
                        </div>
                      </div>
                      
                      <span className="text-xs text-muted-foreground px-2">vs</span>
                      
                      <div className="flex items-center gap-2">
                        <img 
                          src={match.awayTeam.logoUrl} 
                          alt={match.awayTeam.name}
                          className="w-8 h-8 object-contain"
                        />
                        <div>
                          <div className="font-medium text-sm">{match.awayTeam.name}</div>
                          <div className="text-xs text-muted-foreground">{match.awayTeam.leagueRank}위</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{match.venue}</span>
                      <span>·</span>
                      <div className="flex items-center gap-1">
                        <WeatherIcon condition={match.weather.condition} />
                        <span>{match.weather.temperature}°C</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-1">
                      {match.homeTeam.recentResults.slice(0, 3).map((r, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={`w-5 h-5 p-0 flex items-center justify-center text-[10px] font-bold ${
                            r === 'W' ? 'bg-green-500/20 text-green-600 border-green-500/30' :
                            r === 'L' ? 'bg-red-500/20 text-red-600 border-red-500/30' :
                            'bg-gray-500/20 text-gray-600 border-gray-500/30'
                          }`}
                        >
                          {r}
                        </Badge>
                      ))}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center text-muted-foreground">
            <p>예정된 경기가 없습니다</p>
          </Card>
        )}
      </main>
    </div>
  );
}
