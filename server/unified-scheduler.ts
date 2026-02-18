/**
 * 🚀 Soccer Brain 통합 자동화 스케줄러
 * 
 * 모든 데이터 갱신을 자동으로 관리합니다.
 * 
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    자동화 파이프라인                          │
 * ├─────────────────────────────────────────────────────────────┤
 * │  🌅 매일 06:00     → 경기 일정 동기화 (7일치)                  │
 * │  🏥 매일 08:00     → 부상자 명단 1차 갱신                      │
 * │  📊 매일 09:00     → 피처 빌드 (AI 예측 준비) + 날씨           │
 * │  🏥 매일 18:00     → 부상자 명단 2차 갱신                      │
 * │  ⏰ 30분마다       → 순위표 + 경기 결과 + 라인업 체크           │
 * │  💰 1시간마다      → 배당 갱신 (히스토리 저장)                  │
 * │  🌤️ 날씨          → 경기 가져올 때 + 매일 갱신                 │
 * └─────────────────────────────────────────────────────────────┘
 * 
 * 예상 API 호출량: ~1,500회/일 (ULTRA 70,000회 한도의 2%)
 */

import cron from "node-cron";
import { prisma } from "./db";
import { 
  fetchStandingsForLeague, 
  fetchFixturesByDateRange,
  fetchOddsForFixture,
  fetchFixtureStatistics,
  fetchFixtureLineups,
  isApiConfigured 
} from "./api-football";
import axios from "axios";

// ============================================================
// 상수 정의
// ============================================================
const CALENDAR_YEAR_LEAGUES = new Set([292, 293, 98, 99]); // K리그1, K리그2, J1리그, J2리그
const API_DELAY_MS = 300; // API 호출 간격 (속도 제한 방지)
const LINEUP_CHECK_HOURS_BEFORE = 0; // 경기 직전까지 라인업 체크

// ============================================================
// 유틸리티 함수들
// ============================================================

function getCurrentSeason(leagueApiId: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  if (CALENDAR_YEAR_LEAGUES.has(leagueApiId)) {
    return year;
  }
  return month >= 7 ? year : year - 1;
}

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const icons = { info: '📋', success: '✅', error: '❌', warn: '⚠️' };
  const timestamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  console.log(`[${timestamp}] ${icons[type]} [AutoSync] ${message}`);
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 쿨다운 관리: 동일 작업 중복 실행 방지 ──
const lastRunTime: Record<string, number> = {};
const COOLDOWN_MS = 20 * 60 * 1000; // 20분

function shouldSkip(taskName: string): boolean {
  const last = lastRunTime[taskName];
  if (last && (Date.now() - last) < COOLDOWN_MS) {
    const minutesAgo = Math.round((Date.now() - last) / 60000);
    log(`⏭️ ${taskName}: ${minutesAgo}분 전에 실행 완료 → 건너뜀`);
    return true;
  }
  return false;
}

function markDone(taskName: string) {
  lastRunTime[taskName] = Date.now();
}

// ============================================================
// 1. 경기 일정 동기화 (매일 06:00)
// ============================================================
export async function syncFixtures(): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  try {
    const leagues = await prisma.league.findMany({
      where: { enabled: true },
      orderBy: { priority: "desc" },
    });

    const now = new Date();
    const from = now.toISOString().split('T')[0];
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const to = endDate.toISOString().split('T')[0];

    log(`경기 일정 동기화: ${from} ~ ${to} (${leagues.length}개 리그)`);

    for (const league of leagues) {
      try {
        const season = getCurrentSeason(league.apiLeagueId);
        const fixtures = await fetchFixturesByDateRange({
          leagueId: league.apiLeagueId,
          season,
          from,
          to,
        });

        for (const fx of fixtures) {
          // 팀 upsert (새 팀 발견시 자동 생성)
          const home = await prisma.team.upsert({
            where: { apiTeamId: fx.homeTeamId },
            update: { name: fx.homeTeam },
            create: { apiTeamId: fx.homeTeamId, name: fx.homeTeam, logoUrl: `https://media.api-sports.io/football/teams/${fx.homeTeamId}.png` },
          });
          if (!home.logoUrl) {
            await prisma.team.update({ where: { id: home.id }, data: { logoUrl: `https://media.api-sports.io/football/teams/${fx.homeTeamId}.png` } });
          }

          const away = await prisma.team.upsert({
            where: { apiTeamId: fx.awayTeamId },
            update: { name: fx.awayTeam },
            create: { apiTeamId: fx.awayTeamId, name: fx.awayTeam, logoUrl: `https://media.api-sports.io/football/teams/${fx.awayTeamId}.png` },
          });
          if (!away.logoUrl) {
            await prisma.team.update({ where: { id: away.id }, data: { logoUrl: `https://media.api-sports.io/football/teams/${fx.awayTeamId}.png` } });
          }

          // Fixture upsert
          const fixture = await prisma.fixture.upsert({
            where: { apiFixtureId: fx.fixtureId },
            update: {
              leagueId: league.id,
              season,
              kickoffAt: new Date(fx.date),
              status: fx.status || "NS",
              homeTeamId: home.id,
              awayTeamId: away.id,
              homeGoals: fx.homeScore ?? null,
              awayGoals: fx.awayScore ?? null,
              venueName: fx.venueName ?? null,
              venueCity: fx.venueCity ?? null,
            },
            create: {
              apiFixtureId: fx.fixtureId,
              leagueId: league.id,
              season,
              kickoffAt: new Date(fx.date),
              status: fx.status || "NS",
              homeTeamId: home.id,
              awayTeamId: away.id,
              homeGoals: fx.homeScore ?? null,
              awayGoals: fx.awayScore ?? null,
              venueName: fx.venueName ?? null,
              venueCity: fx.venueCity ?? null,
            },
          });

          // 새 경기면 날씨도 가져오기
          await syncWeatherForFixture(fixture.id, fx.venueName ?? null, fx.venueCity ?? null);

          synced++;
        }

        await delay(API_DELAY_MS);
      } catch (err: any) {
        errors++;
        log(`${league.name} 일정 동기화 실패: ${err.message}`, 'error');
      }
    }

    log(`경기 일정: ${synced}개 동기화, ${errors}개 오류`, synced > 0 ? 'success' : 'warn');
  } catch (error: any) {
    log(`경기 일정 동기화 실패: ${error.message}`, 'error');
  }

  return { synced, errors };
}

