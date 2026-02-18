import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Info } from "lucide-react";
import { getTeamName } from "@/shared/team-names";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// Types
// ============================================================

interface TeamInfo {
  id: string;
  name: string;
  shortName: string | null;
  logo: string | null;
}

interface StandingInfo {
  rank: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  form: string | null;
}

interface InjuryInfo {
  player: string;
  position: string | null;
  reason: string | null;
  status: string | null;
}

interface TeamSide {
  team: TeamInfo;
  recentForm: ("W" | "D" | "L")[];
  restDays: number | null;
  injuries: InjuryInfo[];
  standing: StandingInfo | null;
}

interface SeasonStatFields {
  xgDiff: number | null;
  goals: number | null;
  conceded: number | null;
  possession: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  passAccuracy: number | null;
}

interface H2HData {
  filters: { count: number; type: string; venue: string };
  summary: {
    total: number;
    homeWins: number;
    draws: number;
    awayWins: number;
    homeWinPct: number;
    drawPct: number;
    awayWinPct: number;
  };
  metrics: {
    avgGoalsPerMatch: number | null;
    over25Count: number;
    over25Pct: number;
    bttsCount: number;
    bttsPct: number;
  };
  matches: Array<{
    date: string;
    competition: string;
    homeTeam: string;
    awayTeam: string;
    homeGoals: number;
    awayGoals: number;
    isHomeVenue: boolean;
    result: "W" | "D" | "L";
  }>;
}

interface RadarScores {
  attack: number;
  defense: number;
  control: number;
  venueEdge: number;
  bigMatch: number;
}

interface RadarData {
  hasXgData: boolean;
  window: "last5" | "season";
  tierCoefficient: number;
  earlySeasonWarning: boolean;
  home: RadarScores;
  away: RadarScores;
  homeDetail: Record<string, number | null>;
  awayDetail: Record<string, number | null>;
}

interface LineupPlayer {
  player: string;
  pos: string | null;
  number: number | null;
  grid: string | null;
}

interface LineupData {
  formation: string | null;
  coach: string | null;
  confirmed: boolean;
  starters: LineupPlayer[];
  subs: Array<{ player: string; pos: string | null; number: number | null }>;
}

interface MatchDetailResponse {
  ok: boolean;
  fixture: {
    id: string;
    kickoffAt: string;
    status: string;
    score: { home: number; away: number } | null;
    venue: { name: string | null; city: string | null };
    league: {
      id: string;
      name: string;
      country: string | null;
      apiId: number;
    };
  };
  weather: {
    temp: number;
    condition: string;
    humidity: number;
    windKph: number;
  } | null;
  home: TeamSide;
  away: TeamSide;
  odds: {
    current: {
      home: number;
      draw: number;
      away: number;
      bookmaker: string | null;
    };
    allBookmakers: Array<{
      bookmaker: string;
      home: number;
      draw: number;
      away: number;
    }>;
  } | null;
  radar: RadarData | null;
  seasonStats: {
    home: { season: SeasonStatFields; last5: SeasonStatFields };
    away: { season: SeasonStatFields; last5: SeasonStatFields };
  };
  h2h: H2HData | null;
  lineups: { home: LineupData | null; away: LineupData | null } | null;
  summary: string;
}

// ============================================================
// Constants
// ============================================================

type AxisKey = keyof RadarScores;

const RADAR_AXES: { key: AxisKey; label: string; emoji: string }[] = [
  { key: "attack", label: "공격력", emoji: "⚔️" },
  { key: "defense", label: "수비력", emoji: "🛡️" },
  { key: "control", label: "주도권", emoji: "🎮" },
  { key: "venueEdge", label: "홈 어드벤티지", emoji: "🏟️" },
  { key: "bigMatch", label: "강팀 대응력", emoji: "💪" },
];

const RADAR_DESCRIPTIONS = [
  "xG, 유효슈팅, 결정력, 박스 안 침투율 기반",
  "피xG, 실점 억제 효율 기반",
  "점유율, 코너, 슈팅 압박 기반",
  "홈/원정 경기 승점, xG차 기반",
  "리그 상위 30% 팀 상대 성적 기반",
];

const POS_LABEL: Record<string, string> = {
  Goalkeeper: "GK",
  Defender: "DF",
  Midfielder: "MF",
  Attacker: "FW",
  G: "GK",
  D: "DF",
  M: "MF",
  F: "FW",
};

// ============================================================
// Utilities
// ============================================================

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function calcImpliedProb(odds: {
  home: number;
  draw: number;
  away: number;
}): { home: number; draw: number; away: number } | null {
  const { home: h, draw: d, away: a } = odds;
  if (h <= 0 || d <= 0 || a <= 0) return null;
  const total = 1 / h + 1 / d + 1 / a;
  return {
    home: Math.round((1 / h / total) * 100),
    draw: Math.round((1 / d / total) * 100),
    away: Math.round((1 / a / total) * 100),
  };
}

function restDaysColor(days: number): string {
  if (days <= 2) return "#EF4444";
  if (days <= 4) return "#F59E0B";
  return "#22C55E";
}

function restDaysLabel(days: number): string {
  if (days <= 2) return "피로";
  if (days <= 4) return "보통";
  return "충분";
}

// ============================================================
// Sub-components — Header
// ============================================================

