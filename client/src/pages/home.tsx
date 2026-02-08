import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Sparkles, Brain, Trophy, Calendar, Target, Filter, TrendingUp, HelpCircle, X, MapPin, Cloud, Sun, CloudRain, Snowflake, ArrowUp, ArrowDown, Minus, Check, ShoppingCart, LayoutGrid, List, ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";

// 팀 한글명 매핑
const TEAM_NAMES_KR: Record<string, string> = {
  "Manchester United": "맨체스터 유나이티드",
  "Manchester City": "맨체스터 시티",
  "Liverpool": "리버풀",
  "Chelsea": "첼시",
  "Arsenal": "아스널",
  "Tottenham": "토트넘",
  "Newcastle": "뉴캐슬",
  "West Ham": "웨스트햄",
  "Brighton": "브라이튼",
  "Aston Villa": "애스턴 빌라",
  "Fulham": "풀럼",
  "Brentford": "브렌트포드",
  "Crystal Palace": "크리스탈 팰리스",
  "Wolves": "울버햄튼",
  "Everton": "에버튼",
  "Nottingham Forest": "노팅엄 포레스트",
  "Bournemouth": "본머스",
  "Burnley": "번리",
  "Sheffield United": "셰필드",
  "Luton": "루턴",
  "Leeds": "리즈",
  "Leicester": "레스터",
  "Southampton": "사우샘프턴",
  "Sunderland": "선덜랜드",
  "Ipswich": "입스위치",
  "Real Madrid": "레알 마드리드",
  "Barcelona": "바르셀로나",
  "Atletico Madrid": "아틀레티코 마드리드",
  "Athletic Club": "아틀레틱 빌바오",
  "Real Sociedad": "레알 소시에다드",
  "Real Betis": "레알 베티스",
  "Villarreal": "비야레알",
  "Valencia": "발렌시아",
  "Sevilla": "세비야",
  "Celta Vigo": "셀타 비고",
  "Osasuna": "오사수나",
  "Getafe": "헤타페",
  "Girona": "지로나",
  "Mallorca": "마요르카",
  "Rayo Vallecano": "라요 바예카노",
  "Las Palmas": "라스팔마스",
  "Alaves": "알라베스",
  "Cadiz": "카디스",
  "Granada": "그라나다",
  "Almeria": "알메리아",
  "Elche": "엘체",
  "Oviedo": "오비에도",
  "Leganes": "레가네스",
  "Espanyol": "에스파뇰",
  "Valladolid": "바야돌리드",
  "Bayern Munich": "바이에른 뮌헨",
  "Borussia Dortmund": "도르트문트",
  "RB Leipzig": "RB 라이프치히",
  "Bayer Leverkusen": "레버쿠젠",
  "Union Berlin": "우니온 베를린",
  "Eintracht Frankfurt": "프랑크푸르트",
  "VfL Wolfsburg": "볼프스부르크",
  "Borussia Monchengladbach": "묀헨글라트바흐",
  "Werder Bremen": "베르더 브레멘",
  "SC Freiburg": "프라이부르크",
  "FC Augsburg": "아우크스부르크",
  "VfB Stuttgart": "슈투트가르트",
  "1. FC Köln": "쾰른",
  "TSG Hoffenheim": "호펜하임",
  "FSV Mainz 05": "마인츠",
  "VfL Bochum": "보훔",
  "1. FC Heidenheim": "하이덴하임",
  "SV Darmstadt 98": "다름슈타트",
  "FC St. Pauli": "장크트파울리",
  "Hamburger SV": "함부르크",
  "Holstein Kiel": "홀슈타인 킬",
  "Inter": "인테르",
  "AC Milan": "AC 밀란",
  "Juventus": "유벤투스",
  "Napoli": "나폴리",
  "Roma": "로마",
  "Lazio": "라치오",
  "Atalanta": "아탈란타",
  "Fiorentina": "피오렌티나",
  "Bologna": "볼로냐",
  "Torino": "토리노",
  "Monza": "몬자",
  "Udinese": "우디네세",
  "Sassuolo": "사수올로",
  "Empoli": "엠폴리",
  "Cagliari": "칼리아리",
  "Verona": "베로나",
  "Lecce": "레체",
  "Genoa": "제노아",
  "Salernitana": "살레르니타나",
  "Frosinone": "프로시노네",
  "Como": "코모",
  "Parma": "파르마",
  "Venezia": "베네치아",
  "Pisa": "피사",
  "Paris Saint Germain": "파리 생제르맹",
  "PSG": "파리 생제르맹",
  "Marseille": "마르세유",
  "Monaco": "모나코",
  "Lyon": "리옹",
  "Lille": "릴",
  "Nice": "니스",
  "Lens": "랑스",
  "Rennes": "렌",
  "Montpellier": "몽펠리에",
  "Nantes": "낭트",
  "Strasbourg": "스트라스부르",
  "Toulouse": "툴루즈",
  "Reims": "랭스",
  "Brest": "브레스트",
  "Lorient": "로리앙",
  "Clermont": "클레르몽",
  "Metz": "메츠",
  "Le Havre": "르아브르",
  "Auxerre": "오세르",
  "Angers": "앙제",
  "Saint-Etienne": "생테티엔",
  "St Etienne": "생테티엔",
  // API-Football 이름 변형 추가
  "Paris Saint-Germain": "파리 생제르맹",
  "Bayern München": "바이에른 뮌헨",
  "FC Bayern München": "바이에른 뮌헨",
  "FC Bayern Munich": "바이에른 뮌헨",
  "Borussia Mönchengladbach": "묀헨글라트바흐",
  "1. FC Koln": "쾰른",
  "1.FC Köln": "쾰른",
  "Mainz 05": "마인츠",
  "1. FSV Mainz 05": "마인츠",
  "Bayer 04 Leverkusen": "레버쿠젠",
  "SC Freiburg": "프라이부르크",
  "Freiburg": "프라이부르크",
  "Manchester Utd": "맨체스터 유나이티드",
  "Man United": "맨체스터 유나이티드",
  "Man City": "맨체스터 시티",
  "Tottenham Hotspur": "토트넘",
  "Wolverhampton Wanderers": "울버햄튼",
  "Wolverhampton": "울버햄튼",
  "West Ham United": "웨스트햄",
  "Brighton & Hove Albion": "브라이튼",
  "Brighton and Hove Albion": "브라이튼",
  "Nottingham": "노팅엄 포레스트",
  "Nott'm Forest": "노팅엄 포레스트",
  "Sheffield Utd": "셰필드",
  "Luton Town": "루턴",
  "Ipswich Town": "입스위치",
  "Leicester City": "레스터",
  "Inter Milan": "인테르",
  "Internazionale": "인테르",
  "FC Internazionale": "인테르",
  "AC Milan": "AC 밀란",
  "Milan": "AC 밀란",
  "AS Roma": "로마",
  "SS Lazio": "라치오",
  "Atalanta BC": "아탈란타",
  "ACF Fiorentina": "피오렌티나",
  "Bologna FC": "볼로냐",
  "Torino FC": "토리노",
  "Hellas Verona": "베로나",
  "US Lecce": "레체",
  "Genoa CFC": "제노아",
  "Atletico de Madrid": "아틀레티코 마드리드",
  "Atlético Madrid": "아틀레티코 마드리드",
  "Athletic Bilbao": "아틀레틱 빌바오",
  "Celta de Vigo": "셀타 비고",
  "RCD Mallorca": "마요르카",
  "Deportivo Alaves": "알라베스",
  "CD Leganes": "레가네스",
  "RCD Espanyol": "에스파뇰",
  "Real Valladolid": "바야돌리드",
  "Olympique Marseille": "마르세유",
  "Olympique de Marseille": "마르세유",
  "AS Monaco": "모나코",
  "Olympique Lyonnais": "리옹",
  "Olympique Lyon": "리옹",
  "LOSC Lille": "릴",
  "OGC Nice": "니스",
  "RC Lens": "랑스",
  "Stade Rennais": "렌",
  "Stade de Reims": "랭스",
  "Stade Brestois 29": "브레스트",
  "FC Lorient": "로리앙",
  "Clermont Foot": "클레르몽",
  "FC Metz": "메츠",
  "SC Bastia": "바스티아",
  "RC Strasbourg Alsace": "스트라스부르",
  "Strasbourg": "스트라스부르",
  "Toulouse FC": "툴루즈",
  "FC Nantes": "낭트",
  "Montpellier HSC": "몽펠리에",
  "Le Havre AC": "르아브르",
  "AJ Auxerre": "오세르",
  "Angers SCO": "앙제",
  "US Sassuolo": "사수올로",
  "Sassuolo Calcio": "사수올로",
  "Newcastle United": "뉴캐슬",
  "Crystal Palace FC": "크리스탈 팰리스",
};

