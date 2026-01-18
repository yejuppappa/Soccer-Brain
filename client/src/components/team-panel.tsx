import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Team } from "@shared/schema";

interface TeamPanelProps {
  team: Team;
  isHome: boolean;
  isFatigued: boolean;
  isKeyPlayerInjured: boolean;
  onFatigueChange: (checked: boolean) => void;
  onInjuryChange: (checked: boolean) => void;
}

export function TeamPanel({
  team,
  isHome,
  isFatigued,
  isKeyPlayerInjured,
  onFatigueChange,
  onInjuryChange,
}: TeamPanelProps) {
  const teamType = isHome ? "홈팀" : "원정팀";
  const sectionColor = isHome ? "text-destructive" : "text-primary";
  const badgeColor = isHome ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary";

  return (
    <Card className="p-4" data-testid={`panel-${isHome ? 'home' : 'away'}-team`}>
      <div className="flex items-center gap-2 mb-4">
        <span className={`font-bold text-sm ${sectionColor}`}>Section {isHome ? 'B' : 'C'}</span>
        <span className="text-sm font-bold">{teamType} 변수</span>
      </div>

      <div className={`inline-block px-3 py-1.5 rounded-md text-sm font-bold mb-4 ${badgeColor}`}>
        {team.name}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Label 
              htmlFor={`${isHome ? 'home' : 'away'}-fatigue`}
              className="font-medium cursor-pointer text-sm"
            >
              휴식 부족
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              휴식 3일 미만
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFatigued && (
              <span className={`text-xs font-bold ${sectionColor}`}>
                {isHome ? '-10%' : '-10%'}
              </span>
            )}
            <Switch
              id={`${isHome ? 'home' : 'away'}-fatigue`}
              checked={isFatigued}
              onCheckedChange={onFatigueChange}
              data-testid={`switch-${isHome ? 'home' : 'away'}-fatigue`}
            />
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Label 
              htmlFor={`${isHome ? 'home' : 'away'}-injury`}
              className="font-medium cursor-pointer text-sm"
            >
              핵심 선수 부상
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {team.topScorer.name} ({team.topScorer.goals}골) 결장
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isKeyPlayerInjured && (
              <span className={`text-xs font-bold ${sectionColor}`}>
                {isHome ? '-15%' : '-15%'}
              </span>
            )}
            <Switch
              id={`${isHome ? 'home' : 'away'}-injury`}
              checked={isKeyPlayerInjured}
              onCheckedChange={onInjuryChange}
              data-testid={`switch-${isHome ? 'home' : 'away'}-injury`}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
