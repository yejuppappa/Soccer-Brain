import type { StandardizedMatch, StandardizedResult, StandardizedTeamStats } from "@shared/schema";
import type { RawFixtureData, FixtureStatistics } from "./api-football";

function calculateAttackStat(possession: number, shotsOnTarget: number, totalShots: number): number {
  const possessionScore = possession * 0.3;
  const accuracyScore = totalShots > 0 ? (shotsOnTarget / totalShots) * 40 : 20;
  const volumeScore = Math.min(totalShots * 2, 30);
  return Math.round(Math.min(100, possessionScore + accuracyScore + volumeScore));
}

function calculateDefenseStat(shotsAgainst: number, possession: number): number {
  const shotDefense = Math.max(0, 50 - shotsAgainst * 2);
  const possessionControl = possession * 0.3;
  const baseDefense = 30;
  return Math.round(Math.min(100, baseDefense + shotDefense + possessionControl));
}

function calculateOrganizationStat(passAccuracy: number, possession: number): number {
  const passScore = passAccuracy * 0.5;
  const possessionScore = possession * 0.3;
  const baseOrg = 20;
  return Math.round(Math.min(100, baseOrg + passScore + possessionScore));
}

function calculateFormFromResult(result: StandardizedResult, ranking: number): number {
  const baseForm = 50 - (ranking - 10);
  const resultBonus = result === 'W' ? 20 : result === 'D' ? 10 : -5;
  return Math.round(Math.min(100, Math.max(20, baseForm + resultBonus)));
}

function extractStatValue(stats: FixtureStatistics[], teamId: number, statType: string): number {
  const teamStats = stats.find(s => s.team.id === teamId);
  if (!teamStats) return 0;
  
  const stat = teamStats.statistics.find(s => s.type === statType);
  if (!stat || stat.value === null) return 0;
  
  if (typeof stat.value === 'string') {
    const parsed = parseFloat(stat.value.replace('%', ''));
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return stat.value;
}

export function transformRawToStandardized(
  raw: RawFixtureData,
  homeRank: number = 10,
  awayRank: number = 10,
  homeForm: string = "DDDDD",
  awayForm: string = "DDDDD",
  statistics?: FixtureStatistics[]
): StandardizedMatch {
  const result: StandardizedResult = 
    raw.homeScore > raw.awayScore ? 'W' :
    raw.homeScore < raw.awayScore ? 'L' : 'D';

  let homeStats: StandardizedTeamStats;
  let awayStats: StandardizedTeamStats;
  let quality: 'basic' | 'enriched' = 'basic';

  if (statistics && statistics.length >= 2) {
    const homePossession = extractStatValue(statistics, raw.homeTeamId, 'Ball Possession');
    const awayPossession = extractStatValue(statistics, raw.awayTeamId, 'Ball Possession');
    const homeShotsOnTarget = extractStatValue(statistics, raw.homeTeamId, 'Shots on Goal');
    const awayShotsOnTarget = extractStatValue(statistics, raw.awayTeamId, 'Shots on Goal');
    const homeTotalShots = extractStatValue(statistics, raw.homeTeamId, 'Total Shots');
    const awayTotalShots = extractStatValue(statistics, raw.awayTeamId, 'Total Shots');
    const homePassAccuracy = extractStatValue(statistics, raw.homeTeamId, 'Passes %');
    const awayPassAccuracy = extractStatValue(statistics, raw.awayTeamId, 'Passes %');

    homeStats = {
      attack: calculateAttackStat(homePossession, homeShotsOnTarget, homeTotalShots),
      defense: calculateDefenseStat(awayTotalShots, homePossession),
      organization: calculateOrganizationStat(homePassAccuracy, homePossession),
      form: calculateFormFromResult(result, homeRank),
      ranking: homeRank,
    };

    awayStats = {
      attack: calculateAttackStat(awayPossession, awayShotsOnTarget, awayTotalShots),
      defense: calculateDefenseStat(homeTotalShots, awayPossession),
      organization: calculateOrganizationStat(awayPassAccuracy, awayPossession),
      form: calculateFormFromResult(result === 'W' ? 'L' : result === 'L' ? 'W' : 'D', awayRank),
      ranking: awayRank,
    };

    quality = 'enriched';
  } else {
    const homeFormWins = (homeForm || "").split('').filter(c => c === 'W').length;
    const awayFormWins = (awayForm || "").split('').filter(c => c === 'W').length;
    
    homeStats = {
      attack: 40 + Math.round((21 - homeRank) * 2) + homeFormWins * 3,
      defense: 40 + Math.round((21 - homeRank) * 2) + homeFormWins * 2,
      organization: 50 + Math.round((21 - homeRank) * 1.5),
      form: 40 + homeFormWins * 10,
      ranking: homeRank,
    };

    awayStats = {
      attack: 40 + Math.round((21 - awayRank) * 2) + awayFormWins * 3,
      defense: 40 + Math.round((21 - awayRank) * 2) + awayFormWins * 2,
      organization: 50 + Math.round((21 - awayRank) * 1.5),
      form: 40 + awayFormWins * 10,
      ranking: awayRank,
    };

    homeStats.attack = Math.min(95, homeStats.attack);
    homeStats.defense = Math.min(95, homeStats.defense);
    homeStats.organization = Math.min(95, homeStats.organization);
    homeStats.form = Math.min(95, homeStats.form);
    awayStats.attack = Math.min(95, awayStats.attack);
    awayStats.defense = Math.min(95, awayStats.defense);
    awayStats.organization = Math.min(95, awayStats.organization);
    awayStats.form = Math.min(95, awayStats.form);
  }

  return {
    id: `std-${raw.fixtureId}`,
    match_date: raw.date,
    home_team: raw.homeTeam,
    away_team: raw.awayTeam,
    home_score: raw.homeScore,
    away_score: raw.awayScore,
    home_stats: homeStats,
    away_stats: awayStats,
    result,
    venue: raw.venue,
    source: "api-football-v3",
    source_id: String(raw.fixtureId),
    collected_at: new Date().toISOString(),
    quality,
  };
}

export function getSourceIdFromStandardized(match: StandardizedMatch): string {
  return match.source_id;
}

export function isAlreadyCollected(
  existingMatches: StandardizedMatch[],
  sourceId: string
): boolean {
  return existingMatches.some(m => m.source_id === sourceId);
}
