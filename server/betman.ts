/**
 * 국내배당(베트맨) 통합 모듈
 * =============================
 * 1순위: Puppeteer로 실제 베트맨 배당 크롤링
 * 2순위: 해외배당 환산으로 추정 국내배당 생성
 * 
 * 스케줄러에서 하루 2회 자동 실행
 * - 10:00: 오전 배당 수집
 * - 16:00: 오후 배당 업데이트
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// 1. 해외배당 → 국내배당 환산 (100% 안정, 추정값)
// ============================================================
// 베트맨 프로토 환급률: 약 72~75% (오버라운드 ~1.35)
// 해외 북메이커 환급률: 약 92~95% (오버라운드 ~1.05~1.08)

const BETMAN_OVERROUND = 1.35; // 베트맨 총 배당 역수 합계 (마진 ~26%)

interface DomesticOdds {
  home: number;
  draw: number;
  away: number;
  source: "betman" | "estimated";
  isEstimated: boolean;
  round?: string;
  updatedAt: string;
}

/**
 * 해외배당(API-Football)을 국내배당(베트맨 수준)으로 환산
 * 
 * 원리:
 * 1. 해외배당에서 내포확률 추출 (1/odds)
 * 2. 노멀라이즈 (마진 제거)
 * 3. 베트맨 마진 적용 (×1.35 오버라운드)
 * 4. 최소 1.01배 보정
 */
