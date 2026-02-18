# Soccer Brain — 프로젝트 가이드 (Claude Code 필독)

## 프로젝트 정체성
- **예정 경기의 사전 분석 정보를 가장 잘 제공하는 한국어 스포츠 플랫폼**
- LiveScore 경쟁이 아님. 경기 분석 정보 포지셔닝
- 핵심 질문: "이 경기에서 뭘 봐야 하지?" → 폼, 부상, H2H, 배당, 순위 등 사전 분석 정보 제공

### 콘텐츠 분리 원칙 (★ 중요)
경기 상세 페이지는 **순수 정보**와 **가공 분석**을 명확히 분리한다:
- **상세정보 탭**: 객관적 데이터만. 최근 폼, 시즌 스탯(xG/xGA/점유율 등), H2H, 부상자, 배당, 순위. 가공 지표 혼합 금지.
- **AI 분석 탭** (개발 예정): 가공 데이터만. 5축 레이더 차트, 피로도 보정, AI 텍스트 해설 등. SofaScore "AI 인사이트"와 유사한 포지션.
- "예측"이라는 단어는 사용하지 않음. "AI 분석" 또는 "AI 요약"으로 표현.

## 기술 스택
- 프론트엔드: React 18 + TypeScript + Vite + Tailwind + Shadcn UI + wouter + react-query
- 백엔드: Express 5 + TypeScript + Prisma + Neon PostgreSQL
- 데이터: API-Football (Ultra plan, 일일 70,000건)
- 자동화: GitHub Actions (수집 워크플로우 3개: daily, hourly, odds) — ⚠️ 점검 필요

### 폐기된 기술 (제거 완료)
- ❌ Puppeteer (베트맨 배당 크롤링) — 코드 완전 제거됨, puppeteer 의존성 삭제
- ❌ FeatureSnapshot (사전 계산 캐싱) — Prisma 모델 + 모든 API/스케줄러 코드 제거됨
- ❌ Prediction 모델 — Prisma 스키마에서 제거됨

## 데이터 흐름 (전체 아키텍처)
```
[API-Football] → [GitHub Actions / unified-scheduler] → [Neon PostgreSQL]
                                                              ↓
[사용자 브라우저] ← [React 프론트] ← [Express API (routes-v2)] ← [radarEngine + raw 쿼리]
```
- 수집: API-Football → 정규화(normalizeTeamStats.ts) → DB 저장
- 서빙: DB raw 데이터 → radarEngine 실시간 계산 → API 응답 → React 렌더링
- 자동화: GitHub Actions이 cron으로 collect.ts 실행 → 서버 없이 독립 수집

---

## 아키텍처 원칙 (★ 최우선)

### DB 저장 규칙: raw만 저장, 집계는 실시간 계산
- DB에 저장하는 것: **경기별 원시 데이터** (FixtureTeamStatSnapshot 등)
- DB에 저장하지 않는 것: 평균값, 누적값, 사전 계산된 집계
- 평균/누적이 필요하면: API 호출 시점에 raw 데이터에서 직접 계산
- 윈도우(최근 5경기/시즌 전체)는 kickoffAt 기준 정렬 후 선택
- 홈/원정 필터는 윈도우 안에서만 적용
- **시즌 스탯 쿼리에는 반드시 leagueId 필터 포함** (컵대회 혼입 방지)

### 성능 최적화 방침
- 현재 detail API는 Phase1(1쿼리) + Phase2(10개 병렬) 구조. Neon 지연 감안 200-500ms 수준.
- **출시 전에는 성능 최적화 하지 않는다.** 실제 트래픽 측정 후 대응.
- 나중에 필요하면: Express 미들웨어 레벨 in-memory 캐시 (5분 TTL). DB 구조 변경 없이 가능.
- ❌ "성능" 명목으로 DB에 집계 테이블 만드는 건 금지.

### CALENDAR_YEAR_LEAGUES 규칙
- 달력 시즌(1월~12월) 리그: **K리그1(292), K리그2(293), J1리그(98), J2리그(99)** — 이 4개만 해당
- 나머지 모든 리그(유럽 5대리그, 컵대회, ACL, 한국FA컵 등)는 가을~봄 크로스시즌
- 이 목록은 아래 4곳에서 **동일하게** 유지:
  - `server/unified-scheduler.ts` (`CALENDAR_YEAR_LEAGUES`)
  - `server/routes/_helpers.ts` (`CALENDAR_YEAR_LEAGUES`)
  - `server/routes/admin/sync.ts` (`CALENDAR_YEAR_LEAGUE_IDS`)
  - `server/routes-v2.ts` (`springStartLeagues`)

