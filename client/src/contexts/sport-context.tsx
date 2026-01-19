import { createContext, useContext, useState, ReactNode } from "react";

export type SportType = 'soccer' | 'basketball' | 'baseball' | 'volleyball';

interface SportContextType {
  currentSport: SportType;
  setCurrentSport: (sport: SportType) => void;
}

const SportContext = createContext<SportContextType | undefined>(undefined);

export function SportProvider({ children }: { children: ReactNode }) {
  const [currentSport, setCurrentSport] = useState<SportType>('soccer');

  return (
    <SportContext.Provider value={{ currentSport, setCurrentSport }}>
      {children}
    </SportContext.Provider>
  );
}

export function useSport() {
  const context = useContext(SportContext);
  if (context === undefined) {
    throw new Error('useSport must be used within a SportProvider');
  }
  return context;
}
