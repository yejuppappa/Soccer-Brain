import { useLocation } from "wouter";
import { Home, BarChart3, Settings } from "lucide-react";

const tabs = [
  { path: "/", icon: Home, label: "홈" },
  { path: "/standings", icon: BarChart3, label: "순위" },
  { path: "/settings", icon: Settings, label: "설정" },
];

export function BottomNav() {
  const [location, navigate] = useLocation();

  // match-detail 에서는 홈 탭 활성화
  const activePath = location.startsWith("/match/") ? "/" : location;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0F1420] border-t border-[#1E293B] safe-area-pb">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = activePath === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors
                ${isActive ? "text-[#3B82F6]" : "text-[#64748B] active:text-[#94A3B8]"}`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={`text-[10px] ${isActive ? "font-semibold" : "font-normal"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
