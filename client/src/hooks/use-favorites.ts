import { useState, useCallback, useMemo } from "react";

const FAV_LEAGUES_KEY = "soccerbrain_fav_leagues";
const FAV_TEAMS_KEY = "soccerbrain_fav_teams";

interface StoredTeam {
  id: number;
  name: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readTeams(): StoredTeam[] {
  try {
    const raw = localStorage.getItem(FAV_TEAMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 하위 호환: number[] → StoredTeam[]
    if (parsed.length > 0 && typeof parsed[0] === "number") {
      return parsed.map((id: number) => ({ id, name: `Team #${id}` }));
    }
    return parsed;
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favLeagues, setFavLeagues] = useState<number[]>(() => readJson(FAV_LEAGUES_KEY, []));
  const [favTeamsData, setFavTeamsData] = useState<StoredTeam[]>(() => readTeams());

  // 외부 인터페이스: number[] (membership check용)
  const favTeams = useMemo(() => favTeamsData.map(t => t.id), [favTeamsData]);
  // 이름 조회용
  const favTeamEntries = favTeamsData;

  const toggleLeague = useCallback((apiLeagueId: number) => {
    setFavLeagues(prev => {
      const next = prev.includes(apiLeagueId)
        ? prev.filter(id => id !== apiLeagueId)
        : [...prev, apiLeagueId];
      localStorage.setItem(FAV_LEAGUES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleTeam = useCallback((apiTeamId: number, name?: string) => {
    setFavTeamsData(prev => {
      const exists = prev.find(t => t.id === apiTeamId);
      const next = exists
        ? prev.filter(t => t.id !== apiTeamId)
        : [...prev, { id: apiTeamId, name: name || `Team #${apiTeamId}` }];
      localStorage.setItem(FAV_TEAMS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const hasFavorites = favLeagues.length > 0 || favTeamsData.length > 0;

  return { favLeagues, favTeams, favTeamEntries, toggleLeague, toggleTeam, hasFavorites };
}
