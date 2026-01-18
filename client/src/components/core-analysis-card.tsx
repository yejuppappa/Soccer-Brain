import { Activity, Clock, UserX } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AnalysisCore } from "@shared/schema";

interface CoreAnalysisCardProps {
  core: AnalysisCore;
  coreNumber: 1 | 2 | 3;
}

export function CoreAnalysisCard({ core, coreNumber }: CoreAnalysisCardProps) {
  const getIcon = () => {
    switch (coreNumber) {
      case 1:
        return <Activity className="h-5 w-5 text-primary" />;
      case 2:
        return <Clock className="h-5 w-5 text-warning" />;
      case 3:
        return <UserX className="h-5 w-5 text-destructive" />;
    }
  };

  const getCoreLabel = () => {
    switch (coreNumber) {
      case 1:
        return "Core 1 - 기초 체력";
      case 2:
        return "Core 2 - 피로도 변수";
      case 3:
        return "Core 3 - 핵심 선수 변수";
    }
  };

  const getValueColor = () => {
    if (core.adjustedValue >= 0) return "text-success";
    return "text-destructive";
  };

  return (
    <Card className="p-4" data-testid={`card-core-${coreNumber}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-sm">{getCoreLabel()}</span>
            <span className={`font-bold text-sm ${getValueColor()}`}>
              {core.adjustedValue >= 0 ? "+" : ""}{core.adjustedValue}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{core.description}</p>
          {!core.isActive && (
            <span className="inline-block mt-2 text-xs bg-muted px-2 py-0.5 rounded">
              비활성
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
