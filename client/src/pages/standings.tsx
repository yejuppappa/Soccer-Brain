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
      <header className="sticky top-0 z-40 bg-[#0A0E17]/95 backdrop-blur-sm border-b border-[#1E293B]">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold">📊 순위</h1>
        </div>
        {/* 리그 선택 */}
        <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto no-scrollbar">
          {STANDING_LEAGUES.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLeague(l)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${selectedLeague.id === l.id
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#151D2B] text-[#94A3B8]"}`}
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
              <div key={i} className="h-10 rounded bg-[#151D2B] animate-pulse" />
            ))}
          </div>
        ) : standings.length === 0 ? (
          <p className="text-center py-16 text-[#64748B] text-sm">순위 데이터가 없습니다</p>
        ) : (
          <div className="bg-[#111827] rounded-xl overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="flex items-center px-3 py-2 text-[10px] text-[#64748B] border-b border-[#1E293B]">
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
              // 순위 존 색상
              let zoneColor = "";
              if (s.rank <= 4) zoneColor = "border-l-2 border-l-[#3B82F6]"; // UCL
              else if (s.rank === 5) zoneColor = "border-l-2 border-l-[#F59E0B]"; // UEL
              else if (s.rank >= standings.length - 2) zoneColor = "border-l-2 border-l-[#EF4444]"; // 강등

              return (
                <div
                  key={i}
                  className={`flex items-center px-3 py-2 text-xs border-b border-[#1E293B]/50 ${zoneColor}`}
                >
                  <span className="w-6 text-center text-[#64748B] font-medium">{s.rank}</span>
                  <div className="flex-1 flex items-center gap-1.5 ml-2 min-w-0">
                    {s.teamLogo && <img src={s.teamLogo} alt="" className="w-4 h-4 object-contain" />}
                    <span className="truncate text-[#F1F5F9]">{getTeamName(s.teamName)}</span>
                  </div>
                  <span className="w-7 text-center text-[#94A3B8]">{s.played}</span>
                  <span className="w-7 text-center text-[#94A3B8]">{s.won}</span>
                  <span className="w-7 text-center text-[#94A3B8]">{s.drawn}</span>
                  <span className="w-7 text-center text-[#94A3B8]">{s.lost}</span>
                  <span className={`w-9 text-center ${(s.goalsDiff || 0) > 0 ? "text-[#22C55E]" : (s.goalsDiff || 0) < 0 ? "text-[#EF4444]" : "text-[#94A3B8]"}`}>
                    {(s.goalsDiff || 0) > 0 ? "+" : ""}{s.goalsDiff || 0}
                  </span>
                  <span className="w-8 text-center text-[#F1F5F9] font-bold">{s.points}</span>
                  <div className="w-20 flex justify-center gap-0.5">
                    {(s.form || "").split("").slice(-5).map((r: string, fi: number) => (
                      <div
                        key={fi}
                        className={`w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center
                          ${r === "W" ? "bg-[#22C55E]/20 text-[#22C55E]"
                          : r === "D" ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                          : "bg-[#EF4444]/20 text-[#EF4444]"}`}
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
        <div className="flex gap-4 mt-3 text-[10px] text-[#64748B]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3B82F6]" />UCL</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" />UEL</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EF4444]" />강등</span>
        </div>
      </main>
    </div>
  );
}
