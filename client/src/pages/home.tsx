import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronUp, ChevronDown, Star } from "lucide-react";
import { getTeamName, LEAGUES } from "@/shared/team-names";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarModal } from "@/components/calendar-modal";
import { FavoritesSheet } from "@/components/favorites-sheet";
import { useFavorites } from "@/hooks/use-favorites";
import { useSwipe } from "@/hooks/use-swipe";
import { useToast } from "@/hooks/use-toast";

// ============================================================
// 날짜 유틸
// ============================================================
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function getKSTToday(): Date {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const str = kst.toISOString().split("T")[0];
  return new Date(str + "T00:00:00");
}

// ============================================================
// 시간/상태 유틸
// ============================================================
function formatTime(iso: string): { period: string; time: string } {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const period = h < 12 ? "오전" : "오후";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { period, time: `${hour12}:${m}` };
}

function formatMinute(status: string): string {
  if (status === "HT") return "HT";
  if (status === "FT" || status === "AET" || status === "PEN") return "FT";
  const m = status.match(/(\d+)/);
  return m ? `${m[1]}'` : status;
}

type FixtureGroup = "live" | "upcoming" | "finished";
function classifyStatus(status: string): FixtureGroup {
  if (["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(status)) return "live";
  if (["FT", "AET", "PEN", "PST", "CANC", "ABD", "AWD", "WO"].includes(status)) return "finished";
  return "upcoming";
}

// ============================================================
// 리그 표시명 (full name 우선)
// ============================================================
function getLeagueDisplayName(apiId: number, serverName: string): string {
  const found = LEAGUES.find(l => l.apiIds.includes(apiId));
  return found ? found.name : serverName;
}


// ============================================================
// 날짜 바 생성 — 오늘 기준 29일 (14일전~14일후)
// ============================================================
function buildDateBar(today: Date) {
  const items: { date: Date; label: string; isToday: boolean }[] = [];
  const todayStr = toDateStr(today);
  const days = ["일", "월", "화", "수", "목", "금", "토"];

  for (let i = -14; i <= 14; i++) {
    const d = addDays(today, i);
    const ds = toDateStr(d);
    let label: string;
    if (i === 0) label = "오늘";
    else if (i === -1) label = "어제";
    else if (i === 1) label = "내일";
    else label = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;

    items.push({ date: d, label, isToday: ds === todayStr });
  }
  return items;
}

// ============================================================
// Home 페이지
// ============================================================
export default function Home() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const today = getKSTToday();

  // State
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [favSheetOpen, setFavSheetOpen] = useState(false);
  const [liveFilter, setLiveFilter] = useState(false);
  const [openLeagues, setOpenLeagues] = useState<Set<string>>(new Set());
  const [leagueInitialized, setLeagueInitialized] = useState(false);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

  const favorites = useFavorites();
  const mainRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dateScrollRef = useRef<HTMLDivElement>(null);
  const hasMountedScroll = useRef(false);

  const dateStr = toDateStr(selectedDate);

  // 날짜 바 자동 스크롤
  useEffect(() => {
    const container = dateScrollRef.current;
    if (!container) return;

    const doScroll = (smooth: boolean) => {
      const btn = container.querySelector(`[data-date="${dateStr}"]`) as HTMLElement;
      if (!btn) return;
      if (smooth) {
        btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      } else {
        // getBoundingClientRect 기반 정확한 중앙 정렬
        const btnRect = btn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        container.scrollLeft += (btnRect.left + btnRect.width / 2) - (containerRect.left + containerRect.width / 2);
      }
    };

    if (!hasMountedScroll.current) {
      // 레이아웃 완료 후 스크롤 (rAF)
      const raf = requestAnimationFrame(() => {
        doScroll(false);
        hasMountedScroll.current = true;
      });
      return () => cancelAnimationFrame(raf);
    } else {
      doScroll(true);
    }
  }, [dateStr]);

  // 날짜 변경 핸들러 (방향 기반 슬라이드)
  const goDate = useCallback((d: Date, direction?: "left" | "right") => {
    if (direction) {
      setSlideDir(direction);
      setTimeout(() => {
        setSelectedDate(d);
        setLeagueInitialized(false);
        setLiveFilter(false);
        // 반대쪽에서 들어오기
        requestAnimationFrame(() => {
          setSlideDir(null);
        });
      }, 200);
    } else {
      setSelectedDate(d);
      setLeagueInitialized(false);
      setLiveFilter(false);
    }
  }, []);

  // Swipe (경기 리스트 영역에서만)
  useSwipe(contentRef, {
    onSwipeLeft: () => goDate(addDays(selectedDate, 1), "left"),
    onSwipeRight: () => goDate(addDays(selectedDate, -1), "right"),
  });

  // 날짜 바 데이터 (29일)
  const dateBarItems = useMemo(() => buildDateBar(today), [today]);

  // ── 데이터 페칭 ── (항상 all + league)
  const { data: fixturesData, isLoading } = useQuery({
    queryKey: ["v2-fixtures", dateStr],
    queryFn: async () => {
      const params = new URLSearchParams({ date: dateStr, sort: "league" });
      const res = await fetch(`/api/v2/fixtures?${params}`);
      if (!res.ok) throw new Error("Failed to fetch fixtures");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const rawFixtures: any[] = fixturesData?.fixtures || [];
  const leagueGroups: any[] = fixturesData?.leagueGroups || [];

  // 라이브/비라이브 분리
  const { byLeague, liveFixtures, nonLiveByLeague } = useMemo(() => {
    const leagueMap = new Map<string, any[]>();
    const live: any[] = [];
    const nonLiveLeagueMap = new Map<string, any[]>();

    for (const fx of rawFixtures) {
      const lid = fx.league.id;
      const isLive = classifyStatus(fx.status) === "live";

      if (!leagueMap.has(lid)) leagueMap.set(lid, []);
      leagueMap.get(lid)!.push(fx);

      if (isLive) {
        live.push(fx);
      } else {
        if (!nonLiveLeagueMap.has(lid)) nonLiveLeagueMap.set(lid, []);
        nonLiveLeagueMap.get(lid)!.push(fx);
      }
    }

    return { byLeague: leagueMap, liveFixtures: live, nonLiveByLeague: nonLiveLeagueMap };
  }, [rawFixtures]);

  const liveCount = liveFixtures.length;

  // 리그 그룹 (즐겨찾기 리그/팀 → 상단, 나머지 → priority 순)
  const sortedLeagueGroups = useMemo(() => {
    const activeMap = liveFilter ? nonLiveByLeague : byLeague;
    const groups = leagueGroups.filter((g: any) => activeMap.has(g.leagueId));

    if (!favorites.hasFavorites) return groups;

    const favLeagueSet = new Set(favorites.favLeagues);
    const favTeamSet = new Set(favorites.favTeams);

    const isFavGroup = (g: any) => {
      if (favLeagueSet.has(g.apiId)) return true;
      const fixtures = activeMap.get(g.leagueId) || [];
      return fixtures.some((fx: any) =>
        favTeamSet.has(fx.homeTeam.apiTeamId) || favTeamSet.has(fx.awayTeam.apiTeamId)
      );
    };

    const favGroups = groups.filter(isFavGroup);
    const otherGroups = groups.filter(g => !isFavGroup(g));

    return [...favGroups, ...otherGroups];
  }, [leagueGroups, byLeague, nonLiveByLeague, liveFilter, favorites.hasFavorites, favorites.favLeagues, favorites.favTeams]);

  // 리그별 아코디언 초기화 (전부 열기)
  useEffect(() => {
    if (leagueInitialized || leagueGroups.length === 0) return;
    const autoOpen = new Set<string>();
    for (const g of leagueGroups) autoOpen.add(g.leagueId);
    setOpenLeagues(autoOpen);
    setLeagueInitialized(true);
  }, [leagueGroups, leagueInitialized]);

  // ── 하이라이트: 경기 상세에서 복귀 시 마지막 클릭 경기 하이라이트 ──
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    if (location !== "/") return;
    const lastId = sessionStorage.getItem("last_viewed_match");
    if (lastId) {
      setHighlightId(lastId);
      sessionStorage.removeItem("last_viewed_match");
      const timer = setTimeout(() => setHighlightId(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const handleMatchClick = (id: string) => {
    sessionStorage.setItem("last_viewed_match", id);
    navigate(`/match/${id}`);
  };

  const toggleLeague = (leagueId: string) => {
    setOpenLeagues(prev => {
      const next = new Set(prev);
      if (next.has(leagueId)) next.delete(leagueId);
      else next.add(leagueId);
      return next;
    });
  };

  const handleComingSoon = () => {
    toast({ description: "Coming Soon", duration: 1500 });
  };

  // Slide animation style
  const slideStyle = useMemo(() => {
    if (!slideDir) return { transform: "translateX(0)", opacity: 1, transition: "transform 220ms ease, opacity 220ms ease" };
    const x = slideDir === "left" ? "-100%" : "100%";
    return { transform: `translateX(${x})`, opacity: 0, transition: "transform 220ms ease, opacity 220ms ease" };
  }, [slideDir]);

  return (
    <div ref={mainRef} className="max-w-[448px] mx-auto bg-sb-bg min-h-full flex flex-col">
      {/* ── 줄 1: 앱 헤더 ── */}
      <header className="sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3 bg-sb-header-bg border-b border-sb-border">
          <h1 className="text-lg font-bold text-sb-text">Soccer Brain</h1>
          {/* 종목 아이콘 pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-sb-border-subtle">
            <button className="text-[18px] leading-none text-sb-primary">&#9917;</button>
            <button onClick={handleComingSoon} className="text-[18px] leading-none text-sb-icon-disabled">&#127936;</button>
            <button onClick={handleComingSoon} className="text-[18px] leading-none text-sb-icon-disabled">&#9918;</button>
            <button onClick={handleComingSoon} className="text-[18px] leading-none text-sb-icon-disabled">&#127952;</button>
          </div>
        </div>

        {/* ── 줄 2: 날짜 바 (좌우 균형 정렬) ── */}
        <div className="flex items-center px-2 py-2 bg-sb-bg">
          {/* 좌측 고정 영역: Live 버튼 */}
          <div className="w-[76px] flex-shrink-0 flex justify-start">
            <button
              onClick={() => setLiveFilter(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors
                ${liveFilter
                  ? "border-sb-live bg-sb-live/10 text-sb-live"
                  : "border-sb-border-subtle text-sb-text-secondary"}`}
            >
              {liveCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-sb-live animate-pulse" />
              )}
              <span>Live</span>
              {liveCount > 0 && <span className="text-sb-live">{liveCount}</span>}
            </button>
          </div>

          {/* 중앙: 날짜 (스크롤 가능) */}
          <div
            ref={dateScrollRef}
            className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide"
            style={{ touchAction: "pan-x" }}
          >
            {dateBarItems.map(({ date, label }) => {
              const ds = toDateStr(date);
              const isSel = ds === dateStr;
              return (
                <button
                  key={ds}
                  data-date={ds}
                  onClick={() => {
                    const target = date.getTime();
                    const current = selectedDate.getTime();
                    if (target === current) return;
                    goDate(date, target > current ? "left" : "right");
                  }}
                  className={`px-2.5 py-1 text-xs whitespace-nowrap transition-all rounded-full flex-shrink-0
                    ${isSel
                      ? "bg-sb-button-active-bg text-sb-button-active-text font-bold"
                      : "text-sb-text-secondary font-normal"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* 우측 고정 영역: 캘린더 + 즐겨찾기 */}
          <div className="w-[76px] flex-shrink-0 flex justify-end items-center gap-1">
            <button onClick={() => setCalendarOpen(true)} className="p-1.5 text-sb-text-muted">
              <CalendarDays className="w-4 h-4" />
            </button>
            <button onClick={() => setFavSheetOpen(true)} className="p-1.5">
              <Star className={`w-4 h-4 ${favorites.hasFavorites ? "text-sb-star fill-sb-star" : "text-sb-text-muted"}`} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content (슬라이드 애니메이션) ── */}
      <div ref={contentRef} className="flex-1 overflow-hidden">
        <main className="px-3 py-3 pb-6" style={slideStyle}>
          {isLoading && <SkeletonList />}

          {!isLoading && rawFixtures.length === 0 && (
            <div className="text-center py-16 text-sb-text-muted">
              <p className="text-sm">해당 날짜에 경기가 없습니다</p>
            </div>
          )}

          {/* LIVE 섹션 (liveFilter On) */}
          {!isLoading && liveFilter && (
            <section className="mb-3">
              <div className="rounded-lg overflow-hidden border border-sb-card-border">
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-sb-surface-alt">
                  <span className="w-1.5 h-1.5 rounded-full bg-sb-live animate-pulse flex-shrink-0" />
                  <span className="text-[13px] font-semibold text-sb-text">LIVE</span>
                  <span className="text-xs text-sb-text-secondary font-normal">({liveFixtures.length})</span>
                </div>
                {liveFixtures.length > 0 ? (
                  <div className="bg-sb-surface">
                    {liveFixtures.map((fx: any, i: number) => (
                      <div key={fx.id}>
                        {i > 0 && <div className="h-px bg-sb-divider" />}
                        <MatchRow fixture={fx} highlighted={fx.id === highlightId} onClick={() => handleMatchClick(fx.id)} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-sb-surface px-4 py-6 text-center">
                    <p className="text-xs text-sb-text-muted">현재 진행 중인 경기가 없습니다</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* 리그별 카드 블록 (즐겨찾기 리그는 상단으로 자동 배치) */}
          {!isLoading && sortedLeagueGroups.map((group: any) => {
            const activeMap = liveFilter ? nonLiveByLeague : byLeague;
            const leagueFixtures = activeMap.get(group.leagueId) || [];
            if (leagueFixtures.length === 0) return null;
            const isOpen = openLeagues.has(group.leagueId);
            const displayName = getLeagueDisplayName(group.apiId, group.name);
            const isFav = favorites.favLeagues.includes(group.apiId);

            return (
              <LeagueCard
                key={group.leagueId}
                group={group}
                displayName={displayName}
                fixtures={leagueFixtures}
                isOpen={isOpen}
                isFav={isFav}
                onToggle={() => toggleLeague(group.leagueId)}
                highlightId={highlightId}
                onMatchClick={handleMatchClick}
              />
            );
          })}
        </main>
      </div>

      <CalendarModal
        open={calendarOpen}
        selected={selectedDate}
        onSelect={(d) => goDate(d)}
        onClose={() => setCalendarOpen(false)}
      />
      <FavoritesSheet
        open={favSheetOpen}
        onClose={() => setFavSheetOpen(false)}
        favLeagues={favorites.favLeagues}
        favTeams={favorites.favTeams}
        favTeamEntries={favorites.favTeamEntries}
        onToggleLeague={favorites.toggleLeague}
        onToggleTeam={favorites.toggleTeam}
      />
    </div>
  );
}

// ============================================================
// LeagueCard
// ============================================================
function LeagueCard({ group, displayName, fixtures, isOpen, isFav, onToggle, highlightId, onMatchClick }: {
  group: any;
  displayName: string;
  fixtures: any[];
  isOpen: boolean;
  isFav: boolean;
  onToggle: () => void;
  highlightId: string | null;
  onMatchClick: (id: string) => void;
}) {
  return (
    <section className="mb-3">
      <div className="rounded-lg overflow-hidden border border-sb-card-border">
        {/* 리그 헤더 */}
        <div className="w-full flex items-center gap-2 px-3 py-2.5 bg-sb-surface-alt select-none">
          {group.logoUrl && (
            <div className="w-7 h-7 rounded-full bg-sb-surface-hover flex items-center justify-center flex-shrink-0">
              <img src={group.logoUrl} alt="" className="w-5 h-5 object-contain" />
            </div>
          )}
          <span className="text-[13px] font-semibold text-sb-text">{displayName}</span>
          {isFav && <Star className="w-3 h-3 text-sb-star fill-sb-star flex-shrink-0" />}
          <span className="text-xs text-sb-text-secondary font-normal">({fixtures.length})</span>
          <button
            onClick={onToggle}
            className="ml-auto p-1 -mr-1 text-sb-text-secondary flex-shrink-0"
            aria-label={isOpen ? "접기" : "펼치기"}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* 경기 목록 */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: isOpen ? `${fixtures.length * 68 + 4}px` : "0px" }}
        >
          <div className="bg-sb-surface">
            {fixtures.map((fx: any, i: number) => (
              <div key={fx.id}>
                {i > 0 && <div className="h-px bg-sb-divider" />}
                <MatchRow fixture={fx} highlighted={fx.id === highlightId} onClick={() => onMatchClick(fx.id)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// MatchRow: FotMob 가로 중앙 정렬 (축소된 spacing)
// ============================================================
function MatchRow({ fixture, onClick, highlighted }: {
  fixture: any;
  onClick: () => void;
  highlighted?: boolean;
}) {
  const status = classifyStatus(fixture.status);
  const isLive = status === "live";
  const isFinished = status === "finished";
  const homeName = getTeamName(fixture.homeTeam.name);
  const awayName = getTeamName(fixture.awayTeam.name);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-3 py-2 transition-colors
        ${highlighted ? "bg-sb-primary/10 animate-pulse" : "hover:bg-sb-surface-hover active:bg-sb-surface-hover"}`}
      style={{ minHeight: "60px" }}
    >
      {/* 홈팀명 (우측 정렬) */}
      <span className={`flex-1 text-right text-[13px] truncate pr-1.5
        ${isFinished ? "text-sb-text-muted" : "text-sb-text"}`}>
        {homeName}
      </span>

      {/* 홈 로고 */}
      <TeamLogo url={fixture.homeTeam.logoUrl} />

      {/* 중앙: 시간/스코어 */}
      <div className="w-[56px] flex-shrink-0 flex flex-col items-center justify-center mx-1">
        {isLive ? (
          <>
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-sb-live text-[9px] font-bold text-black leading-none mb-0.5">
              {formatMinute(fixture.status)}
            </span>
            <span className="text-[13px] font-bold text-sb-text tabular-nums">
              {fixture.score?.home ?? 0} - {fixture.score?.away ?? 0}
            </span>
          </>
        ) : isFinished ? (
          <>
            <span className="text-[9px] font-medium text-sb-text-muted mb-0.5">FT</span>
            <span className="text-[13px] font-bold text-sb-text tabular-nums">
              {fixture.score?.home ?? 0} - {fixture.score?.away ?? 0}
            </span>
          </>
        ) : (
          <>
            <span className="text-[9px] text-sb-text-secondary leading-none">
              {formatTime(fixture.kickoffAt).period}
            </span>
            <span className="text-[13px] font-medium text-sb-text-secondary tabular-nums">
              {formatTime(fixture.kickoffAt).time}
            </span>
          </>
        )}
      </div>

      {/* 원정 로고 */}
      <TeamLogo url={fixture.awayTeam.logoUrl} />

      {/* 원정팀명 (좌측 정렬) */}
      <span className={`flex-1 text-left text-[13px] truncate pl-1.5
        ${isFinished ? "text-sb-text-muted" : "text-sb-text"}`}>
        {awayName}
      </span>
    </button>
  );
}

function TeamLogo({ url }: { url: string | null }) {
  if (!url) return <div className="w-8 h-8 rounded-full bg-sb-border flex-shrink-0" />;
  return <img src={url} alt="" className="w-8 h-8 object-contain flex-shrink-0" />;
}

// ============================================================
// Skeleton
// ============================================================
function SkeletonList() {
  return (
    <div className="space-y-3 pt-2">
      {[1, 2, 3].map(g => (
        <div key={g} className="rounded-lg overflow-hidden border border-sb-card-border">
          <div className="bg-sb-surface-alt px-3 py-2.5 flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded bg-sb-skeleton" />
            <Skeleton className="h-4 w-24 bg-sb-skeleton" />
          </div>
          {[1, 2].map(i => (
            <div key={i}>
              <div className="h-px bg-sb-divider" />
              <div className="flex items-center px-3 py-2 bg-sb-surface" style={{ minHeight: "60px" }}>
                <div className="flex-1 flex justify-end pr-1.5">
                  <Skeleton className="h-3.5 w-14 bg-sb-skeleton" />
                </div>
                <Skeleton className="w-8 h-8 rounded-full bg-sb-skeleton flex-shrink-0" />
                <div className="w-[56px] flex-shrink-0 flex flex-col items-center mx-1">
                  <Skeleton className="h-2.5 w-5 bg-sb-skeleton mb-1" />
                  <Skeleton className="h-3.5 w-9 bg-sb-skeleton" />
                </div>
                <Skeleton className="w-8 h-8 rounded-full bg-sb-skeleton flex-shrink-0" />
                <div className="flex-1 pl-1.5">
                  <Skeleton className="h-3.5 w-14 bg-sb-skeleton" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
