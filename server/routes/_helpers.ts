// 라우트 모듈들이 공유하는 헬퍼 함수

const CALENDAR_YEAR_LEAGUES = new Set([292, 293, 98, 99]); // K League 1, K League 2, J1 League, J2 League

export function getCurrentSeason(leagueApiId: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (CALENDAR_YEAR_LEAGUES.has(leagueApiId)) {
    return year;
  }

  return month >= 7 ? year : year - 1;
}
