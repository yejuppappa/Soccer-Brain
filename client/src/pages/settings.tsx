import { useTheme, type ThemeMode } from "@/hooks/use-theme";
import { Moon, Sun, Monitor } from "lucide-react";

const THEME_OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Moon }[] = [
  { mode: "dark", label: "다크", Icon: Moon },
  { mode: "light", label: "라이트", Icon: Sun },
  { mode: "system", label: "시스템", Icon: Monitor },
];

export default function Settings() {
  const { mode, setTheme } = useTheme();

  return (
    <div className="max-w-lg mx-auto">
      <header className="sticky top-0 z-40 bg-sb-bg/95 backdrop-blur-sm border-b border-sb-border">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-sb-text">설정</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* 테마 */}
        <section className="bg-sb-surface rounded-xl p-4">
          <h3 className="text-sm font-semibold text-sb-text mb-3">테마</h3>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ mode: m, label, Icon }) => (
              <button
                key={m}
                onClick={() => setTheme(m)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors
                  ${mode === m
                    ? "bg-sb-primary text-white"
                    : "bg-sb-surface-hover text-sb-text-dim hover:text-sb-text-muted"}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* 앱 정보 */}
        <section className="bg-sb-surface rounded-xl p-4">
          <h3 className="text-sm font-semibold text-sb-text mb-3">앱 정보</h3>
          <div className="space-y-2 text-xs text-sb-text-dim">
            <div className="flex justify-between">
              <span>버전</span>
              <span className="text-sb-text-muted">2.0.0-beta</span>
            </div>
            <div className="flex justify-between">
              <span>개발자</span>
              <span className="text-sb-text-muted">Soccer Brain</span>
            </div>
            <div className="flex justify-between">
              <span>데이터 제공</span>
              <span className="text-sb-text-muted">API-Football</span>
            </div>
          </div>
        </section>

        {/* 피드백 */}
        <section className="bg-sb-surface rounded-xl p-4">
          <h3 className="text-sm font-semibold text-sb-text mb-2">피드백</h3>
          <p className="text-xs text-sb-text-dim mb-3">의견이나 버그를 알려주세요</p>
          <a
            href="mailto:feedback@soccer-brain.com"
            className="inline-block px-4 py-2 rounded-lg bg-sb-surface-alt text-sb-primary text-xs font-medium"
          >
            메일 보내기
          </a>
        </section>
      </main>
    </div>
  );
}