### 금지 패턴
- ❌ FeatureSnapshot 사용/참조/재생성 — 완전 제거됨
- ❌ 사전 계산 캐싱 테이블 신규 생성
- ❌ 평균/누적값을 DB에 저장하는 새 컬럼/테이블 추가
- ❌ betman.ts / Puppeteer 관련 코드 — 완전 제거됨

---

## 디자인 시스템 (P5 구축 완료)

### 폰트
- Pretendard + Noto Sans KR (CDN)

### 색상 체계 — FotMob 실측 토큰 기반
**다크 모드:**
- 배경: #000000 / 카드: #1D1D1D / 리그 헤더: #262626
- 텍스트: #FFFFFF / 보조: #9F9F9F / 비활성: #717171
- 테마: #61DF6E / divider: #333333

**라이트 모드:**
- 배경: #FAFAFA / 카드: #FFFFFF / 리그 헤더: #F5F5F5
- 텍스트: #222222 / 보조: #9F9F9F / 비활성: #717171
- 테마: #00985F / divider: #F5F5F5

### CSS 변수
17개 `--sb-*` 토큰이 index.css에 정의됨. 다크/라이트 모드 모두 대응.
Tailwind config에 `sb` 색상 팔레트 등록. 컴포넌트에서 `bg-sb-card`, `text-sb-secondary` 등으로 사용.

### 테마
use-theme.ts 훅: dark/light/system 3모드. localStorage 저장. settings.tsx에서 전환 가능.

---

## 프로젝트 구조
```
client/src/
  pages/
    home.tsx              ← 홈 (FotMob 클론 스타일, 리그별 경기 목록) → GET /api/v2/fixtures
    match-detail.tsx      ← 경기 상세 → GET /api/v2/fixtures/:id/detail + /h2h
    standings.tsx         ← 순위 → GET /api/standings
    settings.tsx          ← 설정 (테마 3단 토글 포함)
    admin.tsx             ← 관리자
  components/
    bottom-nav.tsx        ← 3탭 하단 네비게이션
    calendar-modal.tsx    ← 날짜 선택 모달
    favorites-sheet.tsx   ← 즐겨찾기 바텀시트
    ui/                   ← Shadcn UI 컴포넌트
  hooks/
    use-mobile.tsx, use-theme.ts, use-favorites.ts, use-swipe.ts
  shared/
    team-names.ts         ← 팀 한글명 499개 + 리그 27개 정의 (중앙화 — 하드코딩 금지)

server/
  index.ts                ← 서버 부팅 + 스케줄러 초기화
  routes/
    index.ts              ← 라우터 등록 허브 (36줄)
    _helpers.ts           ← 공유 헬퍼 (getCurrentSeason 등)
    public.ts             ← Public API: matches, leagues, standings, votes (164줄)
    admin/
      sync.ts             ← 데이터 수집 API: fixtures, standings, team-stats, weather, venue-geo, teams (991줄)
      leagues.ts          ← 리그 관리 API: init, toggle, disable-all, sync-leagues (193줄)
      injuries.ts         ← 부상자 수집 API: sync-injuries, sync-injuries-bulk (316줄)
      odds.ts             ← 배당 수집 API: sync-odds, sync-upcoming-odds (174줄)
      debug.ts            ← 디버그/진단 API: fixtures-range, stats-coverage, data-coverage, data-counts (245줄)
  routes-v2.ts            ← 프론트엔드용 API (fixtures, detail, h2h, highlights)
  engines/
    radarEngine.ts        ← ★ 5축 레이더 차트 계산 (raw 기반 실시간, ~700줄)
  api-football.ts         ← API-Football HTTP 클라이언트
  storage.ts              ← DB CRUD 헬퍼
  unified-scheduler.ts    ← 자동 수집 스케줄러 (DISABLE_SCHEDULER=true로 끔)
  utils/
    normalizeTeamStats.ts ← API 응답 → DB 컬럼 매핑

scripts/
  collect.ts              ← ★ GitHub Actions 진입점 (서버 없이 독립 수집)
  backfill-stats.ts       ← 통계 백필
  overnight-backfill.ts   ← 야간 대량 백필
  add-leagues.ts          ← 리그 추가
  set-exposed-leagues.ts  ← 리그 노출 설정
  list-enabled-leagues.ts ← 리그 목록 확인
  db-status.ts            ← DB 상태 리포트
  data-integrity-check.ts ← 데이터 무결성 체크
  comprehensive-data-audit.ts ← 종합 감사
  extract-new-stats-from-raw.ts ← raw → 신규 필드 추출
  backfill-league-logos.ts ← 리그 로고 동기화
  backfill-team-logos.ts  ← 팀 로고 백필

shared/
  schema.ts               ← 프론트-백 공유 타입 (RadarOutput 등)

prisma/
  schema.prisma           ← DB 스키마

.github/workflows/
  collect-daily.yml       ← 일별 수집 — ⚠️ concurrency 미설정, cancelled 빈발
  collect-hourly.yml      ← 매시간 수집 (순위/결과/라인업)
  collect-odds.yml        ← 20분 간격 배당 수집
```

