import { useState, useMemo, useEffect, useRef } from "react";
import { X, Star, Search } from "lucide-react";
import { getTeamName, LEAGUES, TEAM_NAMES_KR } from "@/shared/team-names";

interface FavoritesSheetProps {
  open: boolean;
  onClose: () => void;
  favLeagues: number[];
  favTeams: number[];
  favTeamEntries: Array<{ id: number; name: string }>;
  onToggleLeague: (apiLeagueId: number) => void;
  onToggleTeam: (apiTeamId: number, name?: string) => void;
}

// 리그 카테고리 분류
const LEAGUE_CATEGORIES = [
  { label: "주요 리그", filter: (l: typeof LEAGUES[0]) => l.isPopular && !["ucl", "uel"].includes(l.id) },
  { label: "유럽 대회", filter: (l: typeof LEAGUES[0]) => ["ucl", "uel", "uecl", "uefa_super_cup"].includes(l.id) },
  { label: "아시아", filter: (l: typeof LEAGUES[0]) => ["kleague1", "kleague2", "jleague", "afc_cl", "korean_fa_cup"].includes(l.id) },
  { label: "컵 대회", filter: (l: typeof LEAGUES[0]) => ["fa_cup", "efl_cup", "copa_del_rey", "dfb_pokal", "coppa_italia", "coupe_de_france"].includes(l.id) },
  { label: "기타", filter: (l: typeof LEAGUES[0]) => ["eredivisie", "championship", "community_shield", "super_cup_ger", "super_cup_esp", "super_cup_ita", "trophee_champions"].includes(l.id) },
] as const;

// 인기 팀 (하드코딩)
const POPULAR_TEAMS = [
  { apiTeamId: 529, name: "Barcelona", leagueApiId: 140 },
  { apiTeamId: 541, name: "Real Madrid", leagueApiId: 140 },
  { apiTeamId: 33, name: "Manchester United", leagueApiId: 39 },
  { apiTeamId: 50, name: "Manchester City", leagueApiId: 39 },
  { apiTeamId: 85, name: "Paris Saint Germain", leagueApiId: 61 },
  { apiTeamId: 157, name: "Bayern Munich", leagueApiId: 78 },
  { apiTeamId: 40, name: "Liverpool", leagueApiId: 39 },
  { apiTeamId: 49, name: "Chelsea", leagueApiId: 39 },
  { apiTeamId: 42, name: "Arsenal", leagueApiId: 39 },
  { apiTeamId: 47, name: "Tottenham", leagueApiId: 39 },
  { apiTeamId: 505, name: "Inter", leagueApiId: 135 },
  { apiTeamId: 496, name: "Juventus", leagueApiId: 135 },
  { apiTeamId: 489, name: "AC Milan", leagueApiId: 135 },
  { apiTeamId: 492, name: "Napoli", leagueApiId: 135 },
  { apiTeamId: 165, name: "Borussia Dortmund", leagueApiId: 78 },
  { apiTeamId: 530, name: "Atletico Madrid", leagueApiId: 140 },
];

// 리그 apiId → shortName 매핑 헬퍼
function getLeagueShortName(leagueApiId: number): string {
  const found = LEAGUES.find(l => l.apiIds.includes(leagueApiId));
  return found ? found.shortName : "";
}

