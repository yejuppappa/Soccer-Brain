import { useSport } from "@/contexts/sport-context";
import { Construction, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

const sportNames: Record<string, string> = {
  basketball: '농구',
  baseball: '야구',
  volleyball: '배구',
};

const sportIcons: Record<string, string> = {
  basketball: '🏀',
  baseball: '⚾',
  volleyball: '🏐',
};

export function SportPlaceholder() {
  const { currentSport } = useSport();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="relative">
          <div className="text-7xl mb-4">
            {sportIcons[currentSport] || '🏆'}
          </div>
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center animate-pulse">
            <Construction className="h-6 w-6 text-amber-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 분석 모델 준비 중
          </h2>
          <p className="text-muted-foreground">
            {sportNames[currentSport] || currentSport} 종목의 AI 분석 시스템을<br />
            열심히 개발하고 있습니다.
          </p>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            곧 {sportNames[currentSport] || currentSport}도 Soccer Brain 수준의<br />
            정밀한 분석을 제공할 예정입니다.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          개발 진행률 32%
        </div>
      </Card>
    </div>
  );
}
