import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Beaker, Play, CheckCircle2, XCircle, TrendingUp, AlertTriangle, Loader2, GraduationCap, RefreshCw, Database, Download, FileJson, Save, Zap, ShieldAlert } from "lucide-react";
import type { VariableType, TrainingResult } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";

const variableLabels: Record<VariableType, string> = {
  fatigue: "피로도",
  injury: "부상 변수",
  weather: "날씨 변수",
  form: "팀 폼",
  home_advantage: "홈 어드밴티지",
};

interface TrainingDataResponse {
  matches: Array<{
    id: number;
    homeTeam: { name: string; ranking: number; form: string };
    awayTeam: { name: string; ranking: number; form: string };
    homeScore: number;
    awayScore: number;
    actualResult: string;
    date: string;
    venue?: string;
  }>;
  count: number;
}

interface TrainingSetStats {
  totalMatches: number;
  lastUpdated: string;
  uniqueTeams: number;
  highQualityCount: number;
  basicDataCount: number;
}

interface CollectionResult {
  totalChecked: number;
  newlySaved: number;
  skippedDuplicates: number;
  errors: number;
  logs: string[];
  quotaRemaining: number;
}

interface EnrichResult {
  enriched: number;
  errors: number;
  total: number;
  logs: string[];
}

export default function Admin() {
  const [trainingResult, setTrainingResult] = useState<TrainingResult | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [collectionResult, setCollectionResult] = useState<CollectionResult | null>(null);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [activeTab, setActiveTab] = useState<'training' | 'collection'>('training');
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: trainingData, isLoading: isLoadingData, refetch: refetchData } = useQuery<TrainingDataResponse>({
    queryKey: ["/api/training-data"],
    retry: false,
    staleTime: 0,
  });

  const { data: trainingSetStats, refetch: refetchStats } = useQuery<TrainingSetStats>({
    queryKey: ["/api/training-set/stats"],
    staleTime: 0,
    retry: false,
  });

  const trainMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/train");
      return response.json();
    },
    onSuccess: (data: { result: TrainingResult }) => {
      setTrainingResult(data.result);
      setIsAnimating(false);
    },
    onError: (error) => {
      console.error("Training failed:", error);
      setIsAnimating(false);
    },
  });

  const collectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/collect-data");
      return response.json();
    },
    onSuccess: (data: CollectionResult) => {
      setCollectionResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/training-set/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training-data"] });
    },
    onError: (error) => {
      console.error("Data collection failed:", error);
    },
  });

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/enrich-data");
      return response.json();
    },
    onSuccess: (data: EnrichResult) => {
      setEnrichResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/training-set/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training-data"] });
    },
    onError: (error) => {
      console.error("Data enrichment failed:", error);
    },
  });

  const handleStartEnrich = () => {
    setEnrichResult(null);
    enrichMutation.mutate();
  };

  const handleStartTraining = async () => {
    setTrainingResult(null);
    setIsAnimating(true);
    setProcessedCount(0);

    const matchCount = trainingData?.count || 10;
    for (let i = 0; i <= matchCount; i++) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      setProcessedCount(i);
    }

    trainMutation.mutate();
  };

  const handleStartCollection = () => {
    setCollectionResult(null);
    collectMutation.mutate();
  };

  const handleDownloadBackup = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch("/api/training-set/download");
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === "NO_DATA") {
          alert("백업할 데이터가 없습니다! 먼저 수집을 진행해주세요.");
        } else {
          alert("다운로드 중 오류가 발생했습니다.");
        }
        return;
      }
      
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "soccer_ai_backup.json";
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert("백업할 데이터가 없습니다! 먼저 수집을 진행해주세요.");
    } finally {
      setIsDownloading(false);
    }
  };

  const matches = trainingData?.matches || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-destructive/10 border-b border-destructive/30">
        <div className="px-4 py-3 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <h1 className="text-lg font-bold" data-testid="text-admin-title">관리자 페이지</h1>
              <Badge variant="destructive" className="text-xs">Admin Only</Badge>
            </div>
            <ThemeToggle />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            TensorFlow 학습용 데이터 수집 및 AI 모델 관리
          </p>
        </div>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'training' ? 'default' : 'outline'}
              onClick={() => {
                setActiveTab('training');
                refetchData();
                refetchStats();
              }}
              data-testid="tab-training"
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              AI 학습
            </Button>
            <Button
              variant={activeTab === 'collection' ? 'default' : 'outline'}
              onClick={() => {
                setActiveTab('collection');
                refetchData();
                refetchStats();
              }}
              data-testid="tab-collection"
            >
              <Database className="h-4 w-4 mr-2" />
              데이터 수집
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadBackup}
            disabled={isDownloading}
            data-testid="button-download-backup"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            백업
          </Button>
        </div>

        {activeTab === 'collection' && (
          <>
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="h-4 w-4 text-blue-500" />
                  스마트 데이터 수집
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  API-Football에서 2023-24 시즌 경기 데이터를 수집합니다.
                  <span className="block mt-1 text-xs">
                    중복 체크: Fixture ID 기준 | 일일 한도: 80경기
                  </span>
                </p>

                {trainingSetStats && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted rounded-md p-2">
                        <div className="text-xl font-bold">{trainingSetStats.totalMatches}</div>
                        <div className="text-xs text-muted-foreground">총 데이터</div>
                      </div>
                      <div className="bg-muted rounded-md p-2">
                        <div className="text-xl font-bold text-green-500">{trainingSetStats.highQualityCount}</div>
                        <div className="text-xs text-muted-foreground">고품질(스탯)</div>
                      </div>
                      <div className="bg-muted rounded-md p-2">
                        <div className="text-xl font-bold text-amber-500">{trainingSetStats.basicDataCount}</div>
                        <div className="text-xs text-muted-foreground">기본(스코어)</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                      팀 수: {trainingSetStats.uniqueTeams}개 | 일일 수집 한도: 80경기
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleStartCollection}
                    disabled={collectMutation.isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    data-testid="button-start-collection"
                  >
                    {collectMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        수집 중...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        데이터 수집 시작
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => refetchStats()}
                    data-testid="button-refresh-stats"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">데이터 고도화</span>
                    <span className="text-xs text-muted-foreground">기본 → 고품질</span>
                  </div>
                  <Button
                    onClick={handleStartEnrich}
                    disabled={enrichMutation.isPending || (trainingSetStats?.basicDataCount === 0)}
                    variant="outline"
                    className="w-full border-amber-500/50 hover:bg-amber-500/10"
                    data-testid="button-start-enrich"
                  >
                    {enrichMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        배치 처리 중...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        배치 고도화 (100경기)
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    10경기/1호출 | 최대 10배치 = 100경기
                  </p>
                </div>
              </CardContent>
            </Card>

            <AnimatePresence>
              {enrichResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="border-amber-500/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                        <Zap className="h-4 w-4" />
                        고도화 완료
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-green-500/10 rounded-md p-2">
                          <div className="text-lg font-bold text-green-600">{enrichResult.enriched}</div>
                          <div className="text-xs text-muted-foreground">업그레이드</div>
                        </div>
                        <div className="bg-red-500/10 rounded-md p-2">
                          <div className="text-lg font-bold text-red-600">{enrichResult.errors}</div>
                          <div className="text-xs text-muted-foreground">오류</div>
                        </div>
                        <div className="bg-muted rounded-md p-2">
                          <div className="text-lg font-bold">{enrichResult.total}</div>
                          <div className="text-xs text-muted-foreground">총 데이터</div>
                        </div>
                      </div>
                      <div className="bg-muted rounded-md p-3 max-h-48 overflow-y-auto">
                        <div className="text-xs font-mono space-y-1">
                          {enrichResult.logs.map((log, i) => (
                            <div 
                              key={i} 
                              className={
                                log.includes('✅') ? 'text-green-600' : 
                                log.includes('❌') ? 'text-red-500' : 
                                log.includes('⚠️') ? 'text-amber-500' :
                                log.includes('배치 처리 중') ? 'text-blue-500 font-semibold' :
                                log.includes('고도화 완료') ? 'text-green-600 font-semibold' :
                                ''
                              }
                            >
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {collectionResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="border-green-500/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        수집 완료
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-muted rounded-md p-2">
                          <div className="text-lg font-bold">{collectionResult.totalChecked}</div>
                          <div className="text-xs text-muted-foreground">총 확인</div>
                        </div>
                        <div className="bg-green-500/10 rounded-md p-2">
                          <div className="text-lg font-bold text-green-600">{collectionResult.newlySaved}</div>
                          <div className="text-xs text-muted-foreground">신규 저장</div>
                        </div>
                        <div className="bg-amber-500/10 rounded-md p-2">
                          <div className="text-lg font-bold text-amber-600">{collectionResult.skippedDuplicates}</div>
                          <div className="text-xs text-muted-foreground">중복 스킵</div>
                        </div>
                        <div className="bg-muted rounded-md p-2">
                          <div className="text-lg font-bold">{collectionResult.quotaRemaining}</div>
                          <div className="text-xs text-muted-foreground">남은 한도</div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-sm font-medium flex items-center gap-1">
                          <FileJson className="h-4 w-4" />
                          수집 로그
                        </h4>
                        <ScrollArea className="h-[200px] rounded-md border bg-muted/30 p-3">
                          <div className="space-y-1 text-xs font-mono">
                            {collectionResult.logs.map((log, index) => (
                              <div
                                key={index}
                                className="text-muted-foreground"
                                data-testid={`log-${index}`}
                              >
                                {log}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                      
                      <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-semibold">
                            총 저장된 데이터: {trainingSetStats?.totalMatches || 0}개 (중복 제거됨)
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {activeTab === 'training' && (
          <>
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  AI 학습 모드 (실제 데이터)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  API-Football에서 가져온 <span className="font-bold text-primary">{matches.length}경기</span> 실제 결과 데이터를 사용하여 
                  AI 예측 알고리즘을 훈련합니다.
                </p>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleStartTraining}
                    disabled={isAnimating || trainMutation.isPending || isLoadingData || matches.length === 0}
                    className="flex-1"
                    data-testid="button-start-training"
                  >
                    {isAnimating || trainMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        학습 중... ({processedCount}/{matches.length})
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        학습 시작
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => refetchData()}
                    disabled={isLoadingData}
                    data-testid="button-refresh-data"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingData ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <AnimatePresence>
              {trainingResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="border-primary/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                        학습 완료
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-muted rounded-md p-3">
                          <div className="text-2xl font-bold">{trainingResult.totalMatches}</div>
                          <div className="text-xs text-muted-foreground">분석 경기</div>
                        </div>
                        <div className="bg-muted rounded-md p-3">
                          <div className="text-2xl font-bold text-destructive">{trainingResult.significantErrors}</div>
                          <div className="text-xs text-muted-foreground">주요 오류</div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-amber-500/20 to-green-500/20 rounded-lg p-4 text-center">
                        <div className="text-sm text-muted-foreground mb-2">적중률 개선</div>
                        <div className="flex items-center justify-center gap-4">
                          <div>
                            <span className="text-xl font-bold text-amber-600">{trainingResult.initialAccuracy}%</span>
                            <span className="text-xs block text-muted-foreground">초기</span>
                          </div>
                          <TrendingUp className="h-5 w-5 text-green-500" />
                          <div>
                            <span className="text-xl font-bold text-green-600">{trainingResult.adjustedAccuracy}%</span>
                            <span className="text-xs block text-muted-foreground">조정 후</span>
                          </div>
                        </div>
                      </div>

                      {trainingResult.tuningWeights.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">변수 가중치 조정</h4>
                          {trainingResult.tuningWeights.map((weight, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                              <span className="font-medium">{variableLabels[weight.variable]}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">×{weight.originalWeight.toFixed(1)}</span>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                <span className="font-bold text-green-600">×{weight.adjustedWeight.toFixed(1)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {trainingResult.insights.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            AI 분석 인사이트
                          </h4>
                          <div className="space-y-1">
                            {trainingResult.insights.map((insight, index) => (
                              <div key={index} className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                                {insight}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  학습 데이터셋 ({matches.length}경기)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : matches.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>수집된 학습 데이터가 없습니다</p>
                    <p className="text-xs mt-1">데이터 수집 탭에서 먼저 수집하세요</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {matches.slice(0, 50).map((match) => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-sm"
                        >
                          <div className="flex-1 truncate">
                            <span className="font-medium">{match.homeTeam.name}</span>
                            <span className="text-muted-foreground mx-2">vs</span>
                            <span className="font-medium">{match.awayTeam.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {match.homeScore} - {match.awayScore}
                            </Badge>
                            <Badge 
                              variant={
                                match.actualResult === 'home_win' ? 'destructive' : 
                                match.actualResult === 'away_win' ? 'default' : 
                                'secondary'
                              }
                            >
                              {match.actualResult === 'home_win' ? '홈승' : 
                               match.actualResult === 'away_win' ? '원정승' : '무'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
