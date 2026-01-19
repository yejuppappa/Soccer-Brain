import { Home, Calendar, BarChart3, Trophy, User } from "lucide-react";
import { useLocation } from "wouter";

interface TabItem {
  path: string;
  label: string;
  icon: typeof Home;
}

const tabs: TabItem[] = [
  { path: "/", label: "홈", icon: Home },
  { path: "/schedule", label: "일정", icon: Calendar },
  { path: "/league", label: "리그", icon: BarChart3 },
  { path: "/history", label: "적중내역", icon: Trophy },
  { path: "/my", label: "마이", icon: User },
];

export function BottomTabNavigation() {
  const [location, setLocation] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/";
    }
    if (path === "/schedule") {
      return location === "/schedule" || location.startsWith("/match/");
    }
    return location === path || location.startsWith(path + "/");
  };

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
              <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5px]' : ''}`} />
              <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