export function convertToDomestic(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number
): DomesticOdds {
  // 내포확률
  const pHome = 1 / homeOdds;
  const pDraw = 1 / drawOdds;
  const pAway = 1 / awayOdds;
  const total = pHome + pDraw + pAway; // 해외 오버라운드 (보통 1.05~1.08)

  // 노멀라이즈 (공정확률)
  const fairHome = pHome / total;
  const fairDraw = pDraw / total;
  const fairAway = pAway / total;

  // 베트맨 마진 적용
  const domesticHome = Math.max(1.01, Math.round((1 / (fairHome * BETMAN_OVERROUND)) * 100) / 100);
  const domesticDraw = Math.max(1.01, Math.round((1 / (fairDraw * BETMAN_OVERROUND)) * 100) / 100);
  const domesticAway = Math.max(1.01, Math.round((1 / (fairAway * BETMAN_OVERROUND)) * 100) / 100);

  return {
    home: domesticHome,
    draw: domesticDraw,
    away: domesticAway,
    source: "estimated",
    isEstimated: true,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================
// 2. 베트맨 페이지 텍스트 파서 (실제 구조 기반)
// ============================================================
// v3 디버그에서 확인된 실제 패턴:
// "브라이턴 vs 크리스털\n승\n1.85배당률 상승\n-\n...\n무\n3.50\n-\n...\n패\n2.10"

export interface BetmanMatch {
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  league: string;
}

export function parseBetmanText(rawText: string): BetmanMatch[] {
  const matches: BetmanMatch[] = [];
  const lines = rawText.split('\n').map(l => l.trim());

  for (let i = 0; i < lines.length; i++) {
    // "X vs Y" 패턴
    const vsMatch = lines[i].match(/^(.+?)\s+vs\s+(.+)$/);
    if (!vsMatch) continue;

    const teamA = vsMatch[1].trim();
    const teamB = vsMatch[2].trim();

    // 바로 다음줄 "승"
    if (i + 1 >= lines.length || lines[i + 1] !== '승') continue;

    // 승 배당 ("1.85" 또는 "1.20배당률 상승")
    if (i + 2 >= lines.length) continue;
    const homeM = lines[i + 2].match(/(\d+\.\d+)/);
    if (!homeM) continue;
    const homeOdds = parseFloat(homeM[1]);

    // i+3~i+25에서 "무"와 "패" 탐색
    let drawOdds = 0, awayOdds = 0;
    for (let j = i + 3; j < Math.min(i + 25, lines.length); j++) {
      if (lines[j] === '무' && drawOdds === 0 && j + 1 < lines.length) {
        const dm = lines[j + 1].match(/(\d+\.\d+)/);
        if (dm) drawOdds = parseFloat(dm[1]);
      }
      if (lines[j] === '패' && awayOdds === 0 && j + 1 < lines.length) {
        const am = lines[j + 1].match(/(\d+\.\d+)/);
        if (am) awayOdds = parseFloat(am[1]);
      }
      if (drawOdds > 0 && awayOdds > 0) break;
      if (/^\d{3,4}$/.test(lines[j]) && j > i + 5) break;
    }

    // 승/무/패 3개 모두 → 축구만 (농구는 무 없음)
    if (homeOdds >= 1.01 && drawOdds >= 1.01 && awayOdds >= 1.01) {
      const exists = matches.some(m => m.homeTeam === teamA && m.awayTeam === teamB);
      if (!exists) {
        let league = '';
        for (let k = i - 1; k >= Math.max(0, i - 15); k--) {
          if (/축구/.test(lines[k])) { league = lines[k].replace(/\t/g, ' ').trim(); break; }
        }
        matches.push({ homeTeam: teamA, awayTeam: teamB, homeOdds, drawOdds, awayOdds, league });
      }
    }
  }
  return matches;
}

// ============================================================
// 3. 베트맨 약어 → DB 영어 팀명 매핑
// ============================================================
const BETMAN_TEAM_MAP: Record<string, string[]> = {
  // EPL
  "맨체스U": ["Manchester United"], "맨유": ["Manchester United"],
  "맨체스C": ["Manchester City"], "맨시티": ["Manchester City"],
  "리버풀": ["Liverpool"], "첼시": ["Chelsea"],
  "아스널": ["Arsenal"], "아스날": ["Arsenal"],
  "토트넘": ["Tottenham"], "뉴캐슬": ["Newcastle"],
  "웨스트햄": ["West Ham"],
  "브라이턴": ["Brighton"], "브라이튼": ["Brighton"],
  "애스턴빌": ["Aston Villa"],
  "풀럼": ["Fulham"],
  "브렌트포": ["Brentford"], "브렌트포드": ["Brentford"],
  "크리스털": ["Crystal Palace"],
  "울버햄튼": ["Wolves", "Wolverhampton"],
  "에버턴": ["Everton"],
  "노팅엄포": ["Nottingham Forest"], "노팅엄": ["Nottingham Forest"],
  "본머스": ["Bournemouth"],
  "입스위치": ["Ipswich"],
  "레스터": ["Leicester"],
  "사우샘프": ["Southampton"],
  // 라리가
  "레알마드": ["Real Madrid"], "바르셀로": ["Barcelona"],
  "AT마드": ["Atletico Madrid"], "아틀레티코": ["Atletico Madrid"], "아틀마드": ["Atletico Madrid"],
  "세비야": ["Sevilla"],
  "비야레알": ["Villarreal"], "비야레": ["Villarreal"],
  "베티스": ["Real Betis"], "발렌시아": ["Valencia"],
  "지로나": ["Girona"], "마요르카": ["Mallorca"],
  "셀타비고": ["Celta Vigo"], "셀타": ["Celta Vigo"],
  "오사수나": ["Osasuna"], "헤타페": ["Getafe"],
  "라요바예": ["Rayo Vallecano"],
  "에스파뇰": ["Espanyol"], "바야돌리": ["Valladolid"],
  "레가네스": ["Leganes"], "알라베스": ["Alaves"],
  "라스팔마": ["Las Palmas"],
  "레알소시": ["Real Sociedad"],
  "빌바오": ["Athletic Club", "Athletic Bilbao"],
  "레반테": ["Levante"],
  // 분데스리가
  "바이뮌헨": ["Bayern Munich", "Bayern München"], "바이에른": ["Bayern Munich"],
  "도르트문": ["Borussia Dortmund"],
  "라이프치": ["RB Leipzig"],
  "레버쿠젠": ["Bayer Leverkusen"],
  "프랑크푸": ["Eintracht Frankfurt"],
  "볼프스부": ["VfL Wolfsburg"],
  "슈투트가": ["VfB Stuttgart"],
  "프라이부": ["SC Freiburg", "Freiburg"],
  "브레멘": ["Werder Bremen"],
  "호펜하임": ["TSG Hoffenheim", "Hoffenheim"],
  "마인츠": ["FSV Mainz 05"],
  "아우크스": ["FC Augsburg"],
  "보훔": ["VfL Bochum"],
  "쾰른": ["FC Koln", "1. FC Köln"],
  "묀헨글라": ["Borussia Monchengladbach"],
  "하이덴하": ["1. FC Heidenheim"],
  "킬": ["Holstein Kiel"],
  "장크트파": ["FC St. Pauli"],
  // 세리에A
  "인테르": ["Inter", "Inter Milan"],
  "AC밀란": ["AC Milan"], "밀란": ["AC Milan"],
  "유벤투스": ["Juventus"], "나폴리": ["Napoli"],
  "로마": ["Roma", "AS Roma"], "AS로마": ["AS Roma"],
  "라치오": ["Lazio"], "아탈란타": ["Atalanta"],
  "피오렌티": ["Fiorentina"],
  "볼로냐": ["Bologna"], "토리노": ["Torino"],
  "우디네세": ["Udinese"], "엠폴리": ["Empoli"],
  "칼리아리": ["Cagliari"],
  "베로나": ["Verona", "Hellas Verona"],
  "US레체": ["Lecce"], "레체": ["Lecce"],
  "제노아": ["Genoa"], "코모": ["Como"],
  "파르마": ["Parma"], "베네치아": ["Venezia"],
  "몬자": ["Monza"], "사수올로": ["Sassuolo"],
  // 리그1
  "PSG": ["Paris Saint Germain", "Paris Saint-Germain"],
  "파리생제": ["Paris Saint Germain"],
  "마르세유": ["Marseille"],
  "AS모나코": ["Monaco", "AS Monaco"], "모나코": ["Monaco"],
  "리옹": ["Lyon"], "릴": ["Lille"],
  "OGC니스": ["Nice", "OGC Nice"], "니스": ["Nice"],
  "RC랑스": ["Lens"], "랑스": ["Lens"],
  "렌": ["Rennes"], "브레스트": ["Brest"],
  "RC스트라": ["Strasbourg"],
  "툴루즈": ["Toulouse"], "낭트": ["Nantes"],
  "몽펠리에": ["Montpellier"], "랭스": ["Reims"],
  "르아브르": ["Le Havre"], "오세르": ["Auxerre"],
  "앙제SCO": ["Angers"], "앙제": ["Angers"],
  "생테티엔": ["Saint-Etienne"],
  "파리FC": ["Paris FC"],
  // 에레디비지에
  "아약스": ["Ajax"], "PSV": ["PSV", "PSV Eindhoven"],
  "페예노르": ["Feyenoord"],
  "알크마르": ["AZ", "AZ Alkmaar"],
  "위트레흐": ["FC Utrecht"],
  "흐로닝언": ["FC Groningen"],
  "트벤테": ["FC Twente"],
  "고어헤드": ["Go Ahead Eagles"],
  "텔스타": ["Telstar"],
  // EFL
  "셰필드웬": ["Sheffield Wednesday"],
  "스완지C": ["Swansea"],
  "리즈유나": ["Leeds United"],
  "번리": ["Burnley"],
  // J리그
  "후쿠오카": ["Avispa Fukuoka"],
  "오카야마": ["Fagiano Okayama"],
  "나고야": ["Nagoya Grampus"],
  "시미즈": ["Shimizu S-Pulse"],
  "이와키": ["Iwaki FC"],
  "삿포로": ["Consadole Sapporo"],
  "가와사키": ["Kawasaki Frontale"],
  "가시와": ["Kashiwa Reysol"],
  "도쿄베르": ["Tokyo Verdy"],
  "미토": ["Mito Hollyhock"],
};

// ============================================================
// 4. DB 팀 매칭 (퍼지)
// ============================================================
async function findTeam(betmanName: string): Promise<{ id: bigint; name: string } | null> {
  const cleaned = betmanName.replace(/\s+/g, '').trim();

  // 정확 매칭
  if (BETMAN_TEAM_MAP[cleaned]) {
    for (const en of BETMAN_TEAM_MAP[cleaned]) {
      const t = await prisma.team.findFirst({
        where: { name: { contains: en, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (t) return t;
    }
  }

  // 부분 매칭
  for (const [kr, ens] of Object.entries(BETMAN_TEAM_MAP)) {
    if (cleaned.includes(kr) || kr.includes(cleaned)) {
      for (const en of ens) {
        const t = await prisma.team.findFirst({
          where: { name: { contains: en, mode: 'insensitive' } },
          select: { id: true, name: true },
        });
        if (t) return t;
      }
    }
  }
  return null;
}

// ============================================================
// 5. Puppeteer 크롤링 (단일 요청, 차단 방지)
// ============================================================
async function tryPuppeteerCrawl(): Promise<{ matches: BetmanMatch[]; round: string } | null> {
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1920, height: 1080 });

      // 회차 추정: 2026년 기준 ~3회차/주
      const yr = new Date().getFullYear();
      const dayOfYear = Math.floor((Date.now() - new Date(yr, 0, 1).getTime()) / 86400000);
      const est = Math.max(1, Math.round(dayOfYear / 7 * 3));
      const yearPrefix = String(yr).slice(-2);

      // 추정 회차부터 ±2 탐색 (최대 5번, 축구 경기가 있는 회차 찾기)
      for (let r = est + 2; r >= est - 2; r--) {
        if (r < 1) continue;
        const gmTs = `${yearPrefix}${String(r).padStart(4, '0')}`;

        console.log(`[Betman] Puppeteer: ${r}회차(${gmTs}) 시도`);

        await page.goto(
          `https://www.betman.co.kr/main/mainPage/gamebuy/gameSlipIFR.do?gmId=G101&gmTs=${gmTs}&gameDivCd=C&isIFR=Y`,
          { waitUntil: 'networkidle2', timeout: 20000 }
        );
        await new Promise(resolve => setTimeout(resolve, 4000));

        const bodyText = await page.evaluate(() => document.body.innerText);
        const matches = parseBetmanText(bodyText);

        if (matches.length > 0) {
          console.log(`[Betman] ✅ Puppeteer: ${r}회차 축구 ${matches.length}경기`);
          return { matches, round: String(r) };
        }

        // 회차마감이면 다음으로
        if (bodyText.includes('회차마감') && bodyText.includes('축구')) {
          // 마감됐지만 축구가 있었음 → 파싱 실패한 거일 수도
          console.log(`[Betman] ${r}회차 마감됨, 다음 시도`);
        }

        // 요청 간격 (차단 방지)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('[Betman] Puppeteer: 발매중 회차 없음');
      return null;
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (err: any) {
    console.log(`[Betman] Puppeteer 실패: ${err.message}`);
    return null;
  }
}

// ============================================================
// 6. 메인: 국내배당 자동 동기화
// ============================================================
export interface SyncResult {
  method: "puppeteer" | "estimated" | "none";
  total: number;
  matched: number;
  updated: number;
  round?: string;
  details: Array<{ home: string; away: string; odds: string; source: string }>;
  unmatched: string[];
  errors: string[];
}

export async function syncDomesticOdds(): Promise<SyncResult> {
  const result: SyncResult = {
    method: "none", total: 0, matched: 0, updated: 0,
    details: [], unmatched: [], errors: [],
  };

  const now = new Date();
  const twoWeeks = new Date(now.getTime() + 14 * 86400000);
  const yesterday = new Date(now.getTime() - 86400000);

  // ────────────────────────────────────────
  // Phase 1: Puppeteer 실제 배당 시도
  // ────────────────────────────────────────
  console.log('[Betman] Phase 1: Puppeteer 크롤링 시도...');
  const crawlResult = await tryPuppeteerCrawl();

  if (crawlResult && crawlResult.matches.length > 0) {
    result.method = "puppeteer";
    result.round = crawlResult.round;
    result.total = crawlResult.matches.length;

    for (const bm of crawlResult.matches) {
      try {
        const home = await findTeam(bm.homeTeam);
        const away = await findTeam(bm.awayTeam);
        if (!home || !away) {
          result.unmatched.push(`${bm.homeTeam} vs ${bm.awayTeam}`);
          continue;
        }
        result.matched++;

        const fixture = await prisma.fixture.findFirst({
          where: {
            homeTeamId: home.id, awayTeamId: away.id,
            kickoffAt: { gte: yesterday, lte: twoWeeks },
            status: { in: ['NS', 'TBD', '1H', '2H', 'HT'] },
          },
          include: { odds: true },
        });
        if (!fixture) continue;

        const domestic: DomesticOdds = {
          home: bm.homeOdds, draw: bm.drawOdds, away: bm.awayOdds,
          source: "betman", isEstimated: false,
          round: crawlResult.round, updatedAt: now.toISOString(),
        };

        await upsertDomestic(fixture, domestic);
        result.updated++;
        result.details.push({
          home: `${bm.homeTeam}→${home.name}`, away: `${bm.awayTeam}→${away.name}`,
          odds: `${bm.homeOdds}/${bm.drawOdds}/${bm.awayOdds}`, source: "betman",
        });
      } catch (err: any) {
        result.errors.push(`${bm.homeTeam} vs ${bm.awayTeam}: ${err.message}`);
      }
    }

    // Puppeteer로 못 맞춘 나머지 fixture는 환산으로 채우기
    await fillMissingWithEstimated(result, yesterday, twoWeeks);
    return result;
  }

  // ────────────────────────────────────────
  // Phase 2: 해외배당 환산 (폴백)
  // ────────────────────────────────────────
  console.log('[Betman] Phase 2: 해외배당 환산 폴백...');
  result.method = "estimated";
  await fillMissingWithEstimated(result, yesterday, twoWeeks);
  return result;
}

// ============================================================
// 헬퍼: domestic 없는 fixture에 환산 배당 채우기
// ============================================================
async function fillMissingWithEstimated(
  result: SyncResult,
  from: Date,
  to: Date,
) {
  // 해외배당은 있는데 domestic이 없거나 오래된 fixture 조회
  const fixtures = await prisma.fixture.findMany({
    where: {
      kickoffAt: { gte: from, lte: to },
      status: { in: ['NS', 'TBD'] },
      odds: { isNot: null },
    },
    include: {
      odds: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  for (const f of fixtures) {
    if (!f.odds || !f.odds.home || !f.odds.draw || !f.odds.away) continue;

    // 이미 실제 betman 배당이 최근 12시간 내 있으면 스킵
    const existing = f.odds.domestic as any;
    if (existing && existing.source === 'betman') {
      const updatedAt = new Date(existing.updatedAt || 0);
      if (Date.now() - updatedAt.getTime() < 12 * 60 * 60 * 1000) continue;
    }
    // 환산 배당이 최근 6시간 내면 스킵
    if (existing && existing.source === 'estimated') {
      const updatedAt = new Date(existing.updatedAt || 0);
      if (Date.now() - updatedAt.getTime() < 6 * 60 * 60 * 1000) continue;
    }

    const domestic = convertToDomestic(
      Number(f.odds.home), Number(f.odds.draw), Number(f.odds.away)
    );

    try {
      await upsertDomestic(f, domestic);
      result.updated++;
      result.details.push({
        home: f.homeTeam.name, away: f.awayTeam.name,
        odds: `${domestic.home}/${domestic.draw}/${domestic.away}`, source: "estimated",
      });
    } catch (err: any) {
      result.errors.push(`환산 저장 실패: ${f.homeTeam.name} vs ${f.awayTeam.name}: ${err.message}`);
    }
  }
}

// ============================================================
// 헬퍼: FixtureOdds.domestic 저장
// ============================================================
async function upsertDomestic(
  fixture: { id: bigint; odds: { id: bigint } | null },
  domestic: DomesticOdds,
) {
  if (fixture.odds) {
    await prisma.fixtureOdds.update({
      where: { id: fixture.odds.id },
      data: { domestic: domestic as unknown as Prisma.InputJsonValue },
    });
  } else {
    await prisma.fixtureOdds.create({
      data: {
        fixtureId: fixture.id,
        home: domestic.home,
        draw: domestic.draw,
        away: domestic.away,
        domestic: domestic as unknown as Prisma.InputJsonValue,
        bookmaker: domestic.source,
      },
    });
  }
}

export default { syncDomesticOdds, convertToDomestic, parseBetmanText };