function FormDots({ form }: { form: ("W" | "D" | "L")[] }) {
  if (!form || form.length === 0)
    return <span className="text-[10px] text-sb-text-faint">-</span>;
  return (
    <div className="flex gap-1 items-center">
      {form.map((r, i) => {
        const isLatest = i === form.length - 1;
        return (
          <div
            key={i}
            className={`rounded-full text-[9px] font-bold flex items-center justify-center
              ${isLatest ? "w-5 h-5 ring-1" : "w-4 h-4"}
              ${
                r === "W"
                  ? `bg-sb-win/20 text-sb-win ${isLatest ? "ring-sb-win/50" : ""}`
                  : r === "D"
                    ? `bg-[#6B7280]/20 text-[#6B7280] ${isLatest ? "ring-[#6B7280]/50" : ""}`
                    : `bg-sb-live/20 text-sb-live ${isLatest ? "ring-sb-live/50" : ""}`
              }`}
          >
            {r}
          </div>
        );
      })}
    </div>
  );
}

function OddsChip({
  label,
  odds,
  prob,
  isHighest,
}: {
  label: string;
  odds: number;
  prob?: number;
  isHighest?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-2.5 text-center transition-colors
      ${isHighest ? "bg-sb-primary/15 ring-1 ring-sb-primary/30" : "bg-sb-bg"}`}
    >
      <p className="text-[10px] text-sb-text-dim mb-0.5">{label}</p>
      <p
        className={`text-sm font-bold ${isHighest ? "text-sb-primary" : "text-sb-text"}`}
      >
        {odds.toFixed(2)}
      </p>
      {prob != null && (
        <p
          className={`text-[10px] mt-0.5 ${isHighest ? "text-sb-primary/70" : "text-sb-text-faint"}`}
        >
          {prob}%
        </p>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
  action,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-sb-surface rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm">{icon}</span>
        <h3 className="text-sm font-semibold text-sb-text">{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

// ============================================================
// Sub-components — Injury
// ============================================================

function InjurySection({
  homeInjuries,
  awayInjuries,
  homeName,
  awayName,
}: {
  homeInjuries: InjuryInfo[];
  awayInjuries: InjuryInfo[];
  homeName: string;
  awayName: string;
}) {
  const renderSide = (injuries: InjuryInfo[], teamName: string) => (
    <div className="flex-1 min-w-0">
      <p className="text-xs text-sb-text-dim font-medium mb-2">{teamName}</p>
      {injuries.length === 0 ? (
        <p className="text-xs text-sb-text-faint">결장자 없음</p>
      ) : (
        <div className="space-y-1.5">
          {injuries.map((inj, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {inj.position && (
                <span className="text-[9px] px-1 py-px rounded border border-sb-border-subtle text-sb-text-muted flex-shrink-0">
                  {POS_LABEL[inj.position] ||
                    inj.position.substring(0, 2).toUpperCase()}
                </span>
              )}
              <span className="text-xs text-sb-text truncate">
                {inj.player}
              </span>
              {(inj.reason || inj.status) && (
                <span className="text-[10px] text-sb-text-dim ml-auto flex-shrink-0">
                  {inj.reason || inj.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex gap-4">
      {renderSide(homeInjuries, homeName)}
      <div className="w-px bg-sb-border" />
      {renderSide(awayInjuries, awayName)}
    </div>
  );
}

// ============================================================
// Sub-components — Radar Chart
// ============================================================

const CX = 160,
  CY = 125,
  R = 70;
const ANGLES = Array.from(
  { length: 5 },
  (_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5,
);

function pt(angle: number, r: number) {
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

function ring(scale: number) {
  return ANGLES.map((a) => {
    const p = pt(a, R * scale);
    return `${p.x},${p.y}`;
  }).join(" ");
}

function teamPoly(scores: RadarScores) {
  return RADAR_AXES.map((axis, i) => {
    const val = Math.max(scores[axis.key], 0.5) / 10;
    const p = pt(ANGLES[i], R * val);
    return `${p.x},${p.y}`;
  }).join(" ");
}

const TEXT_ANCHORS: Array<"middle" | "start" | "end"> = [
  "middle",
  "start",
  "start",
  "end",
  "end",
];
const LABEL_DX = [0, 8, 8, -8, -8];
const LABEL_DY = [-8, 0, 8, 8, 0];

function RadarChart({
  radar,
  homeName,
  awayName,
}: {
  radar: RadarData;
  homeName: string;
  awayName: string;
}) {
  const LR = R * 1.5;

  return (
    <svg viewBox="0 0 320 275" className="w-full max-w-[320px] mx-auto">
      {/* Grid rings */}
      {[0.2, 0.4, 0.6, 0.8, 1.0].map((s) => (
        <polygon
          key={s}
          points={ring(s)}
          fill="none"
          stroke="#1E293B"
          strokeWidth={s === 1 ? "1" : "0.5"}
        />
      ))}

      {/* Axis lines */}
      {ANGLES.map((angle, i) => {
        const p = pt(angle, R);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={p.x}
            y2={p.y}
            stroke="#1E293B"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Home polygon */}
      <polygon
        points={teamPoly(radar.home)}
        fill="#3B82F6"
        fillOpacity="0.15"
        stroke="#3B82F6"
        strokeWidth="1.5"
      />
      {/* Home dots */}
      {RADAR_AXES.map((axis, i) => {
        const val = Math.max(radar.home[axis.key], 0.5) / 10;
        const p = pt(ANGLES[i], R * val);
        return (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#3B82F6" />
        );
      })}

      {/* Away polygon */}
      <polygon
        points={teamPoly(radar.away)}
        fill="#F59E0B"
        fillOpacity="0.15"
        stroke="#F59E0B"
        strokeWidth="1.5"
      />
      {/* Away dots */}
      {RADAR_AXES.map((axis, i) => {
        const val = Math.max(radar.away[axis.key], 0.5) / 10;
        const p = pt(ANGLES[i], R * val);
        return (
          <circle
            key={`a${i}`}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill="#F59E0B"
          />
        );
      })}

      {/* Labels & Scores */}
      {RADAR_AXES.map((axis, i) => {
        const lp = pt(ANGLES[i], LR);
        const anchor = TEXT_ANCHORS[i];
        const dx = LABEL_DX[i];
        const dy = LABEL_DY[i];
        const hv = radar.home[axis.key];
        const av = radar.away[axis.key];

        return (
          <g key={axis.key}>
            <text
              x={lp.x + dx}
              y={lp.y + dy}
              textAnchor={anchor}
              fill="#E8EAED"
              fontSize="9"
              fontWeight="500"
            >
              {axis.emoji} {axis.label}
            </text>
            <text
              x={lp.x + dx}
              y={lp.y + dy + 12}
              textAnchor={anchor}
              fontSize="8.5"
            >
              <tspan fill="#3B82F6" fontWeight="600">
                {hv}
              </tspan>
              <tspan fill="#475569"> / </tspan>
              <tspan fill="#F59E0B" fontWeight="600">
                {av}
              </tspan>
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <circle cx="80" cy="265" r="4" fill="#3B82F6" fillOpacity="0.6" />
      <text x="88" y="268" fill="#94A3B8" fontSize="8">
        {homeName}
      </text>
      <circle cx="185" cy="265" r="4" fill="#F59E0B" fillOpacity="0.6" />
      <text x="193" y="268" fill="#94A3B8" fontSize="8">
        {awayName}
      </text>
    </svg>
  );
}

// ============================================================
// Sub-components — Stats
// ============================================================

function DualStatRow({
  label,
  homeSeason,
  homeLast5,
  awaySeason,
  awayLast5,
  format,
  suffix,
  reverse,
  star,
  focused,
  dual,
}: {
  label: string;
  homeSeason: number | null;
  homeLast5: number | null;
  awaySeason: number | null;
  awayLast5: number | null;
  format: string;
  suffix?: string;
  reverse?: boolean;
  star?: boolean;
  focused: "last5" | "season";
  dual?: boolean;
}) {
  const fmt = (v: number | null, dec?: string) => {
    if (v == null) return "–";
    const d = dec || format;
    return d === "0" ? Math.round(v).toString() : v.toFixed(parseInt(d));
  };
  const s = suffix || "";

  // Primary = focused window, secondary = other
  const hPrimary = focused === "last5" ? homeLast5 : homeSeason;
  const aPrimary = focused === "last5" ? awayLast5 : awaySeason;
  const hSecondary = focused === "last5" ? homeSeason : homeLast5;
  const aSecondary = focused === "last5" ? awaySeason : awayLast5;

  const hp = hPrimary ?? 0;
  const ap = aPrimary ?? 0;
  const hs = hSecondary ?? 0;
  const as_ = aSecondary ?? 0;

  // Max for bar scaling (across both windows)
  const allVals = dual ? [hp, ap, hs, as_].map(Math.abs) : [hp, ap].map(Math.abs);
  const max = Math.max(...allVals, 0.01);
  const pct = (v: number) => (Math.abs(v) / max) * 100;

  const homeBetter = reverse ? hp < ap : hp > ap;
  const awayBetter = reverse ? ap < hp : ap > hp;

  return (
    <div className="space-y-0.5">
      {/* Primary row (bold, thick bar) */}
      <div className="flex items-center gap-1.5 text-xs h-5">
        <span
          className={`w-10 text-right tabular-nums ${homeBetter ? "text-sb-primary font-semibold" : "text-sb-text-muted"}`}
        >
          {fmt(hPrimary)}{s}
        </span>
        <div className="flex-1 flex justify-end">
          <div className="relative w-full h-2.5">
            <div
              className="absolute right-0 top-0 h-full rounded-full"
              style={{ width: `${pct(hp)}%`, backgroundColor: homeBetter ? "#3B82F6" : "#334155" }}
            />
          </div>
        </div>
        <span className="w-[52px] text-center text-[10px] text-sb-text-dim flex-shrink-0">
          {star && "★ "}{label}
        </span>
        <div className="flex-1">
          <div className="relative w-full h-2.5">
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ width: `${pct(ap)}%`, backgroundColor: awayBetter ? "#F59E0B" : "#334155" }}
            />
          </div>
        </div>
        <span
          className={`w-10 text-left tabular-nums ${awayBetter ? "text-sb-draw font-semibold" : "text-sb-text-muted"}`}
        >
          {fmt(aPrimary)}{s}
        </span>
      </div>
      {/* Secondary row — only when dual mode */}
      {dual && (
        <div className="flex items-center gap-1.5 text-[10px] h-3">
          <span className="w-10 text-right tabular-nums text-sb-text-faint">
            {fmt(hSecondary)}{s}
          </span>
          <div className="flex-1 flex justify-end">
            <div className="relative w-full h-[3px]">
              <div
                className="absolute right-0 top-0 h-full rounded-full bg-sb-border-subtle"
                style={{ width: `${pct(hs)}%` }}
              />
            </div>
          </div>
          <span className="w-[52px] text-center text-[9px] text-sb-text-faint flex-shrink-0">
            {focused === "last5" ? "시즌" : "최근5"}
          </span>
          <div className="flex-1">
            <div className="relative w-full h-[3px]">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-sb-border-subtle"
                style={{ width: `${pct(as_)}%` }}
              />
            </div>
          </div>
          <span className="w-10 text-left tabular-nums text-sb-text-faint">
            {fmt(aSecondary)}{s}
          </span>
        </div>
      )}
    </div>
  );
}

function H2HBar({
  homeWins,
  draws,
  awayWins,
}: {
  homeWins: number;
  draws: number;
  awayWins: number;
}) {
  const total = homeWins + draws + awayWins;
  if (total === 0) return null;
  const hp = (homeWins / total) * 100;
  const dp = (draws / total) * 100;
  const ap = (awayWins / total) * 100;
  return (
    <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
      {hp > 0 && (
        <div
          className="bg-sb-primary rounded-l-full"
          style={{ width: `${hp}%` }}
        />
      )}
      {dp > 0 && (
        <div className="bg-sb-text-dim" style={{ width: `${dp}%` }} />
      )}
      {ap > 0 && (
        <div
          className="bg-sb-draw rounded-r-full"
          style={{ width: `${ap}%` }}
        />
      )}
    </div>
  );
}

// ============================================================
// Sub-components — Progress Ring
// ============================================================

function ProgressRing({
  value,
  label,
  count,
  total,
}: {
  value: number;
  label: string;
  count: number;
  total: number;
}) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(value, 100);
  const offset = circumference - (pct / 100) * circumference;
  // If total=0, this is a raw value display (e.g. avg goals)
  const isRawValue = total === 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 64 64" className="w-14 h-14">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#1E293B" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="32" textAnchor="middle" dominantBaseline="central" fill="#E8EAED" fontSize="12" fontWeight="600">
          {isRawValue ? count : `${value}%`}
        </text>
      </svg>
      <p className="text-[10px] text-sb-text-dim">{label}</p>
      {!isRawValue && (
        <p className="text-[10px] text-sb-text-faint">{count}/{total}</p>
      )}
    </div>
  );
}

// ============================================================
// Sub-components — Pitch Graphic
// ============================================================

function PitchGraphic({
  homeLineup,
  awayLineup,
  homeName,
  awayName,
}: {
  homeLineup: LineupData;
  awayLineup: LineupData | null;
  homeName: string;
  awayName: string;
}) {
  // Parse grid "row:col" to pixel positions
  // Grid: rows 1-4 (GK=1, DEF=2, MID=3, FWD=4), cols 1-N
  // Home: top half (rows mapped 1→8%, 2→22%, 3→36%, 4→46%)
  // Away: bottom half, mirrored (rows mapped 1→92%, 2→78%, 3→64%, 4→54%)
  const ROW_HOME: Record<string, number> = { "1": 8, "2": 22, "3": 36, "4": 46 };
  const ROW_AWAY: Record<string, number> = { "1": 92, "2": 78, "3": 64, "4": 54 };

  function parseGridPositions(
    starters: LineupPlayer[],
    rowMap: Record<string, number>,
  ): Array<{ player: string; number: number | null; x: number; y: number }> {
    const results: Array<{ player: string; number: number | null; x: number; y: number }> = [];
    // Group by row to calculate col percentages
    const byRow = new Map<string, LineupPlayer[]>();
    for (const p of starters) {
      if (!p.grid) continue;
      const [row] = p.grid.split(":");
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row)!.push(p);
    }

    for (const [row, players] of byRow) {
      const y = rowMap[row] ?? 50;
      const count = players.length;
      players
        .sort((a, b) => {
          const colA = parseInt(a.grid?.split(":")[1] || "0");
          const colB = parseInt(b.grid?.split(":")[1] || "0");
          return colA - colB;
        })
        .forEach((p, i) => {
          const x = ((i + 1) / (count + 1)) * 100;
          results.push({ player: p.player, number: p.number, x, y });
        });
    }

    // Fallback for starters without grid
    const withoutGrid = starters.filter(p => !p.grid);
    if (withoutGrid.length > 0 && results.length === 0) {
      withoutGrid.forEach((p, i) => {
        results.push({
          player: p.player,
          number: p.number,
          x: ((i + 1) / (withoutGrid.length + 1)) * 100,
          y: 30,
        });
      });
    }

    return results;
  }

  const homePlayers = parseGridPositions(homeLineup.starters, ROW_HOME);
  const awayPlayers = awayLineup
    ? parseGridPositions(awayLineup.starters, ROW_AWAY)
    : [];

  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "68/100" }}>
      {/* Grass background */}
      <div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            to bottom,
            #1a5c2a 0px, #1a5c2a 40px,
            #1b6430 40px, #1b6430 80px
          )`,
        }}
      />

      {/* Field lines */}
      <svg viewBox="0 0 68 100" className="absolute inset-0 w-full h-full">
        {/* Outer boundary */}
        <rect x="2" y="2" width="64" height="96" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
        {/* Center line */}
        <line x1="2" y1="50" x2="66" y2="50" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
        {/* Center circle */}
        <circle cx="34" cy="50" r="8" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
        <circle cx="34" cy="50" r="0.6" fill="rgba(255,255,255,0.25)" />
        {/* Top penalty area */}
        <rect x="14" y="2" width="40" height="14" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
        <rect x="22" y="2" width="24" height="5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
        {/* Bottom penalty area */}
        <rect x="14" y="84" width="40" height="14" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
        <rect x="22" y="93" width="24" height="5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" />
      </svg>

      {/* Formation labels */}
      <div className="absolute top-1 left-2 text-[9px] text-white/60">
        {homeName} {homeLineup.formation && `(${homeLineup.formation})`}
      </div>
      {awayLineup && (
        <div className="absolute bottom-1 right-2 text-[9px] text-white/60">
          {awayName} {awayLineup.formation && `(${awayLineup.formation})`}
        </div>
      )}

      {/* Home players */}
      {homePlayers.map((p, i) => (
        <div
          key={`h${i}`}
          className="absolute flex flex-col items-center"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="w-6 h-6 rounded-full bg-sb-primary flex items-center justify-center text-white text-[9px] font-bold shadow-md">
            {p.number ?? ""}
          </div>
          <span className="text-[8px] text-white/90 mt-0.5 max-w-[48px] truncate text-center">
            {p.player.split(" ").pop()}
          </span>
        </div>
      ))}

      {/* Away players */}
      {awayPlayers.map((p, i) => (
        <div
          key={`a${i}`}
          className="absolute flex flex-col items-center"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="w-6 h-6 rounded-full bg-sb-draw flex items-center justify-center text-white text-[9px] font-bold shadow-md">
            {p.number ?? ""}
          </div>
          <span className="text-[8px] text-white/90 mt-0.5 max-w-[48px] truncate text-center">
            {p.player.split(" ").pop()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function MatchDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const fixtureId = params.id;

  const [radarWindow, setRadarWindow] = useState<"last5" | "season">("last5");
  const [showRadarInfo, setShowRadarInfo] = useState(false);
  const [showXgInfo, setShowXgInfo] = useState(false);
  const [showDualStats, setShowDualStats] = useState(false);
  const [h2hCount, setH2hCount] = useState<number>(5);
  const [h2hType, setH2hType] = useState<"all" | "league">("all");
  const [h2hVenue, setH2hVenue] = useState<"all" | "home">("all");
  const [h2hExpanded, setH2hExpanded] = useState(false);

  const { data, isLoading, error } = useQuery<MatchDetailResponse>({
    queryKey: ["v2-fixture-detail", fixtureId, radarWindow],
    queryFn: async () => {
      const res = await fetch(
        `/api/v2/fixtures/${fixtureId}/detail?window=${radarWindow}`,
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!fixtureId,
  });

  // Separate H2H query for filters (only fetches when filters differ from default)
  const isH2hCustom = h2hCount !== 5 || h2hType !== "all" || h2hVenue !== "all";
  const { data: h2hCustom } = useQuery<{ ok: boolean } & H2HData>({
    queryKey: ["v2-h2h", fixtureId, h2hCount, h2hType, h2hVenue],
    queryFn: async () => {
      const res = await fetch(
        `/api/v2/fixtures/${fixtureId}/h2h?count=${h2hCount}&type=${h2hType}&venue=${h2hVenue}`,
      );
      if (!res.ok) throw new Error("Failed to fetch H2H");
      return res.json();
    },
    enabled: !!fixtureId && isH2hCustom,
  });

  // ── Loading ──
  if (!data && isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 bg-sb-bg min-h-screen">
        <div className="space-y-4">
          <div className="bg-sb-surface rounded-2xl p-5 space-y-4">
            <Skeleton className="h-4 w-32 mx-auto bg-sb-skeleton" />
            <div className="flex justify-between items-start">
              <div className="flex-1 flex flex-col items-center gap-2">
                <Skeleton className="w-12 h-12 rounded-full bg-sb-skeleton" />
                <Skeleton className="h-4 w-16 bg-sb-skeleton" />
              </div>
              <Skeleton className="h-8 w-14 mt-3 bg-sb-skeleton" />
              <div className="flex-1 flex flex-col items-center gap-2">
                <Skeleton className="w-12 h-12 rounded-full bg-sb-skeleton" />
                <Skeleton className="h-4 w-16 bg-sb-skeleton" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-14 rounded-lg bg-sb-skeleton" />
              <Skeleton className="h-14 rounded-lg bg-sb-skeleton" />
              <Skeleton className="h-14 rounded-lg bg-sb-skeleton" />
            </div>
          </div>
          <Skeleton className="h-10 rounded-lg bg-sb-skeleton" />
          <Skeleton className="h-48 rounded-xl bg-sb-skeleton" />
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !data?.ok) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center text-sb-text-dim bg-sb-bg min-h-screen">
        <p>경기 정보를 불러올 수 없습니다</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 text-sb-primary text-sm"
        >
          ← 홈으로
        </button>
      </div>
    );
  }

  // ── Data ──
  const {
    fixture: fx,
    weather,
    home,
    away,
    odds,
    radar,
    seasonStats,
    h2h,
    lineups,
    summary,
  } = data;
  const homeName = getTeamName(home.team.name);
  const awayName = getTeamName(away.team.name);
  const impliedProb = odds?.current ? calcImpliedProb(odds.current) : null;
  const totalInjuries = home.injuries.length + away.injuries.length;

  // H2H: custom query result overrides default when filters are non-default
  const h2hData: H2HData | null = isH2hCustom && h2hCustom?.ok
    ? { filters: h2hCustom.filters, summary: h2hCustom.summary, metrics: h2hCustom.metrics, matches: h2hCustom.matches }
    : h2h;

  return (
    <div className="max-w-lg mx-auto bg-sb-bg min-h-screen">
      {/* ── 고정 헤더 ── */}
      <header className="sticky top-0 z-40 bg-sb-bg/95 backdrop-blur-sm border-b border-sb-border">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button onClick={() => navigate("/")} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-sb-text-muted" />
          </button>
          <span className="text-sm text-sb-text-muted">{fx.league.name}</span>
        </div>
      </header>

      <main className="px-4 py-4 space-y-3">
        {/* ============================================ */}
        {/* 경기 헤더 카드 */}
        {/* ============================================ */}
        <section className="bg-sb-surface rounded-2xl p-5">
          <p className="text-center text-xs text-sb-text-dim mb-4">
            {formatKickoff(fx.kickoffAt)}
          </p>

          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 text-center">
              {home.team.logo && (
                <img
                  src={home.team.logo}
                  alt=""
                  className="w-12 h-12 mx-auto mb-1.5 object-contain"
                />
              )}
              <p className="text-sm font-bold text-sb-text">{homeName}</p>
              {home.standing && (
                <p className="text-[11px] text-sb-text-dim mt-0.5">
                  {home.standing.rank}위 · {home.standing.won}승
                  {home.standing.drawn}무{home.standing.lost}패
                </p>
              )}
            </div>

            <div className="flex-shrink-0 px-4 pt-3">
              {fx.score ? (
                <div className="text-2xl font-bold text-sb-text">
                  <span>{fx.score.home}</span>
                  <span className="text-sb-text-faint mx-2">-</span>
                  <span>{fx.score.away}</span>
                </div>
              ) : (
                <span className="text-lg font-bold text-sb-text-faint">vs</span>
              )}
            </div>

            <div className="flex-1 text-center">
              {away.team.logo && (
                <img
                  src={away.team.logo}
                  alt=""
                  className="w-12 h-12 mx-auto mb-1.5 object-contain"
                />
              )}
              <p className="text-sm font-bold text-sb-text">{awayName}</p>
              {away.standing && (
                <p className="text-[11px] text-sb-text-dim mt-0.5">
                  {away.standing.rank}위 · {away.standing.won}승
                  {away.standing.drawn}무{away.standing.lost}패
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-3 px-2">
            <div className="flex-1">
              <FormDots form={home.recentForm} />
            </div>
            <span className="text-[10px] text-sb-text-faint px-3">최근 5경기</span>
            <div className="flex-1 flex justify-end">
              <FormDots form={away.recentForm} />
            </div>
          </div>

          {/* 경기장 + 날씨 */}
          {(fx.venue?.name || weather) && (
            <p className="text-center text-[11px] text-sb-text-faint mb-3">
              {fx.venue?.name && (
                <>📍 {fx.venue.name}</>
              )}
              {fx.venue?.name && weather && " · "}
              {weather && (
                <>☁ {Math.round(weather.temp)}°</>
              )}
            </p>
          )}

          {odds?.current && (
            <div className="grid grid-cols-3 gap-2">
              <OddsChip
                label="홈 승"
                odds={odds.current.home}
                prob={impliedProb?.home}
                isHighest={
                  impliedProb
                    ? impliedProb.home >= impliedProb.draw &&
                      impliedProb.home >= impliedProb.away
                    : false
                }
              />
              <OddsChip
                label="무"
                odds={odds.current.draw}
                prob={impliedProb?.draw}
                isHighest={
                  impliedProb
                    ? impliedProb.draw >= impliedProb.home &&
                      impliedProb.draw >= impliedProb.away
                    : false
                }
              />
              <OddsChip
                label="원정 승"
                odds={odds.current.away}
                prob={impliedProb?.away}
                isHighest={
                  impliedProb
                    ? impliedProb.away >= impliedProb.home &&
                      impliedProb.away >= impliedProb.draw
                    : false
                }
              />
            </div>
          )}
        </section>

        {/* ============================================ */}
        {/* 탭 */}
        {/* ============================================ */}
        <Tabs defaultValue="detail">
          <TabsList className="w-full grid grid-cols-2 bg-sb-surface h-10">
            <TabsTrigger
              value="detail"
              className="data-[state=active]:bg-sb-primary data-[state=active]:text-white text-sb-text-muted rounded-md text-sm"
            >
              상세정보
            </TabsTrigger>
            <TabsTrigger
              value="odds"
              className="data-[state=active]:bg-sb-primary data-[state=active]:text-white text-sb-text-muted rounded-md text-sm"
            >
              배당
            </TabsTrigger>
          </TabsList>

          {/* ── 상세정보 탭 ── */}
          <TabsContent value="detail" className="space-y-3 mt-3">
            {/* 경기 요약 */}
            {summary && (
              <Section icon="🧠" title="경기 요약">
                <p className="text-sm text-sb-text-secondary leading-relaxed">
                  {summary}
                </p>
              </Section>
            )}

            {/* ── 레이더 차트 ── */}
            <Section
              icon="📡"
              title="팀 전력 비교"
              action={
                <button
                  onClick={() => setShowRadarInfo((v) => !v)}
                  className="p-1 rounded-md hover:bg-sb-skeleton transition-colors"
                >
                  <Info className="w-3.5 h-3.5 text-sb-text-dim" />
                </button>
              }
            >
              {radar ? (
                <>
                  {/* Window toggle */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-1 bg-sb-bg rounded-lg p-0.5">
                      <button
                        onClick={() => setRadarWindow("last5")}
                        className={`px-3 py-1 rounded-md text-xs transition-colors ${
                          radarWindow === "last5"
                            ? "bg-sb-primary text-white"
                            : "text-sb-text-muted"
                        }`}
                      >
                        최근 5경기
                      </button>
                      <button
                        onClick={() => setRadarWindow("season")}
                        className={`px-3 py-1 rounded-md text-xs transition-colors ${
                          radarWindow === "season"
                            ? "bg-sb-primary text-white"
                            : "text-sb-text-muted"
                        }`}
                      >
                        시즌 전체
                      </button>
                    </div>
                    <span className="text-[10px] text-sb-text-faint">
                      {radarWindow === "last5"
                        ? "최근 흐름 반영"
                        : "시즌 체급 반영"}
                    </span>
                  </div>

                  {/* Early season warning */}
                  {radar.earlySeasonWarning && (
                    <div className="text-center mb-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sb-draw/15 text-sb-draw">
                        시즌 초반 — 참고용
                      </span>
                    </div>
                  )}

                  {/* Chart */}
                  <RadarChart
                    radar={radar}
                    homeName={homeName}
                    awayName={awayName}
                  />

                  {/* Info panel */}
                  {showRadarInfo && (
                    <div className="mt-3 pt-3 border-t border-sb-border space-y-2">
                      {RADAR_AXES.map((axis, i) => (
                        <div key={axis.key} className="flex gap-2 text-xs">
                          <span className="text-sb-text w-14 flex-shrink-0">
                            {axis.emoji} {axis.label}
                          </span>
                          <span className="text-sb-text-dim">
                            {RADAR_DESCRIPTIONS[i]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-sb-text-dim text-sm">
                  분석 데이터 수집 중
                </div>
              )}
            </Section>

            {/* ── 시즌 스탯 비교 (양쪽 수치 동시 표시, 토글로 강조 변경) ── */}
            {seasonStats && (
                <Section
                  icon="📊"
                  title="시즌 스탯 비교"
                  action={
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDualStats(v => !v)}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                          showDualStats
                            ? "bg-sb-primary/20 text-sb-primary"
                            : "text-sb-text-faint hover:text-sb-text-muted"
                        }`}
                      >
                        비교
                      </button>
                      <div className="flex items-center gap-1 text-[10px] text-sb-text-faint">
                        <span className={radarWindow === "last5" ? "text-sb-text-muted font-medium" : ""}>최근5</span>
                        <span>/</span>
                        <span className={radarWindow === "season" ? "text-sb-text-muted font-medium" : ""}>시즌</span>
                      </div>
                    </div>
                  }
                >
                  <div className="space-y-3">
                    <div>
                      <DualStatRow
                        label="xG차이"
                        homeSeason={seasonStats.home.season.xgDiff} homeLast5={seasonStats.home.last5.xgDiff}
                        awaySeason={seasonStats.away.season.xgDiff} awayLast5={seasonStats.away.last5.xgDiff}
                        format="2" star focused={radarWindow} dual={showDualStats}
                      />
                      {showXgInfo && (
                        <p className="text-[10px] text-sb-text-dim text-center mt-1 px-4">
                          xG(기대득점) - xGA(기대실점). 축구에서 가장 강력한 성과 지표
                        </p>
                      )}
                    </div>
                    <DualStatRow
                      label="득점"
                      homeSeason={seasonStats.home.season.goals} homeLast5={seasonStats.home.last5.goals}
                      awaySeason={seasonStats.away.season.goals} awayLast5={seasonStats.away.last5.goals}
                      format="1" focused={radarWindow} dual={showDualStats}
                    />
                    <DualStatRow
                      label="실점"
                      homeSeason={seasonStats.home.season.conceded} homeLast5={seasonStats.home.last5.conceded}
                      awaySeason={seasonStats.away.season.conceded} awayLast5={seasonStats.away.last5.conceded}
                      format="1" reverse focused={radarWindow} dual={showDualStats}
                    />
                    <DualStatRow
                      label="점유율"
                      homeSeason={seasonStats.home.season.possession} homeLast5={seasonStats.home.last5.possession}
                      awaySeason={seasonStats.away.season.possession} awayLast5={seasonStats.away.last5.possession}
                      format="0" suffix="%" focused={radarWindow} dual={showDualStats}
                    />
                    <DualStatRow
                      label="유효슈팅"
                      homeSeason={seasonStats.home.season.shotsOnTarget} homeLast5={seasonStats.home.last5.shotsOnTarget}
                      awaySeason={seasonStats.away.season.shotsOnTarget} awayLast5={seasonStats.away.last5.shotsOnTarget}
                      format="1" focused={radarWindow} dual={showDualStats}
                    />
                    <DualStatRow
                      label="코너킥"
                      homeSeason={seasonStats.home.season.corners} homeLast5={seasonStats.home.last5.corners}
                      awaySeason={seasonStats.away.season.corners} awayLast5={seasonStats.away.last5.corners}
                      format="1" focused={radarWindow} dual={showDualStats}
                    />
                    <DualStatRow
                      label="패스정확도"
                      homeSeason={seasonStats.home.season.passAccuracy} homeLast5={seasonStats.home.last5.passAccuracy}
                      awaySeason={seasonStats.away.season.passAccuracy} awayLast5={seasonStats.away.last5.passAccuracy}
                      format="0" suffix="%" focused={radarWindow} dual={showDualStats}
                    />
                  </div>

                  {/* xG info toggle */}
                  <div className="mt-2 flex justify-center">
                    <button
                      onClick={() => setShowXgInfo((v) => !v)}
                      className="flex items-center gap-1 text-[10px] text-sb-text-faint hover:text-sb-text-muted transition-colors"
                    >
                      <Info className="w-3 h-3" />
                      <span>★ xG 차이란?</span>
                    </button>
                  </div>

                  {/* 휴식일 */}
                  {home.restDays != null && away.restDays != null && (
                    <div className="mt-3 pt-3 border-t border-sb-border">
                      <p className="text-xs text-sb-text-dim mb-2">휴식일</p>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: restDaysColor(home.restDays) }}
                          >
                            {home.restDays}일
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-px rounded-full"
                            style={{
                              color: restDaysColor(home.restDays),
                              backgroundColor: restDaysColor(home.restDays) + "20",
                            }}
                          >
                            {restDaysLabel(home.restDays)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] px-1.5 py-px rounded-full"
                            style={{
                              color: restDaysColor(away.restDays),
                              backgroundColor: restDaysColor(away.restDays) + "20",
                            }}
                          >
                            {restDaysLabel(away.restDays)}
                          </span>
                          <span
                            className="text-sm font-semibold"
                            style={{ color: restDaysColor(away.restDays) }}
                          >
                            {away.restDays}일
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </Section>
            )}

            {/* ── 상대전적 ── */}
            {(h2hData || h2h) && (
              <Section icon="⚔️" title="상대전적">
                {/* Filter bar */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <div className="flex gap-0.5 bg-sb-bg rounded-md p-0.5">
                    {[3, 5, 10, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => setH2hCount(n)}
                        className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                          h2hCount === n ? "bg-sb-primary text-white" : "text-sb-text-dim"
                        }`}
                      >
                        {n}경기
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-0.5 bg-sb-bg rounded-md p-0.5">
                    {([["all", "전체"], ["league", "리그"]] as const).map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => setH2hType(v)}
                        className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                          h2hType === v ? "bg-sb-primary text-white" : "text-sb-text-dim"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-0.5 bg-sb-bg rounded-md p-0.5">
                    {([["all", "홈+원정"], ["home", "홈만"]] as const).map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => setH2hVenue(v)}
                        className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                          h2hVenue === v ? "bg-sb-primary text-white" : "text-sb-text-dim"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {h2hData && h2hData.summary.total > 0 ? (
                  <>
                    {/* Summary bar */}
                    <div className="mb-3">
                      <H2HBar
                        homeWins={h2hData.summary.homeWins}
                        draws={h2hData.summary.draws}
                        awayWins={h2hData.summary.awayWins}
                      />
                      <div className="flex justify-between text-xs mt-1.5">
                        <span className="text-sb-primary font-medium">
                          {homeName} {h2hData.summary.homeWins}승 ({h2hData.summary.homeWinPct}%)
                        </span>
                        <span className="text-sb-text-dim">{h2hData.summary.draws}무</span>
                        <span className="text-sb-draw font-medium">
                          {awayName} {h2hData.summary.awayWins}승 ({h2hData.summary.awayWinPct}%)
                        </span>
                      </div>
                    </div>

                    {/* Metric cards — unified style */}
                    <div className="flex gap-3 justify-center mb-4">
                      {h2hData.metrics.avgGoalsPerMatch != null && (
                        <ProgressRing
                          value={Math.round(h2hData.metrics.avgGoalsPerMatch * 20)}
                          label="평균 골/경기"
                          count={h2hData.metrics.avgGoalsPerMatch}
                          total={0}
                        />
                      )}
                      <ProgressRing
                        value={h2hData.metrics.over25Pct}
                        label="오버 2.5"
                        count={h2hData.metrics.over25Count}
                        total={h2hData.summary.total}
                      />
                      <ProgressRing
                        value={h2hData.metrics.bttsPct}
                        label="양팀득점"
                        count={h2hData.metrics.bttsCount}
                        total={h2hData.summary.total}
                      />
                    </div>

                    {/* Timeline */}
                    <div className="space-y-1.5">
                      {(h2hExpanded ? h2hData.matches : h2hData.matches.slice(0, 3)).map((m, i) => {
                        const isRecent = i === 0;
                        const d = new Date(m.date);
                        const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isRecent ? "bg-sb-bg" : ""}`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                                m.result === "W"
                                  ? "bg-sb-win/20 text-sb-win"
                                  : m.result === "D"
                                    ? "bg-[#6B7280]/20 text-[#6B7280]"
                                    : "bg-sb-live/20 text-sb-live"
                              }`}
                            >
                              {m.result}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className={`flex items-center gap-1 ${isRecent ? "text-xs font-medium" : "text-[11px]"}`}>
                                <span className={m.isHomeVenue ? "text-sb-text" : "text-sb-text-muted"}>
                                  {getTeamName(m.homeTeam)}
                                </span>
                                <span className="text-sb-text font-bold">
                                  {m.homeGoals}-{m.awayGoals}
                                </span>
                                <span className={!m.isHomeVenue ? "text-sb-text" : "text-sb-text-muted"}>
                                  {getTeamName(m.awayTeam)}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end flex-shrink-0">
                              <span className="text-[9px] text-sb-text-faint">{dateStr}</span>
                              <span className="text-[9px] text-sb-text-faint">{m.competition}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {h2hData.matches.length > 3 && (
                      <button
                        onClick={() => setH2hExpanded((v) => !v)}
                        className="w-full mt-2 text-center text-[11px] text-sb-primary hover:text-sb-primary/80 transition-colors"
                      >
                        {h2hExpanded ? "접기" : `전체 ${h2hData.matches.length}경기 보기`}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-sb-text-dim text-center py-4">
                    상대전적 기록이 없습니다
                  </p>
                )}
              </Section>
            )}

            {/* ── 부상/결장 아코디언 ── */}
            <Accordion type="single" collapsible>
              <AccordionItem
                value="injuries"
                className="bg-sb-surface rounded-xl border-none px-4"
              >
                <AccordionTrigger className="py-3 text-sm text-sb-text hover:no-underline">
                  <div className="flex items-center gap-1.5">
                    <span>🚑</span>
                    <span>부상/결장</span>
                    {totalInjuries > 0 && (
                      <span className="ml-1 text-[10px] px-1.5 py-px rounded-full bg-sb-live/20 text-sb-live">
                        {totalInjuries}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <InjurySection
                    homeInjuries={home.injuries}
                    awayInjuries={away.injuries}
                    homeName={homeName}
                    awayName={awayName}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* ── 라인업 ── */}
            <Section icon="📋" title="라인업">
              {lineups && (lineups.home || lineups.away) ? (
                <div className="space-y-4">
                  {/* Pitch */}
                  {lineups.home && (
                    <PitchGraphic
                      homeLineup={lineups.home}
                      awayLineup={lineups.away}
                      homeName={homeName}
                      awayName={awayName}
                    />
                  )}

                  {/* Coach */}
                  {(lineups.home?.coach || lineups.away?.coach) && (
                    <div className="flex justify-between text-xs text-sb-text-muted px-1">
                      {lineups.home?.coach && (
                        <span>🧑‍💼 {lineups.home.coach}</span>
                      )}
                      {lineups.away?.coach && (
                        <span>🧑‍💼 {lineups.away.coach}</span>
                      )}
                    </div>
                  )}

                  {/* Subs */}
                  {[
                    { side: lineups.home, name: homeName, color: "#3B82F6" },
                    { side: lineups.away, name: awayName, color: "#F59E0B" },
                  ].map(({ side, name, color }) =>
                    side && side.subs.length > 0 ? (
                      <div key={name}>
                        <p className="text-[10px] text-sb-text-dim mb-1.5">{name} 교체</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                          {side.subs.map((s, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-sb-bg flex-shrink-0"
                            >
                              <span
                                className="text-[9px] font-bold"
                                style={{ color }}
                              >
                                {s.number ?? ""}
                              </span>
                              <span className="text-[10px] text-sb-text-muted whitespace-nowrap">
                                {s.player.split(" ").pop()}
                              </span>
                              {s.pos && (
                                <span className="text-[8px] text-sb-text-faint">
                                  {POS_LABEL[s.pos] || s.pos}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null,
                  )}

                  {/* Confirmed badge */}
                  {lineups.home?.confirmed && (
                    <div className="text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sb-win/15 text-sb-win">
                        확정 라인업
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-sb-text-dim">
                  경기 약 1시간 전 공개됩니다
                </p>
              )}
            </Section>
          </TabsContent>

          {/* ── 배당 탭 ── */}
          <TabsContent value="odds" className="space-y-3 mt-3">
            {odds?.allBookmakers && odds.allBookmakers.length > 0 ? (
              <>
                {/* Average summary */}
                {(() => {
                  const bm = odds.allBookmakers;
                  const avgH = bm.reduce((s, b) => s + b.home, 0) / bm.length;
                  const avgD = bm.reduce((s, b) => s + b.draw, 0) / bm.length;
                  const avgA = bm.reduce((s, b) => s + b.away, 0) / bm.length;
                  const avgProb = calcImpliedProb({ home: avgH, draw: avgD, away: avgA });
                  return (
                    <Section icon="📈" title="배당 평균">
                      <div className="grid grid-cols-3 gap-2">
                        <OddsChip
                          label="홈 승"
                          odds={avgH}
                          prob={avgProb?.home}
                          isHighest={avgProb ? avgProb.home >= avgProb.draw && avgProb.home >= avgProb.away : false}
                        />
                        <OddsChip
                          label="무"
                          odds={avgD}
                          prob={avgProb?.draw}
                          isHighest={avgProb ? avgProb.draw >= avgProb.home && avgProb.draw >= avgProb.away : false}
                        />
                        <OddsChip
                          label="원정 승"
                          odds={avgA}
                          prob={avgProb?.away}
                          isHighest={avgProb ? avgProb.away >= avgProb.home && avgProb.away >= avgProb.draw : false}
                        />
                      </div>
                      <p className="text-[10px] text-sb-text-faint text-center mt-2">
                        {bm.length}개 북메이커 평균
                      </p>
                    </Section>
                  );
                })()}

                {/* Bookmaker table with best odds highlighting */}
                <Section icon="💰" title="북메이커별 배당">
                  {(() => {
                    const bm = odds.allBookmakers;
                    const maxH = Math.max(...bm.map((b) => b.home));
                    const maxD = Math.max(...bm.map((b) => b.draw));
                    const maxA = Math.max(...bm.map((b) => b.away));
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-sb-text-dim border-b border-sb-border">
                              <th className="text-left py-1.5 pr-2">북메이커</th>
                              <th className="text-center py-1.5 w-16">홈</th>
                              <th className="text-center py-1.5 w-16">무</th>
                              <th className="text-center py-1.5 w-16">원정</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bm.map((bo, i) => (
                              <tr key={i} className="border-b border-sb-border/50">
                                <td className="py-1.5 pr-2 text-sb-text-muted">
                                  {bo.bookmaker}
                                </td>
                                <td
                                  className={`text-center py-1.5 ${
                                    bo.home === maxH
                                      ? "text-sb-win font-semibold"
                                      : "text-sb-text"
                                  }`}
                                >
                                  {bo.home.toFixed(2)}
                                </td>
                                <td
                                  className={`text-center py-1.5 ${
                                    bo.draw === maxD
                                      ? "text-sb-win font-semibold"
                                      : "text-sb-text"
                                  }`}
                                >
                                  {bo.draw.toFixed(2)}
                                </td>
                                <td
                                  className={`text-center py-1.5 ${
                                    bo.away === maxA
                                      ? "text-sb-win font-semibold"
                                      : "text-sb-text"
                                  }`}
                                >
                                  {bo.away.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </Section>
              </>
            ) : (
              <div className="text-center py-8 text-sb-text-dim text-sm">
                배당 정보가 아직 없습니다
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="h-20" />
      </main>
    </div>
  );
}
