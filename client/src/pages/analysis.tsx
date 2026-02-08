import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, ChevronRight, Trophy, Calendar, Cloud, Sun,
  CloudRain, Snowflake, Wind, TrendingUp, TrendingDown,
  BarChart3, Zap, Clock, AlertTriangle, MapPin, ArrowUp,
  ArrowDown, Minus, HelpCircle, LayoutGrid, List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";

// ─── 팀 한글명 매핑 (home.tsx와 동일) ───
const TEAM_NAMES_KR: Record<string, string> = {
  "Manchester United": "맨체스터 유나이티드", "Manchester City": "맨체스터 시티",
  "Liverpool": "리버풀", "Chelsea": "첼시", "Arsenal": "아스널",
  "Tottenham": "토트넘", "Newcastle": "뉴캐슬", "West Ham": "웨스트햄",
  "Brighton": "브라이튼", "Aston Villa": "애스턴 빌라", "Fulham": "풀럼",
  "Brentford": "브렌트포드", "Crystal Palace": "크리스탈 팰리스",
  "Wolves": "울버햄튼", "Everton": "에버튼", "Nottingham Forest": "노팅엄 포레스트",
  "Bournemouth": "본머스", "Burnley": "번리", "Sheffield United": "셰필드",
  "Luton": "루턴", "Leeds": "리즈", "Leicester": "레스터",
  "Southampton": "사우샘프턴", "Sunderland": "선덜랜드", "Ipswich": "입스위치",
  "Real Madrid": "레알 마드리드", "Barcelona": "바르셀로나",
  "Atletico Madrid": "아틀레티코 마드리드", "Athletic Club": "아틀레틱 빌바오",
  "Real Sociedad": "레알 소시에다드", "Real Betis": "레알 베티스",
  "Villarreal": "비야레알", "Valencia": "발렌시아", "Sevilla": "세비야",
  "Celta Vigo": "셀타 비고", "Osasuna": "오사수나", "Getafe": "헤타페",
  "Girona": "지로나", "Mallorca": "마요르카", "Rayo Vallecano": "라요 바예카노",
  "Las Palmas": "라스팔마스", "Alaves": "알라베스", "Cadiz": "카디스",
  "Granada": "그라나다", "Almeria": "알메리아", "Leganes": "레가네스",
  "Espanyol": "에스파뇰", "Valladolid": "바야돌리드", "Oviedo": "오비에도",
  "Bayern Munich": "바이에른 뮌헨", "Borussia Dortmund": "도르트문트",
  "RB Leipzig": "RB 라이프치히", "Bayer Leverkusen": "레버쿠젠",
  "Union Berlin": "우니온 베를린", "Eintracht Frankfurt": "프랑크푸르트",
  "VfL Wolfsburg": "볼프스부르크", "Borussia Monchengladbach": "묀헨글라트바흐",
  "Werder Bremen": "베르더 브레멘", "SC Freiburg": "프라이부르크",
  "FC Augsburg": "아우크스부르크", "VfB Stuttgart": "슈투트가르트",
  "1. FC Köln": "쾰른", "TSG Hoffenheim": "호펜하임", "FSV Mainz 05": "마인츠",
  "VfL Bochum": "보훔", "1. FC Heidenheim": "하이덴하임",
  "SV Darmstadt 98": "다름슈타트", "FC St. Pauli": "장크트파울리",
  "Hamburger SV": "함부르크", "Holstein Kiel": "홀슈타인 킬",
  "Inter": "인테르", "AC Milan": "AC 밀란", "Juventus": "유벤투스",
  "Napoli": "나폴리", "Roma": "로마", "Lazio": "라치오", "Atalanta": "아탈란타",
  "Fiorentina": "피오렌티나", "Bologna": "볼로냐", "Torino": "토리노",
  "Monza": "몬자", "Udinese": "우디네세", "Sassuolo": "사수올로",
  "Empoli": "엠폴리", "Cagliari": "칼리아리", "Verona": "베로나",
  "Lecce": "레체", "Genoa": "제노아", "Salernitana": "살레르니타나",
  "Frosinone": "프로시노네", "Como": "코모", "Parma": "파르마", "Venezia": "베네치아",
  "Paris Saint Germain": "파리 생제르맹", "PSG": "파리 생제르맹",
  "Marseille": "마르세유", "Monaco": "모나코", "Lyon": "리옹", "Lille": "릴",
  "Nice": "니스", "Lens": "랑스", "Rennes": "렌", "Montpellier": "몽펠리에",
  "Nantes": "낭트", "Strasbourg": "스트라스부르", "Toulouse": "툴루즈",
  "Reims": "랭스", "Brest": "브레스트", "Lorient": "로리앙",
  "Clermont": "클레르몽", "Metz": "메츠", "Le Havre": "르아브르",
  "Auxerre": "오세르", "Angers": "앙제", "Saint-Etienne": "생테티엔",
  "St Etienne": "생테티엔",
  // API-Football 이름 변형
  "Paris Saint-Germain": "파리 생제르맹", "Bayern München": "바이에른 뮌헨",
  "FC Bayern München": "바이에른 뮌헨", "FC Bayern Munich": "바이에른 뮌헨",
  "Borussia Mönchengladbach": "묀헨글라트바흐", "1. FC Koln": "쾰른",
  "1.FC Köln": "쾰른", "Mainz 05": "마인츠", "1. FSV Mainz 05": "마인츠",
  "Bayer 04 Leverkusen": "레버쿠젠", "Freiburg": "프라이부르크",
  "Manchester Utd": "맨체스터 유나이티드", "Man United": "맨체스터 유나이티드",
  "Man City": "맨체스터 시티", "Tottenham Hotspur": "토트넘",
  "Wolverhampton Wanderers": "울버햄튼", "Wolverhampton": "울버햄튼",
  "West Ham United": "웨스트햄", "Brighton & Hove Albion": "브라이튼",
  "Brighton and Hove Albion": "브라이튼", "Nottingham": "노팅엄 포레스트",
  "Nott'm Forest": "노팅엄 포레스트", "Sheffield Utd": "셰필드",
  "Luton Town": "루턴", "Ipswich Town": "입스위치", "Leicester City": "레스터",
  "Inter Milan": "인테르", "Internazionale": "인테르",
  "FC Internazionale": "인테르", "Milan": "AC 밀란",
  "AS Roma": "로마", "SS Lazio": "라치오", "Atalanta BC": "아탈란타",
  "ACF Fiorentina": "피오렌티나", "Bologna FC": "볼로냐",
  "Torino FC": "토리노", "Hellas Verona": "베로나",
  "US Lecce": "레체", "Genoa CFC": "제노아",
  "Atletico de Madrid": "아틀레티코 마드리드", "Atlético Madrid": "아틀레티코 마드리드",
  "Athletic Bilbao": "아틀레틱 빌바오", "Celta de Vigo": "셀타 비고",
  "RCD Mallorca": "마요르카", "Deportivo Alaves": "알라베스",
  "CD Leganes": "레가네스", "RCD Espanyol": "에스파뇰",
  "Real Valladolid": "바야돌리드",
  "Olympique Marseille": "마르세유", "Olympique de Marseille": "마르세유",
  "AS Monaco": "모나코", "Olympique Lyonnais": "리옹", "Olympique Lyon": "리옹",
  "LOSC Lille": "릴", "OGC Nice": "니스", "RC Lens": "랑스",
  "Stade Rennais": "렌", "Stade de Reims": "랭스",
  "Stade Brestois 29": "브레스트", "FC Lorient": "로리앙",
  "Clermont Foot": "클레르몽", "FC Metz": "메츠",
  "RC Strasbourg Alsace": "스트라스부르",
  "Toulouse FC": "툴루즈", "FC Nantes": "낭트", "Montpellier HSC": "몽펠리에",
};

