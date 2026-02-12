// ============================================================
// 팀 한글명 매핑 (중앙화)
// ============================================================
export const TEAM_NAMES_KR: Record<string, string> = {
  // EPL
  "Manchester United": "맨유", "Manchester City": "맨시티", "Liverpool": "리버풀",
  "Chelsea": "첼시", "Arsenal": "아스널", "Tottenham": "토트넘", "Newcastle": "뉴캐슬",
  "West Ham": "웨스트햄", "Brighton": "브라이튼", "Aston Villa": "애스턴 빌라",
  "Fulham": "풀럼", "Brentford": "브렌트포드", "Crystal Palace": "크리스탈 팰리스",
  "Wolves": "울버햄튼", "Everton": "에버튼", "Nottingham Forest": "노팅엄",
  "Bournemouth": "본머스", "Burnley": "번리", "Sheffield United": "셰필드",
  "Luton": "루턴", "Leeds": "리즈", "Leicester": "레스터", "Southampton": "사우샘프턴",
  "Sunderland": "선덜랜드", "Ipswich": "입스위치",
  // La Liga
  "Real Madrid": "레알 마드리드", "Barcelona": "바르셀로나",
  "Atletico Madrid": "아틀레티코", "Athletic Club": "빌바오",
  "Real Sociedad": "소시에다드", "Real Betis": "베티스", "Villarreal": "비야레알",
  "Valencia": "발렌시아", "Sevilla": "세비야", "Celta Vigo": "셀타",
  "Osasuna": "오사수나", "Getafe": "헤타페", "Girona": "지로나",
  "Mallorca": "마요르카", "Rayo Vallecano": "라요", "Las Palmas": "라스팔마스",
  "Alaves": "알라베스", "Cadiz": "카디스", "Granada": "그라나다",
  "Almeria": "알메리아", "Leganes": "레가네스", "Espanyol": "에스파뇰",
  "Valladolid": "바야돌리드",
  // Bundesliga
  "Bayern Munich": "바이에른", "Borussia Dortmund": "도르트문트",
  "RB Leipzig": "라이프치히", "Bayer Leverkusen": "레버쿠젠",
  "Union Berlin": "우니온 베를린", "Eintracht Frankfurt": "프랑크푸르트",
  "VfL Wolfsburg": "볼프스부르크", "Borussia Monchengladbach": "묀헨글라트바흐",
  "Werder Bremen": "브레멘", "SC Freiburg": "프라이부르크",
  "FC Augsburg": "아우크스부르크", "VfB Stuttgart": "슈투트가르트",
  "1. FC Köln": "쾰른", "TSG Hoffenheim": "호펜하임", "FSV Mainz 05": "마인츠",
  "VfL Bochum": "보훔", "1. FC Heidenheim": "하이덴하임",
  "SV Darmstadt 98": "다름슈타트", "FC St. Pauli": "장크트파울리",
  "Holstein Kiel": "킬",
  // Serie A
  "Inter": "인테르", "AC Milan": "AC밀란", "Juventus": "유벤투스",
  "Napoli": "나폴리", "Roma": "로마", "Lazio": "라치오", "Atalanta": "아탈란타",
  "Fiorentina": "피오렌티나", "Bologna": "볼로냐", "Torino": "토리노",
  "Monza": "몬자", "Udinese": "우디네세", "Sassuolo": "사수올로",
  "Empoli": "엠폴리", "Cagliari": "칼리아리", "Verona": "베로나",
  "Lecce": "레체", "Genoa": "제노아", "Como": "코모", "Parma": "파르마",
  "Venezia": "베네치아",
  // Ligue 1
  "Paris Saint Germain": "PSG", "Marseille": "마르세유", "Monaco": "모나코",
  "Lyon": "리옹", "Lille": "릴", "Nice": "니스", "Lens": "랑스", "Rennes": "렌",
  "Montpellier": "몽펠리에", "Nantes": "낭트", "Strasbourg": "스트라스부르",
  "Toulouse": "툴루즈", "Reims": "랭스", "Brest": "브레스트", "Le Havre": "르아브르",
  "Auxerre": "오세르", "Angers": "앙제", "Saint-Etienne": "생테티엔",
  // API-Football 이름 변형
  "Paris Saint-Germain": "PSG", "Bayern München": "바이에른",
  "FC Bayern München": "바이에른", "FC Bayern Munich": "바이에른",
  "Borussia Mönchengladbach": "묀헨글라트바흐", "1. FC Koln": "쾰른",
  "Mainz 05": "마인츠", "Bayer 04 Leverkusen": "레버쿠젠",
  "Freiburg": "프라이부르크", "Manchester Utd": "맨유", "Man United": "맨유",
  "Man City": "맨시티", "Tottenham Hotspur": "토트넘",
  "Wolverhampton Wanderers": "울버햄튼", "Wolverhampton": "울버햄튼",
  "West Ham United": "웨스트햄", "Brighton & Hove Albion": "브라이튼",
  "Brighton and Hove Albion": "브라이튼", "Nottingham": "노팅엄",
  "Nott'm Forest": "노팅엄", "Sheffield Utd": "셰필드", "Luton Town": "루턴",
  "Ipswich Town": "입스위치", "Leicester City": "레스터",
  "Inter Milan": "인테르", "Internazionale": "인테르", "FC Internazionale": "인테르",
  "Milan": "AC밀란", "AS Roma": "로마", "SS Lazio": "라치오",
  "Atletico de Madrid": "아틀레티코", "Atlético Madrid": "아틀레티코",
  "Athletic Bilbao": "빌바오", "Celta de Vigo": "셀타",
  "Newcastle United": "뉴캐슬", "Crystal Palace FC": "크리스탈 팰리스",
  "Olympique Marseille": "마르세유", "AS Monaco": "모나코",
  "Olympique Lyonnais": "리옹", "LOSC Lille": "릴", "OGC Nice": "니스",
  "RC Lens": "랑스", "Stade Rennais": "렌", "Stade de Reims": "랭스",
  "Stade Brestois 29": "브레스트", "RC Strasbourg Alsace": "스트라스부르",
  "Toulouse FC": "툴루즈", "FC Nantes": "낭트", "Montpellier HSC": "몽펠리에",
  "Le Havre AC": "르아브르", "AJ Auxerre": "오세르", "Angers SCO": "앙제",
  "St Etienne": "생테티엔",
};

