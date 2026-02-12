import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Flame, Circle } from "lucide-react";
import { getTeamName, LEAGUES, POPULAR_LEAGUE_API_IDS } from "@/shared/team-names";

// ============================================================
// 날짜 유틸
// ============================================================
function formatDateKR(d: Date): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ============================================================
// 시간 포맷
// ============================================================
function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function formatMinute(status: string): string {
  // NS, 1H, 2H, HT, FT, AET, PEN etc.
  if (status === "HT") return "HT";
  if (status === "FT" || status === "AET" || status === "PEN") return "종료";
  const match = status.match(/(\d+)/);
  return match ? `${match[1]}'` : status;
}

// ============================================================
// 경기 상태 분류
// ============================================================
type FixtureGroup = "live" | "upcoming" | "finished";
function classifyStatus(status: string): FixtureGroup {
  if (["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(status)) return "live";
  if (["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"].includes(status)) return "finished";
  return "upcoming"; // NS, TBD
}
function isLiveStatus(status: string): boolean {
  return classifyStatus(status) === "live";
}

// ============================================================
// 리그 표시명
// ============================================================
function getLeagueTag(leagueName: string, country: string | null): string {
  const found = LEAGUES.find(l => l.name === leagueName || leagueName.includes(l.name));
  if (found) return found.shortName;
  // fallback
  if (leagueName.includes("Premier")) return "EPL";
  if (leagueName.includes("Liga") && country === "Spain") return "라리가";
  if (leagueName.includes("Bundesliga")) return "분데스";
  if (leagueName.includes("Serie A")) return "세리에";
  if (leagueName.includes("Ligue 1")) return "리그1";
  return leagueName.length > 6 ? leagueName.substring(0, 5) : leagueName;
}

// ============================================================
// Home 페이지
// ============================================================
export default function Home() {
  const [, navigate] = useLocation();
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [leagueFilter, setLeagueFilter] = useState("popular"); // "popular" | "all" | apiId

  const dateStr = toDateStr(selectedDate);
  const isToday = toDateStr(today) === dateStr;

  // ── 데이터 페칭 ──
  const { data: fixturesData, isLoading } = useQuery({
    queryKey: ["v2-fixtures", dateStr, leagueFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ date: dateStr, league: leagueFilter });
      const res = await fetch(`/api/v2/fixtures?${params}`);
      if (!res.ok) throw new Error("Failed to fetch fixtures");
      return res.json();
    },
    refetchInterval: 60_000, // 1분마다 갱신
  });

  const { data: highlightsData } = useQuery({
    queryKey: ["v2-highlights", dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/v2/highlights?date=${dateStr}`);
      if (!res.ok) return { highlights: [] };
      return res.json();
    },
    enabled: isToday,
  });

  const fixtures = fixturesData?.fixtures || [];
  const highlights = highlightsData?.highlights || [];

  // ── 경기 분류 ──
  const grouped = useMemo(() => {
    const live = fixtures.filter((f: any) => classifyStatus(f.status) === "live");
    const upcoming = fixtures.filter((f: any) => classifyStatus(f.status) === "upcoming");
    const finished = fixtures.filter((f: any) => classifyStatus(f.status) === "finished");
    return { live, upcoming, finished };
  }, [fixtures]);

  // ── 날짜 바 ──
  const dateRange = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(today, i - 3));
  }, []);

  return (
    <div className="max-w-lg mx-auto">
      {/* ── 상단 헤더 ── */}
      <header className="sticky top-0 z-40 bg-[#0A0E17]/95 backdrop-blur-sm border-b border-[#1E293B]">
        {/* 종목 선택 */}
        <div className="flex items-center gap-3 px-4 py-2">
          <h1 className="text-lg font-bold tracking-tight">⚽ Soccer Brain</h1>
          <div className="flex gap-1.5 ml-auto">
            {["⚽", "⚾", "🏀", "🏐"].map((emoji, i) => (
              <button
                key={emoji}
                className={`w-8 h-8 rounded-full text-sm flex items-center justify-center
                  ${i === 0 ? "bg-[#1E293B]" : "opacity-30 cursor-not-allowed"}`}
                disabled={i !== 0}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* 날짜 선택 바 */}
        <div className="flex items-center px-2 py-1.5 gap-0.5 overflow-x-auto no-scrollbar">
          <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-1.5 text-[#64748B]">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {dateRange.map(d => {
            const ds = toDateStr(d);
            const isSelected = ds === dateStr;
            const isDayToday = ds === toDateStr(today);
            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(d)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${isSelected
                    ? "bg-[#3B82F6] text-white"
                    : "text-[#94A3B8] hover:text-white"}`}
              >
                {isDayToday ? "오늘" : formatDateKR(d)}
              </button>
            );
          })}
          <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-1.5 text-[#64748B]">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 리그 필터 */}
        <div className="flex items-center gap-1.5 px-4 py-1.5 overflow-x-auto no-scrollbar">
          <FilterChip
            label="★ 인기"
            active={leagueFilter === "popular"}
            onClick={() => setLeagueFilter("popular")}
          />
          <FilterChip
            label="전체"
            active={leagueFilter === "all"}
            onClick={() => setLeagueFilter("all")}
          />
          {LEAGUES.filter(l => l.isPopular).map(l => (
            <FilterChip
              key={l.id}
              label={l.shortName}
              active={leagueFilter === String(l.apiIds[0])}
              onClick={() => setLeagueFilter(String(l.apiIds[0]))}
            />
          ))}
        </div>
      </header>

      {/* ── 콘텐츠 ── */}
      <main className="px-4 py-3 space-y-4">

        {/* 하이라이트 섹션 */}
        {highlights.length > 0 && isToday && (
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-[#F1F5F9]">주목할 경기</span>
              <span className="text-xs text-[#64748B] ml-1">{highlights.length}</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {highlights.map((h: any) => (
                <HighlightCard key={h.id} data={h} onClick={() => navigate(`/match/${h.id}`)} />
              ))}
            </div>
          </section>
        )}

        {/* 로딩 */}
        {isLoading && (
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 rounded-lg bg-[#151D2B] animate-pulse" />
            ))}
          </div>
        )}

        {/* 경기 없음 */}
        {!isLoading && fixtures.length === 0 && (
          <div className="text-center py-16 text-[#64748B]">
            <p className="text-sm">해당 날짜에 경기가 없습니다</p>
          </div>
        )}

        {/* LIVE */}
        {grouped.live.length > 0 && (
          <section>
            <SectionHeader title="LIVE" count={grouped.live.length} color="#EF4444" />
            <div className="space-y-0.5">
              {grouped.live.map((fx: any) => (
                <MatchRow key={fx.id} fixture={fx} onClick={() => navigate(`/match/${fx.id}`)} />
              ))}
            </div>
          </section>
        )}

        {/* 예정 */}
        {grouped.upcoming.length > 0 && (
          <section>
            <SectionHeader title="예정" count={grouped.upcoming.length} />
            <div className="space-y-0.5">
              {grouped.upcoming.map((fx: any) => (
                <MatchRow key={fx.id} fixture={fx} onClick={() => navigate(`/match/${fx.id}`)} />
              ))}
            </div>
          </section>
        )}

        {/* 종료 */}
        {grouped.finished.length > 0 && (
          <section>
            <SectionHeader title="종료" count={grouped.finished.length} color="#64748B" />
            <div className="space-y-0.5 opacity-70">
              {grouped.finished.map((fx: any) => (
                <MatchRow key={fx.id} fixture={fx} onClick={() => navigate(`/match/${fx.id}`)} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// ============================================================
// 서브 컴포넌트
// ============================================================

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors
        ${active
          ? "bg-[#3B82F6] text-white"
          : "bg-[#151D2B] text-[#94A3B8] hover:text-white"}`}
    >
      {label}
    </button>
  );
}

function SectionHeader({ title, count, color }: { title: string; count: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      {color && <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />}
      <span className="text-xs font-semibold" style={{ color: color || "#94A3B8" }}>{title}</span>
      <span className="text-xs text-[#475569]">{count}</span>
    </div>
  );
}

// ── 경기 1줄 ──
function MatchRow({ fixture, onClick }: { fixture: any; onClick: () => void }) {
  const isLive = isLiveStatus(fixture.status);
  const isFinished = classifyStatus(fixture.status) === "finished";
  const homeName = getTeamName(fixture.homeTeam.name);
  const awayName = getTeamName(fixture.awayTeam.name);
  const leagueTag = getLeagueTag(fixture.league.name, fixture.league.country);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center px-3 py-2.5 rounded-lg hover:bg-[#151D2B] active:bg-[#1E293B] transition-colors text-left"
    >
      {/* 시간 or 스코어 */}
      <div className="w-12 flex-shrink-0 text-center">
        {isLive ? (
          <span className="text-xs font-bold text-[#EF4444]">{formatMinute(fixture.status)}</span>
        ) : isFinished ? (
          <span className="text-xs text-[#64748B]">종료</span>
        ) : (
          <span className="text-xs text-[#94A3B8]">{formatTime(fixture.kickoffAt)}</span>
        )}
      </div>

      {/* 팀 + 스코어 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {fixture.homeTeam.logoUrl && (
            <img src={fixture.homeTeam.logoUrl} alt="" className="w-4 h-4 object-contain" />
          )}
          <span className="text-sm truncate">{homeName}</span>
          {fixture.score && (
            <span className={`text-sm font-bold ml-auto ${isLive ? "text-[#EF4444]" : ""}`}>
              {fixture.score.home}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {fixture.awayTeam.logoUrl && (
            <img src={fixture.awayTeam.logoUrl} alt="" className="w-4 h-4 object-contain" />
          )}
          <span className="text-sm truncate">{awayName}</span>
          {fixture.score && (
            <span className={`text-sm font-bold ml-auto ${isLive ? "text-[#EF4444]" : ""}`}>
              {fixture.score.away}
            </span>
          )}
        </div>
      </div>

      {/* 리그 태그 */}
      <div className="ml-3 flex-shrink-0">
        <span className="text-[10px] text-[#475569] bg-[#1E293B] px-1.5 py-0.5 rounded">
          {leagueTag}
        </span>
      </div>
    </button>
  );
}

// ── 하이라이트 카드 ──
function HighlightCard({ data, onClick }: { data: any; onClick: () => void }) {
  const homeName = getTeamName(data.homeTeam.name);
  const awayName = getTeamName(data.awayTeam.name);

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-40 p-3 rounded-xl bg-[#151D2B] border border-[#1E293B] hover:border-[#3B82F6]/40 transition-colors text-left"
    >
      <div className="flex items-center gap-1.5 mb-2">
        {data.homeTeam.logoUrl && <img src={data.homeTeam.logoUrl} alt="" className="w-5 h-5" />}
        <span className="text-xs font-medium truncate">{homeName}</span>
      </div>
      <div className="flex items-center gap-1.5 mb-2.5">
        {data.awayTeam.logoUrl && <img src={data.awayTeam.logoUrl} alt="" className="w-5 h-5" />}
        <span className="text-xs font-medium truncate">{awayName}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {data.tags.slice(0, 2).map((tag: string, i: number) => (
          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}
