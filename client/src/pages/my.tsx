import { User, Settings, Moon, Info, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function My() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-lg">마이페이지</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Profile Section */}
        <Card className="p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <User className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="font-bold text-lg mb-1">게스트 사용자</h2>
          <p className="text-sm text-muted-foreground">로그인하여 더 많은 기능을 사용하세요</p>
        </Card>

        {/* Menu Items */}
        <Card className="divide-y divide-border">
          <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">설정</span>
          </button>
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">다크 모드</span>
            </div>
            <ThemeToggle />
          </div>
          <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">도움말</span>
          </button>
          <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors">
            <Info className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">앱 정보</span>
          </button>
        </Card>

        <p className="text-center text-xs text-muted-foreground pt-4">
          Soccer Brain v1.0.0
        </p>
      </main>
    </div>
  );
}