export function FavoritesSheet({
  open, onClose, favLeagues, favTeams, favTeamEntries, onToggleLeague, onToggleTeam,
}: FavoritesSheetProps) {
  const [tab, setTab] = useState<"leagues" | "teams">("leagues");
  const [search, setSearch] = useState("");
  const [leagueSearch, setLeagueSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ apiTeamId: number; name: string; logoUrl: string | null }>>([]);
  const [searching, setSearching] = useState(false);
  const outerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // 키보드 대응: visualViewport 기반 — 외곽 컨테이너를 키보드 위로 제한
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const outer = outerRef.current;
      const sheet = sheetRef.current;
      if (!outer) return;

      // 외곽 컨테이너를 visual viewport(키보드 제외 영역)에 맞춤
      outer.style.height = `${vv.height}px`;
      outer.style.top = `${vv.offsetTop}px`;
      outer.style.bottom = "auto";

      if (sheet) {
        sheet.style.maxHeight = `${vv.height * 0.9}px`;
      }
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      const outer = outerRef.current;
      if (outer) {
        outer.style.height = "";
        outer.style.top = "";
        outer.style.bottom = "";
      }
    };
  }, [open]);

  // 한글 → 영어 역매핑
  const resolvedQuery = useMemo(() => {
    const q = search.trim();
    if (!q || q.length < 2) return "";
    if (/[가-힣]/.test(q)) {
      const matches: string[] = [];
      for (const [eng, kor] of Object.entries(TEAM_NAMES_KR)) {
        if (kor.includes(q)) matches.push(eng);
      }
      return matches.length > 0 ? matches.slice(0, 5).join(",") : q;
    }
    return q;
  }, [search]);

  // 디바운스 API 검색
  useEffect(() => {
    if (!resolvedQuery || resolvedQuery.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v2/teams/search?q=${encodeURIComponent(resolvedQuery)}`);
        const data = await res.json();
        setSearchResults(data.teams || []);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [resolvedQuery]);

  // 시트 닫힐 때 검색 초기화
  useEffect(() => {
    if (!open) { setSearch(""); setLeagueSearch(""); setSearchResults([]); setTab("leagues"); }
  }, [open]);

  // 카테고리별 리그 목록
  const categorizedLeagues = useMemo(() =>
    LEAGUE_CATEGORIES.map(cat => ({
      label: cat.label,
      leagues: LEAGUES.filter(cat.filter),
    })).filter(cat => cat.leagues.length > 0),
  []);

  // 리그 검색 필터링
  const filteredLeagues = useMemo(() => {
    const q = leagueSearch.trim().toLowerCase();
    if (!q) return null; // null = 카테고리 모드 사용
    return LEAGUES.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.shortName.toLowerCase().includes(q) ||
      l.id.toLowerCase().includes(q)
    );
  }, [leagueSearch]);

  if (!open) return null;

  return (
    <div ref={outerRef} className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* 시트 */}
      <div
        ref={sheetRef}
        className="relative bg-sb-surface rounded-t-2xl flex flex-col animate-in slide-in-from-bottom duration-300"
        style={{ maxHeight: "85vh" }}
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 rounded-full bg-sb-border-subtle" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pb-3">
          <span className="text-base font-bold text-sb-text">즐겨찾기</span>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-sb-surface-hover text-sb-text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 세그먼트 탭 */}
        <div className="mx-5 mb-3 flex rounded-lg bg-sb-surface-alt p-0.5">
          <button
            onClick={() => setTab("leagues")}
            className={`flex-1 py-2 text-[13px] font-semibold rounded-md transition-all
              ${tab === "leagues"
                ? "bg-sb-surface text-sb-text shadow-sm"
                : "text-sb-text-muted"}`}
          >
            리그
            {favLeagues.length > 0 && (
              <span className="ml-1 text-sb-primary">{favLeagues.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("teams")}
            className={`flex-1 py-2 text-[13px] font-semibold rounded-md transition-all
              ${tab === "teams"
                ? "bg-sb-surface text-sb-text shadow-sm"
                : "text-sb-text-muted"}`}
          >
            팀
            {favTeams.length > 0 && (
              <span className="ml-1 text-sb-primary">{favTeams.length}</span>
            )}
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-safe-bottom">
          {tab === "leagues" && (
            <div className="px-5 pb-8">
              {/* 리그 검색 바 */}
              <div className="flex items-center gap-2.5 bg-sb-surface-alt rounded-xl px-4 py-2.5 mb-4">
                <Search className="w-4 h-4 text-sb-text-muted flex-shrink-0" />
                <input
                  type="text"
                  value={leagueSearch}
                  onChange={e => setLeagueSearch(e.target.value)}
                  placeholder="대회 검색"
                  className="flex-1 bg-transparent text-[13px] text-sb-text placeholder-sb-text-faint outline-none"
                />
                {leagueSearch && (
                  <button onClick={() => setLeagueSearch("")} className="text-sb-text-muted">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 검색 결과 모드 */}
              {filteredLeagues !== null ? (
                filteredLeagues.length > 0 ? (
                  <div className="rounded-xl bg-sb-surface-alt overflow-hidden">
                    {filteredLeagues.map((league, idx) => {
                      const apiId = league.apiIds[0];
                      const checked = favLeagues.includes(apiId);
                      return (
                        <div key={apiId}>
                          {idx > 0 && <div className="h-px bg-sb-divider ml-14 mr-4" />}
                          <LeagueRow league={league} checked={checked} onToggle={() => onToggleLeague(apiId)} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-sb-text-muted">검색 결과가 없습니다</p>
                  </div>
                )
              ) : (
                <>
                  {/* 내 리그 */}
                  {favLeagues.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[11px] font-medium text-sb-text-muted uppercase tracking-wider mb-1.5 px-1">
                        내 리그
                      </p>
                      <div className="rounded-xl bg-sb-surface-alt overflow-hidden">
                        {LEAGUES.filter(l => favLeagues.includes(l.apiIds[0])).map((league, idx) => {
                          const apiId = league.apiIds[0];
                          return (
                            <div key={apiId}>
                              {idx > 0 && <div className="h-px bg-sb-divider ml-14 mr-4" />}
                              <LeagueRow league={league} checked={true} onToggle={() => onToggleLeague(apiId)} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* 카테고리 모드 */}
                  {categorizedLeagues.map(cat => (
                    <div key={cat.label} className="mb-4">
                      <p className="text-[11px] font-medium text-sb-text-muted uppercase tracking-wider mb-1.5 px-1">
                        {cat.label}
                      </p>
                      <div className="rounded-xl bg-sb-surface-alt overflow-hidden">
                        {cat.leagues.map((league, idx) => {
                          const apiId = league.apiIds[0];
                          const checked = favLeagues.includes(apiId);
                          return (
                            <div key={apiId}>
                              {idx > 0 && <div className="h-px bg-sb-divider ml-14 mr-4" />}
                              <LeagueRow league={league} checked={checked} onToggle={() => onToggleLeague(apiId)} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {tab === "teams" && (
            <div className="px-5 pb-8">
              {/* 검색 입력 */}
              <div className="flex items-center gap-2.5 bg-sb-surface-alt rounded-xl px-4 py-2.5 mb-4">
                <Search className="w-4 h-4 text-sb-text-muted flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="팀명 검색 (한글 / 영문)"
                  className="flex-1 bg-transparent text-[13px] text-sb-text placeholder-sb-text-faint outline-none"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-sb-text-muted">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 즐겨찾기된 팀 (내 팀) */}
              {favTeamEntries.length > 0 && !search && (
                <div className="mb-4">
                  <p className="text-[11px] font-medium text-sb-text-muted uppercase tracking-wider mb-1.5 px-1">
                    내 팀
                  </p>
                  <div className="rounded-xl bg-sb-surface-alt overflow-hidden">
                    {favTeamEntries.map((team, idx) => (
                      <div key={team.id}>
                        {idx > 0 && <div className="h-px bg-sb-divider ml-14 mr-4" />}
                        <button
                          onClick={() => onToggleTeam(team.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 transition-colors active:bg-sb-surface-hover"
                        >
                          <img
                            src={`https://media.api-sports.io/football/teams/${team.id}.png`}
                            alt=""
                            className="w-6 h-6 object-contain flex-shrink-0"
                          />
                          <span className="flex-1 text-[13px] text-sb-text text-left">{getTeamName(team.name)}</span>
                          <Star className="w-[18px] h-[18px] text-sb-star fill-sb-star flex-shrink-0" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 인기 팀 (검색 없을 때) */}
              {!search && (
                <div className="mb-4">
                  <p className="text-[11px] font-medium text-sb-text-muted uppercase tracking-wider mb-1.5 px-1">
                    인기 팀
                  </p>
                  <div className="rounded-xl bg-sb-surface-alt overflow-hidden">
                    {POPULAR_TEAMS.map((team, idx) => {
                      const isFav = favTeams.includes(team.apiTeamId);
                      const krName = getTeamName(team.name);
                      const leagueShort = getLeagueShortName(team.leagueApiId);
                      return (
                        <div key={team.apiTeamId}>
                          {idx > 0 && <div className="h-px bg-sb-divider ml-14 mr-4" />}
                          <button
                            onClick={() => onToggleTeam(team.apiTeamId, team.name)}
                            className="w-full flex items-center gap-3 px-4 py-3 transition-colors active:bg-sb-surface-hover"
                          >
                            <img
                              src={`https://media.api-sports.io/football/teams/${team.apiTeamId}.png`}
                              alt=""
                              className="w-6 h-6 object-contain flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0 text-left">
                              <span className="text-[13px] text-sb-text block truncate">{krName}</span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <img
                                  src={`https://media.api-sports.io/football/leagues/${team.leagueApiId}.png`}
                                  alt=""
                                  className="w-3.5 h-3.5 object-contain flex-shrink-0"
                                />
                                <span className="text-[11px] text-sb-text-muted truncate">{leagueShort}</span>
                              </div>
                            </div>
                            <Star
                              className={`w-[18px] h-[18px] transition-colors flex-shrink-0
                                ${isFav ? "text-sb-star fill-sb-star" : "text-sb-text-faint"}`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 검색 결과 */}
              {searching && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-sb-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!searching && searchResults.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] font-medium text-sb-text-muted uppercase tracking-wider mb-1.5 px-1">
                    검색 결과
                  </p>
                  <div className="rounded-xl bg-sb-surface-alt overflow-hidden">
                    {searchResults.map((team, idx) => {
                      const isFav = favTeams.includes(team.apiTeamId);
                      const krName = getTeamName(team.name);
                      return (
                        <div key={team.apiTeamId}>
                          {idx > 0 && <div className="h-px bg-sb-divider ml-14 mr-4" />}
                          <button
                            onClick={() => onToggleTeam(team.apiTeamId, team.name)}
                            className="w-full flex items-center gap-3 px-4 py-3 transition-colors active:bg-sb-surface-hover"
                          >
                            {team.logoUrl
                              ? <img src={team.logoUrl} alt="" className="w-6 h-6 object-contain flex-shrink-0" />
                              : <div className="w-6 h-6 rounded-full bg-sb-border flex-shrink-0" />}
                            <div className="flex-1 min-w-0 text-left">
                              <span className="text-[13px] text-sb-text block truncate">{krName}</span>
                              {krName !== team.name && (
                                <span className="text-[11px] text-sb-text-muted block truncate">{team.name}</span>
                              )}
                            </div>
                            <Star
                              className={`w-[18px] h-[18px] transition-colors flex-shrink-0
                                ${isFav ? "text-sb-star fill-sb-star" : "text-sb-text-faint"}`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!searching && search.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-sb-text-muted">검색 결과가 없습니다</p>
                </div>
              )}

              {!search && favTeamEntries.length === 0 && (
                <div className="text-center py-8 mt-2">
                  <Search className="w-8 h-8 text-sb-text-faint mx-auto mb-2" />
                  <p className="text-sm text-sb-text-muted">팀명을 검색해서 추가하세요</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LeagueRow 컴포넌트 (로고 + 이름 + 별)
// ============================================================
function LeagueRow({ league, checked, onToggle }: {
  league: typeof LEAGUES[0];
  checked: boolean;
  onToggle: () => void;
}) {
  const apiId = league.apiIds[0];
  const logoUrl = `https://media.api-sports.io/football/leagues/${apiId}.png`;

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 transition-colors active:bg-sb-surface-hover"
    >
      <div className="w-7 h-7 rounded-full bg-sb-surface-hover flex items-center justify-center flex-shrink-0">
        <img src={logoUrl} alt="" className="w-5 h-5 object-contain" />
      </div>
      <span className="flex-1 text-[13px] text-sb-text text-left">{league.name}</span>
      <Star
        className={`w-[18px] h-[18px] transition-colors flex-shrink-0
          ${checked ? "text-sb-star fill-sb-star" : "text-sb-text-faint"}`}
      />
    </button>
  );
}