const LEAGUES = [
  { id: "all", name: "전체", apiIds: [] },
  { id: "epl", name: "EPL", apiIds: [39, 313] },
  { id: "laliga", name: "라리가", apiIds: [140, 328] },
  { id: "bundesliga", name: "분데스", apiIds: [78, 391] },
  { id: "seriea", name: "세리에A", apiIds: [135, 410] },
  { id: "ligue1", name: "리그1", apiIds: [61, 366] },
  { id: "ucl", name: "UCL", apiIds: [2, 3] },
  { id: "uel", name: "UEL", apiIds: [848, 3] },
];

function getTeamDisplayName(name: string, shortName?: string): string {
  // 1. 정확한 매칭
  let krName = TEAM_NAMES_KR[name];
  
  // 2. 정확 매칭 실패 시 부분 매칭 (API 이름 변형 대응)
  if (!krName) {
    const nameLower = name.toLowerCase();
    for (const [key, value] of Object.entries(TEAM_NAMES_KR)) {
      const keyLower = key.toLowerCase();
      // 키가 이름에 포함되거나, 이름이 키에 포함
      if (nameLower.includes(keyLower) || keyLower.includes(nameLower)) {
        krName = value;
        break;
      }
      // 첫 단어 매칭 (Bayern, Liverpool 등 — 4글자 이상)
      const firstWord = keyLower.split(' ')[0];
      if (firstWord.length >= 4 && nameLower.includes(firstWord)) {
        krName = value;
        break;
      }
    }
  }
  
  // 3. shortName 검증 (숫자만이거나 1글자면 name에서 생성)
  const validShort = shortName && shortName.length >= 2 && !/^\d+$/.test(shortName)
    ? shortName 
    : name.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase() || name.substring(0, 3).toUpperCase();
  
  // 4. 결과 반환
  if (krName) return `${krName}(${validShort})`;
  
  // 한글 매핑 없을 때: 짧은 영어 이름이면 그대로, 길면 축약
  const displayName = name.length <= 15 ? name : validShort;
  return `${displayName}(${validShort})`;
}

