import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomTabNavigation } from "@/components/bottom-tab-navigation";
import { SportProvider } from "@/contexts/sport-context";
import { PickProvider } from "@/contexts/pick-context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Analysis from "@/pages/analysis";
import MatchAnalysis from "@/pages/match-analysis";
import Live from "@/pages/live";
import Results from "@/pages/results";
import My from "@/pages/my";
import Admin from "@/pages/admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/analysis" component={Analysis} />
      <Route path="/match/:id" component={MatchAnalysis} />
      <Route path="/live" component={Live} />
      <Route path="/results" component={Results} />
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
        <SportProvider>
          <PickProvider>
            <div className="flex flex-col min-h-screen">
              <div className="flex-1 pb-16">
                <Router />
              </div>
              <BottomTabNavigation />
            </div>
            <Toaster />
          </PickProvider>
        </SportProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