// ============================================================
// 2. 경기 결과 + 팀 스탯 동기화 (30분마다)
// ============================================================
export async function syncResultsAndStats(): Promise<{ updated: number; statsAdded: number; errors: number }> {
  if (shouldSkip('결과')) return { updated: 0, statsAdded: 0, errors: 0 };
  let updated = 0;
  let statsAdded = 0;
  let errors = 0;

  try {
    // 지난 48시간 내 경기 중 아직 FT가 아닌 것
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const fixtures = await prisma.fixture.findMany({
      where: {
        kickoffAt: { gte: twoDaysAgo, lte: now },
        status: { notIn: ["FT", "PST", "CANC", "ABD", "AWD", "WO"] },
      },
      include: { league: true },
    });

    if (fixtures.length === 0) {
      return { updated: 0, statsAdded: 0, errors: 0 };
    }

    log(`경기 결과 체크: ${fixtures.length}개 경기`);

    for (const fixture of fixtures) {
      try {
        const season = getCurrentSeason(fixture.league.apiLeagueId);
        const from = fixture.kickoffAt.toISOString().split('T')[0];
        
        const results = await fetchFixturesByDateRange({
          leagueId: fixture.league.apiLeagueId,
          season,
          from,
          to: from,
        });

        const result = results.find(r => r.fixtureId === fixture.apiFixtureId);
        
        if (result) {
          // 상태 업데이트
          await prisma.fixture.update({
            where: { id: fixture.id },
            data: {
              status: result.status,
              homeGoals: result.homeScore ?? null,
              awayGoals: result.awayScore ?? null,
            },
          });

          // FT면 팀 스탯 가져오기
          if (result.status === "FT") {
            const statsResult = await syncTeamStatsForFixture(fixture.id, fixture.apiFixtureId);
            if (statsResult) statsAdded++;
            
            // TeamMatchStat 기록 (득실 기록)
            await updateTeamMatchStat(fixture);
          }

          updated++;
        }

        await delay(API_DELAY_MS);
      } catch (err: any) {
        errors++;
      }
    }

    if (updated > 0) {
      log(`경기 결과: ${updated}개 업데이트, 팀 스탯 ${statsAdded}개 추가`, 'success');
    }
    markDone('결과');
  } catch (error: any) {
    log(`경기 결과 동기화 실패: ${error.message}`, 'error');
  }

  return { updated, statsAdded, errors };
}

