# Soccer Brain — 프로젝트 가이드 (Claude Code 필독)

## 프로젝트 정체성
- **예정 경기의 사전 분석 정보를 가장 잘 제공하는 한국어 스포츠 플랫폼**
- AI 예측 플랫폼이 아님. "예측"이라는 단어를 UI에 절대 사용하지 않음
- LiveScore 경쟁이 아님. 경기 분석 정보 포지셔닝
- V1~V9 ML 코드는 전부 폐기됨. 참고하지 않음

## 기술 스택
- 프론트엔드: React 18 + TypeScript + Vite + Tailwind + Shadcn UI + wouter + react-query
- 백엔드: Express 5 + TypeScript + Prisma + Neon PostgreSQL
- 데이터: API-Football (Ultra plan), Puppeteer (베트맨 배당)

## 프로젝트 구조
```
client/src/
  pages/home.tsx           ← 홈 (날짜별 경기 목록)
  pages/match-detail.tsx   ← 경기 상세 (단일 스크롤)
  pages/standings.tsx      ← 순위
  pages/settings.tsx       ← 설정
  pages/admin.tsx          ← 관리자 (기존 유지)
  shared/team-names.ts     ← 팀 한글명 + 리그 정의 (중앙화)
  components/bottom-nav.tsx ← 3탭 네비

server/
  routes.ts                ← 기존 API + admin (5000줄, 건드리지 않음)
  routes-v2.ts             ← 새 프론트엔드용 API 3개
  index.ts                 ← 서버 부팅
  storage.ts               ← 데이터 저장/조회
  api-football.ts          ← API-Football 연동
  betman.ts                ← 베트맨 배당 크롤링
```

## 절대 규칙
1. **"예측" 관련 용어 UI에 사용 금지** — AI 예측/추천/EV/배당가치 등. 순수 정보 제공만
2. **팀명은 shared/team-names.ts의 getTeamName() 사용** — 각 페이지에 하드코딩 금지
3. **모든 UI는 한국어**

## 백엔드 코드 규칙
- **routes.ts + routes-v2.ts 통합 가능** — 단, admin API와 데이터 수집 API는 반드시 보존
- 통합 시 ML/예측 관련 코드(v7, v9, predictions 등)는 삭제
- 변경 후 반드시 빌드 테스트 확인
- 통합이 복잡하면 단계적으로 진행 (먼저 불필요 코드 삭제 → 이후 파일 통합)

## UI/UX 원칙
1. 경기 목록은 미니멀 (팀명 + 시간 + 리그만)
2. 경기 상세는 풍부하게 (단일 스크롤, 탭 없음)
3. 데이터 없으면 해당 섹션 숨김 (빈 공간 금지)
4. 색상: W=녹색(#22C55E), D=노란색(#F59E0B), L=빨간색(#EF4444)
5. 모바일 퍼스트 430px
6. 다크 모드 기본 (배경 #0A0E17, 카드 #111827)
7. 폰트: 기본 sans-serif, 볼드는 강조에만

## 현재 API 구조
```
새 프론트용 (routes-v2.ts):
  GET /api/v2/fixtures?date=&league=     ← 홈 경기 목록
  GET /api/v2/fixtures/:id/detail        ← 경기 상세
  GET /api/v2/highlights?date=           ← 주목할 경기

기존 유지 (routes.ts):
  GET /api/standings?leagueId=           ← 순위
  GET /api/leagues                       ← 리그 목록
  POST /api/admin/*                      ← admin 전용
```

## DB 모델 (Prisma)
주요: League, Team, Fixture, Standing, FixtureOdds, BookmakerOdds, FixtureInjury, FixtureWeather, FixtureFeatureSnapshot
- DB 정제 작업 예정 (중복 제거, 독립성 확보)
- Prisma 스키마 수정 시 반드시 확인 후 진행

## Phase 1 우선순위
1. 파일 정리 (ML 코드 폐기, 구 페이지 삭제)
2. UI 다듬기 (경기 상세 페이지 집중)
3. DB 분석 & 정제 (한 경기당 1 row)
4. API 확충
5. 배포 준비

## 삭제 완료 대상 (이 파일들은 참고하지 않음)
- pages/analysis.tsx, match-analysis.tsx, live.tsx, results.tsx, my.tsx
- pages/prediction.tsx, laboratory.tsx, match-list.tsx, schedule.tsx, history.tsx, league.tsx
- components/analysis-*, prediction-*, pick-*, match-card, odds-movement 등
- contexts/pick-context, sport-context, prediction-context
- models/ 폴더, scripts/train_*, scripts/predict_*, scripts/analyze_*
- server/v7-analysis.ts, v9-analysis.ts, training-data-manager.ts, mining-scheduler.ts
