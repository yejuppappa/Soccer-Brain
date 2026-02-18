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
    <nav
      className="flex-shrink-0 bg-sb-footer-bg safe-area-pb"
      style={{ boxShadow: "0px -1px 11px -1px rgba(0,0,0,0.15)" }}
    >
      <div className="max-w-lg mx-auto flex">
        {tabs.map(({ path, icon: Icon, label }) => {
          const isActive = activePath === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors
                ${isActive ? "text-sb-footer-active" : "text-sb-footer-inactive active:text-sb-text"}`}
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
