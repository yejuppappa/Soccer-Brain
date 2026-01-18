import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedProbabilityChartProps {
  probability: number;
  previousProbability?: number;
  showChange?: boolean;
}

export function AnimatedProbabilityChart({
  probability,
  previousProbability,
  showChange = true,
}: AnimatedProbabilityChartProps) {
  const [displayProbability, setDisplayProbability] = useState(probability);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevProbRef = useRef(probability);

  const change = previousProbability !== undefined 
    ? probability - previousProbability 
    : 0;

  useEffect(() => {
    if (prevProbRef.current !== probability) {
      setIsAnimating(true);
      const startValue = prevProbRef.current;
      const endValue = probability;
      const duration = 500;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (endValue - startValue) * easeProgress;
        
        setDisplayProbability(Math.round(currentValue));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          prevProbRef.current = probability;
        }
      };

      requestAnimationFrame(animate);
    }
  }, [probability]);

  const getColorClass = (prob: number) => {
    if (prob >= 60) return "text-success";
    if (prob >= 40) return "text-primary";
    return "text-destructive";
  };

  const getBarColorClass = (prob: number) => {
    if (prob >= 60) return "bg-success";
    if (prob >= 40) return "bg-primary";
    return "bg-destructive";
  };

  const getBgColorClass = (prob: number) => {
    if (prob >= 60) return "bg-success/10";
    if (prob >= 40) return "bg-primary/10";
    return "bg-destructive/10";
  };

  return (
    <div className="flex flex-col items-center space-y-6" data-testid="probability-chart">
      <div className="relative flex flex-col items-center">
        <motion.div
          className={`text-6xl font-bold tabular-nums ${getColorClass(displayProbability)}`}
          animate={{ scale: isAnimating ? [1, 1.05, 1] : 1 }}
          transition={{ duration: 0.3 }}
          data-testid="text-probability-value"
        >
          {displayProbability}%
        </motion.div>
        <span className="text-sm text-muted-foreground mt-1">홈팀 승리 확률</span>
        
        <AnimatePresence>
          {showChange && change !== 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`absolute -right-16 top-2 text-lg font-semibold ${
                change > 0 ? "text-success" : "text-destructive"
              }`}
              data-testid="text-probability-change"
            >
              {change > 0 ? "+" : ""}{change}%
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-xs">
        <div className={`h-4 rounded-full overflow-hidden ${getBgColorClass(displayProbability)}`}>
          <motion.div
            className={`h-full rounded-full ${getBarColorClass(displayProbability)}`}
            initial={{ width: `${prevProbRef.current}%` }}
            animate={{ width: `${displayProbability}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            data-testid="bar-probability"
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
