import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Match } from "@shared/schema";

interface MatchCardProps {
  match: Match;
  onClick: () => void;
  winProbability: number;
}

export function MatchCard({ match, onClick, winProbability }: MatchCardProps) {
  const matchTime = new Date(match.matchTime);
  const timeString = matchTime.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const getProbabilityColor = (prob: number) => {
    if (prob >= 60) return "bg-success text-success-foreground";
    if (prob >= 40) return "bg-primary text-primary-foreground";
    return "bg-destructive text-destructive-foreground";
  };

  return (
    <Card
      className="p-4 hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={onClick}
      data-testid={`card-match-${match.id}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-medium">{timeString}</span>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs text-muted-foreground">{match.venue}</span>
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
          <Badge className={`${getProbabilityColor(winProbability)} font-bold`}>
            {winProbability}%
          </Badge>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}
