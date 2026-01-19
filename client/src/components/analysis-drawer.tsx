import { useState } from "react";
import { X, Trash2, Sparkles, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { usePicks } from "@/contexts/pick-context";
import { motion, AnimatePresence } from "framer-motion";

type AnalysisResult = {
  type: 'success' | 'warning' | 'neutral';
  message: string;
  details: string[];
};

function analyzePicksCombination(picks: typeof usePicks extends () => { picks: infer P } ? P : never): AnalysisResult {
  const count = picks.length;
  
  if (count === 0) {
    return {
      type: 'neutral',
      message: '분석할 경기를 담아주세요',
      details: []
    };
  }

  const totalOdds = picks.reduce((acc, p) => acc * p.odds, 1);
  const hasHighOdds = picks.some(p => p.odds > 3.0);
  const hasLowOdds = picks.every(p => p.odds < 2.0);
  const drawCount = picks.filter(p => p.selection === 'draw').length;

  if (count === 1) {
    if (picks[0].odds < 1.5) {
      return {
        type: 'success',
        message: '안정적인 단폴 선택이에요!',
        details: ['낮은 배당률로 적중 가능성이 높습니다', '단폴은 리스크가 적은 전략입니다']
      };
    }
    return {
      type: 'neutral',
      message: '단폴 분석 완료',
      details: [`예상 배당률: ${picks[0].odds.toFixed(2)}`]
    };
  }

  if (hasHighOdds && count >= 3) {
    return {
      type: 'warning',
      message: '위험한 경기가 섞여 있습니다!',
      details: [
        '고배당 경기가 포함되어 있어요',
        `${count}폴 조합의 총 배당률: ${totalOdds.toFixed(2)}`,
        'AI 추천: 고배당 경기를 제외해보세요'
      ]
    };
  }

  if (drawCount >= 2) {
    return {
      type: 'warning',
      message: '무승부 조합은 변동성이 커요',
      details: [
        `무승부 ${drawCount}개 포함`,
        '무승부는 예측 난이도가 높습니다',
        'AI 추천: 무승부는 1개 이하로 줄여보세요'
      ]
    };
  }

  if (hasLowOdds && count <= 3) {
    return {
      type: 'success',
      message: '이 조합은 성공 확률이 높아요!',
      details: [
        '안정적인 배당률로 구성되어 있습니다',
        `${count}폴 조합의 총 배당률: ${totalOdds.toFixed(2)}`,
        'AI 분석: 좋은 조합입니다'
      ]
    };
  }

  if (count >= 4) {
    return {
      type: 'warning',
      message: '조합 수가 많아 리스크가 있어요',
      details: [
        `${count}폴 조합`,
        `총 배당률: ${totalOdds.toFixed(2)}`,
        'AI 추천: 3폴 이하로 줄이면 적중률이 올라갑니다'
      ]
    };
  }

  return {
    type: 'success',
    message: '균형 잡힌 조합이에요!',
    details: [
      `${count}폴 조합`,
      `총 배당률: ${totalOdds.toFixed(2)}`,
      'AI 분석 결과: 적절한 리스크/리턴 비율'
    ]
  };
}

export function AnalysisDrawer() {
  const { picks, removePick, clearPicks, isDrawerOpen, setDrawerOpen } = usePicks();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const totalOdds = picks.reduce((acc, p) => acc * p.odds, 1);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const result = analyzePicksCombination(picks);
    setAnalysisResult(result);
    setIsAnalyzing(false);
  };

  const getSelectionLabel = (selection: 'home' | 'draw' | 'away') => {
    switch (selection) {
      case 'home': return '홈승';
      case 'draw': return '무승부';
      case 'away': return '원정승';
    }
  };

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setDrawerOpen(false)}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl max-h-[85vh] overflow-hidden"
          >
            <div className="flex flex-col h-full max-h-[85vh]">
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h2 className="font-bold text-lg">AI 분석함</h2>
                  <Badge variant="secondary">{picks.length}경기</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {picks.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={clearPicks}
                      className="text-muted-foreground"
                      data-testid="button-clear-picks"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      전체삭제
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setDrawerOpen(false)}
                    data-testid="button-close-drawer"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {picks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>담은 경기가 없습니다</p>
                    <p className="text-sm mt-1">일정 탭에서 경기를 선택해보세요</p>
                  </div>
                ) : (
                  picks.map((pick) => (
                    <Card key={pick.matchId} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-1">{pick.league}</div>
                          <div className="font-medium text-sm">
                            {pick.homeTeam} vs {pick.awayTeam}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="default" className="text-xs">
                              {getSelectionLabel(pick.selection)}
                            </Badge>
                            <span className="text-sm font-semibold text-primary">
                              {pick.odds.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePick(pick.matchId)}
                          className="text-muted-foreground hover:text-destructive"
                          data-testid={`button-remove-pick-${pick.matchId}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}

                {analysisResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={`p-4 mt-4 ${
                      analysisResult.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
                      analysisResult.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                      'bg-muted/50'
                    }`}>
                      <div className="flex items-start gap-3">
                        {analysisResult.type === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                        ) : analysisResult.type === 'warning' ? (
                          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-semibold">{analysisResult.message}</p>
                          <ul className="mt-2 space-y-1">
                            {analysisResult.details.map((detail, i) => (
                              <li key={i} className="text-sm text-muted-foreground">
                                • {detail}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </div>

              {picks.length > 0 && (
                <div className="p-4 border-t bg-background sticky bottom-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">예상 총 배당률</span>
                    <span className="text-xl font-bold text-primary">{totalOdds.toFixed(2)}</span>
                  </div>
                  <Button 
                    className="w-full h-12 text-base font-semibold gap-2"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    data-testid="button-analyze-picks"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        AI 분석 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        AI 조합 분석
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
