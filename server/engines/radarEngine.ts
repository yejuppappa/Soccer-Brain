/**
 * Radar Chart Engine — 5축 레이더 점수 실시간 계산
 *
 * FixtureTeamStatSnapshot 원시 데이터에서 리그 10분위 기반
 * 공격력·수비력·주도권·홈어드벤티지·강팀대응력 산출
 */

import { prisma } from "../db.js";
import type {
  RadarOutput,
  RadarWindow,
  RadarAxisScores,
  RadarAxisDetail,
} from "../../shared/schema.js";

// ============================================================
// 상수
// ============================================================

/** 컵 대회 apiLeagueId (국내 리그가 아닌 것) */
const CUP_LEAGUE_IDS = new Set([
  2, 3, 17, 18, 45, 48, 66, 81, 137, 143, 294,
  526, 528, 529, 531, 547, 556, 848,
]);

/** 리그 티어 보정 계수 */
const TIER_MAP: Record<number, number> = {
  39: 1.0, 140: 1.0, 135: 1.0, 78: 1.0, 61: 1.0, // T1 Big 5
  88: 0.9,                                          // T1.5 Eredivisie
  292: 0.8, 293: 0.8, 98: 0.8, 40: 0.8,            // T2
};
const DEFAULT_TIER = 0.7;

/** 시즌 초반 raw→점수 참조 범위 [min, max] */
const RAW_RANGES: Record<string, [number, number]> = {
  avgXgPerGame: [0.5, 2.5],
  avgSotPerGame: [2, 8],
  goalsOverXg: [0.5, 1.5],
  insideBoxRatio: [0.3, 0.7],
  avgXgaPerGame: [0.5, 2.5],
  concededOverXga: [0.5, 1.5],
  avgPossession: [35, 65],
  avgCorners: [2, 8],
  avgShotsTotal: [6, 18],
  venuePpg: [0, 3],
  venueXgDiff: [-1.5, 1.5],
  bigMatchXgDiff: [-1.5, 1.5],
  bigMatchPpg: [0, 3],
};

// ============================================================
// 내부 타입
// ============================================================

interface SnapshotRow {
  teamId: bigint;
  fixtureId: bigint;
  isHome: boolean;
  xg: number | null;
  shotsOnTarget: number | null;
  shotsTotal: number | null;
  shotsInsideBox: number | null;
  possessionPct: number | null;
  corners: number | null;
  fixture: {
    kickoffAt: Date;
    homeTeamId: bigint;
    awayTeamId: bigint;
    homeGoals: number | null;
    awayGoals: number | null;
  };
}

interface TeamRawMetrics {
  teamId: string;
  gameCount: number;
  avgXgPerGame: number | null;
  avgSotPerGame: number | null;
  goalsOverXg: number | null;
  insideBoxRatio: number | null;
  avgXgaPerGame: number | null;
  concededOverXga: number | null;
  avgPossession: number | null;
  avgCorners: number | null;
  avgShotsTotal: number | null;
  venuePpg: number | null;
  venueXgDiff: number | null;
  venueGameCount: number;
  bigMatchXgDiff: number | null;
  bigMatchPpg: number | null;
  bigMatchGameCount: number;
}

interface LeagueContext {
  leagueId: bigint;
  season: number;
  apiLeagueId: number;
}

// ============================================================
// 헬퍼
// ============================================================