// 팀 스탯 가져오기 (완전히 있으면 스킵)
async function syncTeamStatsForFixture(fixtureId: bigint, apiFixtureId: number): Promise<boolean> {
  try {
    // 이미 있는지 확인 (2개 있으면 완료, 아니면 재수집)
    const existingCount = await prisma.fixtureTeamStatSnapshot.count({
      where: { fixtureId },
    });

    if (existingCount >= 2) {
      return false; // 홈+어웨이 2개 다 있으면 스킵
    }

    const stats = await fetchFixtureStatistics(apiFixtureId);
    if (!stats || stats.length === 0) return false;

    const fixture = await prisma.fixture.findUnique({
      where: { id: fixtureId },
      include: { homeTeam: true, awayTeam: true },
    });

    if (!fixture) return false;

    for (const teamStats of stats) {
      const isHome = teamStats.team.id === fixture.homeTeam.apiTeamId;
      const team = isHome ? fixture.homeTeam : fixture.awayTeam;

      // 통계 파싱
      const getValue = (type: string): any => {
        const stat = teamStats.statistics.find(s => s.type === type);
        return stat?.value;
      };

      await prisma.fixtureTeamStatSnapshot.upsert({
        where: {
          fixtureId_teamId: { fixtureId, teamId: team.id },
        },
        update: {
          shotsTotal: parseInt(getValue("Total Shots")) || null,
          shotsOnTarget: parseInt(getValue("Shots on Goal")) || null,
          shotsOffTarget: parseInt(getValue("Shots off Goal")) || null,
          possessionPct: parseFloat(getValue("Ball Possession")?.replace("%", "")) || null,
          passesTotal: parseInt(getValue("Total passes")) || null,
          passesAccurate: parseInt(getValue("Passes accurate")) || null,
          passAccuracyPct: parseFloat(getValue("Passes %")?.replace("%", "")) || null,
          fouls: parseInt(getValue("Fouls")) || null,
          corners: parseInt(getValue("Corner Kicks")) || null,
          offsides: parseInt(getValue("Offsides")) || null,
          yellowCards: parseInt(getValue("Yellow Cards")) || null,
          redCards: parseInt(getValue("Red Cards")) || null,
          saves: parseInt(getValue("Goalkeeper Saves")) || null,
          xg: parseFloat(getValue("expected_goals")) || null,
          raw: teamStats as unknown as import("@prisma/client").Prisma.InputJsonValue,
          fetchedAt: new Date(),
        },
        create: {
          fixtureId,
          teamId: team.id,
          isHome,
          shotsTotal: parseInt(getValue("Total Shots")) || null,
          shotsOnTarget: parseInt(getValue("Shots on Goal")) || null,
          shotsOffTarget: parseInt(getValue("Shots off Goal")) || null,
          possessionPct: parseFloat(getValue("Ball Possession")?.replace("%", "")) || null,
          passesTotal: parseInt(getValue("Total passes")) || null,
          passesAccurate: parseInt(getValue("Passes accurate")) || null,
          passAccuracyPct: parseFloat(getValue("Passes %")?.replace("%", "")) || null,
          fouls: parseInt(getValue("Fouls")) || null,
          corners: parseInt(getValue("Corner Kicks")) || null,
          offsides: parseInt(getValue("Offsides")) || null,
          yellowCards: parseInt(getValue("Yellow Cards")) || null,
          redCards: parseInt(getValue("Red Cards")) || null,
          saves: parseInt(getValue("Goalkeeper Saves")) || null,
          xg: parseFloat(getValue("expected_goals")) || null,
          raw: teamStats as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
    }

    return true;
  } catch (error: any) {
    log(`팀 스탯 동기화 실패 (fixture ${apiFixtureId}): ${error.message}`, 'error');
    return false;
  }
}

// TeamMatchStat 기록
async function updateTeamMatchStat(fixture: any): Promise<void> {
  try {
    if (fixture.homeGoals === null || fixture.awayGoals === null) return;

    // 홈팀 기록
    await prisma.teamMatchStat.upsert({
      where: {
        fixtureId_teamId: { fixtureId: fixture.id, teamId: fixture.homeTeamId },
      },
      update: {
        goalsFor: fixture.homeGoals,
        goalsAgainst: fixture.awayGoals,
      },
      create: {
        fixtureId: fixture.id,
        teamId: fixture.homeTeamId,
        isHome: true,
        goalsFor: fixture.homeGoals,
        goalsAgainst: fixture.awayGoals,
        playedAt: fixture.kickoffAt,
      },
    });

    // 원정팀 기록
    await prisma.teamMatchStat.upsert({
      where: {
        fixtureId_teamId: { fixtureId: fixture.id, teamId: fixture.awayTeamId },
      },
      update: {
        goalsFor: fixture.awayGoals,
        goalsAgainst: fixture.homeGoals,
      },
      create: {
        fixtureId: fixture.id,
        teamId: fixture.awayTeamId,
        isHome: false,
        goalsFor: fixture.awayGoals,
        goalsAgainst: fixture.homeGoals,
        playedAt: fixture.kickoffAt,
      },
    });
  } catch (error: any) {
    // 무시 (중복 등)
  }
}

// ============================================================
// 3. 순위표 동기화 (30분마다)
// ============================================================
export async function syncStandings(): Promise<{ updated: number; errors: number }> {
  if (shouldSkip('순위')) return { updated: 0, errors: 0 };
  let updated = 0;
  let errors = 0;

  try {
    const leagues = await prisma.league.findMany({
      where: { enabled: true },
      orderBy: { priority: "desc" },
    });

    for (const league of leagues) {
      try {
        const season = getCurrentSeason(league.apiLeagueId);
        const standings = await fetchStandingsForLeague(league.apiLeagueId, season);

        for (const s of standings) {
          const team = await prisma.team.upsert({
            where: { apiTeamId: s.teamId },
            update: { name: s.teamName },
            create: { apiTeamId: s.teamId, name: s.teamName, logoUrl: `https://media.api-sports.io/football/teams/${s.teamId}.png` },
          });
          if (!team.logoUrl) {
            await prisma.team.update({ where: { id: team.id }, data: { logoUrl: `https://media.api-sports.io/football/teams/${s.teamId}.png` } });
          }

          await prisma.standing.upsert({
            where: {
              leagueId_teamId_season: {
                leagueId: league.id,
                teamId: team.id,
                season,
              },
            },
            update: {
              rank: s.rank,
              points: s.points,
              played: s.played,
              won: s.won,
              drawn: s.drawn,
              lost: s.lost,
              goalsFor: s.goalsFor,
              goalsAgainst: s.goalsAgainst,
              goalDiff: s.goalDiff,
              form: s.form,
            },
            create: {
              leagueId: league.id,
              teamId: team.id,
              season,
              rank: s.rank,
              points: s.points,
              played: s.played,
              won: s.won,
              drawn: s.drawn,
              lost: s.lost,
              goalsFor: s.goalsFor,
              goalsAgainst: s.goalsAgainst,
              goalDiff: s.goalDiff,
              form: s.form,
            },
          });

          updated++;
        }

        await delay(API_DELAY_MS);
      } catch (err: any) {
        errors++;
        log(`${league.name} 순위 동기화 실패: ${err.message}`, 'error');
      }
    }

    log(`순위표: ${updated}개 팀 업데이트`, 'success');
    markDone('순위');
  } catch (error: any) {
    log(`순위표 동기화 실패: ${error.message}`, 'error');
  }

  return { updated, errors };
}

// ============================================================
// 4. 배당 동기화 (1시간마다) - 다중 북메이커 + 히스토리 저장
// ============================================================
export async function syncOddsWithHistory(): Promise<{ updated: number; errors: number }> {
  if (shouldSkip('배당')) return { updated: 0, errors: 0 };
  let updated = 0;
  let errors = 0;
  let totalBookmakerSnapshots = 0;

  try {
    // 향후 7일 내 아직 시작 안 한 경기
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const fixtures = await prisma.fixture.findMany({
      where: {
        kickoffAt: { gte: now, lte: endDate },
        status: { in: ["NS", "TBD"] },
      },
      include: { odds: true },
      orderBy: { kickoffAt: "asc" },
    });

    log(`배당 동기화: ${fixtures.length}개 경기`);

    for (const fixture of fixtures) {
      try {
        const oddsData = await fetchOddsForFixture(fixture.apiFixtureId);
        
        if (oddsData && oddsData.home && oddsData.draw && oddsData.away) {
          const prevOdds = fixture.odds;
          
          // ─── 기존: FixtureOdds 대표 배당 upsert (호환성 유지) ───
          const currentOdds = await prisma.fixtureOdds.upsert({
            where: { fixtureId: fixture.id },
            update: {
              home: oddsData.home,
              draw: oddsData.draw,
              away: oddsData.away,
              bookmaker: oddsData.bookmaker || "Bet365",
              fetchedAt: new Date(),
            },
            create: {
              fixtureId: fixture.id,
              home: oddsData.home,
              draw: oddsData.draw,
              away: oddsData.away,
              bookmaker: oddsData.bookmaker || "Bet365",
            },
          });

          // 기존 OddsHistory 저장 (매 수집 시점마다 기록)
          const homeChange = prevOdds?.home ? Number(oddsData.home) - Number(prevOdds.home) : null;
          const drawChange = prevOdds?.draw ? Number(oddsData.draw) - Number(prevOdds.draw) : null;
          const awayChange = prevOdds?.away ? Number(oddsData.away) - Number(prevOdds.away) : null;

          await prisma.oddsHistory.create({
            data: {
              oddsId: currentOdds.id,
              home: oddsData.home,
              draw: oddsData.draw,
              away: oddsData.away,
              homeChange,
              drawChange,
              awayChange,
            },
          });

          // ─── NEW: 다중 북메이커 배당 저장 ───
          if (oddsData.allBookmakers && oddsData.allBookmakers.length > 0) {
            for (const bm of oddsData.allBookmakers) {
              try {
                await saveBookmakerOddsSnapshot(fixture.id, bm);
                totalBookmakerSnapshots++;
              } catch (bmErr: any) {
                // 개별 북메이커 에러는 무시하고 계속 진행
              }
            }
          }

          updated++;
        }

        await delay(API_DELAY_MS);
      } catch (err: any) {
        errors++;
      }
    }

    log(`배당: ${updated}개 경기 업데이트 | 북메이커 스냅샷 ${totalBookmakerSnapshots}건 저장`, updated > 0 ? 'success' : 'warn');
    markDone('배당');
  } catch (error: any) {
    log(`배당 동기화 실패: ${error.message}`, 'error');
  }

  return { updated, errors };
}

/**
 * 북메이커별 배당 스냅샷 저장 + open/delta/velocity 계산
 */
async function saveBookmakerOddsSnapshot(
  fixtureId: bigint,
  bm: { bookmaker: string; home: number; draw: number; away: number }
): Promise<void> {
  const now = new Date();
  
  // 기존 BookmakerOdds 조회 (있으면 업데이트, 없으면 생성)
  const existing = await prisma.bookmakerOdds.findUnique({
    where: { fixtureId_bookmaker: { fixtureId, bookmaker: bm.bookmaker } },
    include: { 
      snapshots: { 
        orderBy: { recordedAt: 'desc' }, 
        take: 1 
      } 
    },
  });

  // 직전 스냅샷 대비 변동 계산
  const lastSnapshot = existing?.snapshots?.[0];
  const homeChange = lastSnapshot ? bm.home - Number(lastSnapshot.home) : null;
  const drawChange = lastSnapshot ? bm.draw - Number(lastSnapshot.draw) : null;
  const awayChange = lastSnapshot ? bm.away - Number(lastSnapshot.away) : null;

  if (existing) {
    // ── 업데이트: current 갱신 + delta 계산 ──
    const deltaHome = existing.openHome ? bm.home - Number(existing.openHome) : null;
    const deltaDraw = existing.openDraw ? bm.draw - Number(existing.openDraw) : null;
    const deltaAway = existing.openAway ? bm.away - Number(existing.openAway) : null;

    // velocity 계산: 최근 3시간 스냅샷 기반
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const recentSnapshots = await prisma.bookmakerOddsSnapshot.findMany({
      where: {
        bookmakerOddsId: existing.id,
        recordedAt: { gte: threeHoursAgo },
      },
      orderBy: { recordedAt: 'asc' },
    });

    let velocityHome: number | null = null;
    let velocityDraw: number | null = null;
    let velocityAway: number | null = null;

    if (recentSnapshots.length >= 2) {
      const first = recentSnapshots[0];
      const last = recentSnapshots[recentSnapshots.length - 1];
      const hoursDiff = (last.recordedAt.getTime() - first.recordedAt.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 0) {
        velocityHome = (bm.home - Number(first.home)) / hoursDiff;
        velocityDraw = (bm.draw - Number(first.draw)) / hoursDiff;
        velocityAway = (bm.away - Number(first.away)) / hoursDiff;
      }
    }

    await prisma.bookmakerOdds.update({
      where: { id: existing.id },
      data: {
        currentHome: bm.home,
        currentDraw: bm.draw,
        currentAway: bm.away,
        deltaHome,
        deltaDraw,
        deltaAway,
        velocityHome,
        velocityDraw,
        velocityAway,
        snapshotCount: { increment: 1 },
      },
    });

    // 스냅샷 저장 (매 수집 시점마다 기록 — 변동 없음도 유의미한 데이터)
    await prisma.bookmakerOddsSnapshot.create({
      data: {
        bookmakerOddsId: existing.id,
        home: bm.home,
        draw: bm.draw,
        away: bm.away,
        homeChange,
        drawChange,
        awayChange,
      },
    });

  } else {
    // ── 신규 생성: open = current = 첫 값 ──
    const newBmOdds = await prisma.bookmakerOdds.create({
      data: {
        fixtureId,
        bookmaker: bm.bookmaker,
        openHome: bm.home,
        openDraw: bm.draw,
        openAway: bm.away,
        openAt: now,
        currentHome: bm.home,
        currentDraw: bm.draw,
        currentAway: bm.away,
        deltaHome: 0,
        deltaDraw: 0,
        deltaAway: 0,
        velocityHome: 0,
        velocityDraw: 0,
        velocityAway: 0,
        snapshotCount: 1,
      },
    });

    // 첫 스냅샷 저장
    await prisma.bookmakerOddsSnapshot.create({
      data: {
        bookmakerOddsId: newBmOdds.id,
        home: bm.home,
        draw: bm.draw,
        away: bm.away,
        homeChange: null,
        drawChange: null,
        awayChange: null,
      },
    });
  }
}

// ============================================================
// 5. 부상자 동기화 (매일 08:00, 18:00)
// ============================================================
export async function syncInjuries(): Promise<{ saved: number; errors: number }> {
  if (shouldSkip('부상자')) return { saved: 0, errors: 0 };
  let saved = 0;
  let errors = 0;

  try {
    const apiKey = process.env.API_SPORTS_KEY;
    if (!apiKey) {
      log("API_SPORTS_KEY 없음", 'warn');
      return { saved: 0, errors: 0 };
    }

    const leagues = await prisma.league.findMany({
      where: { enabled: true },
      select: { id: true, apiLeagueId: true, name: true },
    });

    log(`부상자 동기화: ${leagues.length}개 리그`);

    for (const league of leagues) {
      try {
        const season = getCurrentSeason(league.apiLeagueId);
        
        const response = await axios.get("https://v3.football.api-sports.io/injuries", {
          params: { league: league.apiLeagueId, season },
          headers: { "x-apisports-key": apiKey },
          timeout: 20000,
        });

        const items: any[] = response.data?.response ?? [];

        for (const item of items) {
          const apiFixtureId = item?.fixture?.id;
          const apiTeamId = item?.team?.id;
          const playerName = item?.player?.name;
          const apiPlayerId = item?.player?.id;

          if (!apiFixtureId || !apiTeamId || !playerName) continue;

          const fixture = await prisma.fixture.findUnique({
            where: { apiFixtureId: Number(apiFixtureId) },
          });
          if (!fixture) continue;

          const team = await prisma.team.findUnique({
            where: { apiTeamId: Number(apiTeamId) },
          });
          if (!team) continue;

          // 선수 정보 upsert (새 선수 발견시)
          let playerId: bigint | null = null;
          if (apiPlayerId) {
            const player = await prisma.player.upsert({
              where: { apiPlayerId: Number(apiPlayerId) },
              update: { name: playerName },
              create: { 
                apiPlayerId: Number(apiPlayerId), 
                name: playerName,
                position: item?.player?.position || null,
              },
            });
            playerId = player.id;
          }

          const externalKey = `${apiFixtureId}-${apiTeamId}-${apiPlayerId || playerName}`;

          await prisma.fixtureInjury.upsert({
            where: { source_externalKey: { source: "api-football", externalKey } },
            update: {
              playerName,
              reason: item?.player?.reason || null,
              status: item?.player?.type || null,
              playerId,
              fetchedAt: new Date(),
            },
            create: {
              fixtureId: fixture.id,
              teamId: team.id,
              apiPlayerId: apiPlayerId || null,
              playerName,
              reason: item?.player?.reason || null,
              status: item?.player?.type || null,
              source: "api-football",
              externalKey,
              playerId,
            },
          });

          saved++;
        }

        await delay(API_DELAY_MS);
      } catch (err: any) {
        errors++;
        log(`${league.name} 부상자 동기화 실패: ${err.message}`, 'error');
      }
    }

    log(`부상자: ${saved}명 업데이트`, saved > 0 ? 'success' : 'warn');
    markDone('부상자');
  } catch (error: any) {
    log(`부상자 동기화 실패: ${error.message}`, 'error');
  }

  return { saved, errors };
}

// ============================================================
// 6. 누락 통계 백필 (주 1회 - 48시간 놓친 경기 복구)
// ============================================================
export async function syncMissedStats(): Promise<{ backfilled: number; errors: number }> {
  if (shouldSkip('백필')) return { backfilled: 0, errors: 0 };
  let backfilled = 0;
  let errors = 0;

  try {
    log("🔄 누락 통계 백필 시작 (FT인데 통계 없는 경기)...");

    // 지난 60일 내 FT 경기 중 FixtureTeamStatSnapshot 없는 것
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const missedFixtures = await prisma.fixture.findMany({
      where: {
        kickoffAt: { gte: sixtyDaysAgo, lte: now },
        status: "FT",
        teamStats: { none: {} },
      },
      include: { league: true },
      take: 100, // 한 번에 최대 100경기만 (쿼터 보호)
      orderBy: { kickoffAt: "desc" },
    });

    if (missedFixtures.length === 0) {
      log("✅ 누락 통계 없음", 'success');
      markDone('백필');
      return { backfilled: 0, errors: 0 };
    }

    log(`누락 경기 발견: ${missedFixtures.length}개`);

    for (const fixture of missedFixtures) {
      try {
        const success = await syncTeamStatsForFixture(fixture.id, fixture.apiFixtureId);
        if (success) {
          backfilled++;
          log(`✅ ${fixture.apiFixtureId} 백필 완료`);
        }

        await delay(API_DELAY_MS);
      } catch (err: any) {
        errors++;
        log(`❌ ${fixture.apiFixtureId} 백필 실패: ${err.message}`, 'error');
      }
    }

    log(`누락 통계 백필: ${backfilled}개 완료, ${errors}개 실패`, backfilled > 0 ? 'success' : 'warn');
    markDone('백필');
  } catch (error: any) {
    log(`누락 통계 백필 실패: ${error.message}`, 'error');
  }

  return { backfilled, errors };
}

// ============================================================
// 7. 라인업 동기화 (30분마다 - 경기 1시간 전부터)
// ============================================================
export async function syncLineups(): Promise<{ updated: number; errors: number }> {
  if (shouldSkip('라인업')) return { updated: 0, errors: 0 };
  let updated = 0;
  let errors = 0;

  try {
    const now = new Date();
    const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    // 현재~3시간 후 시작 경기 중 라인업 미확정인 것
    const fixtures = await prisma.fixture.findMany({
      where: {
        kickoffAt: { gte: now, lte: threeHoursLater },
        status: { in: ["NS", "TBD"] },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        lineups: { where: { isConfirmed: true } },
      },
    });

    // 이미 확정 라인업 있는 경기 제외
    const fixturesNeedLineup = fixtures.filter(f => f.lineups.length === 0);

    if (fixturesNeedLineup.length === 0) {
      return { updated: 0, errors: 0 };
    }

    log(`라인업 체크: ${fixturesNeedLineup.length}개 경기`);

    for (const fixture of fixturesNeedLineup) {
      try {
        const lineups = await fetchFixtureLineups(fixture.apiFixtureId);
        
        if (lineups && lineups.length > 0) {
          for (const lineup of lineups) {
            const isHome = lineup.team.id === fixture.homeTeam.apiTeamId;
            const team = isHome ? fixture.homeTeam : fixture.awayTeam;

            // 라인업 저장
            const savedLineup = await prisma.fixtureLineup.upsert({
              where: {
                fixtureId_teamId_isConfirmed_source: {
                  fixtureId: fixture.id,
                  teamId: team.id,
                  isConfirmed: true,
                  source: "api-football",
                },
              },
              update: {
                formation: lineup.formation,
                coachName: lineup.coach?.name || null,
                raw: lineup as any,
                fetchedAt: new Date(),
              },
              create: {
                fixtureId: fixture.id,
                teamId: team.id,
                formation: lineup.formation,
                coachName: lineup.coach?.name || null,
                isConfirmed: true,
                source: "api-football",
                raw: lineup as any,
              },
            });

            // 선발/교체 선수 저장
            const allPlayers = [
              ...lineup.startXI.map(p => ({ ...p, isStarter: true })),
              ...lineup.substitutes.map(p => ({ ...p, isStarter: false })),
            ];

            for (const playerData of allPlayers) {
              // 선수 upsert
              const player = await prisma.player.upsert({
                where: { apiPlayerId: playerData.player.id },
                update: { name: playerData.player.name },
                create: {
                  apiPlayerId: playerData.player.id,
                  name: playerData.player.name,
                  position: playerData.player.pos || null,
                },
              });

              await prisma.fixtureLineupPlayer.upsert({
                where: {
                  lineupId_playerId: {
                    lineupId: savedLineup.id,
                    playerId: player.id,
                  },
                },
                update: {
                  isStarter: playerData.isStarter,
                  number: playerData.player.number || null,
                  pos: playerData.player.pos || null,
                },
                create: {
                  fixtureId: fixture.id,
                  teamId: team.id,
                  lineupId: savedLineup.id,
                  playerId: player.id,
                  isStarter: playerData.isStarter,
                  number: playerData.player.number || null,
                  pos: playerData.player.pos || null,
                },
              });
            }
          }

          updated++;
        }

        await delay(API_DELAY_MS);
      } catch (err: any) {
        errors++;
      }
    }

    if (updated > 0) {
      log(`라인업: ${updated}개 경기 확정`, 'success');
    markDone('라인업');
    }
  } catch (error: any) {
    log(`라인업 동기화 실패: ${error.message}`, 'error');
  }

  return { updated, errors };
}

// ============================================================
// 7. 날씨 동기화
// ============================================================
async function syncWeatherForFixture(fixtureId: bigint, venueName: string | null, venueCity: string | null): Promise<boolean> {
  try {
    if (!venueName && !venueCity) return false;

    // 이미 날씨 있으면 스킵 (나중에 업데이트는 별도 함수에서)
    const existing = await prisma.fixtureWeather.findUnique({
      where: { fixtureId },
    });
    if (existing) return false;

    // Geocoding (도시 이름 → 좌표)
    const query = venueCity || venueName;
    const geoResponse = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
      params: { name: query, count: 1 },
    });

    const location = geoResponse.data?.results?.[0];
    if (!location) return false;

    // 날씨 가져오기
    const weatherResponse = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude: location.latitude,
        longitude: location.longitude,
        current: "temperature_2m,weather_code,wind_speed_10m,precipitation,relative_humidity_2m,cloud_cover",
        timezone: "auto",
      },
    });

    const current = weatherResponse.data?.current;
    if (!current) return false;

    // 날씨 코드 → 상태 텍스트
    const weatherCondition = getWeatherCondition(current.weather_code);

    await prisma.fixtureWeather.create({
      data: {
        fixtureId,
        tempC: current.temperature_2m,
        condition: weatherCondition,
        weatherCode: current.weather_code,
        windKph: current.wind_speed_10m,
        precipitationMm: current.precipitation,
        humidityPct: current.relative_humidity_2m,
        cloudCoverPct: current.cloud_cover,
        lat: location.latitude,
        lon: location.longitude,
        provider: "open-meteo",
      },
    });

    return true;
  } catch (error: any) {
    return false;
  }
}

