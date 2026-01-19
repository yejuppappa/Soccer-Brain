import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePicks } from "@/contexts/pick-context";
import { motion, AnimatePresence } from "framer-motion";

export function PickFAB() {
  const { picks, setDrawerOpen } = usePicks();
  const count = picks.length;

  if (count === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="fixed bottom-24 right-4 z-50"
      >
        <Button
          size="lg"
          onClick={() => setDrawerOpen(true)}
          className="rounded-full shadow-lg gap-2"
          data-testid="button-pick-fab"
        >
          <Sparkles className="h-5 w-5" />
          <span className="font-semibold">분석함</span>
          <Badge 
            variant="secondary" 
            className="ml-1 rounded-full"
          >
            {count}
          </Badge>
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