// ============================================================
// 설명 팝업 컴포넌트
// ============================================================
function InfoPopup({ title, content, isOpen, onClose }: { 
  title: string; content: string; isOpen: boolean; onClose: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <Card className="max-w-sm p-4 bg-background shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm">{title}</h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{content}</p>
      </Card>
    </div>
  );
}

// ============================================================
// Standing 타입
// ============================================================
interface Standing {
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  form: string | null;
}

// ============================================================
// 폴더 타입 정의
// ============================================================
interface FolderItem {
  fixtureId: string;
  pick: 'home' | 'draw' | 'away';
  pickName: string;
  probability: number;
  homeTeam: string;
  awayTeam: string;
  odds: number;
}

// ============================================================
// V9 인터페이스 정의
// ============================================================
interface V9Analysis {
  mlProb: { home: number; draw: number; away: number; };
  mlPick: { pick: 'home' | 'draw' | 'away'; pickProb: number; pickName: string; };
  recommendation: { level: 'STRONG' | 'MEDIUM' | 'NONE'; stars: number; reason: string; };
  drawWarning: { isClose: boolean; likelihood: number; message: string | null; };
  valueBet: { isValue: boolean; ev: number; message: string | null; };
  isRecommended: boolean;
}

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
    domestic?: { home: number; draw: number; away: number; } | null;
  } | null;
  prediction: {
    homeProb: number; drawProb: number; awayProb: number;
    expectedValue: { home: number; draw: number; away: number; best: string; bestValue: number; };
    isRecommended: boolean; confidence: string;
  };
  v9?: V9Analysis;
  features: { homeForm: number | null; awayForm: number | null; homeWinPct: number | null; h2hHomeWinPct: number | null; restDiff: number | null; h2hMatches: number | null; } | null;
}

// ============================================================
// V9 헬퍼 함수들
// ============================================================
function getProb(match: Prediction) {
  if (match.v9?.mlProb) {
    return { 
      home: match.v9.mlProb.home ?? 33.3, 
      draw: match.v9.mlProb.draw ?? 33.3, 
      away: match.v9.mlProb.away ?? 33.3 
    };
  }
  if (match.prediction?.homeProb !== undefined && match.prediction?.drawProb !== undefined && match.prediction?.awayProb !== undefined) {
    return { 
      home: match.prediction.homeProb, 
      draw: match.prediction.drawProb, 
      away: match.prediction.awayProb 
    };
  }
  // prediction이 없거나 불완전한 경우 기본값
  return { home: 33.3, draw: 33.3, away: 33.3 };
}

// V9 추천 기반으로 판단 (STRONG 또는 MEDIUM)
function isRecommended(match: Prediction): boolean {
  // V9 데이터가 있으면 그걸 기준으로 판단
  if (match.v9?.recommendation) {
    return match.v9.recommendation.level === 'STRONG' || match.v9.recommendation.level === 'MEDIUM';
  }
  // V9 없으면 prediction 필드 확인
  if (match.prediction?.isRecommended !== undefined) {
    return match.prediction.isRecommended;
  }
  // 폴백: 60%+ 이면 추천
  const prob = getProb(match);
  if (prob.home === 33.3 && prob.draw === 33.3 && prob.away === 33.3) return false;
  const maxProb = Math.max(prob.home, prob.draw, prob.away);
  return maxProb >= 60;
}

// ML Pick 가져오기
function getMlPick(match: Prediction) {
  if (match.v9?.mlPick) return match.v9.mlPick;
  const prob = getProb(match);
  if (prob.home >= prob.draw && prob.home >= prob.away) {
    return { pick: 'home' as const, pickProb: prob.home, pickName: '홈승' };
  } else if (prob.away >= prob.home && prob.away >= prob.draw) {
    return { pick: 'away' as const, pickProb: prob.away, pickName: '원정승' };
  }
  return { pick: 'draw' as const, pickProb: prob.draw, pickName: '무승부' };
}

function getValueBet(match: Prediction) {
  return match.v9?.valueBet ?? { isValue: false, ev: 0, message: null };
}