### 폐기 대상 파일 (제거 완료)
- ~~`server/betman.ts`~~ — ✅ 삭제 완료 (Puppeteer + 국내배당 코드 전량 제거)
- ~~`scripts/` 내 일회성 스크립트 다수~~ — ✅ 정리 완료 (31개 삭제, 12개 유지)
- ~~`FixtureFeatureSnapshot` 관련 모든 코드~~ — ✅ 제거 완료 (Prisma 모델 + 모든 API/스케줄러 참조)
- ~~`Prediction` 모델~~ — ✅ Prisma 스키마에서 제거 완료

## API 엔드포인트

### V2 API (프론트엔드 사용)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v2/fixtures?date=&sort=` | 날짜별 경기 목록 (exposed+enabled 리그, sort: time/league) |
| GET | `/api/v2/fixtures/:id/detail` | 경기 상세 (전체 분석 데이터) |
| GET | `/api/v2/fixtures/:id/h2h?count=&comp=&venue=` | H2H 상대전적 (필터 가능) |
| GET | `/api/v2/highlights?date=` | ⚠️ 주석 처리됨 (빈 배열 반환) |

### V2 fixtures 응답 포함 필드
league.logoUrl, league.priority, league.country, team.logoUrl 등. sort=league 시 leagueGroups 응답 추가.

### Admin API (데이터 수집용, server/routes/admin/)
sync-fixtures, sync-standings, sync-team-stats, sync-injuries, sync-odds, sync-weather 등.
상세 목록은 server/routes/admin/ 내 파일 직접 참조.

---

## 레이더 차트 (radarEngine.ts) — AI 분석 탭 핵심

### 5축 가중치
| 축 | 하위 지표 |
|----|----------|
| 공격력 | A1 찬스생산 40% / A2 위협슈팅 20% / A3 결정력 20% / A4 공격침투 20% |
| 수비력 | D1 찬스억제 60% / D2 실점억제효율 40% |
| 주도권 | C1 점유율 50% / C2 코너 20% / C3 슈팅압박 30% |
| 홈 어드벤티지 | V1 장소PPG 50% / V2 장소xG차 50% |
| 강팀 대응력 | S1 강팀상대xG차 50% / S2 강팀상대PPG 50% |

### 특수 처리
- **xG 미제공 리그**: xG→유효슈팅, xGA→상대유효슈팅, 득점÷xG→득점÷유효슈팅, xG차→득실차. hasXgData 플래그 포함
- **시즌 초반**: 0경기=미표시, 1~4경기=raw+배지, 5경기+=정상 10분위 점수화
- **컵대회**: 소속 리그 기반 + 티어 보정(T1=×1.0, T1.5=×0.9, T2=×0.8, T3=×0.7)

---

## 리그 구조

### 2단계 구조
- **서비스 리그** (27개, `exposed=true`): 사용자에게 노출
- **지원 리그** (N개, `exposed=false`): 데이터만 수집

### League.priority 설정 완료
K리그1=1, EPL=2, La Liga=3, ... 슈퍼컵=50, 나머지=99

---

## DB 모델 요약

### 핵심 (4개)
League (logoUrl, exposed, priority 포함), Team (logoUrl 포함), Fixture, Standing

### 경기 부속 데이터
FixtureTeamStatSnapshot (★핵심), TeamMatchStat, BookmakerOdds+Snapshot, FixtureOdds/OddsHistory, FixtureWeather, FixtureInjury, FixtureLineup/Player

