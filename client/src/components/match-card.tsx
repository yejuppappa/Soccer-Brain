import { Sun, Cloud, CloudRain, Snowflake, MapPin, ArrowUp, ArrowDown, Minus, ChevronRight, BarChart2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { usePicks } from "@/contexts/pick-context";
import type { Match, WeatherCondition, WinDrawLossProbability, OddsTrend } from "@shared/schema";

interface MatchCardProps {
  match: Match;
  onClick: () => void;
  probability: WinDrawLossProbability;
  viewMode?: 'card' | 'list';
}

// 🇰🇷 한글 팀명 매핑
function getTeamNameKR(name: string): string {
  const map: Record<string, string> = {
    "Manchester City": "맨체스터 시티", "Arsenal": "아스널", "Liverpool": "리버풀",
    "Aston Villa": "애스턴 빌라", "Tottenham": "토트넘", "Chelsea": "첼시",
    "Newcastle": "뉴캐슬", "Manchester United": "맨유", "Manchester Utd": "맨유",
    "West Ham": "웨스트햄", "Brighton": "브라이튼", "Real Madrid": "레알 마드리드", 
    "Barcelona": "바르셀로나", "Atletico Madrid": "A.마드리드", "Sevilla": "세비야"
  };
  return map[name] || name;
}

function WeatherIcon({ condition }: { condition: WeatherCondition }) {
  switch (condition) {
    case 'sunny': return <Sun className="h-3 w-3 text-amber-500" />;
    case 'cloudy': return <Cloud className="h-3 w-3 text-muted-foreground" />;
    case 'rainy': return <CloudRain className="h-3 w-3 text-blue-500" />;
    case 'snowy': return <Snowflake className="h-3 w-3 text-sky-300" />;
    default: return <Sun className="h-3 w-3 text-amber-500" />;
  }
}

function TrendIcon({ trend }: { trend: OddsTrend }) {
  if (trend === 'up') return <ArrowUp className="h-2 w-2 text-red-500 shrink-0" />;
  if (trend === 'down') return <ArrowDown className="h-2 w-2 text-blue-500 shrink-0" />;
  return <Minus className="h-2 w-2 text-muted-foreground/30 shrink-0" />;
}

// 🔴🟢⚪ 최근 전적
function RecentForm({ results }: { results: ("W" | "D" | "L")[] }) {
  return (
    <div className="flex gap-0.5 mt-1.5 justify-center">
      {results.slice(-5).map((r, i) => (
        <div 
          key={i} 
          className={`
            w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white
            ${r === 'W' ? 'bg-red-500' : r === 'D' ? 'bg-green-500' : 'bg-slate-400'}
          `}
        >
          {r === 'W' ? '승' : r === 'D' ? '무' : '패'}
        </div>
      ))}
    </div>
  );
}

// 확률 버튼
function ProbabilityButton({ 
  type, value, isSelected, onClick, label, compact = false 
}: { 
  type: 'home' | 'draw' | 'away'; 
  value: number; isSelected: boolean; onClick: (e: React.MouseEvent) => void; label: string; compact?: boolean;
}) {
  const heightClass = compact ? "h-5 text-[8px]" : "h-10";
  const baseStyle = `flex flex-col items-center justify-center px-1 rounded transition-all cursor-pointer border ${heightClass} relative overflow-hidden`;
  
  const activeStyle = isSelected
    ? type === 'home' ? "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 ring-1 ring-red-500"
    : type === 'draw' ? "bg-green-500/10 border-green-500 text-green-600 dark:text-green-400 ring-1 ring-green-500"
    : "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500"
    : "bg-background border-border hover:bg-muted/50 text-muted-foreground hover:border-primary/50";

  const barColor = type === 'home' ? 'bg-red-500' : type === 'draw' ? 'bg-green-500' : 'bg-blue-500';

  return (
    <div className={`${baseStyle} ${activeStyle} flex-1`} onClick={onClick}>
      {!isSelected && (
        <div className={`absolute bottom-0 left-0 h-0.5 opacity-30 ${barColor}`} style={{ width: `${value}%` }} />
      )}
      <div className="flex items-center gap-1 leading-none z-10 w-full justify-between px-1">
        <span className="text-[9px] font-bold opacity-60 tracking-tighter">{label}</span>
        <span className={`font-bold leading-none ${isSelected ? '' : 'text-foreground'} ${compact ? 'text-[10px]' : 'text-sm'}`}>
          {value}%
        </span>
      </div>
    </div>
  );
}

export function MatchCard({ match, onClick, probability, viewMode = 'card' }: MatchCardProps) {
  const { togglePick, getPickForMatch } = usePicks();
  const currentPick = getPickForMatch(match.id);

  const matchTime = new Date(match.matchTime);
  const timeString = matchTime.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

  const handleBadgeClick = (e: React.MouseEvent, type: 'home' | 'draw' | 'away') => {
    e.stopPropagation();
    const oddsValue = type === 'home' ? match.odds.domestic[0] : type === 'draw' ? match.odds.domestic[1] : match.odds.domestic[2];
    togglePick({
      matchId: match.id,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      matchTime: match.matchTime,
      selection: type,
      odds: oddsValue,
      league: "Premier League"
    });
  };

  // 1️⃣ 리스트형 (기존 V15 디자인 유지 - 가운데 정렬)
  if (viewMode === 'list') {
    return (
      <Card className="hover:border-primary/50 transition-all cursor-pointer group mb-2 shadow-sm border-border/60 p-2" onClick={onClick}>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 border-b border-border/30 pb-1">
          <div className="flex gap-2">
            <span className="font-bold text-foreground">{timeString}</span>
            <span>{match.venue}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 text-[9px] text-primary/80 font-bold bg-primary/5 px-1.5 py-0.5 rounded border border-primary/20 hover:bg-primary/10 transition-colors">
              <BarChart2 className="h-2.5 w-2.5" />
              <span>AI 분석</span>
              <ChevronRight className="h-2 w-2" />
            </div>
            <div className="flex items-center gap-1 opacity-70">
              <WeatherIcon condition={match.weather.condition} />
              <span>{match.weather.temperature}°</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 팀 정보 */}
          <div className="flex-[1.2] flex flex-col justify-center gap-1.5">
            {/* 홈팀 */}
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] h-4 w-4 p-0 flex items-center justify-center border-red-200 text-red-600 bg-red-50/50 shrink-0">H</Badge>
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-xs font-bold truncate">{getTeamNameKR(match.homeTeam.name)}</span>
                <span className="text-[10px] text-muted-foreground/60 font-medium">({match.homeTeam.shortName})</span>
              </div>
            </div>
            
            {/* 원정팀 */}
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] h-4 w-4 p-0 flex items-center justify-center border-blue-200 text-blue-600 bg-blue-50/50 shrink-0">A</Badge>
              <div className="flex items-baseline gap-1 min-w-0">
                <span className="text-xs font-bold truncate">{getTeamNameKR(match.awayTeam.name)}</span>
                <span className="text-[10px] text-muted-foreground/60 font-medium">({match.awayTeam.shortName})</span>
              </div>
            </div>
          </div>

          {/* 오른쪽 섹션 (확률 + 배당률) */}
          <div className="flex-[2] flex flex-col gap-1 min-w-0">
            {/* 확률 버튼 */}
            <div className="flex gap-1">
              <ProbabilityButton type="home" label="HOME" value={probability.homeWin} isSelected={currentPick?.selection === 'home'} onClick={(e) => handleBadgeClick(e, 'home')} compact />
              <ProbabilityButton type="draw" label="DRAW" value={probability.draw} isSelected={currentPick?.selection === 'draw'} onClick={(e) => handleBadgeClick(e, 'draw')} compact />
              <ProbabilityButton type="away" label="AWAY" value={probability.awayWin} isSelected={currentPick?.selection === 'away'} onClick={(e) => handleBadgeClick(e, 'away')} compact />
            </div>

            {/* ✅ 배당률 정보 (가운데 정렬) */}
            <div className="bg-muted/20 rounded px-1.5 py-1 border border-border/30 text-[9px] leading-tight tracking-tighter">
              {/* 국내 */}
              <div className="flex justify-center items-center gap-3 mb-0.5">
                <span className="text-[8px] text-muted-foreground whitespace-nowrap">국내</span>
                <div className="flex gap-2 font-bold text-foreground">
                  <span className="flex items-center justify-center min-w-[30px]">{match.odds.domestic[0].toFixed(2)}<TrendIcon trend={match.odds.domesticTrend[0]} /></span>
                  <span className="flex items-center justify-center min-w-[30px]">{match.odds.domestic[1].toFixed(2)}<TrendIcon trend={match.odds.domesticTrend[1]} /></span>
                  <span className="flex items-center justify-center min-w-[30px]">{match.odds.domestic[2].toFixed(2)}<TrendIcon trend={match.odds.domesticTrend[2]} /></span>
                </div>
              </div>
              
              {/* 해외 */}
              <div className="flex justify-center items-center gap-3">
                <span className="text-[8px] text-muted-foreground whitespace-nowrap">해외</span>
                <div className="flex gap-2 font-bold text-foreground">
                  <span className="flex items-center justify-center min-w-[30px]">{match.odds.overseas[0].toFixed(2)}<TrendIcon trend={match.odds.overseasTrend[0]} /></span>
                  <span className="flex items-center justify-center min-w-[30px]">{match.odds.overseas[1].toFixed(2)}<TrendIcon trend={match.odds.overseasTrend[1]} /></span>
                  <span className="flex items-center justify-center min-w-[30px]">{match.odds.overseas[2].toFixed(2)}<TrendIcon trend={match.odds.overseasTrend[2]} /></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // 2️⃣ 카드형 (수정됨: 배당표 위치 내림)
  return (
    <Card className="overflow-hidden hover:border-primary/50 transition-all cursor-pointer group mb-2 shadow-sm border-border/60" onClick={onClick}>
      <div className="bg-muted/40 px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground border-b border-border/40">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-background font-normal border-border">
            {timeString}
          </Badge>
          <span className="flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5" /> {match.venue}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <WeatherIcon condition={match.weather.condition} />
          <span>{match.weather.temperature}°</span>
        </div>
      </div>

      <div className="p-3 pb-0">
        <div className="flex items-center gap-2">
          {/* 홈팀 */}
          <div className="flex-1 flex flex-col items-center gap-0.5 text-center min-w-0">
            <Avatar className="h-9 w-9 border border-border/50 bg-white p-0.5">
              <AvatarImage src={match.homeTeam.logoUrl} className="object-contain" />
              <AvatarFallback>{match.homeTeam.shortName}</AvatarFallback>
            </Avatar>
            <div className="mt-1 flex flex-col w-full items-center">
              <span className="text-xs font-bold truncate leading-tight">{getTeamNameKR(match.homeTeam.name)}</span>
              <span className="text-[9px] text-muted-foreground truncate leading-none mt-0.5 font-medium">{match.homeTeam.name}</span>
              <RecentForm results={match.homeTeam.recentResults || []} />
            </div>
          </div>

          {/* 중앙 (VS + 배당표) */}
          <div className="flex-[1.8] flex flex-col items-center">
            <div className="text-sm font-black text-muted-foreground/30 italic leading-none mb-1">VS</div>
            
            {/* ✅ 수정 포인트: mt-2.5 추가하여 아래로 내림 */}
            <div className="w-full bg-muted/20 rounded border border-border/40 overflow-hidden mt-2.5">
              <div className="grid grid-cols-[26px_1fr_1fr_1fr] text-[10px] items-center text-center py-0.5 border-b border-border/30">
                <span className="text-[9px] text-muted-foreground text-left pl-1">국내</span>
                <div className="flex justify-center items-center gap-0.5 font-bold text-foreground">
                  {match.odds.domestic[0].toFixed(2)} <TrendIcon trend={match.odds.domesticTrend[0]} />
                </div>
                <div className="flex justify-center items-center gap-0.5 font-bold text-foreground">
                  {match.odds.domestic[1].toFixed(2)} <TrendIcon trend={match.odds.domesticTrend[1]} />
                </div>
                <div className="flex justify-center items-center gap-0.5 font-bold text-foreground">
                  {match.odds.domestic[2].toFixed(2)} <TrendIcon trend={match.odds.domesticTrend[2]} />
                </div>
              </div>
              <div className="grid grid-cols-[26px_1fr_1fr_1fr] text-[10px] items-center text-center py-0.5 bg-muted/10">
                <span className="text-[9px] text-muted-foreground text-left pl-1">해외</span>
                <div className="flex justify-center items-center gap-0.5 text-muted-foreground">
                  {match.odds.overseas[0].toFixed(2)} <TrendIcon trend={match.odds.overseasTrend[0]} />
                </div>
                <div className="flex justify-center items-center gap-0.5 text-muted-foreground">
                  {match.odds.overseas[1].toFixed(2)} <TrendIcon trend={match.odds.overseasTrend[1]} />
                </div>
                <div className="flex justify-center items-center gap-0.5 text-muted-foreground">
                  {match.odds.overseas[2].toFixed(2)} <TrendIcon trend={match.odds.overseasTrend[2]} />
                </div>
              </div>
            </div>
          </div>

          {/* 원정팀 */}
          <div className="flex-1 flex flex-col items-center gap-0.5 text-center min-w-0">
            <Avatar className="h-9 w-9 border border-border/50 bg-white p-0.5">
              <AvatarImage src={match.awayTeam.logoUrl} className="object-contain" />
              <AvatarFallback>{match.awayTeam.shortName}</AvatarFallback>
            </Avatar>
            <div className="mt-1 flex flex-col w-full items-center">
              <span className="text-xs font-bold truncate leading-tight">{getTeamNameKR(match.awayTeam.name)}</span>
              <span className="text-[9px] text-muted-foreground truncate leading-none mt-0.5 font-medium">{match.awayTeam.name}</span>
              <RecentForm results={match.awayTeam.recentResults || []} />
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 w-full mt-2.5 mb-2.5">
          <ProbabilityButton type="home" label="HOME" value={probability.homeWin} isSelected={currentPick?.selection === 'home'} onClick={(e) => handleBadgeClick(e, 'home')} />
          <ProbabilityButton type="draw" label="DRAW" value={probability.draw} isSelected={currentPick?.selection === 'draw'} onClick={(e) => handleBadgeClick(e, 'draw')} />
          <ProbabilityButton type="away" label="AWAY" value={probability.awayWin} isSelected={currentPick?.selection === 'away'} onClick={(e) => handleBadgeClick(e, 'away')} />
        </div>
      </div>
      
      <div className="bg-primary/5 py-2 flex items-center justify-center gap-1 text-xs font-medium text-primary/70 border-t border-border/40 hover:bg-primary/10 transition-colors">
        <span>AI 상세 분석 및 리포트 보기</span>
        <ChevronRight className="h-3 w-3" />
      </div>
    </Card>
  );
}
