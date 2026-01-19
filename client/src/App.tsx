import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomTabNavigation } from "@/components/bottom-tab-navigation";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Schedule from "@/pages/schedule";
import MatchAnalysis from "@/pages/match-analysis";
import Laboratory from "@/pages/laboratory";
import History from "@/pages/history";
import My from "@/pages/my";
import Admin from "@/pages/admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/match/:id" component={MatchAnalysis} />
      <Route path="/lab" component={Laboratory} />
      <Route path="/history" component={History} />
      <Route path="/my" component={My} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <BottomTabNavigation />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
