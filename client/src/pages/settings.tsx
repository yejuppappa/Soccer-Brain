import { LEAGUES } from "@/shared/team-names";

export default function Settings() {
  return (
    <div className="max-w-lg mx-auto">
      <header className="sticky top-0 z-40 bg-[#0A0E17]/95 backdrop-blur-sm border-b border-[#1E293B]">
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold">👤 설정</h1>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* 테마 */}
        <section className="bg-[#111827] rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">테마</h3>
          <div className="flex gap-2">
            <button className="flex-1 py-2 rounded-lg bg-[#3B82F6] text-white text-xs font-medium">
              다크 모드
            </button>
            <button className="flex-1 py-2 rounded-lg bg-[#151D2B] text-[#64748B] text-xs cursor-not-allowed">
              라이트 모드 (준비중)
            </button>
          </div>
        </section>

        {/* 관심 리그 */}
        <section className="bg-[#111827] rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">관심 리그 (인기 필터)</h3>
          <p className="text-xs text-[#64748B] mb-3">홈 화면 "인기" 필터에 표시될 리그를 선택하세요</p>
          <div className="space-y-2">
            {LEAGUES.map(l => (
              <label key={l.id} className="flex items-center gap-3 py-1.5">
                <input
                  type="checkbox"
                  defaultChecked={l.isPopular}
                  className="w-4 h-4 rounded bg-[#1E293B] border-[#334155] text-[#3B82F6] focus:ring-[#3B82F6]"
                />
                <span className="text-sm text-[#F1F5F9]">{l.name}</span>
                <span className="text-xs text-[#64748B]">{l.country}</span>
              </label>
            ))}
          </div>
        </section>

        {/* 앱 정보 */}
        <section className="bg-[#111827] rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">앱 정보</h3>
          <div className="space-y-2 text-xs text-[#64748B]">
            <div className="flex justify-between">
              <span>버전</span>
              <span className="text-[#94A3B8]">2.0.0-beta</span>
            </div>
            <div className="flex justify-between">
              <span>개발자</span>
              <span className="text-[#94A3B8]">Soccer Brain</span>
            </div>
            <div className="flex justify-between">
              <span>데이터 제공</span>
              <span className="text-[#94A3B8]">API-Football</span>
            </div>
          </div>
        </section>

        {/* 피드백 */}
        <section className="bg-[#111827] rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-2">피드백</h3>
          <p className="text-xs text-[#64748B] mb-3">의견이나 버그를 알려주세요</p>
          <a
            href="mailto:feedback@soccer-brain.com"
            className="inline-block px-4 py-2 rounded-lg bg-[#151D2B] text-[#3B82F6] text-xs font-medium"
          >
            메일 보내기
          </a>
        </section>
      </main>
    </div>
  );
}