### 폐기 완료
~~FixtureFeatureSnapshot, Prediction~~ — Prisma 스키마 + DB 테이블 모두 제거 완료

---

## 절대 규칙
1. **상세정보 탭에 가공 지표 혼합 금지** — 순수 데이터와 AI 분석은 반드시 분리
2. **팀명은 shared/team-names.ts의 getTeamName() 사용** — 하드코딩 금지 (499개 매핑)
3. **모든 UI는 한국어**
4. **DB에 집계/평균 저장 금지** — raw만 저장, 실시간 계산
5. **FeatureSnapshot 사용 금지**
6. **CSS는 sb-* 토큰 사용** — 하드코딩 색상값 금지, 디자인 시스템 토큰 활용

## UI/UX 원칙
1. 모바일 퍼스트 (430px 기준)
2. FotMob 클론 디자인 방향 (P6 확정)
3. 다크/라이트 모드 — FotMob 실측 토큰 기반
4. 데이터 없으면 해당 섹션 숨김
5. 홈: 항상 리그별 표시. 필터 시스템(popular/all/favorites) 완전 제거됨. exposed+enabled 리그만 표시.
6. 경기 상세는 풍부하게 (단일 스크롤)
7. 리그 헤더: chevron 아이콘만 접힘/열림 토글. long-press/drag-to-reorder 제거됨.
8. 페이지 상태 유지: 하위 페이지에서 돌아올 때 이전 상태(날짜, 스크롤 위치, 필터 등) 완전 유지. 바텀 네비게이션 탭 전환 시에도 동일. App.tsx의 keep-alive TabPane 패턴으로 구현.

## 코드 규칙
- 변경 후 `npx tsc --noEmit` 에러 0개 확인
- Prisma 스키마 변경은 항상 `npx prisma db push` 사용 — ❌ `prisma migrate dev` 사용 금지 (drift 발생 시 데이터 전체 삭제됨). ❌ `prisma migrate reset` 절대 금지.
- tsconfig.json: `"target": "ES2020"` (변경 금지)
- server/routes/ 수정 시 기존 admin API 보존

## 작업 완료 규칙
모든 작업 완료 후 반드시 보고:
1. 변경/생성/삭제된 파일 목록
2. CLAUDE.md 업데이트 필요 여부
3. 다음 단계 제안

## 코드 위생 규칙
- scripts/ 일회성 스크립트 방치 금지
- 죽은 코드 발견 시 제거 보고
- "나중에 쓸 수도" 금지 — git에 있음

---

## ⚠️ 알려진 이슈

### GitHub Actions 수집
- collect-daily.yml concurrency 설정 완료
- ~~collect.ts의 domestic 태스크가 폐기된 betman.ts 의존~~ — ✅ domestic/betman 코드 완전 제거됨

### match-detail.tsx 디자인 미동기화
- home.tsx는 FotMob 스타일로 전환 완료
- match-detail.tsx는 이전 디자인. 홈 확정 후 동일 토큰 적용 예정
- **홈 디자인 확정 전까지 match-detail.tsx 건드리지 않기**

---

## 현재 Phase 1 로드맵 (출시 전)
1. ~~경기 상세 페이지~~ ✅
2. ~~레이더 차트 엔진~~ ✅
3. ~~H2H 상대전적~~ ✅
4. ~~홈 화면 P1~P5 (DB, 한글명, API, 프론트, 디자인시스템)~~ ✅
5. ~~홈 화면 P6 FotMob 클론 1차~~ ✅
6. 홈 화면 P6-fix (피드백 반영) ← **진행중** — 리그 fullName 표시, chevron-only 접힘, drag/longpress 삭제, 필터 시스템 제거 완료
7. ~~프로젝트 정비 (폐기 코드 제거, scripts 정리, routes.ts 분리)~~ ✅ — GitHub Actions 수복만 남음
8. match-detail.tsx 디자인 동기화
9. standings/settings UI 통일
10. 모바일 실기기 테스트

## Phase 2 (출시 후)
- AI 분석 탭 (레이더 차트 + AI 해설을 별도 탭 분리)
- 피로도 보정계수 학습
- 부상자 한글화, 배당 흐름, routes.ts 분리

## 이 문서의 관리
- CLAUDE.md는 프로젝트 상태에 따라 계속 업데이트된다
- 큰 작업 완료 후 Claude Code가 업데이트 필요 여부 보고
- 구조 변경, 새 규칙, 폐기 대상 변경 시 반드시 갱신