// 날씨 아이콘
function WeatherIcon({ condition }: { condition: string }) {
  const l = (condition || "").toLowerCase();
  if (l.includes('rain') || l.includes('drizzle') || l.includes('shower')) return <CloudRain className="w-3 h-3 text-blue-500" />;
  if (l.includes('snow') || l.includes('sleet') || l.includes('hail')) return <Snowflake className="w-3 h-3 text-cyan-400" />;
  if (l.includes('cloud') || l.includes('overcast') || l.includes('fog') || l.includes('mist')) return <Cloud className="w-3 h-3 text-gray-400" />;
  if (l.includes('storm') || l.includes('thunder')) return <CloudRain className="w-3 h-3 text-purple-500" />;
  return <Sun className="w-3 h-3 text-yellow-500" />;
}

// 배당 변동 화살표 (실제 OddsHistory 기반)
function OddsTrend({ trend }: { trend: 'up' | 'down' | 'same' | undefined | null }) {
  if (!trend || trend === 'same') return <Minus className="w-2.5 h-2.5 text-gray-400 inline" />;
  if (trend === 'up') return <ArrowUp className="w-2.5 h-2.5 text-red-500 inline" />;
  return <ArrowDown className="w-2.5 h-2.5 text-blue-500 inline" />;
}

// 날짜 포맷
function formatDateKey(date: Date): string {
  return date.toLocaleDateString("ko-KR", { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateLabel(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateStr = date.toLocaleDateString("ko-KR", { month: 'long', day: 'numeric', weekday: 'short' });
  
  if (formatDateKey(date) === formatDateKey(today)) {
    return `📅 오늘 (${dateStr})`;
  } else if (formatDateKey(date) === formatDateKey(tomorrow)) {
    return `📅 내일 (${dateStr})`;
  }
  return `📅 ${dateStr}`;
}

// ============================================================
// 경기 카드 (와이드형)
// ============================================================
function MatchCard({ 
  match, 
  onClick, 
  onShowInfo,
  folder,
  onToggleFolder
}: { 
  match: Prediction; 
  onClick: () => void; 
  onShowInfo: (title: string, content: string) => void;
  folder: FolderItem[];
  onToggleFolder: (item: FolderItem) => void;
}) {
  const kickoff = new Date(match.kickoffAt);
  const timeStr = kickoff.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = kickoff.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  const defaultLogo = "https://via.placeholder.com/40?text=⚽";
  
  const prob = getProb(match);
  const recommended = isRecommended(match);
  const mlPick = getMlPick(match);
  const valueBet = getValueBet(match);

  // 실제 데이터 사용 (없으면 기본값)
  const venue = match.venue?.name || "경기장 정보 없음";
  const weather = match.weather?.temp !== null && match.weather?.temp !== undefined 
    ? { temp: match.weather.temp, condition: match.weather.condition || "Unknown" }
    : null;
  
  // 추정 배당 여부 확인
  const isEstimatedOdds = match.odds?.isEstimated === true;

  // 실제 리그 순위 데이터 사용
  const homeStanding = match.homeTeam.standing || null;
  const awayStanding = match.awayTeam.standing || null;

  // 폴더에 담겼는지 확인
  const isInFolder = (pick: 'home' | 'draw' | 'away') => {
    return folder.some(f => f.fixtureId === match.fixtureId && f.pick === pick);
  };

  // 폴더 토글
  const handlePickClick = (e: React.MouseEvent, pick: 'home' | 'draw' | 'away') => {
    e.stopPropagation();
    const pickProb = pick === 'home' ? prob.home : pick === 'away' ? prob.away : prob.draw;
    const pickName = pick === 'home' ? '홈승' : pick === 'away' ? '원정승' : '무승부';
    const oddsValue = match.odds ? (pick === 'home' ? match.odds.home : pick === 'away' ? match.odds.away : match.odds.draw) : null;
    const pickOdds = oddsValue != null ? Number(oddsValue) : 1;
    
    onToggleFolder({
      fixtureId: match.fixtureId,
      pick,
      pickName,
      probability: pickProb,
      homeTeam: match.homeTeam.shortName || match.homeTeam.name,
      awayTeam: match.awayTeam.shortName || match.awayTeam.name,
      odds: pickOdds,
    });
  };

  // 배당가치 설명
  const showValueInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShowInfo(
      "💎 배당가치란?",
      `AI가 분석한 승리 확률과 현재 배당을 비교한 지표입니다.

양수(+)일수록: AI 예측 확률에 비해 배당이 좋음
음수(-)일수록: AI 예측 확률에 비해 배당이 낮음

💡 배당가치가 높을수록 AI 관점에서 매력적인 경기입니다.`
    );
  };

  return (
    <Card 
      className={`overflow-hidden hover:shadow-lg transition-all ${
        recommended ? 'border-amber-400 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-950/30' : 'border-border/50'
      }`}
    >
      {/* 상단: 리그 | 경기장+날씨 | 시간 */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1 cursor-pointer" onClick={onClick}>
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

      {/* 팀 정보 (클릭 시 상세 페이지) */}
      <div className="px-3 py-1.5 cursor-pointer" onClick={onClick}>
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
            </div>
          </div>
          
          {/* VS + 배당 (가운데 - 해외/국내 + 화살표) */}
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
                {/* 국내 배당 (실제: 베트맨 / 추정: 해외배당 환산) */}
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
            </div>
            <img src={match.awayTeam.logoUrl || defaultLogo} className="w-8 h-8 object-contain" alt=""
              onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} />
          </div>
        </div>
      </div>

      {/* 확률 선택 버튼 (3등분) - 클릭 시 폴더 담기 */}
      <div className="grid grid-cols-3 border-t border-border/50">
        {/* 홈 승 */}
        <button
          onClick={(e) => handlePickClick(e, 'home')}
          className={`py-2.5 text-center border-r border-border/50 transition-all active:scale-95 ${
            isInFolder('home') 
              ? 'bg-red-100 dark:bg-red-900/40' 
              : 'hover:bg-red-50 dark:hover:bg-red-900/20'
          }`}
        >
          <div className={`text-base font-black ${isInFolder('home') ? 'text-red-600' : ''}`}>
            {prob.home.toFixed(1)}%
          </div>
          <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">
            홈승
            {isInFolder('home') && <Check className="w-3 h-3 text-red-600" />}
          </div>
        </button>
        
        {/* 무승부 */}
        <button
          onClick={(e) => handlePickClick(e, 'draw')}
          className={`py-2.5 text-center border-r border-border/50 transition-all active:scale-95 ${
            isInFolder('draw') 
              ? 'bg-gray-200 dark:bg-gray-700/50' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-800/50'
          }`}
        >
          <div className={`text-base font-black ${isInFolder('draw') ? 'text-gray-700 dark:text-gray-200' : 'text-muted-foreground'}`}>
            {prob.draw.toFixed(1)}%
          </div>
          <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">
            무승부
            {isInFolder('draw') && <Check className="w-3 h-3 text-gray-600" />}
          </div>
        </button>
        
        {/* 원정 승 */}
        <button
          onClick={(e) => handlePickClick(e, 'away')}
          className={`py-2.5 text-center transition-all active:scale-95 ${
            isInFolder('away') 
              ? 'bg-blue-100 dark:bg-blue-900/40' 
              : 'hover:bg-blue-50 dark:hover:bg-blue-900/20'
          }`}
        >
          <div className={`text-base font-black ${isInFolder('away') ? 'text-blue-600' : ''}`}>
            {prob.away.toFixed(1)}%
          </div>
          <div className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">
            원정승
            {isInFolder('away') && <Check className="w-3 h-3 text-blue-600" />}
          </div>
        </button>
      </div>

      {/* 하단: 추천 배지(왼쪽) + 배당가치(오른쪽) */}
      {(recommended || valueBet.isValue) && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-t border-border/30">
          {/* 추천 배지 (왼쪽) - V9 등급 기반 */}
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
          
          {/* 배당가치 (오른쪽) */}
          <div>
            {valueBet.isValue && valueBet.ev != null && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-green-600">
                  💎 배당가치 +{Number(valueBet.ev).toFixed(1)}%
                </span>
                <button onClick={showValueInfo} className="text-green-600/60 hover:text-green-600 transition-colors">
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// 경기 리스트 아이템 (목록형) - 개선: 배당가치 제거, 버튼 크게, 정렬
// ============================================================
function MatchListItem({ 
  match, 
  onClick, 
  folder,
  onToggleFolder,
  showDate
}: { 
  match: Prediction; 
  onClick: () => void; 
  folder: FolderItem[];
  onToggleFolder: (item: FolderItem) => void;
  showDate?: boolean;
}) {
  const kickoff = new Date(match.kickoffAt);
  const timeStr = kickoff.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = kickoff.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
  const defaultLogo = "https://via.placeholder.com/24?text=⚽";
  
  const prob = getProb(match);
  const recommended = isRecommended(match);

  // 실제 리그 순위 데이터 사용
  const homeStanding = match.homeTeam.standing;
  const awayStanding = match.awayTeam.standing;

  // 폴더에 담겼는지 확인
  const isInFolder = (pick: 'home' | 'draw' | 'away') => {
    return folder.some(f => f.fixtureId === match.fixtureId && f.pick === pick);
  };

  const handlePickClick = (e: React.MouseEvent, pick: 'home' | 'draw' | 'away') => {
    e.stopPropagation();
    const pickProb = pick === 'home' ? prob.home : pick === 'away' ? prob.away : prob.draw;
    const pickName = pick === 'home' ? '홈승' : pick === 'away' ? '원정승' : '무승부';
    const oddsValue = match.odds ? (pick === 'home' ? match.odds.home : pick === 'away' ? match.odds.away : match.odds.draw) : null;
    const pickOdds = oddsValue != null ? Number(oddsValue) : 1;
    
    onToggleFolder({
      fixtureId: match.fixtureId,
      pick,
      pickName,
      probability: pickProb,
      homeTeam: match.homeTeam.shortName || match.homeTeam.name,
      awayTeam: match.awayTeam.shortName || match.awayTeam.name,
      odds: pickOdds,
    });
  };

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
        recommended ? 'border-2 border-amber-400/70 bg-card' : 'bg-card border border-border/50 hover:bg-muted/50'
      }`}
      onClick={onClick}
    >
      {/* 시간/날짜 */}
      <div className="text-center w-16 flex-shrink-0">
        {showDate && <div className="text-[8px] text-muted-foreground">{dateStr}</div>}
        <div className="text-[10px] text-muted-foreground font-medium">{timeStr}</div>
      </div>
      
      {/* 팀 정보 */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <img src={match.homeTeam.logoUrl || defaultLogo} className="w-5 h-5 object-contain flex-shrink-0" alt=""
          onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} />
        <span className="font-medium text-xs truncate">{match.homeTeam.shortName}</span>
        <span className="text-[8px] text-muted-foreground">({homeStanding?.rank ?? '-'}위)</span>
        <span className="text-[10px] text-muted-foreground mx-0.5">vs</span>
        <span className="font-medium text-xs truncate">{match.awayTeam.shortName}</span>
        <span className="text-[8px] text-muted-foreground">({awayStanding?.rank ?? '-'}위)</span>
        <img src={match.awayTeam.logoUrl || defaultLogo} className="w-5 h-5 object-contain flex-shrink-0" alt=""
          onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} />
      </div>

      {/* 승무패 확률 + 선택 - 고정 너비로 오와열 맞춤, 사이즈 키움 */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button 
          onClick={(e) => handlePickClick(e, 'home')}
          className={`w-14 py-1.5 rounded text-[11px] font-bold transition-all text-center ${
            isInFolder('home') 
              ? 'bg-red-500 text-white' 
              : 'bg-muted hover:bg-red-100 dark:hover:bg-red-900/30'
          }`}
        >
          {prob.home.toFixed(0)}%
        </button>
        <button 
          onClick={(e) => handlePickClick(e, 'draw')}
          className={`w-14 py-1.5 rounded text-[11px] font-bold transition-all text-center ${
            isInFolder('draw') 
              ? 'bg-gray-500 text-white' 
              : 'bg-muted hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {prob.draw.toFixed(0)}%
        </button>
        <button 
          onClick={(e) => handlePickClick(e, 'away')}
          className={`w-14 py-1.5 rounded text-[11px] font-bold transition-all text-center ${
            isInFolder('away') 
              ? 'bg-blue-500 text-white' 
              : 'bg-muted hover:bg-blue-100 dark:hover:bg-blue-900/30'
          }`}
        >
          {prob.away.toFixed(0)}%
        </button>
      </div>
    </div>
  );
}

// 로딩 스켈레톤
function LoadingSkeleton({ viewMode }: { viewMode: 'card' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Skeleton className="h-[100px] w-full rounded-xl" />
      <Skeleton className="h-[160px] w-full rounded-lg" />
      <Skeleton className="h-[160px] w-full rounded-lg" />
    </div>
  );
}

// 통계 카드 - 단순화 (나중에 실제 데이터 연동)
function StatsCard({ onShowInfo }: { onShowInfo: (title: string, content: string) => void }) {
  const showAccuracyInfo = () => {
    onShowInfo(
      "📊 적중률이란?",
      `AI 모델이 추천한 경기가 실제로 맞은 비율입니다.

지난 주 AI가 강력추천한 경기들의 실제 적중률을 보여드립니다.

💡 숫자가 높을수록 AI 예측이 정확했다는 의미입니다.

※ 과거 데이터 기반 결과이며, 미래 결과를 보장하지 않습니다.`
    );
  };

  return (
    <Card className="p-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="font-bold text-xs">AI 분석 성과</span>
        </div>
        <button onClick={showAccuracyInfo} className="text-muted-foreground hover:text-foreground transition-colors">
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <div className="text-2xl font-black text-primary">71%</div>
          <div className="text-[9px] text-muted-foreground">60%+ 추천 적중률 (백테스트)</div>
        </div>
        <div className="text-center flex-1 border-l border-border/50">
          <div className="text-2xl font-black text-muted-foreground">V9</div>
          <div className="text-[9px] text-muted-foreground">AI 모델 버전</div>
        </div>
      </div>
    </Card>
  );
}

// 폴더 FAB (플로팅 버튼)
function FolderFAB({ folder, onClick }: { folder: FolderItem[]; onClick: () => void }) {
  if (folder.length === 0) return null;
  
  const totalProb = folder.reduce((acc, item) => acc * ((item.probability || 33.3) / 100), 1) * 100;
  const totalOdds = folder.reduce((acc, item) => acc * (item.odds || 1), 1);

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-4 z-40 bg-primary text-primary-foreground rounded-2xl shadow-xl px-4 py-2.5 flex items-center gap-3 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
    >
      <div className="relative">
        <ShoppingCart className="w-5 h-5" />
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
          {folder.length}
        </span>
      </div>
      <div className="text-left border-l border-primary-foreground/30 pl-3">
        <div className="text-xs font-bold">{folder.length}폴더</div>
        <div className="text-[9px] opacity-80">
          적중 {isNaN(totalProb) ? '0.0' : totalProb.toFixed(1)}% · {isNaN(totalOdds) ? '1.00' : totalOdds.toFixed(2)}배
        </div>
      </div>
    </button>
  );
}

// 폴더 상세 모달
function FolderModal({ 
  folder, 
  isOpen, 
  onClose,
  onRemove,
  onClear
}: { 
  folder: FolderItem[]; 
  isOpen: boolean; 
  onClose: () => void;
  onRemove: (fixtureId: string, pick: string) => void;
  onClear: () => void;
}) {
  if (!isOpen) return null;
  
  const totalProb = folder.reduce((acc, item) => acc * ((item.probability || 33.3) / 100), 1) * 100;
  const totalOdds = folder.reduce((acc, item) => acc * (item.odds || 1), 1);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <Card className="w-full max-w-lg rounded-t-3xl rounded-b-none p-4 bg-background shadow-2xl max-h-[80vh] overflow-auto" 
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            내 조합 ({folder.length}경기)
          </h3>
          <div className="flex items-center gap-2">
            {folder.length > 0 && (
              <Button variant="ghost" size="sm" className="text-red-500 text-xs h-7" onClick={onClear}>
                전체 삭제
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {folder.length === 0 ? (
          <div className="text-center py-10">
            <ShoppingCart className="w-14 h-14 mx-auto text-muted-foreground/20 mb-2" />
            <p className="text-muted-foreground text-sm">경기를 선택해서 조합을 만들어보세요</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">홈승/무/원정승 버튼을 클릭하면 담깁니다</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 mb-3">
              {folder.map((item, idx) => (
                <div key={`${item.fixtureId}-${item.pick}`} 
                  className="flex items-center justify-between p-2.5 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground w-4">{idx + 1}</span>
                    <div>
                      <div className="text-xs font-medium">
                        {item.homeTeam} vs {item.awayTeam}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[8px] h-3.5 px-1">
                          {item.pickName}
                        </Badge>
                        <span>{(item.probability || 0).toFixed(1)}%</span>
                        <span>·</span>
                        <span>{(item.odds || 1).toFixed(2)}배</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500"
                    onClick={() => onRemove(item.fixtureId, item.pick)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1">조합 분석 결과</div>
              <div className="text-2xl font-black text-primary mb-0.5">
                {isNaN(totalProb) ? '0.00' : totalProb.toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground">
                적중 시 배당 <span className="font-bold text-foreground">{isNaN(totalOdds) ? '1.00' : totalOdds.toFixed(2)}배</span>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// 날짜별 그룹화 헬퍼
// ============================================================
function groupByDate(matches: Prediction[]): Map<string, Prediction[]> {
  const groups = new Map<string, Prediction[]>();
  
  matches.forEach(match => {
    const date = new Date(match.kickoffAt);
    const key = formatDateKey(date);
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(match);
  });
  
  return groups;
}

export default function Home() {
  const [, navigate] = useLocation();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "recommend">("all");
  const [leagueFilter, setLeagueFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [sortBy, setSortBy] = useState<'time' | 'ev'>('time');
  
  const [infoPopup, setInfoPopup] = useState<{ title: string; content: string } | null>(null);
  const [folder, setFolder] = useState<FolderItem[]>([]);
  const [folderModalOpen, setFolderModalOpen] = useState(false);

  const showInfo = (title: string, content: string) => setInfoPopup({ title, content });
  const closeInfo = () => setInfoPopup(null);

  const toggleFolder = (item: FolderItem) => {
    setFolder(prev => {
      const exists = prev.find(f => f.fixtureId === item.fixtureId && f.pick === item.pick);
      if (exists) return prev.filter(f => !(f.fixtureId === item.fixtureId && f.pick === item.pick));
      return [...prev.filter(f => f.fixtureId !== item.fixtureId), item];
    });
  };

  const removeFromFolder = (fixtureId: string, pick: string) => {
    setFolder(prev => prev.filter(f => !(f.fixtureId === fixtureId && f.pick === pick)));
  };

  const clearFolder = () => setFolder([]);

  useEffect(() => { fetchPredictions(); }, []);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/predictions/upcoming?days=7&limit=100");
      const data = await res.json();
      if (data.ok) setPredictions(data.data);
      else setError(data.error);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 리그 필터
  const leagueFilteredMatches = predictions.filter(p => {
    if (leagueFilter === "all") return true;
    const league = LEAGUES.find(l => l.id === leagueFilter);
    if (!league) return true;
    return league.apiIds.some(apiId => 
      p.league.id === apiId.toString() || p.league.name.toLowerCase().includes(league.id)
    );
  });

  // 조건 필터 (전체 / AI추천 - 60% 이상만)
  const conditionFilteredMatches = leagueFilteredMatches.filter(p => {
    if (filter === "recommend") return isRecommended(p);
    return true;
  });

  // 정렬
  const sortedMatches = [...conditionFilteredMatches].sort((a, b) => {
    if (sortBy === 'ev') {
      const evA = getValueBet(a).ev;
      const evB = getValueBet(b).ev;
      return evB - evA;
    }
    return new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();
  });

  // 날짜별 그룹화
  const groupedMatches = groupByDate(sortedMatches);

  const recommendCount = leagueFilteredMatches.filter(p => isRecommended(p)).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      <InfoPopup title={infoPopup?.title ?? ''} content={infoPopup?.content ?? ''} isOpen={!!infoPopup} onClose={closeInfo} />
      <FolderModal folder={folder} isOpen={folderModalOpen} onClose={() => setFolderModalOpen(false)} onRemove={removeFromFolder} onClear={clearFolder} />
      <FolderFAB folder={folder} onClick={() => setFolderModalOpen(true)} />
      
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between">
          <h1 className="font-black text-lg flex items-center gap-1.5 text-primary tracking-tight">
            <Brain className="w-5 h-5" />
            Soccer Brain
          </h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-3">
        <StatsCard onShowInfo={showInfo} />

        {/* 리그 필터 */}
        <div className="mt-3 flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {LEAGUES.map(league => (
            <Button key={league.id} variant={leagueFilter === league.id ? "default" : "outline"} size="sm"
              onClick={() => setLeagueFilter(league.id)}
              className={`text-[10px] h-7 px-2.5 whitespace-nowrap flex-shrink-0 ${leagueFilter === league.id ? "bg-primary" : "border-muted-foreground/30"}`}>
              {league.name}
            </Button>
          ))}
        </div>

        {/* 조건 필터 + 뷰/정렬 토글 (간소화: 전체 + AI추천만) */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")} className="text-[10px] h-6 px-2">
              전체 ({leagueFilteredMatches.length})
            </Button>
            <Button variant={filter === "recommend" ? "default" : "outline"} size="sm" onClick={() => setFilter("recommend")}
              className={`text-[10px] h-6 px-2 ${filter === "recommend" ? "bg-amber-500 hover:bg-amber-600" : "border-amber-300 text-amber-600 hover:bg-amber-50"}`}>
              <TrendingUp className="w-3 h-3 mr-0.5" />AI 추천 ({recommendCount})
            </Button>
          </div>
          
          {/* 정렬 & 뷰 모드 토글 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSortBy(s => s === 'time' ? 'ev' : 'time')} 
              className="h-6 px-1.5 text-[10px]"
              title={sortBy === 'time' ? '배당가치순으로 정렬' : '시간순으로 정렬'}
            >
              <ArrowUpDown className="w-3.5 h-3.5 mr-0.5" />
              {sortBy === 'time' ? '시간' : '가치'}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode(v => v === 'card' ? 'list' : 'card')} 
              className="h-6 w-6"
              title={viewMode === 'card' ? '목록형으로 보기' : '카드형으로 보기'}
            >
              {viewMode === 'card' ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {loading && <div className="mt-4"><LoadingSkeleton viewMode={viewMode} /></div>}

        {error && (
          <Card className="mt-4 p-3 border-red-200 bg-red-50">
            <p className="text-red-600 text-xs">{error}</p>
            <Button variant="outline" size="sm" className="mt-2 h-7" onClick={fetchPredictions}>다시 시도</Button>
          </Card>
        )}

        {filter === "recommend" && !loading && (
          <Card className="mt-3 p-2.5 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs">
              <Sparkles className="w-3.5 h-3.5" /><span className="font-bold">V9 AI 추천 경기</span>
            </div>
            <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
              🔥 강력추천 (60%+) · ⭐ 추천 (55%+ & 배당가치 양수)
            </p>
          </Card>
        )}

        {/* 날짜별 경기 목록 */}
        {!loading && sortedMatches.length > 0 && (
          <section className="mt-3">
            {Array.from(groupedMatches.entries()).map(([dateKey, matches]) => (
              <div key={dateKey} className="mb-4">
                {/* 날짜 헤더 */}
                <h2 className="text-xs font-bold flex items-center gap-1.5 mb-2 text-muted-foreground sticky top-12 bg-background/95 py-1 z-10">
                  {formatDateLabel(new Date(matches[0].kickoffAt))} ({matches.length}경기)
                </h2>
                
                {viewMode === 'card' ? (
                  <div className="space-y-2.5">
                    {matches.map(match => (
                      <MatchCard 
                        key={match.fixtureId} 
                        match={match} 
                        onClick={() => navigate(`/match/${match.fixtureId}`)}
                        onShowInfo={showInfo}
                        folder={folder}
                        onToggleFolder={toggleFolder}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {matches.map(match => (
                      <MatchListItem 
                        key={match.fixtureId} 
                        match={match} 
                        onClick={() => navigate(`/match/${match.fixtureId}`)}
                        folder={folder}
                        onToggleFolder={toggleFolder}
                        showDate={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {!loading && sortedMatches.length === 0 && !error && (
          <Card className="mt-4 p-6 text-center">
            <Filter className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground text-sm">조건에 맞는 경기가 없습니다</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setFilter("all")}>전체 보기</Button>
          </Card>
        )}
      </main>
    </div>
  );
}