// ============================================================
// 리그 정의
// ============================================================
export interface LeagueDef {
  id: string;
  name: string;
  shortName: string;
  apiIds: number[];
  country: string;
  isPopular: boolean;
}

export const LEAGUES: LeagueDef[] = [
  { id: "epl", name: "프리미어리그", shortName: "EPL", apiIds: [39], country: "England", isPopular: true },
  { id: "laliga", name: "라리가", shortName: "라리가", apiIds: [140], country: "Spain", isPopular: true },
  { id: "bundesliga", name: "분데스리가", shortName: "분데스", apiIds: [78], country: "Germany", isPopular: true },
  { id: "seriea", name: "세리에A", shortName: "세리에", apiIds: [135], country: "Italy", isPopular: true },
  { id: "ligue1", name: "리그1", shortName: "리그1", apiIds: [61], country: "France", isPopular: true },
  { id: "kleague1", name: "K리그1", shortName: "K1", apiIds: [292], country: "Korea", isPopular: true },
  { id: "kleague2", name: "K리그2", shortName: "K2", apiIds: [293], country: "Korea", isPopular: true },
  { id: "ucl", name: "챔피언스리그", shortName: "UCL", apiIds: [2], country: "Europe", isPopular: false },
  { id: "uel", name: "유로파리그", shortName: "UEL", apiIds: [3], country: "Europe", isPopular: false },
  { id: "uecl", name: "컨퍼런스리그", shortName: "UECL", apiIds: [848], country: "Europe", isPopular: false },
  { id: "jleague", name: "J1리그", shortName: "J1", apiIds: [98], country: "Japan", isPopular: false },
  { id: "eredivisie", name: "에레디비시", shortName: "에레", apiIds: [88], country: "Netherlands", isPopular: false },
  { id: "liga_portugal", name: "포르투갈", shortName: "포르", apiIds: [94], country: "Portugal", isPopular: false },
  { id: "championship", name: "챔피언십", shortName: "ELC", apiIds: [40], country: "England", isPopular: false },
];

export const POPULAR_LEAGUE_API_IDS = LEAGUES.filter(l => l.isPopular).flatMap(l => l.apiIds);

// ============================================================
// 팀명 표시 유틸
// ============================================================
export function getTeamName(name: string): string {
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
  return krName || name;
}

export function getLeagueShortName(leagueName: string, country?: string | null): string {
  const found = LEAGUES.find(l => 
    l.apiIds.some(id => leagueName.includes(String(id))) ||
    leagueName.toLowerCase().includes(l.name.toLowerCase()) ||
    (country && l.country.toLowerCase() === country.toLowerCase())
  );
  return found?.shortName || leagueName.substring(0, 4);
}

export function getLeagueByApiId(apiId: number): LeagueDef | undefined {
  return LEAGUES.find(l => l.apiIds.includes(apiId));
}
