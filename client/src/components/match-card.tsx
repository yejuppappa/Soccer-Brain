import { ChevronRight, Sun, Cloud, CloudRain, Snowflake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Match, WeatherCondition } from "@shared/schema";

interface MatchCardProps {
  match: Match;
  onClick: () => void;
  homeWinProbability: number;
}

const weatherLabels: Record<WeatherCondition, string> = {
  sunny: 'Sunny',
  cloudy: 'Cloudy',
  rainy: 'Rain',
  snowy: 'Snow',
};

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

export function MatchCard({ match, onClick, homeWinProbability }: MatchCardProps) {
  const matchTime = new Date(match.matchTime);
  const timeString = matchTime.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const getProbabilityColor = (prob: number) => {
    if (prob >= 50) return "bg-destructive text-destructive-foreground";
    if (prob >= 35) return "bg-muted text-muted-foreground";
    return "bg-primary text-primary-foreground";
  };

  return (
    <Card
      className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`card-match-${match.id}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">{timeString}</span>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs text-muted-foreground">{match.venue}</span>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <WeatherIcon condition={match.weather.condition} />
              {weatherLabels[match.weather.condition]}, {match.weather.temperature}°C
            </span>
          </div>
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">{match.homeTeam.name}</span>
              <span className="text-xs text-muted-foreground">(홈)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-base text-muted-foreground">{match.awayTeam.name}</span>
              <span className="text-xs text-muted-foreground">(원정)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge className={`${getProbabilityColor(homeWinProbability)} font-bold`}>
            {homeWinProbability}%
          </Badge>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}