function getTeamDisplayName(name: string, shortName?: string): string {
  let krName = TEAM_NAMES_KR[name];
  if (!krName) {
    const nameLower = name.toLowerCase();
    for (const [key, value] of Object.entries(TEAM_NAMES_KR)) {
      const keyLower = key.toLowerCase();
      if (nameLower.includes(keyLower) || keyLower.includes(nameLower)) {
        krName = value; break;
      }
      const firstWord = keyLower.split(' ')[0];
      if (firstWord.length >= 4 && nameLower.includes(firstWord)) {
        krName = value; break;
      }
    }
  }
  const validShort = shortName && shortName.length >= 2 && !/^\d+$/.test(shortName)
    ? shortName
    : name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase() || name.substring(0, 3).toUpperCase();
  if (krName) return `${krName}(${validShort})`;
  const displayName = name.length <= 15 ? name : validShort;
  return `${displayName}(${validShort})`;
}

// ─── 리그 설정 ───
interface LeagueConfig {
  id: number; label: string; flag: string; totalTeams: number;
  uclSpots: number; uelSpots: number; ueclSpots: number; relegationSpots: number;
}

const LEAGUE_CONFIGS: LeagueConfig[] = [
  { id: 39, label: "EPL", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", totalTeams: 20, uclSpots: 4, uelSpots: 1, ueclSpots: 1, relegationSpots: 3 },
  { id: 140, label: "라리가", flag: "🇪🇸", totalTeams: 20, uclSpots: 4, uelSpots: 1, ueclSpots: 1, relegationSpots: 3 },
  { id: 135, label: "세리에A", flag: "🇮🇹", totalTeams: 20, uclSpots: 4, uelSpots: 1, ueclSpots: 1, relegationSpots: 3 },
  { id: 78, label: "분데스", flag: "🇩🇪", totalTeams: 18, uclSpots: 4, uelSpots: 1, ueclSpots: 1, relegationSpots: 2 },
  { id: 61, label: "리그1", flag: "🇫🇷", totalTeams: 18, uclSpots: 3, uelSpots: 1, ueclSpots: 1, relegationSpots: 2 },
  { id: 2, label: "UCL", flag: "🏆", totalTeams: 36, uclSpots: 0, uelSpots: 0, ueclSpots: 0, relegationSpots: 0 },
  { id: 3, label: "UEL", flag: "🏆", totalTeams: 36, uclSpots: 0, uelSpots: 0, ueclSpots: 0, relegationSpots: 0 },
  { id: 88, label: "에레디비시", flag: "🇳🇱", totalTeams: 18, uclSpots: 2, uelSpots: 1, ueclSpots: 1, relegationSpots: 1 },
  { id: 94, label: "프리메이라", flag: "🇵🇹", totalTeams: 18, uclSpots: 2, uelSpots: 1, ueclSpots: 1, relegationSpots: 2 },
  { id: 292, label: "K리그1", flag: "🇰🇷", totalTeams: 12, uclSpots: 1, uelSpots: 0, ueclSpots: 1, relegationSpots: 1 },
];

const LEAGUE_MAP = Object.fromEntries(LEAGUE_CONFIGS.map(l => [l.id, l]));

const LEAGUES_FILTER = [
  { id: "all", name: "전체", apiIds: [] as number[] },
  { id: "epl", name: "EPL", apiIds: [39, 313] },
  { id: "laliga", name: "라리가", apiIds: [140, 328] },
  { id: "bundesliga", name: "분데스", apiIds: [78, 391] },
  { id: "seriea", name: "세리에A", apiIds: [135, 410] },
  { id: "ligue1", name: "리그1", apiIds: [61, 366] },
  { id: "ucl", name: "UCL", apiIds: [2, 3] },
  { id: "uel", name: "UEL", apiIds: [848, 3] },
];

type ViewMode = "matches" | "standings";

// ─── Standing 타입 ───
interface Standing {
  rank: number; played: number; won: number; drawn: number; lost: number; form: string | null;
}

// ─── V9 Analysis 타입 ───
interface V9Analysis {
  mlProb: { home: number; draw: number; away: number; };
  mlPick: { pick: 'home' | 'draw' | 'away'; pickProb: number; pickName: string; };
  recommendation: { level: 'STRONG' | 'MEDIUM' | 'NONE'; stars: number; reason: string; };
  drawWarning: { isClose: boolean; likelihood: number; message: string | null; };
  valueBet: { isValue: boolean; ev: number; message: string | null; };
  isRecommended: boolean;
}

// ─── Prediction 타입 ───
interface Prediction {
  fixtureId: string;
  kickoffAt: string;
  status: string;
  league: { id: string; name: string; country: string; };
  homeTeam: { id: string; name: string; shortName: string; logoUrl: string; standing?: Standing | null; };
  awayTeam: { id: string; name: string; shortName: string; logoUrl: string; standing?: Standing | null; };
  venue?: { name: string | null; city: string | null; } | null;
  weather?: { temp: number | null; condition: string | null; icon?: string | null; } | null;
  odds: {
    home: number; draw: number; away: number;
    isEstimated?: boolean;
    trend?: { home: 'up' | 'down' | 'same'; draw: 'up' | 'down' | 'same'; away: 'up' | 'down' | 'same'; } | null;
    domestic?: { home: number; draw: number; away: number; isEstimated?: boolean; } | null;
  } | null;
  prediction: {
    homeProb: number; drawProb: number; awayProb: number;
    expectedValue: { home: number; draw: number; away: number; best: string; bestValue: number; };
    isRecommended: boolean; confidence: string;
    recommendationLevel?: string; bestPick?: string; hasFeatures?: boolean;
  };
  v9?: V9Analysis;
  features: any;
}

// ─── 헬퍼: 확률 ───
function getProb(match: Prediction) {
  if (match.v9?.mlProb) {
    return { home: match.v9.mlProb.home ?? 33.3, draw: match.v9.mlProb.draw ?? 33.3, away: match.v9.mlProb.away ?? 33.3 };
  }
  if (match.prediction?.homeProb !== undefined) {
    return { home: match.prediction.homeProb, draw: match.prediction.drawProb, away: match.prediction.awayProb };
  }
  return { home: 33.3, draw: 33.3, away: 33.3 };
}

function isMatchRecommended(match: Prediction): boolean {
  if (match.v9?.recommendation) {
    return match.v9.recommendation.level === 'STRONG' || match.v9.recommendation.level === 'MEDIUM';
  }
  if (match.prediction?.isRecommended !== undefined) return match.prediction.isRecommended;
  const prob = getProb(match);
  return Math.max(prob.home, prob.draw, prob.away) >= 60;
}

function getMlPick(match: Prediction) {
  if (match.v9?.mlPick) return match.v9.mlPick;
  const prob = getProb(match);
  if (prob.home >= prob.draw && prob.home >= prob.away) return { pick: 'home' as const, pickProb: prob.home, pickName: '홈승' };
  if (prob.away >= prob.home && prob.away >= prob.draw) return { pick: 'away' as const, pickProb: prob.away, pickName: '원정승' };
  return { pick: 'draw' as const, pickProb: prob.draw, pickName: '무승부' };
}

function getValueBet(match: Prediction) {
  return match.v9?.valueBet ?? { isValue: false, ev: 0, message: null };
}

// ─── 날씨 아이콘 ───
function WeatherIcon({ condition }: { condition: string }) {
  const l = (condition || "").toLowerCase();
  if (l.includes('rain') || l.includes('drizzle') || l.includes('shower')) return <CloudRain className="w-3 h-3 text-blue-500" />;
  if (l.includes('snow') || l.includes('sleet') || l.includes('hail')) return <Snowflake className="w-3 h-3 text-cyan-400" />;
  if (l.includes('cloud') || l.includes('overcast') || l.includes('fog') || l.includes('mist')) return <Cloud className="w-3 h-3 text-gray-400" />;
  if (l.includes('storm') || l.includes('thunder')) return <CloudRain className="w-3 h-3 text-purple-500" />;
  return <Sun className="w-3 h-3 text-yellow-500" />;
}

// ─── 배당 변동 화살표 ───
function OddsTrend({ trend }: { trend: 'up' | 'down' | 'same' | undefined | null }) {
  if (!trend || trend === 'same') return <Minus className="w-2.5 h-2.5 text-gray-400 inline" />;
  if (trend === 'up') return <ArrowUp className="w-2.5 h-2.5 text-red-500 inline" />;
  return <ArrowDown className="w-2.5 h-2.5 text-blue-500 inline" />;
}

// ─── 폼 표시 (□ 안에 승/무/패 글자, 최근 경기 밑줄) ───
function FormDotsWithLabel({ form }: { form?: string | null }) {
  if (!form) return null;
  const last5 = form.slice(-5);
  const chars = last5.split("");
  const labelMap: Record<string, string> = { W: "승", D: "무", L: "패" };
  const borderMap: Record<string, string> = {
    W: "border-emerald-500", D: "border-gray-400", L: "border-red-500",
  };
  const textMap: Record<string, string> = {
    W: "text-emerald-500", D: "text-gray-400", L: "text-red-500",
  };
  const bgMap: Record<string, string> = {
    W: "bg-emerald-500", D: "bg-gray-400", L: "bg-red-500",
  };
  return (
    <div className="flex gap-[2px] items-start">
      {chars.map((ch, i) => {
        const isLast = i === chars.length - 1;
        return (
          <div key={i} className="flex flex-col items-center">
            <span
              className={`w-3 h-3 rounded-[2px] border flex items-center justify-center text-[6px] font-bold leading-none ${borderMap[ch] || "border-gray-500"} ${textMap[ch] || "text-gray-500"}`}
            >
              {labelMap[ch] || ch}
            </span>
            {isLast && (
              <span className={`w-3 h-[1.5px] rounded-full mt-[1px] ${bgMap[ch] || "bg-gray-500"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 메인 Analysis 컴포넌트
// ============================================================
export default function Analysis() {
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("matches");
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [dateOffset, setDateOffset] = useState(0);
  const [cardView, setCardView] = useState<'card' | 'list'>('card');

  // 경기 데이터 — /api/predictions/upcoming
  const { data: predictionsData, isLoading: matchesLoading, error: matchesError } = useQuery({
    queryKey: ["/api/predictions/upcoming"],
    queryFn: async () => {
      const res = await fetch("/api/predictions/upcoming?days=7&limit=200");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 10,
  });

  const predictions: Prediction[] = predictionsData?.data || [];

  // 순위 데이터
  const { data: standingsData, isLoading: standingsLoading } = useQuery({
    queryKey: ["/api/standings", selectedLeague],
    queryFn: async () => {
      const res = await fetch(`/api/standings?leagueId=${selectedLeague}`);
      if (!res.ok) throw new Error("Failed to fetch standings");
      return res.json();
    },
    enabled: viewMode === "standings" && selectedLeague !== null,
    staleTime: 1000 * 60 * 30,
  });

  const standings = standingsData?.standings || [];

  // 날짜 라벨 생성
  const dateLabels = useMemo(() => {
    const labels: { label: string; date: string }[] = [];
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const dayStr = `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`;
      labels.push({
        label: i === 0 ? "오늘" : i === 1 ? "내일" : dayStr,
        date: dateStr,
      });
    }
    return labels;
  }, []);

  const targetDate = dateLabels[dateOffset]?.date || "";

  // 리그 + 날짜 필터링
  const filteredMatches = useMemo(() => {
    return predictions.filter((p) => {
      const pDate = new Date(p.kickoffAt).toISOString().split("T")[0];
      if (pDate !== targetDate) return false;
      
      if (leagueFilter === "all") return true;
      const league = LEAGUES_FILTER.find(l => l.id === leagueFilter);
      if (!league) return true;
      return league.apiIds.some(apiId =>
        p.league.id === apiId.toString() || p.league.name.toLowerCase().includes(league.id)
      );
    });
  }, [predictions, targetDate, leagueFilter]);

  // 날짜별 전체 경기 수
  const totalMatchCount = useMemo(() => {
    return predictions.filter(p => {
      const pDate = new Date(p.kickoffAt).toISOString().split("T")[0];
      return pDate === targetDate;
    }).length;
  }, [predictions, targetDate]);

  // 순위표 모드 진입 시 기본 리그 선택
  useEffect(() => {
    if (viewMode === "standings" && !selectedLeague) setSelectedLeague(39);
  }, [viewMode]);

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "standings" && !selectedLeague) setSelectedLeague(39);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ─── 헤더 ─── */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold tracking-tight">분석</h1>
            </div>
            <ThemeToggle />
          </div>

          {/* 모드 토글 (iOS 세그먼트 스타일) */}
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => handleModeChange("matches")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === "matches"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <Search className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              경기 분석
            </button>
            <button
              onClick={() => handleModeChange("standings")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                viewMode === "standings"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <Trophy className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              리그 순위
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-3 space-y-3 pb-20">
        {viewMode === "matches" ? (
          <>
            {/* 날짜 선택 */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
              {dateLabels.map((dl, i) => (
                <button
                  key={i}
                  onClick={() => setDateOffset(i)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    dateOffset === i
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {dl.label}
                </button>
              ))}
            </div>

            {/* 리그 필터 */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
              {LEAGUES_FILTER.map((lf) => (
                <button
                  key={lf.id}
                  onClick={() => setLeagueFilter(lf.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    leagueFilter === lf.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground border border-muted-foreground/30"
                  }`}
                >
                  {lf.name}
                </button>
              ))}
            </div>

            {/* 경기 수 & 뷰 토글 */}
            {!matchesLoading && filteredMatches.length > 0 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">
                  📅 {dateLabels[dateOffset]?.label} ({filteredMatches.length}경기)
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCardView(v => v === 'card' ? 'list' : 'card')}
                  className="h-6 w-6"
                  title={cardView === 'card' ? '목록형으로 보기' : '카드형으로 보기'}
                >
                  {cardView === 'card' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
                </Button>
              </div>
            )}

            {/* 경기 목록 */}
            {matchesLoading ? (
              <div className="space-y-3">
                {cardView === 'card' 
                  ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-[180px] w-full rounded-xl" />)
                  : [1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)
                }
              </div>
            ) : matchesError ? (
              <EmptyState
                icon={<AlertTriangle className="h-10 w-10 text-destructive/50" />}
                title="데이터를 불러올 수 없습니다"
                desc="잠시 후 다시 시도해주세요"
              />
            ) : filteredMatches.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-10 w-10 text-muted-foreground/30" />}
                title="예정된 경기가 없습니다"
                desc="다른 날짜나 리그를 선택해보세요"
              />
            ) : cardView === 'card' ? (
              <div className="space-y-3">
                {filteredMatches.map((match) => (
                  <MatchCard
                    key={match.fixtureId}
                    match={match}
                    onClick={() => setLocation(`/match/${match.fixtureId}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredMatches.map((match) => (
                  <MatchListItem
                    key={match.fixtureId}
                    match={match}
                    onClick={() => setLocation(`/match/${match.fixtureId}`)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* ─── 리그 순위 뷰 ─── */
          <>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
              {LEAGUE_CONFIGS.map((lc) => (
                <button
                  key={lc.id}
                  onClick={() => setSelectedLeague(lc.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                    selectedLeague === lc.id
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {lc.flag} {lc.label}
                </button>
              ))}
            </div>

            {!selectedLeague ? (
              <EmptyState icon={<Trophy className="h-10 w-10 text-muted-foreground/30" />} title="리그를 선택해주세요" />
            ) : standingsLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
              </div>
            ) : standings.length === 0 ? (
              <EmptyState
                icon={<Trophy className="h-10 w-10 text-muted-foreground/30" />}
                title="순위 데이터가 없습니다"
                desc="관리자에서 순위 동기화를 실행해주세요"
              />
            ) : (
              <StandingsTable
                standings={standings}
                standingsData={standingsData}
                leagueConfig={LEAGUE_MAP[selectedLeague] || null}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ============================================================
// 빈 상태
// ============================================================
function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="text-center py-16">
      <div className="mx-auto mb-3 flex justify-center">{icon}</div>
      <p className="text-sm text-muted-foreground">{title}</p>
      {desc && <p className="text-xs text-muted-foreground/60 mt-1">{desc}</p>}
    </div>
  );
}

// ============================================================
// 경기 카드 (홈 탭과 동일한 구조 + 폼 점 추가)
// ============================================================
function MatchCard({ match, onClick }: { match: Prediction; onClick: () => void }) {
  const kickoff = new Date(match.kickoffAt);
  const timeStr = kickoff.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = kickoff.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  const defaultLogo = "https://via.placeholder.com/40?text=⚽";

  const prob = getProb(match);
  const recommended = isMatchRecommended(match);
  const mlPick = getMlPick(match);
  const valueBet = getValueBet(match);

  const venue = match.venue?.name || "경기장 정보 없음";
  const weather = match.weather?.temp !== null && match.weather?.temp !== undefined
    ? { temp: match.weather.temp, condition: match.weather.condition || "Unknown" }
    : null;

  const isEstimatedOdds = match.odds?.isEstimated === true;
  const homeStanding = match.homeTeam.standing || null;
  const awayStanding = match.awayTeam.standing || null;

  return (
    <Card
      className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer ${
        recommended ? 'border-amber-400 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-950/30' : 'border-border/50'
      }`}
      onClick={onClick}
    >
      {/* 상단: 리그 | 경기장+날씨 | 시간 */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-[10px] font-medium text-muted-foreground">{match.league.name}</span>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <MapPin className="w-3 h-3" />
          {venue}
          {weather && (
            <>
              <WeatherIcon condition={weather.condition} />
              {weather.temp}°C
            </>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground">{dateStr} {timeStr}</span>
      </div>

      {/* 팀 정보 */}
      <div className="px-3 py-1.5">
        <div className="flex items-center justify-between">
          {/* 홈팀 */}
          <div className="flex items-center gap-2 flex-1">
            <img src={match.homeTeam.logoUrl || defaultLogo} className="w-8 h-8 object-contain" alt=""
              onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} />
            <div>
              <div className="font-bold text-xs leading-tight">{getTeamDisplayName(match.homeTeam.name, match.homeTeam.shortName)}</div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-red-300 text-red-500">홈</Badge>
                {homeStanding ? (
                  <span className="text-[9px] text-muted-foreground">{homeStanding.rank}위 {homeStanding.won}승{homeStanding.drawn}무{homeStanding.lost}패</span>
                ) : (
                  <span className="text-[9px] text-muted-foreground/50">순위 정보 없음</span>
                )}
              </div>
              {/* ✅ 폼 점 추가 (홈팀) */}
              {homeStanding?.form && (
                <div className="mt-0.5">
                  <FormDotsWithLabel form={homeStanding.form} />
                </div>
              )}
            </div>
          </div>

          {/* VS + 배당 (가운데) */}
          <div className="text-center px-2">
            <div className="text-sm font-black text-muted-foreground/40">VS</div>
            {match.odds && match.odds.home != null && match.odds.draw != null && match.odds.away != null && (
              <div className="mt-0.5 space-y-0.5">
                {/* 해외 배당 + 변동 화살표 */}
                <div className="flex items-center justify-center gap-1 text-[8px]">
                  <span className="text-muted-foreground/60">{isEstimatedOdds ? '추정' : '해외'}</span>
                  <span className="flex items-center">{Number(match.odds.home).toFixed(2)}{!isEstimatedOdds && match.odds.trend && <OddsTrend trend={match.odds.trend.home} />}</span>
                  <span className="text-muted-foreground/40">/</span>
                  <span className="flex items-center">{Number(match.odds.draw).toFixed(2)}{!isEstimatedOdds && match.odds.trend && <OddsTrend trend={match.odds.trend.draw} />}</span>
                  <span className="text-muted-foreground/40">/</span>
                  <span className="flex items-center">{Number(match.odds.away).toFixed(2)}{!isEstimatedOdds && match.odds.trend && <OddsTrend trend={match.odds.trend.away} />}</span>
                </div>
                {/* 국내 배당 */}
                {match.odds.domestic && (
                  <div className="flex items-center justify-center gap-1 text-[8px] text-muted-foreground/70">
                    <span className={(match.odds.domestic as any).isEstimated ? "text-yellow-600/70" : "text-green-600/70"}>
                      {(match.odds.domestic as any).isEstimated ? "국내≈" : "국내"}
                    </span>
                    <span>{Number((match.odds.domestic as any).home).toFixed(2)}</span>
                    <span className="text-muted-foreground/40">/</span>
                    <span>{Number((match.odds.domestic as any).draw).toFixed(2)}</span>
                    <span className="text-muted-foreground/40">/</span>
                    <span>{Number((match.odds.domestic as any).away).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 원정팀 */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="text-right">
              <div className="font-bold text-xs leading-tight">{getTeamDisplayName(match.awayTeam.name, match.awayTeam.shortName)}</div>
              <div className="flex items-center gap-1 justify-end">
                {awayStanding ? (
                  <span className="text-[9px] text-muted-foreground">{awayStanding.rank}위 {awayStanding.won}승{awayStanding.drawn}무{awayStanding.lost}패</span>
                ) : (
                  <span className="text-[9px] text-muted-foreground/50">순위 정보 없음</span>
                )}
                <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-blue-300 text-blue-500">원정</Badge>
              </div>
              {/* ✅ 폼 점 추가 (원정팀) */}
              {awayStanding?.form && (
                <div className="mt-0.5 flex justify-end">
                  <FormDotsWithLabel form={awayStanding.form} />
                </div>
              )}
            </div>
            <img src={match.awayTeam.logoUrl || defaultLogo} className="w-8 h-8 object-contain" alt=""
              onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} />
          </div>
        </div>
      </div>

      {/* 확률 표시 (3등분) */}
      <div className="grid grid-cols-3 border-t border-border/50">
        <div className="py-2.5 text-center border-r border-border/50 hover:bg-red-50 dark:hover:bg-red-900/20">
          <div className="text-base font-black">{prob.home.toFixed(1)}%</div>
          <div className="text-[9px] text-muted-foreground">홈승</div>
        </div>
        <div className="py-2.5 text-center border-r border-border/50 hover:bg-gray-100 dark:hover:bg-gray-800/50">
          <div className="text-base font-black text-muted-foreground">{prob.draw.toFixed(1)}%</div>
          <div className="text-[9px] text-muted-foreground">무승부</div>
        </div>
        <div className="py-2.5 text-center hover:bg-blue-50 dark:hover:bg-blue-900/20">
          <div className="text-base font-black">{prob.away.toFixed(1)}%</div>
          <div className="text-[9px] text-muted-foreground">원정승</div>
        </div>
      </div>

      {/* 하단: 추천 배지 + 배당가치 */}
      {(recommended || valueBet.isValue) && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-t border-border/30">
          <div>
            {recommended && match.v9?.recommendation?.level === 'STRONG' && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] h-5 px-2 shadow-sm">
                🔥 {mlPick.pickName} 강력추천!
              </Badge>
            )}
            {recommended && match.v9?.recommendation?.level === 'MEDIUM' && (
              <Badge className="bg-gradient-to-r from-sky-500 to-blue-500 text-white text-[9px] h-5 px-2 shadow-sm">
                ⭐ {mlPick.pickName} 추천
              </Badge>
            )}
            {recommended && !match.v9?.recommendation && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] h-5 px-2 shadow-sm">
                🔥 {mlPick.pickName} 강력추천!
              </Badge>
            )}
          </div>
          <div>
            {valueBet.isValue && valueBet.ev != null && (
              <span className="text-[10px] font-bold text-green-600">
                💎 배당가치 +{Number(valueBet.ev).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* 상세분석 바 */}
      <div className="flex items-center justify-center gap-1.5 py-2 border-t border-border/50 bg-primary/5 hover:bg-primary/10 transition-colors">
        <Search className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-bold text-primary">상세분석 보기</span>
        <ChevronRight className="w-3.5 h-3.5 text-primary" />
      </div>
    </Card>
  );
}

// ============================================================
// 경기 리스트 아이템 (목록형 - 홈과 동일 구조)
// ============================================================
function MatchListItem({ match, onClick }: { match: Prediction; onClick: () => void }) {
  const kickoff = new Date(match.kickoffAt);
  const timeStr = kickoff.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const defaultLogo = "https://via.placeholder.com/24?text=⚽";

  const prob = getProb(match);
  const recommended = isMatchRecommended(match);
  const homeStanding = match.homeTeam.standing;
  const awayStanding = match.awayTeam.standing;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
        recommended ? 'border-2 border-amber-400/70 bg-card' : 'bg-card border border-border/50 hover:bg-muted/50'
      }`}
      onClick={onClick}
    >
      {/* 시간 */}
      <div className="text-center w-12 flex-shrink-0">
        <div className="text-[10px] text-muted-foreground font-medium">{timeStr}</div>
      </div>

      {/* 팀 정보 */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <img src={match.homeTeam.logoUrl || defaultLogo} className="w-5 h-5 object-contain flex-shrink-0" alt=""
          onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} />
        <span className="font-medium text-xs truncate">{match.homeTeam.shortName || match.homeTeam.name.split(' ')[0]}</span>
        <span className="text-[8px] text-muted-foreground">({homeStanding?.rank ?? '-'}위)</span>
        <span className="text-[10px] text-muted-foreground mx-0.5">vs</span>
        <span className="font-medium text-xs truncate">{match.awayTeam.shortName || match.awayTeam.name.split(' ')[0]}</span>
        <span className="text-[8px] text-muted-foreground">({awayStanding?.rank ?? '-'}위)</span>
        <img src={match.awayTeam.logoUrl || defaultLogo} className="w-5 h-5 object-contain flex-shrink-0" alt=""
          onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} />
      </div>

      {/* 확률 3열 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="w-12 py-1 rounded bg-muted text-center text-[11px] font-bold">{prob.home.toFixed(0)}%</div>
        <div className="w-12 py-1 rounded bg-muted text-center text-[11px] font-bold text-muted-foreground">{prob.draw.toFixed(0)}%</div>
        <div className="w-12 py-1 rounded bg-muted text-center text-[11px] font-bold">{prob.away.toFixed(0)}%</div>
      </div>

      {/* 상세 화살표 */}
      <ChevronRight className="w-4 h-4 text-primary/60 flex-shrink-0" />
    </div>
  );
}

// ============================================================
// 순위표 컴포넌트
// ============================================================
function StandingsTable({ standings, standingsData, leagueConfig }: {
  standings: any[];
  standingsData: any;
  leagueConfig: LeagueConfig | null;
}) {
  return (
    <div className="space-y-2">
      {standingsData?.leagueName && (
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-semibold">
            {leagueConfig?.flag} {standingsData.leagueName}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {standingsData.season}/{(standingsData.season % 100) + 1} 시즌
          </span>
        </div>
      )}

      {leagueConfig && leagueConfig.uclSpots > 0 && (
        <div className="flex gap-3 px-1 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />UCL</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />UEL</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />UECL</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />강등</span>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_24px_24px_24px_36px_36px_40px] gap-0.5 px-2.5 py-2 bg-muted/60 text-[10px] text-muted-foreground font-medium">
          <span className="text-center">#</span>
          <span>팀</span>
          <span className="text-center">승</span>
          <span className="text-center">무</span>
          <span className="text-center">패</span>
          <span className="text-center">득실</span>
          <span className="text-center font-bold">승점</span>
          <span className="text-center">최근</span>
        </div>

        {standings.map((team: any, i: number) => {
          const rank = team.rank || i + 1;
          const zone = getZone(rank, leagueConfig, standings.length);
          const borderColor =
            zone === "ucl" ? "border-l-blue-500" :
            zone === "uel" ? "border-l-orange-500" :
            zone === "uecl" ? "border-l-emerald-500" :
            zone === "relegation" ? "border-l-red-500" :
            "border-l-transparent";

          return (
            <div
              key={team.teamApiId || i}
              className={`grid grid-cols-[28px_1fr_24px_24px_24px_36px_36px_40px] gap-0.5 px-2.5 py-2 text-xs border-t border-border/40 items-center border-l-[3px] ${borderColor}`}
            >
              <span className={`text-center font-mono ${rank <= 3 ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                {rank}
              </span>
              <span className="font-medium truncate">
                {getTeamDisplayName(team.teamName, team.teamShortName)}
              </span>
              <span className="text-center">{team.won ?? "-"}</span>
              <span className="text-center text-muted-foreground">{team.drawn ?? "-"}</span>
              <span className="text-center text-muted-foreground">{team.lost ?? "-"}</span>
              <span className={`text-center text-[11px] ${
                (team.goalsDiff ?? 0) > 0 ? "text-emerald-500" :
                (team.goalsDiff ?? 0) < 0 ? "text-red-400" :
                "text-muted-foreground"
              }`}>
                {team.goalsDiff != null ? (team.goalsDiff > 0 ? `+${team.goalsDiff}` : team.goalsDiff) : "-"}
              </span>
              <span className="text-center font-bold">{team.points ?? "-"}</span>
              <div className="flex justify-center">
                <FormDotsWithLabel form={team.form} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getZone(
  rank: number, config: LeagueConfig | null, totalTeams: number
): "ucl" | "uel" | "uecl" | "relegation" | "none" {
  if (!config) return "none";
  if (rank <= config.uclSpots) return "ucl";
  if (rank <= config.uclSpots + config.uelSpots) return "uel";
  if (rank <= config.uclSpots + config.uelSpots + config.ueclSpots) return "uecl";
  if (config.relegationSpots > 0 && rank > totalTeams - config.relegationSpots) return "relegation";
  return "none";
}
