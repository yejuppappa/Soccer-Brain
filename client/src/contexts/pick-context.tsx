import { createContext, useContext, useState, ReactNode } from "react";

export interface PickItem {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  matchTime: string;
  selection: 'home' | 'draw' | 'away';
  odds: number;
  league: string;
}

interface PickContextType {
  picks: PickItem[];
  addPick: (pick: PickItem) => void;
  removePick: (matchId: string) => void;
  togglePick: (pick: PickItem) => void;
  clearPicks: () => void;
  getPickForMatch: (matchId: string) => PickItem | undefined;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const PickContext = createContext<PickContextType | undefined>(undefined);

export function PickProvider({ children }: { children: ReactNode }) {
  const [picks, setPicks] = useState<PickItem[]>([]);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const addPick = (pick: PickItem) => {
    setPicks(prev => {
      const existing = prev.find(p => p.matchId === pick.matchId);
      if (existing) {
        if (existing.selection === pick.selection) {
          return prev.filter(p => p.matchId !== pick.matchId);
        }
        return prev.map(p => p.matchId === pick.matchId ? pick : p);
      }
      return [...prev, pick];
    });
  };

  const removePick = (matchId: string) => {
    setPicks(prev => prev.filter(p => p.matchId !== matchId));
  };

  const togglePick = (pick: PickItem) => {
    setPicks(prev => {
      const existing = prev.find(p => p.matchId === pick.matchId);
      if (existing && existing.selection === pick.selection) {
        return prev.filter(p => p.matchId !== pick.matchId);
      }
      if (existing) {
        return prev.map(p => p.matchId === pick.matchId ? pick : p);
      }
      return [...prev, pick];
    });
  };

  const clearPicks = () => {
    setPicks([]);
  };

  const getPickForMatch = (matchId: string) => {
    return picks.find(p => p.matchId === matchId);
  };

  return (
    <PickContext.Provider value={{ 
      picks, 
      addPick, 
      removePick, 
      togglePick, 
      clearPicks, 
      getPickForMatch,
      isDrawerOpen,
      setDrawerOpen
    }}>
      {children}
    </PickContext.Provider>
  );
}

export function usePicks() {
  const context = useContext(PickContext);
  if (!context) {
    throw new Error("usePicks must be used within a PickProvider");
  }
  return context;
}
