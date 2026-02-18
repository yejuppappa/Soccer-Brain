import { Switch, Route, useLocation } from "wouter";
import type { ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/bottom-nav";
import { useTheme } from "@/hooks/use-theme";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import MatchDetail from "@/pages/match-detail";
import Standings from "@/pages/standings";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin";

const TAB_PATHS = ["/", "/standings", "/settings"];

function TabPane({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div
      className="absolute inset-0 overflow-y-auto"
      style={{
        visibility: active ? "visible" : "hidden",
        pointerEvents: active ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

function AppLayout() {
  const [location] = useLocation();

  const isTab = TAB_PATHS.includes(location);
  const isMatchDetail = /^\/match\/\d/.test(location);
  const isAdmin = location === "/admin";
  const isOverlay = isMatchDetail || isAdmin;

  return (
    <div className="h-[100dvh] flex flex-col bg-sb-bg text-sb-text overflow-hidden">
      <div className="flex-1 relative overflow-hidden">
        {/* Keep-alive tab pages — 항상 마운트, visibility로 전환 */}
        <TabPane active={isTab && location === "/"}>
          <Home />
        </TabPane>
        <TabPane active={isTab && location === "/standings"}>
          <Standings />
        </TabPane>
        <TabPane active={isTab && location === "/settings"}>
          <Settings />
        </TabPane>

        {/* Overlay pages — 조건부 렌더링 */}
        {isOverlay && (
          <div className="absolute inset-0 overflow-y-auto z-10 bg-sb-bg">
            <Switch>
              <Route path="/match/:id" component={MatchDetail} />
              <Route path="/admin" component={Admin} />
            </Switch>
          </div>
        )}

        {/* 404 */}
        {!isTab && !isOverlay && (
          <div className="absolute inset-0 overflow-y-auto z-10 bg-sb-bg">
            <NotFound />
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function App() {
  useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppLayout />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
