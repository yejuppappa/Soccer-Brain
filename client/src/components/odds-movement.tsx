import { TrendingUp, TrendingDown, Minus, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Odds, OddsTrend } from "@shared/schema";

interface OddsMovementProps {
  odds: Odds;
  homeTeamName: string;
  awayTeamName: string;
}

function TrendIcon({ trend }: { trend: OddsTrend }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="h-3 w-3 text-green-500" />;
    case 'down':
      return <TrendingDown className="h-3 w-3 text-red-500" />;
    case 'stable':
      return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
}

function OddsCell({ 
  label, 
  domestic, 
  overseas, 
  domesticTrend, 
  overseasTrend,
  isHot 
}: { 
  label: string;
  domestic: number;
  overseas: number;
  domesticTrend: OddsTrend;
  overseasTrend: OddsTrend;
  isHot: boolean;
}) {
  return (
    <div className="text-center relative">
      {isHot && (
        <Badge 
          variant="outline" 
          className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0 border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400"
          data-testid={`badge-hot-${label.toLowerCase().replace(/\s/g, '-')}`}
        >
          <Flame className="h-2.5 w-2.5 mr-0.5" />
          HOT
        </Badge>
      )}
      <div className="text-xs text-muted-foreground mb-1 mt-2">{label}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-muted-foreground">국내</span>
          <span className="font-bold text-sm">{domestic.toFixed(2)}</span>
          <TrendIcon trend={domesticTrend} />
        </div>
        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-muted-foreground">해외</span>
          <span className="font-medium text-sm text-muted-foreground">{overseas.toFixed(2)}</span>
          <TrendIcon trend={overseasTrend} />
        </div>
      </div>
    </div>
  );
}

export function OddsMovement({ odds, homeTeamName, awayTeamName }: OddsMovementProps) {
  const [homeDom, drawDom, awayDom] = odds.domestic;
  const [homeOver, drawOver, awayOver] = odds.overseas;
  const [homeDomTrend, drawDomTrend, awayDomTrend] = odds.domesticTrend;
  const [homeOverTrend, drawOverTrend, awayOverTrend] = odds.overseasTrend;

  const isHomeHot = homeDomTrend === 'down' || homeOverTrend === 'down';
  const isDrawHot = drawDomTrend === 'down' || drawOverTrend === 'down';
  const isAwayHot = awayDomTrend === 'down' || awayOverTrend === 'down';

  return (
    <Card className="p-4" data-testid="panel-odds-movement">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-amber-500" />
          배당 흐름
        </h3>
        <span className="text-xs text-muted-foreground">
          배당 하락 = 돈이 몰리는 중
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <OddsCell
          label={`${homeTeamName} 승`}
          domestic={homeDom}
          overseas={homeOver}
          domesticTrend={homeDomTrend}
          overseasTrend={homeOverTrend}
          isHot={isHomeHot}
        />
        <OddsCell
          label="무승부"
          domestic={drawDom}
          overseas={drawOver}
          domesticTrend={drawDomTrend}
          overseasTrend={drawOverTrend}
          isHot={isDrawHot}
        />
        <OddsCell
          label={`${awayTeamName} 승`}
          domestic={awayDom}
          overseas={awayOver}
          domesticTrend={awayDomTrend}
          overseasTrend={awayOverTrend}
          isHot={isAwayHot}
        />
      </div>

      <div className="mt-4 pt-3 border-t">
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span>배당 상승 (인기 감소)</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-red-500" />
            <span>배당 하락 (인기 증가)</span>
          </div>
          <div className="flex items-center gap-1">
            <Minus className="h-3 w-3" />
            <span>변동 없음</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