function avg(nums: (number | null | undefined)[]): number | null {
  const clean = nums.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (clean.length === 0) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function sum(nums: (number | null | undefined)[]): number {
  return nums.reduce<number>(
    (acc, v) => acc + (typeof v === "number" && Number.isFinite(v) ? v : 0),
    0,
  );
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** 스냅샷에서 득점·실점 추출 */
function getGoals(
  snap: SnapshotRow,
): { gf: number; ga: number } | null {
  const fx = snap.fixture;
  if (fx.homeGoals === null || fx.awayGoals === null) return null;
  const isHome = snap.teamId === fx.homeTeamId;
  return {
    gf: isHome ? fx.homeGoals : fx.awayGoals,
    ga: isHome ? fx.awayGoals : fx.homeGoals,
  };
}

/** 스냅샷에서 승점 추출 */
function getPoints(snap: SnapshotRow): number | null {
  const g = getGoals(snap);
  if (!g) return null;
  if (g.gf > g.ga) return 3;
  if (g.gf === g.ga) return 1;
  return 0;
}

/** 상대팀의 xG (또는 fallback) 조회 */
function getOpponentStat(
  snap: SnapshotRow,
  fixtureSnapMap: Map<string, SnapshotRow[]>,
  hasXg: boolean,
): number | null {
  const pair = fixtureSnapMap.get(snap.fixtureId.toString());
  if (!pair) return null;
  const opp = pair.find((s) => s.teamId !== snap.teamId);
  if (!opp) return null;
  return hasXg ? opp.xg : opp.shotsOnTarget;
}

/** xG 또는 fallback 값 */
function getXgValue(snap: SnapshotRow, hasXg: boolean): number | null {
  return hasXg ? snap.xg : snap.shotsOnTarget;
}

// ============================================================
// 10분위 점수화
// ============================================================

function computeDecile(
  values: { teamId: string; value: number }[],
  targetTeamId: string,
  inverted = false,
  clipExtremes = false,
): number {
  if (values.length === 0) return 5;

  let sorted = [...values].sort((a, b) => a.value - b.value);

  // 효율 지표 상하위 5% 클리핑
  if (clipExtremes && sorted.length >= 20) {
    const clipN = Math.floor(sorted.length * 0.05);
    const lower = sorted[clipN].value;
    const upper = sorted[sorted.length - 1 - clipN].value;
    sorted = sorted.map((s) => ({
      ...s,
      value: clamp(s.value, lower, upper),
    }));
    sorted.sort((a, b) => a.value - b.value);
  }

  const idx = sorted.findIndex((s) => s.teamId === targetTeamId);
  if (idx === -1) return 5;

  const n = sorted.length;
  const percentile = n <= 1 ? 0.5 : idx / (n - 1);

  const decile = inverted
    ? Math.round((1 - percentile) * 9) + 1
    : Math.round(percentile * 9) + 1;

  return clamp(decile, 1, 10);
}

/** 시즌 초반용: raw 값을 참조 범위로 1-10 변환 */
function rawToDecile(value: number | null, metricKey: string): number {
  if (value === null) return 5;
  const range = RAW_RANGES[metricKey];
  if (!range) return 5;
  const [lo, hi] = range;
  const normalized = (value - lo) / (hi - lo);
  return clamp(Math.round(normalized * 9) + 1, 1, 10);
}

// ============================================================
// 팀별 원시 지표 계산
// ============================================================

function computeTeamRawMetrics(
  teamId: string,
  windowSnaps: SnapshotRow[],
  fixtureSnapMap: Map<string, SnapshotRow[]>,
  hasXg: boolean,
  isHomeInTarget: boolean,
  topTeamIds: Set<string>,
): TeamRawMetrics {
  const n = windowSnaps.length;
  if (n === 0) {
    return {
      teamId,
      gameCount: 0,
      avgXgPerGame: null, avgSotPerGame: null,
      goalsOverXg: null, insideBoxRatio: null,
      avgXgaPerGame: null, concededOverXga: null,
      avgPossession: null, avgCorners: null, avgShotsTotal: null,
      venuePpg: null, venueXgDiff: null, venueGameCount: 0,
      bigMatchXgDiff: null, bigMatchPpg: null, bigMatchGameCount: 0,
    };
  }

  // --- 공격 ---
  const xgValues = windowSnaps.map((s) => getXgValue(s, hasXg));
  const avgXgPerGame = avg(xgValues);
  const avgSotPerGame = avg(windowSnaps.map((s) => s.shotsOnTarget));

  // A3: 결정력
  const totalGoals = sum(windowSnaps.map((s) => getGoals(s)?.gf ?? null));
  const totalXg = sum(xgValues);
  const goalsOverXg = totalXg > 0 ? totalGoals / totalXg : null;

  // A4: 박스안 슈팅 비율
  const totalInsideBox = sum(windowSnaps.map((s) => s.shotsInsideBox));
  const totalShots = sum(windowSnaps.map((s) => s.shotsTotal));
  const insideBoxRatio = totalShots > 0 ? totalInsideBox / totalShots : null;

  // --- 수비 ---
  const xgaValues = windowSnaps.map((s) =>
    getOpponentStat(s, fixtureSnapMap, hasXg),
  );
  const avgXgaPerGame = avg(xgaValues);

  const totalConceded = sum(windowSnaps.map((s) => getGoals(s)?.ga ?? null));
  const totalXga = sum(xgaValues);
  const concededOverXga = totalXga > 0 ? totalConceded / totalXga : null;

  // --- 주도권 ---
  const avgPossession = avg(windowSnaps.map((s) => s.possessionPct));
  const avgCorners = avg(windowSnaps.map((s) => s.corners));
  const avgShotsTotal = avg(windowSnaps.map((s) => s.shotsTotal));

  // --- 홈어드벤티지 (V0 장소 필터) ---
  const venueSnaps = windowSnaps.filter((s) => s.isHome === isHomeInTarget);
  const venueGameCount = venueSnaps.length;

  const venuePoints = venueSnaps
    .map(getPoints)
    .filter((v): v is number => v !== null);
  const venuePpg = venuePoints.length > 0
    ? venuePoints.reduce((a, b) => a + b, 0) / venuePoints.length
    : null;

  const venueXgDiffs = venueSnaps.map((s) => {
    const myXg = getXgValue(s, hasXg);
    const oppXg = getOpponentStat(s, fixtureSnapMap, hasXg);
    if (myXg === null || oppXg === null) return null;
    return myXg - oppXg;
  });
  const venueXgDiff = avg(venueXgDiffs);

  // --- 강팀 대응력 ---
  const bigMatchSnaps = windowSnaps.filter((s) => {
    const oppId =
      s.teamId === s.fixture.homeTeamId
        ? s.fixture.awayTeamId.toString()
        : s.fixture.homeTeamId.toString();
    return topTeamIds.has(oppId);
  });
  const bigMatchGameCount = bigMatchSnaps.length;

  const bigMatchXgDiffs = bigMatchSnaps.map((s) => {
    const myXg = getXgValue(s, hasXg);
    const oppXg = getOpponentStat(s, fixtureSnapMap, hasXg);
    if (myXg === null || oppXg === null) return null;
    return myXg - oppXg;
  });
  const bigMatchXgDiff = avg(bigMatchXgDiffs);

  const bigMatchPoints = bigMatchSnaps
    .map(getPoints)
    .filter((v): v is number => v !== null);
  const bigMatchPpg = bigMatchPoints.length > 0
    ? bigMatchPoints.reduce((a, b) => a + b, 0) / bigMatchPoints.length
    : null;

  return {
    teamId,
    gameCount: n,
    avgXgPerGame, avgSotPerGame, goalsOverXg, insideBoxRatio,
    avgXgaPerGame, concededOverXga,
    avgPossession, avgCorners, avgShotsTotal,
    venuePpg, venueXgDiff, venueGameCount,
    bigMatchXgDiff, bigMatchPpg, bigMatchGameCount,
  };
}

// ============================================================
// 축 점수 합산
// ============================================================

function computeAxes(d: RadarAxisDetail): RadarAxisScores {
  return {
    attack: round1(
      (d.a1 ?? 5) * 0.4 + (d.a2 ?? 5) * 0.2 +
      (d.a3 ?? 5) * 0.2 + (d.a4 ?? 5) * 0.2,
    ),
    defense: round1((d.d1 ?? 5) * 0.6 + (d.d2 ?? 5) * 0.4),
    control: round1(
      (d.c1 ?? 5) * 0.5 + (d.c2 ?? 5) * 0.2 + (d.c3 ?? 5) * 0.3,
    ),
    venueEdge: round1((d.v1 ?? 5) * 0.5 + (d.v2 ?? 5) * 0.5),
    bigMatch: round1((d.s1 ?? 5) * 0.5 + (d.s2 ?? 5) * 0.5),
  };
}

function applyTier(
  scores: RadarAxisScores,
  coeff: number,
): RadarAxisScores {
  if (coeff >= 1.0) return scores;
  return {
    attack: round1(scores.attack * coeff),
    defense: round1(scores.defense * coeff),
    control: round1(scores.control * coeff),
    venueEdge: round1(scores.venueEdge * coeff),
    bigMatch: round1(scores.bigMatch * coeff),
  };
}

// ============================================================
// 국내리그 해석 (컵대회용)
// ============================================================

async function resolveDataLeague(
  teamId: bigint,
  fallbackSeason: number,
): Promise<LeagueContext | null> {
  const standing = await prisma.standing.findFirst({
    where: {
      teamId,
      league: { apiLeagueId: { notIn: [...CUP_LEAGUE_IDS] } },
    },
    include: { league: { select: { id: true, apiLeagueId: true, season: true } } },
    orderBy: { league: { priority: "desc" } },
  });

  if (!standing) return null;
  return {
    leagueId: standing.league.id,
    season: standing.season,
    apiLeagueId: standing.league.apiLeagueId,
  };
}

// ============================================================
// 메인 함수
// ============================================================

export async function computeRadarScores(
  fixtureId: bigint,
  window: RadarWindow = "last5",
): Promise<RadarOutput | null> {
  try {
    // Q1: 대상 경기 로드
    const fixture = await prisma.fixture.findUnique({
      where: { id: fixtureId },
      include: {
        league: { select: { id: true, apiLeagueId: true, season: true } },
      },
    });

    if (!fixture) return null;

    const fixtureKickoff = fixture.kickoffAt;
    const isCup = CUP_LEAGUE_IDS.has(fixture.league.apiLeagueId);
    let homeCtx: LeagueContext;
    let awayCtx: LeagueContext;
    let tierCoeff = TIER_MAP[fixture.league.apiLeagueId] ?? DEFAULT_TIER;

    if (isCup) {
      // Q2: 국내리그 해석 (병렬)
      const [hCtx, aCtx] = await Promise.all([
        resolveDataLeague(fixture.homeTeamId, fixture.season),
        resolveDataLeague(fixture.awayTeamId, fixture.season),
      ]);

      homeCtx = hCtx ?? {
        leagueId: fixture.league.id,
        season: fixture.season,
        apiLeagueId: fixture.league.apiLeagueId,
      };
      awayCtx = aCtx ?? {
        leagueId: fixture.league.id,
        season: fixture.season,
        apiLeagueId: fixture.league.apiLeagueId,
      };

      // 티어 계수: 각 팀의 국내리그 기준
      tierCoeff = Math.max(
        TIER_MAP[homeCtx.apiLeagueId] ?? DEFAULT_TIER,
        TIER_MAP[awayCtx.apiLeagueId] ?? DEFAULT_TIER,
      );
    } else {
      const ctx: LeagueContext = {
        leagueId: fixture.league.id,
        season: fixture.season,
        apiLeagueId: fixture.league.apiLeagueId,
      };
      homeCtx = ctx;
      awayCtx = ctx;
    }

    // 양 팀이 같은 리그인지 판별
    const sameLeague =
      homeCtx.leagueId === awayCtx.leagueId &&
      homeCtx.season === awayCtx.season;

    // 리그별 데이터 로드 함수
    async function loadLeagueData(ctx: LeagueContext) {
      const [snapshots, standings] = await Promise.all([
        prisma.fixtureTeamStatSnapshot.findMany({
          where: {
            fixture: {
              leagueId: ctx.leagueId,
              season: ctx.season,
              status: "FT",
              kickoffAt: { lt: fixtureKickoff },
            },
          },
          select: {
            teamId: true,
            fixtureId: true,
            isHome: true,
            xg: true,
            shotsOnTarget: true,
            shotsTotal: true,
            shotsInsideBox: true,
            possessionPct: true,
            corners: true,
            fixture: {
              select: {
                kickoffAt: true,
                homeTeamId: true,
                awayTeamId: true,
                homeGoals: true,
                awayGoals: true,
              },
            },
          },
          orderBy: { fixture: { kickoffAt: "desc" } },
        }),
        prisma.standing.findMany({
          where: { leagueId: ctx.leagueId, season: ctx.season },
          select: { teamId: true, rank: true },
          orderBy: { rank: "asc" },
        }),
      ]);

      return { snapshots: snapshots as SnapshotRow[], standings };
    }

    // Q3+Q4: 벌크 로드 (병렬)
    let homeData: Awaited<ReturnType<typeof loadLeagueData>>;
    let awayData: Awaited<ReturnType<typeof loadLeagueData>>;

    if (sameLeague) {
      homeData = await loadLeagueData(homeCtx);
      awayData = homeData; // 같은 리그면 공유
    } else {
      [homeData, awayData] = await Promise.all([
        loadLeagueData(homeCtx),
        loadLeagueData(awayCtx),
      ]);
    }

    // ──────────────────────────────────────────────────────────
    // 인메모리 처리
    // ──────────────────────────────────────────────────────────

    function processLeague(
      data: { snapshots: SnapshotRow[]; standings: { teamId: bigint; rank: number }[] },
      targetTeamId: bigint,
      isHomeInTarget: boolean,
    ) {
      const { snapshots, standings } = data;

      // xG 가용성
      const xgCount = snapshots.filter((s) => s.xg !== null).length;
      const hasXgData = xgCount > snapshots.length * 0.5;

      // fixtureSnapMap: 경기별 양팀 페어링
      const fixtureSnapMap = new Map<string, SnapshotRow[]>();
      for (const snap of snapshots) {
        const fid = snap.fixtureId.toString();
        if (!fixtureSnapMap.has(fid)) fixtureSnapMap.set(fid, []);
        fixtureSnapMap.get(fid)!.push(snap);
      }

      // 팀별 그룹핑 (kickoffAt desc 이미 보장)
      const snapshotsByTeam = new Map<string, SnapshotRow[]>();
      for (const snap of snapshots) {
        const tid = snap.teamId.toString();
        if (!snapshotsByTeam.has(tid)) snapshotsByTeam.set(tid, []);
        snapshotsByTeam.get(tid)!.push(snap);
      }

      // 강팀 판별 (상위 30%)
      const top30rank = Math.ceil(standings.length * 0.3);
      const topTeamIds = new Set(
        standings.filter((s) => s.rank <= top30rank).map((s) => s.teamId.toString()),
      );

      // Window 필터
      function applyWindow(teamSnaps: SnapshotRow[]): SnapshotRow[] {
        return window === "last5" ? teamSnaps.slice(0, 5) : teamSnaps;
      }

      // 모든 팀의 원시 지표 계산 (10분위용)
      const allMetrics: TeamRawMetrics[] = [];
      for (const [tid, teamSnaps] of snapshotsByTeam) {
        const wSnaps = applyWindow(teamSnaps);
        // 홈어드벤티지: 각 팀에 대해 isHomeInTarget은 해당 팀의 것을 사용
        // → 리그 비교이므로 모든 팀을 isHome=true/false 구분 없이 계산하고,
        //   타겟 팀만 실제 isHomeInTarget으로 계산
        const metrics = computeTeamRawMetrics(
          tid,
          wSnaps,
          fixtureSnapMap,
          hasXgData,
          tid === targetTeamId.toString() ? isHomeInTarget : true, // 다른 팀은 홈 기준
          topTeamIds,
        );
        allMetrics.push(metrics);
      }

      // 타겟 팀 찾기
      const targetTid = targetTeamId.toString();
      const targetMetrics = allMetrics.find((m) => m.teamId === targetTid);
      if (!targetMetrics || targetMetrics.gameCount === 0) {
        return null; // 데이터 없음
      }

      // 시즌 초반 체크
      const earlySeasonWarning = targetMetrics.gameCount < 5;

      // --- 효율 지표 분모 임계값 ---
      const leagueAvgXg = avg(
        allMetrics.map((m) => {
          if (!m.avgXgPerGame || m.gameCount === 0) return null;
          return m.avgXgPerGame * m.gameCount;
        }),
      );
      const leagueAvgXga = avg(
        allMetrics.map((m) => {
          if (!m.avgXgaPerGame || m.gameCount === 0) return null;
          return m.avgXgaPerGame * m.gameCount;
        }),
      );

      // 타겟 팀의 총 xG, xGA
      const targetWindowSnaps = applyWindow(snapshotsByTeam.get(targetTid) ?? []);
      const targetTotalXg = sum(targetWindowSnaps.map((s) => getXgValue(s, hasXgData)));
      const targetTotalXga = sum(
        targetWindowSnaps.map((s) => getOpponentStat(s, fixtureSnapMap, hasXgData)),
      );

      // --- 10분위 점수 산출 ---
      function buildDecileValues(
        key: keyof TeamRawMetrics,
      ): { teamId: string; value: number }[] {
        return allMetrics
          .filter((m) => m[key] !== null && m.gameCount >= (earlySeasonWarning ? 1 : 5))
          .map((m) => ({ teamId: m.teamId, value: m[key] as number }));
      }

      let detail: RadarAxisDetail;

      if (earlySeasonWarning) {
        // 시즌 초반: raw → 고정 범위 스케일링
        const m = targetMetrics;
        detail = {
          a1: rawToDecile(m.avgXgPerGame, "avgXgPerGame"),
          a2: rawToDecile(m.avgSotPerGame, "avgSotPerGame"),
          a3: m.goalsOverXg !== null ? rawToDecile(m.goalsOverXg, "goalsOverXg") : 5,
          a4: m.insideBoxRatio !== null ? rawToDecile(m.insideBoxRatio, "insideBoxRatio") : 5,
          d1: m.avgXgaPerGame !== null
            ? 11 - rawToDecile(m.avgXgaPerGame, "avgXgaPerGame") // 뒤집기
            : 5,
          d2: m.concededOverXga !== null
            ? 11 - rawToDecile(m.concededOverXga, "concededOverXga")
            : 5,
          c1: rawToDecile(m.avgPossession, "avgPossession"),
          c2: rawToDecile(m.avgCorners, "avgCorners"),
          c3: rawToDecile(m.avgShotsTotal, "avgShotsTotal"),
          v1: m.venueGameCount >= 1 ? rawToDecile(m.venuePpg, "venuePpg") : 5,
          v2: m.venueGameCount >= 1 ? rawToDecile(m.venueXgDiff, "venueXgDiff") : 5,
          s1: 5, // 시즌 초반은 강팀 데이터 부족
          s2: 5,
        };
      } else {
        // 정상: 리그 10분위

        // A3 분모 확인
        const a3Threshold = (leagueAvgXg ?? 0) * 0.3;
        const a3Neutral = targetTotalXg < a3Threshold;

        // D2 분모 확인
        const d2Threshold = (leagueAvgXga ?? 0) * 0.3;
        const d2Neutral = targetTotalXga < d2Threshold;

        detail = {
          a1: computeDecile(buildDecileValues("avgXgPerGame"), targetTid, false),
          a2: computeDecile(buildDecileValues("avgSotPerGame"), targetTid, false),
          a3: a3Neutral ? 5 : computeDecile(buildDecileValues("goalsOverXg"), targetTid, false, true),
          a4: targetMetrics.insideBoxRatio !== null
            ? computeDecile(buildDecileValues("insideBoxRatio"), targetTid, false)
            : 5,
          d1: computeDecile(buildDecileValues("avgXgaPerGame"), targetTid, true),
          d2: d2Neutral ? 5 : computeDecile(buildDecileValues("concededOverXga"), targetTid, true, true),
          c1: computeDecile(buildDecileValues("avgPossession"), targetTid, false),
          c2: computeDecile(buildDecileValues("avgCorners"), targetTid, false),
          c3: computeDecile(buildDecileValues("avgShotsTotal"), targetTid, false),
          v1: targetMetrics.venueGameCount >= 2
            ? computeDecile(buildDecileValues("venuePpg"), targetTid, false)
            : 5,
          v2: targetMetrics.venueGameCount >= 2
            ? computeDecile(buildDecileValues("venueXgDiff"), targetTid, false)
            : 5,
          s1: targetMetrics.bigMatchGameCount > 1
            ? computeDecile(buildDecileValues("bigMatchXgDiff"), targetTid, false)
            : 5,
          s2: targetMetrics.bigMatchGameCount > 1
            ? computeDecile(buildDecileValues("bigMatchPpg"), targetTid, false)
            : 5,
        };
      }

      return { detail, hasXgData, earlySeasonWarning };
    }

    // 홈·원정 팀 각각 계산
    const homeResult = processLeague(homeData, fixture.homeTeamId, true);
    const awayResult = processLeague(awayData, fixture.awayTeamId, false);

    if (!homeResult || !awayResult) return null;

    // 축 점수 합산
    let homeScores = computeAxes(homeResult.detail);
    let awayScores = computeAxes(awayResult.detail);

    // 컵대회 티어 보정
    if (isCup) {
      const homeTier = TIER_MAP[homeCtx.apiLeagueId] ?? DEFAULT_TIER;
      const awayTier = TIER_MAP[awayCtx.apiLeagueId] ?? DEFAULT_TIER;
      homeScores = applyTier(homeScores, homeTier);
      awayScores = applyTier(awayScores, awayTier);
    }

    return {
      hasXgData: homeResult.hasXgData && awayResult.hasXgData,
      window,
      tierCoefficient: tierCoeff,
      earlySeasonWarning: homeResult.earlySeasonWarning || awayResult.earlySeasonWarning,
      home: homeScores,
      away: awayScores,
      homeDetail: homeResult.detail,
      awayDetail: awayResult.detail,
    };
  } catch (error: any) {
    console.error("[RadarEngine] Error:", error.message);
    return null;
  }
}
