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
  "Bournemouth": "본머스", "Burnley": "번리", "Sheffield United": "셰필드 유나이티드",
  "Luton": "루턴", "Leeds": "리즈", "Leicester": "레스터", "Southampton": "사우샘프턴",
  "Sunderland": "선덜랜드", "Ipswich": "입스위치",
  // Championship
  "Birmingham": "버밍엄", "Blackburn": "블랙번", "Bristol City": "브리스톨 시티",
  "Charlton": "찰턴", "Coventry": "코번트리", "Derby": "더비", "Hull City": "헐 시티",
  "Middlesbrough": "미들즈브러", "Millwall": "밀월", "Norwich": "노리치",
  "Oxford United": "옥스퍼드", "Portsmouth": "포츠머스", "Preston": "프레스턴",
  "QPR": "QPR", "Sheffield Wednesday": "셰필드 W", "Stoke City": "스토크",
  "Swansea": "스완지", "Watford": "왓포드", "West Brom": "웨스트브롬", "Wrexham": "렉섬",
  // La Liga
  "Real Madrid": "레알 마드리드", "Barcelona": "바르셀로나",
  "Atletico Madrid": "아틀레티코", "Athletic Club": "빌바오",
  "Real Sociedad": "소시에다드", "Real Betis": "베티스", "Villarreal": "비야레알",
  "Valencia": "발렌시아", "Sevilla": "세비야", "Celta Vigo": "셀타",
  "Osasuna": "오사수나", "Getafe": "헤타페", "Girona": "지로나",
  "Mallorca": "마요르카", "Rayo Vallecano": "라요", "Las Palmas": "라스팔마스",
  "Alaves": "알라베스", "Cadiz": "카디스", "Granada": "그라나다",
  "Almeria": "알메리아", "Leganes": "레가네스", "Espanyol": "에스파뇰",
  "Valladolid": "바야돌리드", "Levante": "레반테", "Elche": "엘체", "Oviedo": "오비에도",
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
  "Holstein Kiel": "킬", "1899 Hoffenheim": "호펜하임", "Hamburger SV": "함부르크",
  // Serie A
  "Inter": "인테르", "AC Milan": "AC밀란", "Juventus": "유벤투스",
  "Napoli": "나폴리", "Roma": "로마", "Lazio": "라치오", "Atalanta": "아탈란타",
  "Fiorentina": "피오렌티나", "Bologna": "볼로냐", "Torino": "토리노",
  "Monza": "몬자", "Udinese": "우디네세", "Sassuolo": "사수올로",
  "Empoli": "엠폴리", "Cagliari": "칼리아리", "Verona": "베로나",
  "Lecce": "레체", "Genoa": "제노아", "Como": "코모", "Parma": "파르마",
  "Venezia": "베네치아", "Cremonese": "크레모네세", "Pisa": "피사",
  // Ligue 1
  "Paris Saint Germain": "PSG", "Marseille": "마르세유", "Monaco": "모나코",
  "Lyon": "리옹", "Lille": "릴", "Nice": "니스", "Lens": "랑스", "Rennes": "렌",
  "Montpellier": "몽펠리에", "Nantes": "낭트", "Strasbourg": "스트라스부르",
  "Toulouse": "툴루즈", "Reims": "랭스", "Brest": "브레스트", "Le Havre": "르아브르",
  "Auxerre": "오세르", "Angers": "앙제", "Saint-Etienne": "생테티엔",
  "Lorient": "로리앙", "Metz": "메스", "Paris FC": "파리 FC",
  // Eredivisie
  "Ajax": "아약스", "AZ Alkmaar": "AZ", "Excelsior": "엑셀시오르",
  "FC Volendam": "폴렌담", "Feyenoord": "페예노르트", "Fortuna Sittard": "포르투나 시타르트",
  "GO Ahead Eagles": "고 어헤드", "Groningen": "흐로닝언",
  "Heerenveen": "헤이렌베인", "Heracles": "헤라클레스",
  "NAC Breda": "NAC 브레다", "NEC Nijmegen": "NEC", "PEC Zwolle": "PEC 즈볼레",
  "PSV Eindhoven": "PSV", "Sparta Rotterdam": "스파르타", "Telstar": "텔스타르",
  "Twente": "트벤테", "Utrecht": "위트레흐트",
  // K League 1
  "FC Seoul": "FC 서울", "Ulsan Hyundai FC": "울산 HD", "Jeonbuk Motors": "전북 현대",
  "Pohang Steelers": "포항 스틸러스", "Daegu FC": "대구 FC", "Gangwon FC": "강원 FC",
  "Suwon Bluewings": "수원 삼성", "Jeju United FC": "제주 유나이티드",
  "Gwangju FC": "광주 FC", "Daejeon Citizen": "대전 시티즌",
  "Suwon City FC": "수원 FC", "FC Anyang": "FC 안양",
  "Sangju Sangmu FC": "김천 상무", "Bucheon FC 1995": "부천 FC 1995",
  // K League 2
  "Incheon United": "인천 유나이티드", "Seongnam FC": "성남 FC",
  "Seoul E-Land FC": "서울 이랜드", "Gyeongnam FC": "경남 FC",
  "Busan I Park": "부산 아이파크", "Ansan Greeners": "안산 그리너스",
  "Jeonnam Dragons": "전남 드래곤즈", "Cheongju": "청주 FC",
  "Cheonan City": "천안 시티", "Gimpo Citizen": "김포 시민",
  "Asan Mugunghwa": "충남 아산", "Hwaseong": "화성 FC",
  // J1 League
  "Vissel Kobe": "비셀 고베", "Yokohama F. Marinos": "요코하마 F 마리노스",
  "Machida Zelvia": "마치다 젤비아", "Gamba Osaka": "감바 오사카",
  "Sanfrecce Hiroshima": "산프레체 히로시마", "FC Tokyo": "FC 도쿄",
  "Cerezo Osaka": "세레소 오사카", "Kawasaki Frontale": "가와사키 프론탈레",
  "Urawa": "우라와 레즈", "Kashima": "가시마 앤틀러스",
  "Kashiwa Reysol": "가시와 레이솔", "Nagoya Grampus": "나고야 그램퍼스",
  "Albirex Niigata": "알비렉스 니가타", "Tokyo Verdy": "도쿄 베르디",
  "Avispa Fukuoka": "아비스파 후쿠오카", "Kyoto Sanga": "교토 상가",
  "Shimizu S-pulse": "시미즈 에스펄스", "Shonan Bellmare": "쇼난 벨마레",
  "Yokohama FC": "요코하마 FC", "V-varen Nagasaki": "V-파렌 나가사키",
  "Fagiano Okayama": "파지아노 오카야마",
  "JEF United Chiba": "JEF 유나이티드 치바", "Mito Hollyhock": "미토 홀리호크",
  // UCL / UEL / UECL
  "Aberdeen": "애버딘", "AEK Athens FC": "AEK 아테네", "AEK Larnaca": "AEK 라르나카",
  "AIK Stockholm": "AIK", "Aktobe": "악퇴베", "Anderlecht": "안데를레흐트",
  "Ararat-Armenia": "아라라트 아르메니아", "Araz": "아라즈",
  "Arda Kardzhali": "아르다", "Aris": "아리스",
  "Aris Thessalonikis": "아리스 테살로니키",
  "Atletic Club d'Escaldes": "아틀레틱 에스칼데스", "Auda": "아우다",
  "Austria Vienna": "아우스트리아 빈", "Ballkani": "발카니", "Banga": "방가",
  "Banik Ostrava": "바니크 오스트라바", "Basaksehir": "바샥셰히르",
  "Beitar Jerusalem": "베이타르 예루살렘",
  "Benfica": "벤피카", "Besiktas": "베식타시",
  "BFC Daugavpils": "BFC 다우가프필스", "Birkirkara": "비르키르카라",
  "BK Hacken": "해켄", "Bodo/Glimt": "보되글림트",
  "Borac Banja Luka": "보라츠", "Brann": "브란",
  "Breidablik": "브레이다블리크", "Brondby": "브뢴뷔",
  "BSC Young Boys": "영 보이스", "Buducnost Podgorica": "부두크노스트",
  "Celje": "첼예", "Celtic": "셀틱",
  "CFR 1907 Cluj": "CFR 클루지", "Charleroi": "샤를루아",
  "Cherno More Varna": "체르노 모레", "Cliftonville FC": "클리프턴빌",
  "Club Brugge KV": "클럽 브뤼헤",
  "Decic": "데치치", "Dila": "딜라",
  "Dinamo Brest": "디나모 브레스트", "Dinamo Minsk": "디나모 민스크",
  "Dinamo Tirana": "디나모 티라나", "Dinamo Zagreb": "디나모 자그레브",
  "Drita": "드리타", "Dundee Utd": "던디 유나이티드",
  "Dungannon Swifts": "던개넌", "Dynamo Kyiv": "디나모 키예프",
  "Egnatia Rrogozhine": "에그나티아",
  "F91 Dudelange": "뒤들랑주", "FC Astana": "아스타나",
  "FC Basel 1893": "바젤", "FC Copenhagen": "코펜하겐",
  "FC Differdange 03": "디페르당주", "FC Levadia Tallinn": "레바디아",
  "FC Lugano": "루가노", "FC Midtjylland": "미트윌란",
  "FC Noah": "노아", "FC Porto": "포르투",
  "FC Santa Coloma": "산타 콜로마", "FC Urartu": "우라르투",
  "FC Vaduz": "파두츠", "FCSB": "FCSB",
  "Fenerbahce": "페네르바흐체", "Ferencvarosi TC": "페렌츠바로시",
  "FK Crvena Zvezda": "츠르베나 즈베즈다", "FK Kosice": "코시체",
  "FK Partizan": "파르티잔", "FK Rabotnicki": "라보트니치키",
  "FK Sarajevo": "사라예보", "FK Zalgiris Vilnius": "잘기리스",
  "Flora Tallinn": "플로라", "Floriana": "플로리아나",
  "Fredrikstad": "프레드릭스타", "Galatasaray": "갈라타사라이",
  "Genk": "겐크", "Gyori ETO FC": "죄리",
  "Hammarby FF": "함마르뷔", "Hamrun Spartans": "함룬",
  "Hapoel Beer Sheva": "하포엘 베르셰바",
  "Haverfordwest County AFC": "해버포드웨스트",
  "HB": "HB 토르스하운", "Hegelmann Litauen": "헤겔만",
  "Hibernian": "히버니안", "Hibernians": "히버니안스",
  "HJK helsinki": "HJK 헬싱키",
  "HNK Hajduk Split": "하이두크", "HNK Rijeka": "리예카",
  "Ilves": "일베스", "Inter Club d'Escaldes": "인테르 에스칼데스",
  "Jagiellonia": "야기엘로니아",
  "KA Akureyri": "KA 아쿠레이리", "Kairat Almaty": "카이라트",
  "Kalju Nomme": "칼유", "Kauno Zalgiris": "카우나스 잘기리스",
  "KI Klaksvik": "KI 클락스비크", "Koper": "코페르", "KuPS": "KuPS",
  "La Fiorita": "라 피오리타", "Larne": "란", "Lausanne": "로잔",
  "Lech Poznan": "레흐 포즈난", "Legia Warszawa": "레기아",
  "Levski Sofia": "레프스키",
  "Lincoln Red Imps FC": "링컨 레드 임프스", "Linfield": "린필드",
  "Ludogorets": "루도고레츠",
  "Maccabi Haifa": "마카비 하이파", "Maccabi Tel Aviv": "마카비 텔아비브",
  "Magpies": "매그파이스", "Malisheva": "말리셰바",
  "Malmo FF": "말뫼", "Maribor": "마리보르", "Milsami Orhei": "밀사미",
  "Neman": "네만", "NK Varazdin": "바라주딘", "Novi Pazar": "노비 파자르",
  "NSI Runavik": "NSI 루나비크", "Oleksandria": "올렉산드리아",
  "Olimpija Ljubljana": "올림피야 류블랴나", "Olympiakos Piraeus": "올림피아코스",
  "Omonia Nicosia": "오모니아", "Ordabasy": "오르다바시",
  "Pafos": "파포스", "Paide": "파이데", "Paks": "팍시",
  "Panathinaikos": "파나티나이코스", "PAOK": "PAOK",
  "Partizani": "파르티자니", "Penybont": "페니본트",
  "Petrocub": "페트로쿠브", "Plzen": "플젠", "Polessya": "폴레시아",
  "Prishtina": "프리슈티나", "Puskas Academy": "푸슈카시",
  "Pyunik Yerevan": "퓨니크", "Qarabag": "카라바흐",
  "Racing FC Union Luxembourg": "라싱 FC", "Radnicki 1923": "라드니치키",
  "Rakow Czestochowa": "라쿠프", "Rangers": "레인저스",
  "Rapid Vienna": "라피드 빈", "Red Bull Salzburg": "잘츠부르크",
  "Riga": "리가", "Rigas FS": "리가스", "Rosenborg": "로센보르그",
  "Sabah FA": "사바", "Saburtalo": "사부르탈로", "Samsunspor": "삼순스포르",
  "Santa Clara": "산타 클라라", "SC Braga": "브라가",
  "Servette FC": "세르베트", "Shakhtar Donetsk": "샤흐타르",
  "Shamrock Rovers": "셰임록", "Shelbourne": "셸본",
  "Sheriff Tiraspol": "셰리프", "Shkendija": "슈켄디야",
  "Sigma Olomouc": "시그마 올로모우츠", "Sileks": "실렉스",
  "Silkeborg": "실케보르", "SJK": "SJK",
  "Slavia Praha": "슬라비아 프라하", "Slovan Bratislava": "슬로반 브라티슬라바",
  "Spaeri": "스패리", "Sparta Praha": "스파르타 프라하",
  "Spartak Trnava": "스파르탁 트르나바", "Sporting CP": "스포르팅",
  "St Joseph S Fc": "세인트 조지프", "St Patrick's Athl.": "세인트 패트릭스",
  "Sturm Graz": "슈투름 그라츠", "Sutjeska": "수체스카",
  "The New Saints": "더 뉴 세인츠",
  "Torpedo Kutaisi": "토르페도 쿠타이시", "Torpedo Zhodino": "토르페도 조디노",
  "Tre Fiori": "트레 피오리", "UNA Strassen": "UNA 슈트라센",
  "Union St. Gilloise": "유니온 생질루아즈",
  "Universitatea Cluj": "우니베르시타테아 클루지",
  "Universitatea Craiova": "우니베르시타테아 크라이오바",
  "Valur Reykjavik": "발루르", "Vardar Skopje": "바르다르",
  "Viking": "바이킹", "Vikingur Gota": "비킹구르 고타",
  "Vikingur Reykjavik": "비킹구르 레이캬비크", "Virtus": "비르투스",
  "Vllaznia Shkoder": "블라즈니아", "Wolfsberger AC": "볼프스베르거",
  "Zeljeznicar Sarajevo": "젤예즈니차르", "Zilina": "질리나",
  "Zimbru": "짐브루", "Zira": "지라", "Zrinjski": "즈린스키",
  // AFC Champions League
  "Al Sadd": "알 사드", "Al Shorta": "알 쇼르타", "Al Wahda FC": "알 와흐다",
  "Al-Ahli Jeddah": "알 아흘리", "Al-Duhail SC": "알 두하일",
  "Al-Gharafa": "알 가라파", "Al-Hilal Saudi FC": "알 힐랄",
  "Al-Ittihad FC": "알 이티하드", "Bangkok United": "방콕 유나이티드",
  "Buriram United": "부리람 유나이티드", "Chengdu Better City": "청두",
  "Johor Darul Takzim FC": "조호르 DT", "Melbourne City": "멜버른 시티",
  "Nasaf": "나사프", "Sepahan FC": "세파한",
  "Shabab Al Ahli Dubai": "샤밥 알 아흘리", "Shanghai Shenhua": "상하이 선화",
  "SHANGHAI SIPG": "상하이 항강", "Sharjah FC": "샤르자",
  "Tractor Sazi": "트랙터",
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
  "Nott'm Forest": "노팅엄", "Sheffield Utd": "셰필드 유나이티드",
  "Luton Town": "루턴", "Ipswich Town": "입스위치", "Leicester City": "레스터",
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
  // Championship 변형
  "West Bromwich Albion": "웨스트브롬", "Queens Park Rangers": "QPR",
  "Norwich City": "노리치", "Coventry City": "코번트리", "Derby County": "더비",
  "Preston North End": "프레스턴", "Blackburn Rovers": "블랙번",
  "Sheffield Wed": "셰필드 W", "Swansea City": "스완지",
  "Birmingham City": "버밍엄", "Stoke": "스토크",
  "Middlesbrough FC": "미들즈브러", "Hull": "헐 시티",
  // Eredivisie 변형
  "SC Heerenveen": "헤이렌베인", "FC Groningen": "흐로닝언",
  "FC Utrecht": "위트레흐트", "FC Twente": "트벤테",
  // K League 변형
  "Gimcheon Sangmu": "김천 상무", "Gimcheon Sangmu FC": "김천 상무",
  "Ulsan HD": "울산 HD", "Ulsan HD FC": "울산 HD",
  "Jeonbuk Hyundai": "전북 현대", "Jeonbuk Hyundai Motors": "전북 현대",
  // UCL/UEL 변형
  "SL Benfica": "벤피카", "FC Salzburg": "잘츠부르크",
  "RB Salzburg": "잘츠부르크", "Sporting Lisbon": "스포르팅",
  "Club Brugge": "클럽 브뤼헤", "Red Star Belgrade": "츠르베나 즈베즈다",
  "Young Boys": "영 보이스",
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
  // 주요 리그 (isPopular)
  { id: "epl", name: "프리미어리그", shortName: "EPL", apiIds: [39], country: "England", isPopular: true },
  { id: "laliga", name: "라리가", shortName: "라리가", apiIds: [140], country: "Spain", isPopular: true },
  { id: "bundesliga", name: "분데스리가", shortName: "분데스", apiIds: [78], country: "Germany", isPopular: true },
  { id: "seriea", name: "세리에A", shortName: "세리에", apiIds: [135], country: "Italy", isPopular: true },
  { id: "ligue1", name: "리그1", shortName: "리그1", apiIds: [61], country: "France", isPopular: true },
  { id: "kleague1", name: "K리그1", shortName: "K1", apiIds: [292], country: "Korea", isPopular: true },
  { id: "ucl", name: "챔피언스리그", shortName: "UCL", apiIds: [2], country: "Europe", isPopular: true },
  { id: "uel", name: "유로파리그", shortName: "UEL", apiIds: [3], country: "Europe", isPopular: true },
  // 일반 리그
  { id: "kleague2", name: "K리그2", shortName: "K2", apiIds: [293], country: "Korea", isPopular: false },
  { id: "uecl", name: "컨퍼런스리그", shortName: "UECL", apiIds: [848], country: "Europe", isPopular: false },
  { id: "jleague", name: "J1리그", shortName: "J1", apiIds: [98], country: "Japan", isPopular: false },
  { id: "eredivisie", name: "에레디비시", shortName: "에레", apiIds: [88], country: "Netherlands", isPopular: false },
  { id: "championship", name: "챔피언십", shortName: "ELC", apiIds: [40], country: "England", isPopular: false },
  { id: "afc_cl", name: "AFC 챔피언스리그", shortName: "ACL", apiIds: [17], country: "Asia", isPopular: false },
  // 컵 대회
  { id: "fa_cup", name: "FA컵", shortName: "FA컵", apiIds: [45], country: "England", isPopular: false },
  { id: "efl_cup", name: "카라바오컵", shortName: "EFL컵", apiIds: [48], country: "England", isPopular: false },
  { id: "copa_del_rey", name: "코파 델 레이", shortName: "국왕컵", apiIds: [143], country: "Spain", isPopular: false },
  { id: "dfb_pokal", name: "DFB 포칼", shortName: "DFB", apiIds: [81], country: "Germany", isPopular: false },
  { id: "coppa_italia", name: "코파 이탈리아", shortName: "코파", apiIds: [137], country: "Italy", isPopular: false },
  { id: "coupe_de_france", name: "쿠프 드 프랑스", shortName: "쿠프", apiIds: [66], country: "France", isPopular: false },
  { id: "korean_fa_cup", name: "FA컵(한국)", shortName: "FA컵", apiIds: [294], country: "Korea", isPopular: false },
  // 슈퍼컵
  { id: "uefa_super_cup", name: "UEFA 슈퍼컵", shortName: "슈퍼컵", apiIds: [531], country: "Europe", isPopular: false },
  { id: "community_shield", name: "커뮤니티 실드", shortName: "실드", apiIds: [528], country: "England", isPopular: false },
  { id: "super_cup_ger", name: "DFL 슈퍼컵", shortName: "슈퍼컵", apiIds: [529], country: "Germany", isPopular: false },
  { id: "super_cup_esp", name: "수페르코파", shortName: "슈퍼컵", apiIds: [556], country: "Spain", isPopular: false },
  { id: "super_cup_ita", name: "수페르코파", shortName: "슈퍼컵", apiIds: [547], country: "Italy", isPopular: false },
  { id: "trophee_champions", name: "트로페 데 샹피옹", shortName: "트로페", apiIds: [526], country: "France", isPopular: false },
];

export const POPULAR_LEAGUE_API_IDS = LEAGUES.filter(l => l.isPopular).flatMap(l => l.apiIds);

// ============================================================
// 팀명 표시 유틸
// ============================================================
export function getTeamName(name: string): string {
  // 1. 정확 매칭 (최우선)
  const exact = TEAM_NAMES_KR[name];
  if (exact) return exact;

  // 2. Fuzzy 매칭 (정확 매칭 실패 시)
  const nameLower = name.toLowerCase();
  for (const [key, value] of Object.entries(TEAM_NAMES_KR)) {
    const keyWords = key.trim().split(/\s+/);
    // 단어 수가 1개인 키는 fuzzy에서 제외 (도시명 오매칭 방지)
    if (keyWords.length <= 1) continue;

    const keyLower = key.toLowerCase();
    // 전체 키 포함 매칭
    if (nameLower.includes(keyLower) || keyLower.includes(nameLower)) {
      return value;
    }
    // 첫 단어 매칭 (6글자 이상만)
    const firstWord = keyWords[0].toLowerCase();
    if (firstWord.length >= 6 && nameLower.includes(firstWord)) {
      return value;
    }
  }

  return name;
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
