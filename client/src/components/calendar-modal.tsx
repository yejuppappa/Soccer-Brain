import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface CalendarModalProps {
  open: boolean;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarModal({ open, selected, onSelect, onClose }: CalendarModalProps) {
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const todayStr = toDateStr(new Date());
  const selectedStr = toDateStr(selected);

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-sb-surface-alt rounded-2xl w-[320px] p-4 border border-sb-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-1.5 text-sb-text-muted hover:text-sb-text">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-sb-text">
            {viewYear}년 {viewMonth + 1}월
          </span>
          <button onClick={nextMonth} className="p-1.5 text-sb-text-muted hover:text-sb-text">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(w => (
            <div key={w} className="text-center text-[11px] text-sb-text-dim py-1">{w}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((d, i) => {
            if (!d) return <div key={`empty-${i}`} />;
            const ds = toDateStr(d);
            const isToday = ds === todayStr;
            const isSel = ds === selectedStr;
            return (
              <button
                key={ds}
                onClick={() => { onSelect(d); onClose(); }}
                className={`h-9 rounded-lg text-sm flex items-center justify-center transition-colors
                  ${isSel ? "bg-sb-primary text-white font-bold" :
                    isToday ? "text-sb-primary font-semibold" :
                    "text-sb-text-secondary hover:bg-sb-surface-hover"}`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>

        {/* Close button */}
        <button onClick={onClose} className="absolute top-3 right-3 text-sb-text-dim hover:text-sb-text">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