// 날씨 업데이트 (매일)
export async function syncWeatherUpdates(): Promise<{ updated: number; errors: number }> {
  if (shouldSkip('날씨')) return { updated: 0, errors: 0 };
  let updated = 0;
  let errors = 0;

  try {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 경기 1시간 전 ~ 7일 내 경기
    const fixtures = await prisma.fixture.findMany({
      where: {
        kickoffAt: { gte: oneHourLater, lte: sevenDaysLater },
        status: { in: ["NS", "TBD"] },
        weather: { isNot: null },
      },
      include: { weather: true },
    });

    log(`날씨 업데이트: ${fixtures.length}개 경기`);

    for (const fixture of fixtures) {
      try {
        if (!fixture.weather?.lat || !fixture.weather?.lon) continue;

        const weatherResponse = await axios.get("https://api.open-meteo.com/v1/forecast", {
          params: {
            latitude: fixture.weather.lat,
            longitude: fixture.weather.lon,
            current: "temperature_2m,weather_code,wind_speed_10m,precipitation,relative_humidity_2m,cloud_cover",
            timezone: "auto",
          },
        });

        const current = weatherResponse.data?.current;
        if (current) {
          const weatherCondition = getWeatherCondition(current.weather_code);

          await prisma.fixtureWeather.update({
            where: { fixtureId: fixture.id },
            data: {
              tempC: current.temperature_2m,
              condition: weatherCondition,
              weatherCode: current.weather_code,
              windKph: current.wind_speed_10m,
              precipitationMm: current.precipitation,
              humidityPct: current.relative_humidity_2m,
              cloudCoverPct: current.cloud_cover,
              fetchedAt: new Date(),
            },
          });

          updated++;
        }

        await delay(200);
      } catch (err: any) {
        errors++;
      }
    }

    log(`날씨: ${updated}개 업데이트`, updated > 0 ? 'success' : 'warn');
    markDone('날씨');
  } catch (error: any) {
    log(`날씨 업데이트 실패: ${error.message}`, 'error');
  }

  return { updated, errors };
}

