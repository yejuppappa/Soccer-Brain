type StatItem = {
    type: string;
    value: string | number | null;
  };
  
  export function normalizeTeamStats(statistics: StatItem[]) {
    const map: Record<string, string> = {
      "Total Shots": "shotsTotal",
      "Shots on Goal": "shotsOnTarget",
      "Shots off Goal": "shotsOffTarget",
      "Shots insidebox": "shotsInsideBox",      // Phase A
      "Shots outsidebox": "shotsOutsideBox",    // Phase A
      "Blocked Shots": "blockedShots",          // Phase A

      "Ball Possession": "possessionPct",

      "Total passes": "passesTotal",
      "Passes accurate": "passesAccurate",
      "Passes %": "passAccuracyPct",

      "Fouls": "fouls",
      "Corner Kicks": "corners",
      "Offsides": "offsides",

      "Yellow Cards": "yellowCards",
      "Red Cards": "redCards",

      "Tackles": "tackles",
      "Interceptions": "interceptions",

      "Total duels": "duelsTotal",
      "Duels won": "duelsWon",

      "Goalkeeper Saves": "saves",

      "Expected Goals": "xg",         // 구 형식 (하위 호환)
      "expected_goals": "xg",         // 신 형식 (현재 API)
      "goals_prevented": "goalsPrevented",  // Phase A
    };
  
    const normalized: Record<string, number | null> = {};
    const extras: Record<string, number | null> = {};
  
    for (const stat of statistics) {
      const key = map[stat.type];
  
      let value: number | null = null;
  
      if (typeof stat.value === "string") {
        value = parseFloat(stat.value.replace("%", ""));
      } else if (typeof stat.value === "number") {
        value = stat.value;
      }
  
      if (key) {
        normalized[key] = value;
      } else {
        extras[stat.type] = value;
      }
    }
  
    return { normalized, extras };
  }
  