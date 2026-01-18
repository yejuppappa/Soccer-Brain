import { Sun, Cloud, CloudRain, Snowflake, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { Match, WeatherCondition, WinDrawLossProbability } from "@shared/schema";

interface MatchCardProps {
  match: Match;
  onClick: () => void;
  probability: WinDrawLossProbability;
}

function WeatherIcon({ condition }: { condition: WeatherCondition }) {
  switch (condition) {
    case 'sunny':
      return <Sun className="h-3 w-3 text-warning" />;
    case 'cloudy':
      return <Cloud className="h-3 w-3 text-muted-foreground" />;
    case 'rainy':
      return <CloudRain className="h-3 w-3 text-primary" />;
    case 'snowy':
      return <Snowflake className="h-3 w-3 text-primary" />;
  }
}

export function MatchCard({ match, onClick, probability }: MatchCardProps) {
  const matchTime = new Date(match.matchTime);
  const timeString = matchTime.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <Card
      className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`card-match-${match.id}`}
    >
      <div className="flex items-center justify-center gap-1 mb-3 text-xs text-muted-foreground">
        <span className="font-medium">{timeString}</span>
        <span>|</span>
        <span>{match.venue}</span>
        <span>|</span>
        <span className="flex items-center gap-1">
          <WeatherIcon condition={match.weather.condition} />
          {match.weather.temperature}°C
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 flex items-center gap-2 min-w-0" data-testid="team-home">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={match.homeTeam.logoUrl} alt={match.homeTeam.name} />
            <AvatarFallback className="text-xs font-bold">{match.homeTeam.shortName}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate">{match.homeTeam.name}</p>
            <p className="text-xs text-muted-foreground">홈</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0" data-testid="probability-badges">
          <div className="flex items-center gap-1">
            <Badge 
              className="bg-destructive text-destructive-foreground font-bold text-xs px-2 py-1"
              data-testid="badge-home-win"
            >
              {probability.homeWin}%
            </Badge>
            <Badge 
              className="bg-muted text-muted-foreground font-bold text-xs px-2 py-1"
              data-testid="badge-draw"
            >
              {probability.draw}%
            </Badge>
            <Badge 
              className="bg-primary text-primary-foreground font-bold text-xs px-2 py-1"
              data-testid="badge-away-win"
            >
              {probability.awayWin}%
            </Badge>
          </div>
          
          <div className="flex flex-col items-center gap-0.5 mt-1" data-testid="odds-section">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-foreground font-medium">Betman</span>
              <span className="font-mono text-foreground/80">
                {match.odds.domestic[0].toFixed(2)} | {match.odds.domestic[1].toFixed(2)} | {match.odds.domestic[2].toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Bet365</span>
              <span className="font-mono">
                {match.odds.overseas[0].toFixed(2)} | {match.odds.overseas[1].toFixed(2)} | {match.odds.overseas[2].toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0 justify-end" data-testid="team-away">
          <div className="min-w-0 flex-1 text-right">
            <p className="font-bold text-sm truncate">{match.awayTeam.name}</p>
            <p className="text-xs text-muted-foreground">원정</p>
          </div>
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={match.awayTeam.logoUrl} alt={match.awayTeam.name} />
            <AvatarFallback className="text-xs font-bold">{match.awayTeam.shortName}</AvatarFallback>
          </Avatar>
        </div>

        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </div>
    </Card>
  );
}
