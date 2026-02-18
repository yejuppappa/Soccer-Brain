import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LEAGUES } from "@/shared/team-names";
import { getTeamName } from "@/shared/team-names";

const STANDING_LEAGUES = LEAGUES.filter(l => l.isPopular || ["ucl", "uel"].includes(l.id));

export default function Standings() {
  const [selectedLeague, setSelectedLeague] = useState(STANDING_LEAGUES[0]);

  const { data, isLoading } = useQuery({
    queryKey: ["standings", selectedLeague.apiIds[0]],
    queryFn: async () => {
      const res = await fetch(`/api/standings?leagueId=${selectedLeague.apiIds[0]}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const standings = data?.standings || [];

  return (
    <div className="max-w-lg mx-auto">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-sb-bg/95 backdrop-blur-sm border-b border-sb-border">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-sb-text">순위</h1>
        </div>
        {/* 리그 선택 */}
        <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto no-scrollbar">
          {STANDING_LEAGUES.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLeague(l)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${selectedLeague.id === l.id
                  ? "bg-sb-primary text-white"
                  : "bg-sb-surface-alt text-sb-text-muted"}`}
            >
              {l.shortName}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 py-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="h-10 rounded bg-sb-surface-alt animate-pulse" />
            ))}
          </div>
        ) : standings.length === 0 ? (
          <p className="text-center py-16 text-sb-text-dim text-sm">순위 데이터가 없습니다</p>
        ) : (
          <div className="bg-sb-surface rounded-xl overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="flex items-center px-3 py-2 text-[10px] text-sb-text-dim border-b border-sb-border">
              <span className="w-6 text-center">#</span>
              <span className="flex-1 ml-2">팀</span>
              <span className="w-7 text-center">경기</span>
              <span className="w-7 text-center">승</span>
              <span className="w-7 text-center">무</span>
              <span className="w-7 text-center">패</span>
              <span className="w-9 text-center">득실</span>
              <span className="w-8 text-center">승점</span>
              <span className="w-20 text-center">폼</span>
            </div>
            {/* 테이블 rows */}
            {standings.map((s: any, i: number) => {
              let zoneColor = "";
              if (s.rank <= 4) zoneColor = "border-l-2 border-l-sb-primary";
              else if (s.rank === 5) zoneColor = "border-l-2 border-l-sb-draw";
              else if (s.rank >= standings.length - 2) zoneColor = "border-l-2 border-l-sb-live";

              return (
                <div
                  key={i}
                  className={`flex items-center px-3 py-2 text-xs border-b border-sb-border/50 ${zoneColor}`}
                >
                  <span className="w-6 text-center text-sb-text-dim font-medium">{s.rank}</span>
                  <div className="flex-1 flex items-center gap-1.5 ml-2 min-w-0">
                    {s.teamLogo && <img src={s.teamLogo} alt="" className="w-4 h-4 object-contain" />}
                    <span className="truncate text-sb-text">{getTeamName(s.teamName)}</span>
                  </div>
                  <span className="w-7 text-center text-sb-text-muted">{s.played}</span>
                  <span className="w-7 text-center text-sb-text-muted">{s.won}</span>
                  <span className="w-7 text-center text-sb-text-muted">{s.drawn}</span>
                  <span className="w-7 text-center text-sb-text-muted">{s.lost}</span>
                  <span className={`w-9 text-center ${(s.goalsDiff || 0) > 0 ? "text-sb-win" : (s.goalsDiff || 0) < 0 ? "text-sb-live" : "text-sb-text-muted"}`}>
                    {(s.goalsDiff || 0) > 0 ? "+" : ""}{s.goalsDiff || 0}
                  </span>
                  <span className="w-8 text-center text-sb-text font-bold">{s.points}</span>
                  <div className="w-20 flex justify-center gap-0.5">
                    {(s.form || "").split("").slice(-5).map((r: string, fi: number) => (
                      <div
                        key={fi}
                        className={`w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center
                          ${r === "W" ? "bg-sb-win/20 text-sb-win"
                          : r === "D" ? "bg-sb-draw/20 text-sb-draw"
                          : "bg-sb-live/20 text-sb-live"}`}
                      >
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* 범례 */}
        <div className="flex gap-4 mt-3 text-[10px] text-sb-text-dim">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sb-primary" />UCL</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sb-draw" />UEL</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sb-live" />강등</span>
        </div>
      </main>
    </div>
  );
}
