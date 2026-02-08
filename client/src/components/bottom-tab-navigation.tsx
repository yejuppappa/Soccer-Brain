import { Home, Search, Radio, ClipboardCheck, User } from "lucide-react";
import { useLocation } from "wouter";

interface TabItem {
  path: string;
  label: string;
  icon: typeof Home;
}

const tabs: TabItem[] = [
  { path: "/", label: "홈", icon: Home },
  { path: "/analysis", label: "분석", icon: Search },
  { path: "/live", label: "라이브", icon: Radio },
  { path: "/results", label: "결과", icon: ClipboardCheck },
  { path: "/my", label: "마이", icon: User },
];

export function BottomTabNavigation() {
  const [location, setLocation] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    if (path === "/analysis") {
      return location === "/analysis" || location.startsWith("/match/");
    }
    return location === path || location.startsWith(path + "/");
  };

  // admin 페이지에서는 네비게이션 숨김
  if (location.startsWith("/admin")) return null;

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50"
      data-testid="bottom-tab-navigation"
    >
      <div className="flex items-center justify-around gap-2 h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;

          return (
            <button
              key={tab.path}
              onClick={() => setLocation(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors ${
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.label}`}
            >
              {tab.path === "/live" && (
                <span className="absolute top-2 right-1/4 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
              <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5px]' : ''}`} />
              <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
