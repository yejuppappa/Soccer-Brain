import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/bottom-nav";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import MatchDetail from "@/pages/match-detail";
import Standings from "@/pages/standings";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin";

function Router() {
  return (
<Switch>
  <Route path="/" component={Home} />
  <Route path="/match/:id" component={MatchDetail} />
  <Route path="/standings" component={Standings} />
  <Route path="/settings" component={Settings} />
  <Route path="/admin" component={Admin} />     {/* ← 이거 추가 */}
  <Route component={NotFound} />
</Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex flex-col min-h-screen bg-[#0A0E17] text-[#F1F5F9]">
          <div className="flex-1 pb-16">
            <Router />
          </div>
          <BottomNav />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
