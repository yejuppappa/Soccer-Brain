import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PredictionProvider } from "@/context/prediction-context";
import { BottomTabNavigation } from "@/components/bottom-tab-navigation";
import NotFound from "@/pages/not-found";
import MatchList from "@/pages/match-list";
import MatchAnalysis from "@/pages/match-analysis";
import Prediction from "@/pages/prediction";

function Router() {
  return (
    <Switch>
      <Route path="/" component={MatchList} />
      <Route path="/match/:id" component={MatchAnalysis} />
      <Route path="/prediction" component={Prediction} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PredictionProvider>
          <Toaster />
          <Router />
          <BottomTabNavigation />
        </PredictionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
