import { BarChart3, Target, Beaker } from "lucide-react";
import { useLocation } from "wouter";
import { usePrediction } from "@/context/prediction-context";

interface TabItem {
  path: string;
  label: string;
  icon: typeof BarChart3;
}

const tabs: TabItem[] = [
  { path: "/", label: "분석", icon: BarChart3 },
  { path: "/prediction", label: "예측", icon: Target },
  { path: "/lab", label: "실험실", icon: Beaker },
];

export function BottomTabNavigation() {
  const [location, setLocation] = useLocation();
  const { selections } = usePrediction();

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/" || location.startsWith("/match/");
    }
    return location === path;
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50"
      data-testid="bottom-tab-navigation"
    >
      <div className="flex items-center justify-around gap-4 h-14 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          const showBadge = tab.path === "/prediction" && selections.length > 0;

          return (
            <button
              key={tab.path}
              onClick={() => setLocation(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors ${
                active 
                  ? "text-primary" 
                  : "text-muted-foreground"
              }`}
              data-testid={`tab-${tab.label}`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span className="absolute -top-1 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-4 flex items-center justify-center px-1">
                    {selections.length}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
