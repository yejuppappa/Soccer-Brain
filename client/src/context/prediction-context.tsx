import { createContext, useContext, useState, type ReactNode } from "react";
import type { Match, WinDrawLossProbability } from "@shared/schema";

export type PredictionType = 'home' | 'draw' | 'away';

export interface SelectedPrediction {
  match: Match;
  prediction: PredictionType;
  probability: WinDrawLossProbability;
  odds: number;
  selectedProbability: number;
}

interface PredictionContextType {
  selections: SelectedPrediction[];
  addSelection: (match: Match, prediction: PredictionType, probability: WinDrawLossProbability) => void;
  removeSelection: (matchId: string) => void;
  updateSelection: (matchId: string, prediction: PredictionType) => void;
  clearSelections: () => void;
  getSelection: (matchId: string) => SelectedPrediction | undefined;
  totalOdds: number;
  totalProbability: number;
}

const PredictionContext = createContext<PredictionContextType | null>(null);

function getOddsForPrediction(match: Match, prediction: PredictionType): number {
  switch (prediction) {
    case 'home': return match.odds.domestic[0];
    case 'draw': return match.odds.domestic[1];
    case 'away': return match.odds.domestic[2];
  }
}

function getProbabilityForPrediction(probability: WinDrawLossProbability, prediction: PredictionType): number {
  switch (prediction) {
    case 'home': return probability.homeWin;
    case 'draw': return probability.draw;
    case 'away': return probability.awayWin;
  }
}

export function PredictionProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<SelectedPrediction[]>([]);

  const addSelection = (match: Match, prediction: PredictionType, probability: WinDrawLossProbability) => {
    const existing = selections.find(s => s.match.id === match.id);
    if (existing) {
      updateSelection(match.id, prediction);
      return;
    }

    const newSelection: SelectedPrediction = {
      match,
      prediction,
      probability,
      odds: getOddsForPrediction(match, prediction),
      selectedProbability: getProbabilityForPrediction(probability, prediction),
    };

    setSelections(prev => [...prev, newSelection]);
  };

  const removeSelection = (matchId: string) => {
    setSelections(prev => prev.filter(s => s.match.id !== matchId));
  };

  const updateSelection = (matchId: string, prediction: PredictionType) => {
    setSelections(prev => prev.map(s => {
      if (s.match.id === matchId) {
        return {
          ...s,
          prediction,
          odds: getOddsForPrediction(s.match, prediction),
          selectedProbability: getProbabilityForPrediction(s.probability, prediction),
        };
      }
      return s;
    }));
  };

  const clearSelections = () => {
    setSelections([]);
  };

  const getSelection = (matchId: string) => {
    return selections.find(s => s.match.id === matchId);
  };

  const totalOdds = selections.length > 0 
    ? selections.reduce((acc, s) => acc * s.odds, 1) 
    : 0;

  const totalProbability = selections.length > 0 
    ? selections.reduce((acc, s) => acc * (s.selectedProbability / 100), 1) * 100 
    : 0;

  return (
    <PredictionContext.Provider value={{
      selections,
      addSelection,
      removeSelection,
      updateSelection,
      clearSelections,
      getSelection,
      totalOdds,
      totalProbability,
    }}>
      {children}
    </PredictionContext.Provider>
  );
}

export function usePrediction() {
  const context = useContext(PredictionContext);
  if (!context) {
    throw new Error('usePrediction must be used within a PredictionProvider');
  }
  return context;
}
