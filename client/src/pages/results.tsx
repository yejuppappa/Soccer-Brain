import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronRight, Calendar, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";

const TEAM_KR: Record<string, string> = {
  "Manchester United": "맨유", "Manchester City": "맨시티", "Liverpool": "리버풀",
  "Chelsea": "첼시", "Arsenal": "아스널", "Tottenham": "토트넘",
  "Newcastle": "뉴캐슬", "Brighton": "브라이튼", "Aston Villa": "애스턴빌라",
  "Real Madrid": "레알마드리드", "Barcelona": "바르셀로나",
  "Inter": "인테르", "AC Milan": "AC밀란", "Juventus": "유벤투스",
  "Bayern Munich": "바이에른", "Borussia Dortmund": "도르트문트",
  "Paris Saint Germain": "PSG",
};
const kr = (name: string) => TEAM_KR[name] || name;

const LEAGUE_FLAGS: Record<number, string> = {
  39: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", 140: "🇪🇸", 135: "🇮🇹", 78: "🇩🇪", 61: "🇫🇷",
  2: "🏆", 3: "🏆", 88: "🇳🇱", 94: "🇵🇹", 292: "🇰🇷",
};

export default function Results() {
  const [, setLocation] = useLocation();
  const [dateOffset, setDateOffset] = useState(0); // 0=오늘, -1=어제, -2=그저께
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);

  const { data: fixtures, isLoading } = useQuery({
    queryKey: ["/api/fixtures"],
  });

  const targetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    return d.toISOString().split("T")[0];
  }, [dateOffset]);

  const completedFixtures = useMemo(() => {
    if (!fixtures || !Array.isArray(fixtures)) return [];
    return fixtures
      .filter((f: any) => {
        const fDate = new Date(f.kickoffAt).toISOString().split("T")[0];
        const dateMatch = fDate === targetDate;
        const leagueMatch = !selectedLeague || f.league?.apiLeagueId === selectedLeague;
        const isCompleted = f.status === "FT" || f.status === "AET" || f.status === "PEN";
        return dateMatch && leagueMatch && isCompleted;
      })
      .sort((a: any, b: any) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime());
  }, [fixtures, targetDate, selectedLeague]);

  // 리그별 그룹핑
  const groupedByLeague = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const f of completedFixtures) {
      const leagueName = f.league?.name || "기타";
      if (!groups[leagueName]) groups[leagueName] = [];
      groups[leagueName].push(f);
    }
    return groups;
  }, [completedFixtures]);

  const dateLabels = [
    { offset: 0, label: "오늘" },
    { offset: -1, label: "어제" },
    { offset: -2, label: "그저께" },
    { offset: -3, label: "3일 전" },
  ];

  const leagueFilters = [
    { id: null, label: "전체" },
    { id: 39, label: "EPL" },
    { id: 140, label: "라리가" },
    { id: 135, label: "세리에A" },
    { id: 78, label: "분데스" },
    { id: 61, label: "리그1" },
    { id: 2, label: "UCL" },
    { id: 292, label: "K리그" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold">경기 결과</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* 날짜 선택 (과거로) */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {dateLabels.map(({ offset, label }) => (
            <button
              key={offset}
              onClick={() => setDateOffset(offset)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                dateOffset === offset
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 리그 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {leagueFilters.map((lf) => (
            <button
              key={lf.id ?? "all"}
              onClick={() => setSelectedLeague(lf.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedLeague === lf.id
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {lf.id ? LEAGUE_FLAGS[lf.id] || "" : ""} {lf.label}
            </button>
          ))}
        </div>

        {/* 결과 목록 */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : completedFixtures.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {dateLabels.find(d => d.offset === dateOffset)?.label || ""} 완료된 경기가 없습니다
            </p>
          </div>
        ) : (
          Object.entries(groupedByLeague).map(([leagueName, matches]) => (
            <div key={leagueName} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground px-1">
                {leagueName}
              </h3>
              {matches.map((match: any) => (
                <ResultRow
                  key={match.id}
                  match={match}
                  onClick={() => setLocation(`/match/${match.id}`)}
                />
              ))}
            </div>
          ))
        )}
      </main>
    </div>
  );
}

function ResultRow({ match, onClick }: { match: any; onClick: () => void }) {
  const homeGoals = match.homeGoals ?? 0;
  const awayGoals = match.awayGoals ?? 0;
  const homeWin = homeGoals > awayGoals;
  const awayWin = awayGoals > homeGoals;

  const kickoff = new Date(match.kickoffAt);
  const timeStr = kickoff.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <Card
      className="p-3 cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.98]"
      onClick={onClick}
    >
      <div className="flex items-center">
        {/* 홈팀 */}
        <div className="flex-1 text-right pr-3">
          <p className={`text-sm truncate ${homeWin ? "font-bold" : "text-muted-foreground"}`}>
            {kr(match.homeTeam?.name || "홈")}
          </p>
        </div>

        {/* 스코어 */}
        <div className="flex items-center gap-2 px-2">
          <span className={`text-lg font-bold tabular-nums ${homeWin ? "text-foreground" : "text-muted-foreground"}`}>
            {homeGoals}
          </span>
          <span className="text-xs text-muted-foreground">-</span>
          <span className={`text-lg font-bold tabular-nums ${awayWin ? "text-foreground" : "text-muted-foreground"}`}>
            {awayGoals}
          </span>
        </div>

        {/* 원정팀 */}
        <div className="flex-1 pl-3">
          <p className={`text-sm truncate ${awayWin ? "font-bold" : "text-muted-foreground"}`}>
            {kr(match.awayTeam?.name || "원정")}
          </p>
        </div>

        {/* 시간 + 화살표 */}
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground/60">{timeStr}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
        </div>
      </div>
    </Card>
  );
}
