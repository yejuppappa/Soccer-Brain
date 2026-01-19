import { useState } from "react";
import { X, Trash2, Sparkles, AlertTriangle, CheckCircle, Loader2, TrendingUp, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { usePicks } from "@/contexts/pick-context";
import { motion, AnimatePresence } from "framer-motion";

type AnalysisResult = {
  type: 'success' | 'warning' | 'danger' | 'jackpot' | 'neutral';
  title: string;
  message: string;
  details: string[];
};

const AI_COMMENTS = {
  safe: [
    '안전빵이네요! 꾸준함이 승리의 비결입니다.',
    '이 정도면 편하게 잘 수 있겠어요.',
    '착실한 선택! 소확행을 노려보세요.',
    '리스크 최소화! 현명한 선택입니다.',
  ],
  balanced: [
    '밸런스 좋네요! AI도 이 조합 좋아해요.',
    '적당한 스릴과 적당한 안정감!',
    '교과서적인 조합이에요.',
    '이 정도면 도전해볼 만해요!',
  ],
  risky: [
    '심장이 두근두근... 조심하세요!',
    '용기 있는 선택이네요. 행운을 빕니다!',
    '변동성이 좀 있어요. 각오하셨죠?',
    '도전 정신은 좋지만, 신중하게!',
  ],
  danger: [
    '이건 좀... 다시 생각해보세요!',
    '무모한 도전! AI가 말렸는데...',
    '고위험 고수익! 하지만 대부분은...',
    '이 조합은 AI도 책임 못 져요!',
  ],
  jackpot: [
    '대박 아니면 쪽박! 올인 각오하셨죠?',
    '인생 역전 노리시는 건가요?',
    '성공하면 전설이 됩니다!',
    '이건 로또급 도전이에요!',
  ],
};

function getRandomComment(category: keyof typeof AI_COMMENTS): string {
  const comments = AI_COMMENTS[category];
  return comments[Math.floor(Math.random() * comments.length)];
}

function getOddsTier(totalOdds: number): { tier: string; color: string } {
  if (totalOdds < 2) return { tier: '안전', color: 'text-green-600 dark:text-green-400' };
  if (totalOdds < 5) return { tier: '균형', color: 'text-blue-600 dark:text-blue-400' };
  if (totalOdds < 10) return { tier: '도전', color: 'text-amber-600 dark:text-amber-400' };
  if (totalOdds < 30) return { tier: '위험', color: 'text-orange-600 dark:text-orange-400' };
  return { tier: '대박', color: 'text-red-600 dark:text-red-400' };
}

function analyzePicksCombination(picks: typeof usePicks extends () => { picks: infer P } ? P : never): AnalysisResult {
  const count = picks.length;
  
  if (count === 0) {
    return {
      type: 'neutral',
      title: '분석 대기',
      message: '분석할 경기를 담아주세요',
      details: []
    };
  }

  const totalOdds = picks.reduce((acc, p) => acc * p.odds, 1);
  const hasHighOdds = picks.some(p => p.odds > 3.0);
  const hasVeryHighOdds = picks.some(p => p.odds > 4.0);
  const hasLowOdds = picks.every(p => p.odds < 2.0);
  const drawCount = picks.filter(p => p.selection === 'draw').length;
  const homeCount = picks.filter(p => p.selection === 'home').length;
  const awayCount = picks.filter(p => p.selection === 'away').length;

  if (totalOdds >= 30) {
    return {
      type: 'jackpot',
      title: '대박 조합!',
      message: getRandomComment('jackpot'),
      details: [
        `${count}폴 조합`,
        `총 배당률: ${totalOdds.toFixed(2)}배`,
        '적중 시 엄청난 수익!',
        'AI 경고: 성공 확률은 매우 낮습니다'
      ]
    };
  }

  if (totalOdds >= 10 || (hasVeryHighOdds && count >= 2)) {
    return {
      type: 'danger',
      title: '위험 조합',
      message: getRandomComment('danger'),
      details: [
        `${count}폴 조합`,
        `총 배당률: ${totalOdds.toFixed(2)}배`,
        hasVeryHighOdds ? '초고배당 경기 포함' : '',
        'AI 추천: 일부 경기를 제외해보세요'
      ].filter(Boolean)
    };
  }

  if (count === 1) {
    if (picks[0].odds < 1.5) {
      return {
        type: 'success',
        title: '안전 단폴',
        message: getRandomComment('safe'),
        details: [
          `배당률: ${picks[0].odds.toFixed(2)}배`,
          '낮은 리스크, 안정적인 선택'
        ]
      };
    }
    return {
      type: 'neutral',
      title: '단폴 분석',
      message: getRandomComment('balanced'),
      details: [`배당률: ${picks[0].odds.toFixed(2)}배`]
    };
  }

  if (hasHighOdds && count >= 3) {
    return {
      type: 'warning',
      title: '주의 필요',
      message: getRandomComment('risky'),
      details: [
        `${count}폴 조합`,
        `총 배당률: ${totalOdds.toFixed(2)}배`,
        '고배당 경기가 포함되어 있어요',
        'AI 추천: 고배당 경기를 제외해보세요'
      ]
    };
  }

  if (drawCount >= 2) {
    return {
      type: 'warning',
      title: '무승부 다수',
      message: getRandomComment('risky'),
      details: [
        `무승부 ${drawCount}개 포함`,
        `총 배당률: ${totalOdds.toFixed(2)}배`,
        '무승부는 예측 난이도가 높습니다'
      ]
    };
  }

  if (hasLowOdds && count <= 3) {
    return {
      type: 'success',
      title: '안전 조합',
      message: getRandomComment('safe'),
      details: [
        `${count}폴 조합`,
        `총 배당률: ${totalOdds.toFixed(2)}배`,
        '안정적인 배당률 구성',
        `홈승 ${homeCount}개 / 무승부 ${drawCount}개 / 원정승 ${awayCount}개`
      ]
    };
  }

  if (count >= 4) {
    return {
      type: 'warning',
      title: '복잡한 조합',
      message: getRandomComment('risky'),
      details: [
        `${count}폴 조합`,
        `총 배당률: ${totalOdds.toFixed(2)}배`,
        'AI 추천: 3폴 이하로 줄이면 적중률 상승'
      ]
    };
  }

  return {
    type: 'success',
    title: '균형 조합',
    message: getRandomComment('balanced'),
    details: [
      `${count}폴 조합`,
      `총 배당률: ${totalOdds.toFixed(2)}배`,
      `홈승 ${homeCount}개 / 무승부 ${drawCount}개 / 원정승 ${awayCount}개`
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
                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                              {pick.odds.toFixed(2)}배
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
                    data-testid="analysis-result"
                  >
                    <Card className={`p-4 mt-4 ${
                      analysisResult.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
                      analysisResult.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                      analysisResult.type === 'danger' ? 'bg-orange-500/10 border-orange-500/30' :
                      analysisResult.type === 'jackpot' ? 'bg-red-500/10 border-red-500/30' :
                      'bg-muted/50'
                    }`}>
                      <div className="flex items-start gap-3">
                        {analysisResult.type === 'success' ? (
                          <Shield className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                        ) : analysisResult.type === 'warning' ? (
                          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        ) : analysisResult.type === 'danger' ? (
                          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                        ) : analysisResult.type === 'jackpot' ? (
                          <Zap className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        ) : (
                          <Sparkles className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={
                              analysisResult.type === 'success' ? 'default' :
                              analysisResult.type === 'jackpot' ? 'destructive' :
                              'secondary'
                            } className={
                              analysisResult.type === 'success' ? 'bg-green-500' :
                              analysisResult.type === 'warning' ? 'bg-amber-500' :
                              analysisResult.type === 'danger' ? 'bg-orange-500' :
                              analysisResult.type === 'jackpot' ? 'bg-red-500' : ''
                            }>
                              {analysisResult.title}
                            </Badge>
                          </div>
                          <p className="font-semibold text-sm">{analysisResult.message}</p>
                          <ul className="mt-2 space-y-1">
                            {analysisResult.details.map((detail, i) => (
                              <li key={i} className="text-sm text-muted-foreground">
                                {detail}
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
                  {/* Odds Summary with Tier Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">총 배당률</span>
                      <Badge 
                        variant="outline" 
                        className={getOddsTier(totalOdds).color}
                        data-testid="badge-odds-tier"
                      >
                        {getOddsTier(totalOdds).tier}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xl font-bold text-foreground" data-testid="text-total-odds">
                        {totalOdds.toFixed(2)}배
                      </span>
                    </div>
                  </div>
                  <Button 
                    size="lg"
                    className="w-full gap-2"
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
