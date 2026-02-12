/**
 * Soccer Brain v2 - New Frontend API Routes
 * 이 파일을 기존 routes.ts 하단에 추가하거나, 별도 import 해서 사용
 * 
 * 추가 엔드포인트:
 * GET /api/v2/fixtures?date=2026-02-10&league=popular|all|39
 * GET /api/v2/fixtures/:id/detail
 * GET /api/v2/highlights?date=2026-02-10
 */

import type { Express } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 시즌 판별 (기존 로직 재사용)
function getCurrentSeason(apiLeagueId: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const springStartLeagues = [292, 293, 98, 99, 294, 17, 18];
  if (springStartLeagues.includes(apiLeagueId)) {
    return year;
  }
  return month >= 7 ? year : year - 1;
}

export function registerV2Routes(app: Express) {
  
  // ============================================================
  // GET /api/v2/fixtures — 날짜별 경기 목록 (홈 화면)
  // ============================================================
  app.get("/api/v2/fixtures", async (req, res) => {
    try {
      const dateStr = req.query.date as string; // "2026-02-10"
      const leagueFilter = req.query.league as string || "popular"; // "popular" | "all" | "39"
      
      // 날짜 범위: 해당 날짜의 00:00 ~ 23:59 (KST 기준)
      let startDate: Date, endDate: Date;
      if (dateStr) {
        startDate = new Date(dateStr + "T00:00:00+09:00");
        endDate = new Date(dateStr + "T23:59:59+09:00");
      } else {
        // 오늘
        const today = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstToday = new Date(today.getTime() + kstOffset);
        const dateOnly = kstToday.toISOString().split("T")[0];
        startDate = new Date(dateOnly + "T00:00:00+09:00");
        endDate = new Date(dateOnly + "T23:59:59+09:00");
      }
      
      // 리그 필터 조건
      let leagueCondition: any = {};
      if (leagueFilter === "popular") {
        const popularApiIds = [39, 140, 78, 135, 61, 292, 293];
        const popularLeagues = await prisma.league.findMany({
          where: { apiLeagueId: { in: popularApiIds }, enabled: true },
          select: { id: true },
        });
        leagueCondition = { leagueId: { in: popularLeagues.map(l => l.id) } };
      } else if (leagueFilter !== "all") {
        const apiId = parseInt(leagueFilter);
        if (!isNaN(apiId)) {
          const league = await prisma.league.findUnique({ where: { apiLeagueId: apiId } });
          if (league) leagueCondition = { leagueId: league.id };
        }
      }
      
      const fixtures = await prisma.fixture.findMany({
        where: {
          kickoffAt: { gte: startDate, lte: endDate },
          ...leagueCondition,
        },
        include: {
          homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true, apiTeamId: true } },
          awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true, apiTeamId: true } },
          league: { select: { id: true, name: true, country: true, apiLeagueId: true } },
          odds: { select: { home: true, draw: true, away: true } },
        },
        orderBy: { kickoffAt: "asc" },
      });
      
      const result = fixtures.map(fx => ({
        id: fx.id.toString(),
        apiFixtureId: fx.apiFixtureId,
        kickoffAt: fx.kickoffAt.toISOString(),
        status: fx.status,
        homeTeam: {
          id: fx.homeTeam.id.toString(),
          name: fx.homeTeam.name,
          shortName: fx.homeTeam.shortName,
          logoUrl: fx.homeTeam.logoUrl,
        },
        awayTeam: {
          id: fx.awayTeam.id.toString(),
          name: fx.awayTeam.name,
          shortName: fx.awayTeam.shortName,
          logoUrl: fx.awayTeam.logoUrl,
        },
        league: {
          id: fx.league.id.toString(),
          name: fx.league.name,
          country: fx.league.country,
          apiId: fx.league.apiLeagueId,
        },
        score: (fx.homeGoals !== null && fx.awayGoals !== null)
          ? { home: fx.homeGoals, away: fx.awayGoals }
          : null,
        odds: fx.odds ? {
          home: Number(fx.odds.home),
          draw: Number(fx.odds.draw),
          away: Number(fx.odds.away),
        } : null,
      }));
      
      res.json({ ok: true, date: dateStr || new Date().toISOString().split("T")[0], fixtures: result });
    } catch (error: any) {
      console.error("[v2/fixtures] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  
  // ============================================================
  // GET /api/v2/fixtures/:id/detail — 경기 상세 (단일 스크롤 페이지용)
  // ============================================================
  app.get("/api/v2/fixtures/:id/detail", async (req, res) => {
    try {
      const fixtureId = BigInt(req.params.id);
      
      const fixture = await prisma.fixture.findUnique({
        where: { id: fixtureId },
        include: {
          homeTeam: true,
          awayTeam: true,
          league: true,
          odds: true,
          weather: true,
          featureSnapshot: true,
          injuries: {
            include: { team: { select: { name: true, shortName: true } } },
          },
          bookmakerOdds: {
            orderBy: { updatedAt: "desc" },
          },
        },
      });
      
      if (!fixture) {
        return res.status(404).json({ ok: false, error: "Fixture not found" });
      }
      
      // 순위 조회
      const [homeStanding, awayStanding] = await Promise.all([
        prisma.standing.findFirst({
          where: { teamId: fixture.homeTeamId, leagueId: fixture.leagueId, season: fixture.season },
        }),
        prisma.standing.findFirst({
          where: { teamId: fixture.awayTeamId, leagueId: fixture.leagueId, season: fixture.season },
        }),
      ]);
      
      const snapshot = fixture.featureSnapshot;
      const odds = fixture.odds;
      
      // 배당 기반 내재확률 계산
      let impliedProb = null;
      if (odds) {
        const h = Number(odds.home), d = Number(odds.draw), a = Number(odds.away);
        if (h > 0 && d > 0 && a > 0) {
          const totalMargin = (1/h + 1/d + 1/a);
          impliedProb = {
            home: Math.round((1/h / totalMargin) * 100),
            draw: Math.round((1/d / totalMargin) * 100),
            away: Math.round((1/a / totalMargin) * 100),
          };
        }
      }
      
      // 경기 요약 생성 (템플릿 기반)
      const summary = generateMatchSummary(fixture, homeStanding, awayStanding, snapshot, impliedProb);
      
      const fmtStanding = (s: any) => s ? {
        rank: s.rank, played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
        goalsFor: s.goalsFor, goalsAgainst: s.goalsAgainst, goalDiff: s.goalDiff,
        points: s.points, form: s.form,
      } : null;
      
      res.json({
        ok: true,
        fixture: {
          id: fixture.id.toString(),
          apiFixtureId: fixture.apiFixtureId,
          kickoffAt: fixture.kickoffAt.toISOString(),
          status: fixture.status,
          season: fixture.season,
          score: (fixture.homeGoals !== null && fixture.awayGoals !== null)
            ? { home: fixture.homeGoals, away: fixture.awayGoals } : null,
          homeTeam: {
            id: fixture.homeTeam.id.toString(),
            name: fixture.homeTeam.name,
            shortName: fixture.homeTeam.shortName,
            logoUrl: fixture.homeTeam.logoUrl,
            standing: fmtStanding(homeStanding),
          },
          awayTeam: {
            id: fixture.awayTeam.id.toString(),
            name: fixture.awayTeam.name,
            shortName: fixture.awayTeam.shortName,
            logoUrl: fixture.awayTeam.logoUrl,
            standing: fmtStanding(awayStanding),
          },
          league: {
            id: fixture.league.id.toString(),
            name: fixture.league.name,
            country: fixture.league.country,
            apiId: fixture.league.apiLeagueId,
          },
          venue: { name: fixture.venueName, city: fixture.venueCity },
          weather: fixture.weather ? {
            temp: fixture.weather.tempC,
            condition: fixture.weather.condition,
          } : null,
        },
        // 배당
        odds: odds ? {
          home: Number(odds.home),
          draw: Number(odds.draw),
          away: Number(odds.away),
        } : null,
        impliedProb,
        // 북메이커별 배당
        bookmakerOdds: fixture.bookmakerOdds.map(bo => ({
          bookmaker: bo.bookmaker,
          home: Number(bo.currentHome || bo.openHome || 0),
          draw: Number(bo.currentDraw || bo.openDraw || 0),
          away: Number(bo.currentAway || bo.openAway || 0),
        })).filter(bo => bo.home > 0),
        // 부상자
        injuries: fixture.injuries.map(inj => ({
          playerName: inj.playerName,
          teamName: inj.team.name,
          teamShortName: inj.team.shortName,
          reason: inj.reason,
          status: inj.status,
          isHome: inj.teamId === fixture.homeTeamId,
        })),
        // 피처 스냅샷 (스탯 비교용)
        stats: snapshot ? {
          home: {
            xg: snapshot.home_xg_avg,
            possession: snapshot.home_possessionPct_avg,
            shotsOnTarget: snapshot.home_shotsOnTarget_avg,
            shotsTotal: snapshot.home_shotsTotal_avg,
            passAccuracy: snapshot.home_passAccuracyPct_avg,
            goalsFor: snapshot.home_goalsFor_avg,
            goalsAgainst: snapshot.home_goalsAgainst_avg,
            corners: snapshot.home_corners_avg,
            goalsForHome: snapshot.home_goalsFor_atHome_avg,
            goalsAgainstHome: snapshot.home_goalsAgainst_atHome_avg,
            xgHome: snapshot.home_xg_atHome_avg,
            winPctHome: snapshot.home_wins_atHome_pct,
            formLast3: snapshot.home_form_last3,
            formLast5: snapshot.home_form_last5,
            daysRest: snapshot.home_days_rest,
            matches14d: snapshot.home_matches_14d,
          },
          away: {
            xg: snapshot.away_xg_avg,
            possession: snapshot.away_possessionPct_avg,
            shotsOnTarget: snapshot.away_shotsOnTarget_avg,
            shotsTotal: snapshot.away_shotsTotal_avg,
            passAccuracy: snapshot.away_passAccuracyPct_avg,
            goalsFor: snapshot.away_goalsFor_avg,
            goalsAgainst: snapshot.away_goalsAgainst_avg,
            corners: snapshot.away_corners_avg,
            goalsForAway: snapshot.away_goalsFor_atAway_avg,
            goalsAgainstAway: snapshot.away_goalsAgainst_atAway_avg,
            xgAway: snapshot.away_xg_atAway_avg,
            winPctAway: snapshot.away_wins_atAway_pct,
            formLast3: snapshot.away_form_last3,
            formLast5: snapshot.away_form_last5,
            daysRest: snapshot.away_days_rest,
            matches14d: snapshot.away_matches_14d,
          },
        } : null,
        // H2H
        h2h: snapshot ? {
          total: snapshot.h2h_total_matches,
          homeWins: snapshot.h2h_home_wins,
          awayWins: snapshot.h2h_away_wins,
          draws: snapshot.h2h_draws,
          homeGoalsAvg: snapshot.h2h_home_goals_avg,
          awayGoalsAvg: snapshot.h2h_away_goals_avg,
          homeWinPct: snapshot.h2h_home_win_pct,
        } : null,
        // AI 경기 요약
        summary,
      });
    } catch (error: any) {
      console.error("[v2/fixtures/:id/detail] Error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  });
  
  // ============================================================
  // GET /api/v2/highlights — 주목할 경기 (홈 상단)
  // ============================================================
  app.get("/api/v2/highlights", async (req, res) => {
    try {
      const dateStr = req.query.date as string;
      
      let startDate: Date, endDate: Date;
      if (dateStr) {
        startDate = new Date(dateStr + "T00:00:00+09:00");
        endDate = new Date(dateStr + "T23:59:59+09:00");
      } else {
        // 오늘 + 내일까지
        const now = new Date();
        startDate = new Date(now.getTime());
        endDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      }
      
      // 인기 리그 경기만
      const popularApiIds = [39, 140, 78, 135, 61, 292, 293];
      const popularLeagues = await prisma.league.findMany({
        where: { apiLeagueId: { in: popularApiIds }, enabled: true },
        select: { id: true },
      });
      
      const fixtures = await prisma.fixture.findMany({
        where: {
          kickoffAt: { gte: startDate, lte: endDate },
          status: { in: ["NS", "TBD"] },
          leagueId: { in: popularLeagues.map(l => l.id) },
        },
        include: {
          homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          league: { select: { name: true, apiLeagueId: true } },
          featureSnapshot: {
            select: {
              home_form_last5: true, away_form_last5: true,
              home_goalsFor_avg: true, away_goalsFor_avg: true,
              home_wins_atHome_pct: true,
              h2h_total_matches: true,
            },
          },
        },
        orderBy: { kickoffAt: "asc" },
      });
      
      // 하이라이트 판정
      const highlights: any[] = [];
      
      for (const fx of fixtures) {
        const s = fx.featureSnapshot;
        const tags: string[] = [];
        
        // 1. 순위 기반 빅매치
        const [hs, as_] = await Promise.all([
          prisma.standing.findFirst({ where: { teamId: fx.homeTeamId, leagueId: fx.leagueId, season: fx.season } }),
          prisma.standing.findFirst({ where: { teamId: fx.awayTeamId, leagueId: fx.leagueId, season: fx.season } }),
        ]);
        if (hs && as_ && hs.rank <= 4 && as_.rank <= 4) {
          tags.push("빅매치");
        }
        
        // 2. 폼 기반 (form에서 연승 체크)
        if (hs?.form) {
          const streak = getWinStreak(hs.form);
          if (streak >= 3) tags.push(`${fx.homeTeam.shortName || fx.homeTeam.name} ${streak}연승`);
        }
        if (as_?.form) {
          const streak = getWinStreak(as_.form);
          if (streak >= 3) tags.push(`${fx.awayTeam.shortName || fx.awayTeam.name} ${streak}연승`);
        }
        
        // 3. 다득점 팀
        if (s?.home_goalsFor_avg && s.home_goalsFor_avg >= 2.0) {
          tags.push(`${fx.homeTeam.shortName || fx.homeTeam.name} 경기당 ${s.home_goalsFor_avg.toFixed(1)}골`);
        }
        if (s?.away_goalsFor_avg && s.away_goalsFor_avg >= 2.0) {
          tags.push(`${fx.awayTeam.shortName || fx.awayTeam.name} 경기당 ${s.away_goalsFor_avg.toFixed(1)}골`);
        }
        
        // 4. 홈 무패
        if (s?.home_wins_atHome_pct && s.home_wins_atHome_pct >= 70) {
          tags.push(`홈 승률 ${Math.round(s.home_wins_atHome_pct)}%`);
        }
        
        if (tags.length > 0) {
          highlights.push({
            id: fx.id.toString(),
            kickoffAt: fx.kickoffAt.toISOString(),
            homeTeam: { name: fx.homeTeam.name, shortName: fx.homeTeam.shortName, logoUrl: fx.homeTeam.logoUrl },
            awayTeam: { name: fx.awayTeam.name, shortName: fx.awayTeam.shortName, logoUrl: fx.awayTeam.logoUrl },
            league: { name: fx.league.name },
            tags,
          });
        }
      }
      
      res.json({ ok: true, highlights: highlights.slice(0, 8) });
    } catch (error: any) {
      console.error("[v2/highlights] Error:", error);
      res.status(500).json({ ok: false, error: error.message, highlights: [] });
    }
  });
}

// ============================================================
// 유틸리티
// ============================================================
function getWinStreak(form: string): number {
  let streak = 0;
  for (let i = form.length - 1; i >= 0; i--) {
    if (form[i] === "W") streak++;
    else break;
  }
  return streak;
}

function generateMatchSummary(
  fixture: any,
  homeStanding: any,
  awayStanding: any,
  snapshot: any,
  impliedProb: any
): string {
  const parts: string[] = [];
  const homeName = fixture.homeTeam.shortName || fixture.homeTeam.name;
  const awayName = fixture.awayTeam.shortName || fixture.awayTeam.name;
  
  // 1. 배당 기반
  if (impliedProb) {
    const fav = impliedProb.home > impliedProb.away ? homeName : awayName;
    const favPct = Math.max(impliedProb.home, impliedProb.away);
    parts.push(`배당상 ${fav} 우세 (${favPct}%).`);
  }
  
  // 2. 순위
  if (homeStanding && awayStanding) {
    parts.push(`${homeName} ${homeStanding.rank}위(${homeStanding.won}승${homeStanding.drawn}무${homeStanding.lost}패) vs ${awayName} ${awayStanding.rank}위(${awayStanding.won}승${awayStanding.drawn}무${awayStanding.lost}패).`);
  }
  
  // 3. 폼
  if (homeStanding?.form && awayStanding?.form) {
    const homeWins = (homeStanding.form || "").split("").filter((c: string) => c === "W").length;
    const awayWins = (awayStanding.form || "").split("").filter((c: string) => c === "W").length;
    parts.push(`최근 5경기: ${homeName} ${homeWins}승, ${awayName} ${awayWins}승.`);
  }
  
  // 4. H2H
  if (snapshot?.h2h_total_matches && snapshot.h2h_total_matches >= 2) {
    parts.push(`최근 ${snapshot.h2h_total_matches}번 맞대결: ${snapshot.h2h_home_wins || 0}승 ${snapshot.h2h_draws || 0}무 ${snapshot.h2h_away_wins || 0}패.`);
  }
  
  // 5. 부상자 수
  if (snapshot) {
    const homeInj = snapshot.homeInjuryCount || 0;
    const awayInj = snapshot.awayInjuryCount || 0;
    if (homeInj + awayInj > 0) {
      const injParts: string[] = [];
      if (homeInj > 0) injParts.push(`${homeName} ${homeInj}명`);
      if (awayInj > 0) injParts.push(`${awayName} ${awayInj}명`);
      parts.push(`결장/부상: ${injParts.join(", ")}.`);
    }
  }
  
  // 6. 휴식일 차이
  if (snapshot?.rest_diff !== null && snapshot?.rest_diff !== undefined && Math.abs(snapshot.rest_diff) >= 3) {
    const tired = snapshot.rest_diff > 0 ? awayName : homeName;
    parts.push(`${tired}은 체력적 불리 (휴식일 차이 ${Math.abs(snapshot.rest_diff)}일).`);
  }
  
  return parts.join(" ") || "분석 데이터 수집 중입니다.";
}
