import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function History() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-lg">적중 내역</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <Card className="p-8 text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-bold text-lg mb-2">적중 내역 준비 중</h2>
          <p className="text-sm text-muted-foreground">
            AI 예측 결과와 실제 결과를 비교하는 기능이 곧 추가됩니다.
          </p>
        </Card>
      </main>
    </div>
  );
}
