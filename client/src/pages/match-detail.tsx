import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, MapPin, Cloud, Droplets, AlertTriangle, Swords, BarChart3, DollarSign, Users } from "lucide-react";
import { getTeamName } from "@/shared/team-names";

// ============================================================
// 유틸
// ============================================================
function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function FormDots({ form }: { form: string | null }) {
  if (!form) return <span className="text-[10px] text-[#475569]">–</span>;
  return (
    <div className="flex gap-0.5">
      {form.split("").slice(-5).map((r, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center
            ${r === "W" ? "bg-[#22C55E]/20 text-[#22C55E]"
            : r === "D" ? "bg-[#F59E0B]/20 text-[#F59E0B]"
            : "bg-[#EF4444]/20 text-[#EF4444]"}`}
        >
          {r}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Match Detail 페이지
// ============================================================
export default function MatchDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const fixtureId = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["v2-fixture-detail", fixtureId],
    queryFn: async () => {
      const res = await fetch(`/api/v2/fixtures/${fixtureId}/detail`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!fixtureId,
  });

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="space-y-4">
          <div className="h-40 rounded-xl bg-[#151D2B] animate-pulse" />
          <div className="h-24 rounded-xl bg-[#151D2B] animate-pulse" />
          <div className="h-32 rounded-xl bg-[#151D2B] animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center text-[#64748B]">
        <p>경기 정보를 불러올 수 없습니다</p>
        <button onClick={() => navigate("/")} className="mt-4 text-[#3B82F6] text-sm">← 홈으로</button>
      </div>
    );
  }

  const { fixture: fx, odds, impliedProb, injuries, stats, h2h, bookmakerOdds, summary } = data;
  const home = fx.homeTeam;
  const away = fx.awayTeam;
  const homeName = getTeamName(home.name);
  const awayName = getTeamName(away.name);

  return (
    <div className="max-w-lg mx-auto">
      {/* ── 고정 헤더 ── */}
      <header className="sticky top-0 z-40 bg-[#0A0E17]/95 backdrop-blur-sm border-b border-[#1E293B]">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button onClick={() => navigate("/")} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-[#94A3B8]" />
          </button>
          <span className="text-sm text-[#94A3B8]">{fx.league.name}</span>
          <span className="text-[10px] text-[#475569]">·</span>
          {fx.venue?.name && (
            <>
              <MapPin className="w-3 h-3 text-[#475569]" />
              <span className="text-xs text-[#475569] truncate">{fx.venue.name}</span>
            </>
          )}
          {fx.weather && (
            <>
              <span className="text-[10px] text-[#475569]">·</span>
              <Cloud className="w-3 h-3 text-[#475569]" />
              <span className="text-xs text-[#475569]">{Math.round(fx.weather.temp)}°</span>
            </>
          )}
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* ============================================ */}
        {/* ABOVE THE FOLD — 핵심 3대 정보 */}
        {/* ============================================ */}
        <section className="bg-[#111827] rounded-2xl p-5">
          {/* 킥오프 시간 */}
          <p className="text-center text-xs text-[#64748B] mb-4">{formatKickoff(fx.kickoffAt)}</p>

          {/* 팀 정보 + 순위 + 전적 */}
          <div className="flex items-start justify-between mb-4">
            {/* 홈 */}
            <div className="flex-1 text-center">
              {home.logoUrl && <img src={home.logoUrl} alt="" className="w-12 h-12 mx-auto mb-1.5 object-contain" />}
              <p className="text-sm font-bold">{homeName}</p>
              {home.standing && (
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  {home.standing.rank}위 · {home.standing.won}승{home.standing.drawn}무{home.standing.lost}패
                </p>
              )}
            </div>

            {/* VS or 스코어 */}
            <div className="flex-shrink-0 px-4 pt-3">
              {fx.score ? (
                <div className="text-2xl font-bold">
                  <span>{fx.score.home}</span>
                  <span className="text-[#475569] mx-2">-</span>
                  <span>{fx.score.away}</span>
                </div>
              ) : (
                <span className="text-lg font-bold text-[#475569]">vs</span>
              )}
            </div>

            {/* 원정 */}
            <div className="flex-1 text-center">
              {away.logoUrl && <img src={away.logoUrl} alt="" className="w-12 h-12 mx-auto mb-1.5 object-contain" />}
              <p className="text-sm font-bold">{awayName}</p>
              {away.standing && (
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  {away.standing.rank}위 · {away.standing.won}승{away.standing.drawn}무{away.standing.lost}패
                </p>
              )}
            </div>
          </div>

          {/* 최근 5경기 폼 */}
          <div className="flex justify-between items-center mb-4 px-2">
            <div className="flex-1">
              <FormDots form={home.standing?.form} />
            </div>
            <span className="text-[10px] text-[#475569] px-3">최근 5경기</span>
            <div className="flex-1 flex justify-end">
              <FormDots form={away.standing?.form} />
            </div>
          </div>

          {/* 배당 + 내재확률 */}
          {odds && impliedProb && (
            <div className="grid grid-cols-3 gap-2">
              <OddsChip label="홈승" odds={odds.home} prob={impliedProb.home}
                isHighest={impliedProb.home >= impliedProb.draw && impliedProb.home >= impliedProb.away} />
              <OddsChip label="무" odds={odds.draw} prob={impliedProb.draw}
                isHighest={impliedProb.draw >= impliedProb.home && impliedProb.draw >= impliedProb.away} />
              <OddsChip label="원정" odds={odds.away} prob={impliedProb.away}
                isHighest={impliedProb.away >= impliedProb.home && impliedProb.away >= impliedProb.draw} />
            </div>
          )}
          {odds && !impliedProb && (
            <div className="grid grid-cols-3 gap-2">
              <OddsChip label="홈승" odds={odds.home} />
              <OddsChip label="무" odds={odds.draw} />
              <OddsChip label="원정" odds={odds.away} />
            </div>
          )}
        </section>

        {/* ============================================ */}
        {/* 🧠 경기 요약 */}
        {/* ============================================ */}
        {summary && (
          <Section icon="🧠" title="경기 요약">
            <p className="text-sm text-[#CBD5E1] leading-relaxed">{summary}</p>
          </Section>
        )}

        {/* ============================================ */}
        {/* 🚑 부상/결장 */}
        {/* ============================================ */}
        {injuries && injuries.length > 0 && (
          <Section icon="🚑" title="부상/결장">
            <div className="space-y-1.5">
              {injuries.map((inj: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full ${inj.isHome ? "bg-[#3B82F6]" : "bg-[#F59E0B]"}`} />
                  <span className="text-[#94A3B8] w-14 text-xs truncate">
                    {getTeamName(inj.teamName)}
                  </span>
                  <span className="text-[#F1F5F9]">{inj.playerName}</span>
                  <span className="text-xs text-[#64748B] ml-auto">{inj.reason || inj.status || ""}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ============================================ */}
        {/* ⚔ 상대전적 */}
        {/* ============================================ */}
        {h2h && h2h.total && h2h.total > 0 && (
          <Section icon="⚔️" title={`상대전적 (최근 ${h2h.total}경기)`}>
            {/* H2H 바 */}
            <div className="mb-3">
              <H2HBar homeWins={h2h.homeWins || 0} draws={h2h.draws || 0} awayWins={h2h.awayWins || 0} />
              <div className="flex justify-between text-xs text-[#94A3B8] mt-1">
                <span>{homeName} {h2h.homeWins || 0}승</span>
                <span>{h2h.draws || 0}무</span>
                <span>{awayName} {h2h.awayWins || 0}승</span>
              </div>
            </div>
            {/* 평균 골 */}
            {h2h.homeGoalsAvg != null && (
              <p className="text-xs text-[#64748B]">
                평균 골: {homeName} {h2h.homeGoalsAvg?.toFixed(1) || 0} vs {awayName} {h2h.awayGoalsAvg?.toFixed(1) || 0}
              </p>
            )}
          </Section>
        )}

        {/* ============================================ */}
        {/* 📊 시즌 스탯 비교 */}
        {/* ============================================ */}
        {stats && (
          <Section icon="📊" title="시즌 스탯 비교 (경기당 평균)">
            <div className="space-y-3">
              <StatBar label="xG" home={stats.home.xg} away={stats.away.xg} format="1" />
              <StatBar label="점유율" home={stats.home.possession} away={stats.away.possession} format="0" suffix="%" />
              <StatBar label="득점" home={stats.home.goalsFor} away={stats.away.goalsFor} format="1" />
              <StatBar label="실점" home={stats.home.goalsAgainst} away={stats.away.goalsAgainst} format="1" reverse />
              <StatBar label="유효슈팅" home={stats.home.shotsOnTarget} away={stats.away.shotsOnTarget} format="1" />
              <StatBar label="코너킥" home={stats.home.corners} away={stats.away.corners} format="1" />
              <StatBar label="패스 정확도" home={stats.home.passAccuracy} away={stats.away.passAccuracy} format="0" suffix="%" />
            </div>
            {/* 홈/어웨이 분리 스탯 */}
            {(stats.home.winPctHome || stats.away.winPctAway) && (
              <div className="mt-4 pt-3 border-t border-[#1E293B]">
                <p className="text-xs text-[#64748B] mb-2">홈/어웨이 성적</p>
                {stats.home.winPctHome != null && (
                  <StatBar label={`${homeName} 홈 승률`} home={stats.home.winPctHome} away={null} format="0" suffix="%" singleSide />
                )}
                {stats.away.winPctAway != null && (
                  <StatBar label={`${awayName} 원정 승률`} home={null} away={stats.away.winPctAway} format="0" suffix="%" singleSide />
                )}
              </div>
            )}
            {/* 피로도 */}
            {stats.home.daysRest != null && stats.away.daysRest != null && (
              <div className="mt-3 pt-3 border-t border-[#1E293B]">
                <p className="text-xs text-[#64748B] mb-1">휴식일</p>
                <div className="flex justify-between text-sm">
                  <span>{stats.home.daysRest}일</span>
                  <span>{stats.away.daysRest}일</span>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ============================================ */}
        {/* 💰 배당 상세 */}
        {/* ============================================ */}
        {bookmakerOdds && bookmakerOdds.length > 0 && (
          <Section icon="💰" title="북메이커별 배당">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#64748B] border-b border-[#1E293B]">
                    <th className="text-left py-1.5 pr-2">북메이커</th>
                    <th className="text-center py-1.5 w-16">홈</th>
                    <th className="text-center py-1.5 w-16">무</th>
                    <th className="text-center py-1.5 w-16">원정</th>
                  </tr>
                </thead>
                <tbody>
                  {bookmakerOdds.map((bo: any, i: number) => (
                    <tr key={i} className="border-b border-[#1E293B]/50">
                      <td className="py-1.5 pr-2 text-[#94A3B8]">{bo.bookmaker}</td>
                      <td className="text-center py-1.5 text-[#F1F5F9]">{bo.home.toFixed(2)}</td>
                      <td className="text-center py-1.5 text-[#F1F5F9]">{bo.draw.toFixed(2)}</td>
                      <td className="text-center py-1.5 text-[#F1F5F9]">{bo.away.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* ============================================ */}
        {/* 📋 라인업 (플레이스홀더) */}
        {/* ============================================ */}
        <Section icon="📋" title="라인업">
          <p className="text-sm text-[#64748B]">⏳ 경기 약 1시간 전 공개됩니다</p>
        </Section>

        {/* 하단 여백 */}
        <div className="h-8" />
      </main>
    </div>
  );
}

// ============================================================
// 서브 컴포넌트
// ============================================================

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#111827] rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function OddsChip({ label, odds, prob, isHighest }: {
  label: string; odds: number; prob?: number; isHighest?: boolean;
}) {
  return (
    <div className={`rounded-lg p-2.5 text-center transition-colors
      ${isHighest ? "bg-[#3B82F6]/15 ring-1 ring-[#3B82F6]/30" : "bg-[#0A0E17]"}`}>
      <p className="text-[10px] text-[#64748B] mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${isHighest ? "text-[#3B82F6]" : "text-[#F1F5F9]"}`}>
        {odds.toFixed(2)}
      </p>
      {prob != null && (
        <p className={`text-[10px] mt-0.5 ${isHighest ? "text-[#3B82F6]/70" : "text-[#475569]"}`}>
          {prob}%
        </p>
      )}
    </div>
  );
}

function H2HBar({ homeWins, draws, awayWins }: { homeWins: number; draws: number; awayWins: number }) {
  const total = homeWins + draws + awayWins;
  if (total === 0) return null;
  const hp = (homeWins / total) * 100;
  const dp = (draws / total) * 100;
  const ap = (awayWins / total) * 100;

  return (
    <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
      {hp > 0 && <div className="bg-[#3B82F6] rounded-l-full" style={{ width: `${hp}%` }} />}
      {dp > 0 && <div className="bg-[#64748B]" style={{ width: `${dp}%` }} />}
      {ap > 0 && <div className="bg-[#F59E0B] rounded-r-full" style={{ width: `${ap}%` }} />}
    </div>
  );
}

function StatBar({ label, home, away, format, suffix, reverse, singleSide }: {
  label: string;
  home: number | null;
  away: number | null;
  format: string;
  suffix?: string;
  reverse?: boolean;
  singleSide?: boolean;
}) {
  const fmt = (v: number | null) => {
    if (v == null) return "–";
    return format === "0" ? Math.round(v).toString() : v.toFixed(parseInt(format));
  };
  const s = suffix || "";

  if (singleSide) {
    const val = home ?? away ?? 0;
    return (
      <div className="flex items-center gap-2 text-xs mb-1">
        <span className="text-[#94A3B8] w-28 truncate">{label}</span>
        <div className="flex-1 h-2 bg-[#0A0E17] rounded-full overflow-hidden">
          <div className="h-full bg-[#3B82F6]/50 rounded-full" style={{ width: `${Math.min(100, val)}%` }} />
        </div>
        <span className="text-[#F1F5F9] w-10 text-right">{fmt(val)}{s}</span>
      </div>
    );
  }

  const hv = home ?? 0;
  const av = away ?? 0;
  const max = Math.max(hv, av, 0.01);
  // 높은 쪽 하이라이트 (reverse면 낮은 쪽이 좋은 것)
  const homeBetter = reverse ? hv < av : hv > av;
  const awayBetter = reverse ? av < hv : av > hv;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-10 text-right ${homeBetter ? "text-[#3B82F6] font-semibold" : "text-[#94A3B8]"}`}>
        {fmt(home)}{s}
      </span>
      <div className="flex-1 flex gap-0.5">
        {/* 홈 바 (오른쪽 정렬) */}
        <div className="flex-1 flex justify-end">
          <div className="h-2 rounded-full" style={{
            width: `${(hv / max) * 100}%`,
            backgroundColor: homeBetter ? "#3B82F6" : "#334155",
          }} />
        </div>
        {/* 원정 바 (왼쪽 정렬) */}
        <div className="flex-1">
          <div className="h-2 rounded-full" style={{
            width: `${(av / max) * 100}%`,
            backgroundColor: awayBetter ? "#F59E0B" : "#334155",
          }} />
        </div>
      </div>
      <span className={`w-10 text-left ${awayBetter ? "text-[#F59E0B] font-semibold" : "text-[#94A3B8]"}`}>
        {fmt(away)}{s}
      </span>
      <span className="text-[#475569] w-16 text-center text-[10px]">{label}</span>
    </div>
  );
}
