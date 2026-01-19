import { useSport, SportType } from "@/contexts/sport-context";
import { cn } from "@/lib/utils";

interface SportOption {
  id: SportType;
  icon: string;
  label: string;
}

const sports: SportOption[] = [
  { id: 'soccer', icon: '⚽', label: '축구' },
  { id: 'basketball', icon: '🏀', label: '농구' },
  { id: 'baseball', icon: '⚾', label: '야구' },
  { id: 'volleyball', icon: '🏐', label: '배구' },
];

export function SportSelector() {
  const { currentSport, setCurrentSport } = useSport();

  return (
    <div className="w-full bg-background border-b overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-1 px-4 py-2 min-w-max">
        {sports.map((sport) => (
          <button
            key={sport.id}
            onClick={() => setCurrentSport(sport.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full transition-all text-sm font-medium whitespace-nowrap",
              currentSport === sport.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
            data-testid={`button-sport-${sport.id}`}
          >
            <span className="text-base">{sport.icon}</span>
            <span>{sport.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