// 날씨 코드 → 텍스트
function getWeatherCondition(code: number): string {
  const conditions: { [key: number]: string } = {
    0: "Clear",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    71: "Slight Snow",
    73: "Moderate Snow",
    75: "Heavy Snow",
    80: "Slight Rain Showers",
    81: "Moderate Rain Showers",
    82: "Violent Rain Showers",
    95: "Thunderstorm",
  };
  return conditions[code] || "Unknown";
}

// ============================================================
// 스케줄러 초기화
// ============================================================
export function initUnifiedScheduler(): void {
  if (!isApiConfigured()) {
    log("API 설정 안됨. 스케줄러 비활성화.", 'warn');
    return;
  }

  // GitHub Actions가 데이터 수집을 담당할 때 로컬 스케줄러 비활성화
  if (process.env.DISABLE_LOCAL_SCHEDULER === 'true') {
    log("🌐 DISABLE_LOCAL_SCHEDULER=true → 로컬 cron 비활성화 (GitHub Actions가 수집 담당)", 'warn');
    return;
  }

  log("🚀 통합 스케줄러 초기화...");

  // ────────────────────────────────────────────────────────────
  // 서버 시작 시 초기 동기화 (30초 후)
  // - 각 함수에 20분 쿨다운이 있어 cron과 겹쳐도 중복 실행 방지
  // ────────────────────────────────────────────────────────────
  setTimeout(async () => {
    log("📦 초기 동기화 시작...");
    await syncStandings();
    await syncOddsWithHistory();
    await syncInjuries();
    await syncWeatherUpdates();
    await syncLineups();
    log("📦 초기 동기화 완료!", 'success');
  }, 30000);

  // ────────────────────────────────────────────────────────────
  // 30분마다: 순위 + 결과 + 라인업
  // ────────────────────────────────────────────────────────────
  cron.schedule("*/30 * * * *", async () => {
    log("⏰ 30분 주기 작업...");
    await syncStandings();
    await syncResultsAndStats();
    await syncLineups();
  }, { timezone: "Asia/Seoul" });

  // ────────────────────────────────────────────────────────────
  // 1시간마다: 배당 동기화
  // ────────────────────────────────────────────────────────────
  cron.schedule("0 * * * *", async () => {
    log("💰 배당 동기화...");
    await syncOddsWithHistory();
  }, { timezone: "Asia/Seoul" });

  // ────────────────────────────────────────────────────────────
  // 매일 06:00: 경기 일정
  // ────────────────────────────────────────────────────────────
  cron.schedule("0 6 * * *", async () => {
    log("🌅 경기 일정 동기화...");
    await syncFixtures();
  }, { timezone: "Asia/Seoul" });

  // ────────────────────────────────────────────────────────────
  // 매일 08:00: 부상자 1차
  // ────────────────────────────────────────────────────────────
  cron.schedule("0 8 * * *", async () => {
    log("🏥 부상자 1차 동기화...");
    await syncInjuries();
  }, { timezone: "Asia/Seoul" });

  // ────────────────────────────────────────────────────────────
  // 매일 09:00: 날씨 업데이트
  // ────────────────────────────────────────────────────────────
  cron.schedule("0 9 * * *", async () => {
    log("🌦️ 날씨 업데이트...");
    await syncWeatherUpdates();
  }, { timezone: "Asia/Seoul" });

  // ────────────────────────────────────────────────────────────
  // 매일 18:00: 부상자 2차
  // ────────────────────────────────────────────────────────────
  cron.schedule("0 18 * * *", async () => {
    log("🏥 부상자 2차 동기화...");
    await syncInjuries();
  }, { timezone: "Asia/Seoul" });

  // ────────────────────────────────────────────────────────────
  // 매주 일요일 03:00: 누락 통계 백필
  // ────────────────────────────────────────────────────────────
  cron.schedule("0 3 * * 0", async () => {
    log("🔄 누락 통계 백필 (주 1회)...");
    await syncMissedStats();
  }, { timezone: "Asia/Seoul" });

  // ────────────────────────────────────────────────────────────
  log("✅ 통합 스케줄러 시작!");
  log("📋 스케줄:");
  log("   • 30분마다      → 순위 + 결과 + 라인업");
  log("   • 1시간마다     → 배당 (히스토리 저장)");
  log("   • 매일 06:00    → 경기 일정");
  log("   • 매일 08:00    → 부상자 1차");
  log("   • 매일 09:00    → 날씨");
  log("   • 매일 18:00    → 부상자 2차");
  log("   • 매주 일요일 03:00 → 🔄 누락 통계 백필");
}

// ============================================================
// 수동 트리거 (API에서 호출 가능)
// ============================================================
export const manualSync = {
  fixtures: syncFixtures,
  results: syncResultsAndStats,
  standings: syncStandings,
  odds: syncOddsWithHistory,
  injuries: syncInjuries,
  lineups: syncLineups,
  weather: syncWeatherUpdates,
  backfill: syncMissedStats,

  all: async () => {
    log("🔄 전체 수동 동기화...");
    await syncFixtures();
    await syncStandings();
    await syncOddsWithHistory();
    await syncInjuries();
    await syncWeatherUpdates();
    await syncMissedStats();
    log("🎉 전체 동기화 완료!", 'success');
  }
};
