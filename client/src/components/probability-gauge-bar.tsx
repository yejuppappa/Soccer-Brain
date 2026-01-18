import { motion } from "framer-motion";
import type { WinDrawLossProbability } from "@shared/schema";

interface ProbabilityGaugeBarProps {
  probability: WinDrawLossProbability;
  homeTeamName: string;
  awayTeamName: string;
}

export function ProbabilityGaugeBar({ 
  probability, 
  homeTeamName, 
  awayTeamName 
}: ProbabilityGaugeBarProps) {
  return (
    <div className="w-full" data-testid="probability-gauge">
      <div className="flex justify-between text-sm mb-3">
        <div className="flex flex-col items-start">
          <span className="font-bold text-destructive">{probability.homeWin}%</span>
          <span className="text-xs text-muted-foreground">홈 승</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-bold text-muted-foreground">{probability.draw}%</span>
          <span className="text-xs text-muted-foreground">무승부</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-bold text-primary">{probability.awayWin}%</span>
          <span className="text-xs text-muted-foreground">원정 승</span>
        </div>
      </div>
      
      <div className="h-6 rounded-full overflow-hidden flex bg-muted/30">
        <motion.div
          className="bg-destructive h-full"
          initial={{ width: 0 }}
          animate={{ width: `${probability.homeWin}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          data-testid="bar-home-win"
        />
        <motion.div
          className="bg-muted-foreground/40 h-full"
          initial={{ width: 0 }}
          animate={{ width: `${probability.draw}%` }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          data-testid="bar-draw"
        />
        <motion.div
          className="bg-primary h-full"
          initial={{ width: 0 }}
          animate={{ width: `${probability.awayWin}%` }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          data-testid="bar-away-win"
        />
      </div>
      
      <div className="flex justify-between text-xs mt-2 text-muted-foreground">
        <span>{homeTeamName}</span>
        <span>{awayTeamName}</span>
      </div>
    </div>
  );
}
