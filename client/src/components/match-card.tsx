import { Sun, Cloud, CloudRain, Snowflake, ChevronRight, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { usePrediction, type PredictionType } from "@/context/prediction-context";
import type { Match, WeatherCondition, WinDrawLossProbability, OddsTrend } from "@shared/schema";

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

function TrendIcon({ trend }: { trend: OddsTrend }) {
  switch (trend) {
    case 'up':
      return <ArrowUp className="h-3 w-3 text-destructive" />;
    case 'down':
      return <ArrowDown className="h-3 w-3 text-primary" />;
    case 'stable':
      return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
}

interface SelectableBadgeProps {
  type: PredictionType;
  value: number;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  testId: string;
}

function SelectableBadge({ type, value, isSelected, onClick, testId }: SelectableBadgeProps) {
  const baseClasses = {
    home: isSelected 
      ? 'bg-destructive text-destructive-foreground ring-2 ring-destructive ring-offset-2 ring-offset-background' 
      : 'bg-destructive/20 text-destructive hover-elevate',
    draw: isSelected 
      ? 'bg-muted text-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background' 
      : 'bg-muted/50 text-muted-foreground hover-elevate',
    away: isSelected 
      ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background' 
      : 'bg-primary/20 text-primary hover-elevate',
  };

  return (
    <Badge 
      className={`${baseClasses[type]} font-bold text-xs px-2 py-1 cursor-pointer transition-all`}
      onClick={onClick}
      data-testid={testId}
    >
      {value}%
    </Badge>
  );
}

export function MatchCard({ match, onClick, probability }: MatchCardProps) {
  const { addSelection, getSelection, removeSelection } = usePrediction();
  const selection = getSelection(match.id);

  const matchTime = new Date(match.matchTime);
  const timeString = matchTime.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const handleBadgeClick = (e: React.MouseEvent, prediction: PredictionType) => {
    e.stopPropagation();
    if (selection?.prediction === prediction) {
      removeSelection(match.id);
    } else {
      addSelection(match, prediction, probability);
    }
  };

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
          <Avatar className="h-10 w-10 border border-border shrink-0">
            <AvatarImage src={match.homeTeam.logoUrl} alt={match.homeTeam.name} />
            <AvatarFallback className="text-xs font-bold">{match.homeTeam.shortName}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-xs leading-tight break-keep">{match.homeTeam.name}</p>
            <p className="text-xs text-muted-foreground">홈</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0" data-testid="probability-badges">
          <div className="flex items-center gap-1">
            <SelectableBadge
              type="home"
              value={probability.homeWin}
              isSelected={selection?.prediction === 'home'}
              onClick={(e) => handleBadgeClick(e, 'home')}
              testId="badge-home-win"
            />
            <SelectableBadge
              type="draw"
              value={probability.draw}
              isSelected={selection?.prediction === 'draw'}
              onClick={(e) => handleBadgeClick(e, 'draw')}
              testId="badge-draw"
            />
            <SelectableBadge
              type="away"
              value={probability.awayWin}
              isSelected={selection?.prediction === 'away'}
              onClick={(e) => handleBadgeClick(e, 'away')}
              testId="badge-away-win"
            />
          </div>
          
          <div className="mt-1" data-testid="odds-section">
            <div className="flex flex-col gap-0.5 text-xs">
              <div className="flex items-center">
                <span className="w-8 text-muted-foreground shrink-0">국내</span>
                <div className="flex items-center gap-2">
                  <div className="w-12 flex items-center justify-end gap-0.5">
                    <span className="font-mono">{match.odds.domestic[0].toFixed(2)}</span>
                    <TrendIcon trend={match.odds.domesticTrend[0]} />
                  </div>
                  <div className="w-12 flex items-center justify-end gap-0.5">
                    <span className="font-mono">{match.odds.domestic[1].toFixed(2)}</span>
                    <TrendIcon trend={match.odds.domesticTrend[1]} />
                  </div>
                  <div className="w-12 flex items-center justify-end gap-0.5">
                    <span className="font-mono">{match.odds.domestic[2].toFixed(2)}</span>
                    <TrendIcon trend={match.odds.domesticTrend[2]} />
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <span className="w-8 text-muted-foreground shrink-0">해외</span>
                <div className="flex items-center gap-2">
                  <div className="w-12 flex items-center justify-end gap-0.5">
                    <span className="font-mono text-muted-foreground">{match.odds.overseas[0].toFixed(2)}</span>
                    <TrendIcon trend={match.odds.overseasTrend[0]} />
                  </div>
                  <div className="w-12 flex items-center justify-end gap-0.5">
                    <span className="font-mono text-muted-foreground">{match.odds.overseas[1].toFixed(2)}</span>
                    <TrendIcon trend={match.odds.overseasTrend[1]} />
                  </div>
                  <div className="w-12 flex items-center justify-end gap-0.5">
                    <span className="font-mono text-muted-foreground">{match.odds.overseas[2].toFixed(2)}</span>
                    <TrendIcon trend={match.odds.overseasTrend[2]} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0 justify-end" data-testid="team-away">
          <div className="min-w-0 flex-1 text-right">
            <p className="font-bold text-xs leading-tight break-keep">{match.awayTeam.name}</p>
            <p className="text-xs text-muted-foreground">원정</p>
          </div>
          <Avatar className="h-10 w-10 border border-border shrink-0">
            <AvatarImage src={match.awayTeam.logoUrl} alt={match.awayTeam.name} />
            <AvatarFallback className="text-xs font-bold">{match.awayTeam.shortName}</AvatarFallback>
          </Avatar>
        </div>

        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </div>
    </Card>
  );
}
