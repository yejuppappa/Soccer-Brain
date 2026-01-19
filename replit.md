# Soccer Win Rate Simulator (축구 승률 분석 시뮬레이터)

## Overview

A mobile-first web application that analyzes soccer match win probabilities using the Triple Core analysis system. Users can view upcoming Premier League matches and explore detailed analysis reports with interactive probability adjustments. The design follows a clean, Toss app-inspired aesthetic with data transparency and professional simplicity.

### Triple Core Analysis System
- **Core 1 (기초 체력)**: Base win rate calculated from team's league ranking and recent 5-game performance
- **Core 2 (피로도 변수)**: If rest days < 3, subtract 10-15% from base probability
- **Core 3 (핵심 선수 변수)**: If top scorer is injured, subtract 20% from probability

### Interactive Features
- Win/Draw/Loss horizontal gauge bar showing all three probabilities (always sums to 100%)
- AI auto-detects factors (fatigue, form, weather, streaks) and displays as insight badges
- No manual toggle switches - all factors are analyzed automatically
- Real-time animated probability chart
- Responsive desktop layout
- Weather information displayed on match cards (icon + temperature)
- Dark mode support
- Team power comparison radar chart (5 stats: ATT, DEF, ORG, FORM, GOAL)
- AI predicted score badge with seeded randomization based on match data
- Dynamic lineup status display ("예상 라인업" vs "확정 라인업") with confirmation animation
- User voting system for match predictions (승/무/패) stored via API
- History page with daily accuracy line chart (Recharts) and prediction records
- My page with user vs AI accuracy comparison bar chart

### Pick Selection & AI Combination Analyzer
- **Global Pick State (PickContext)**: Shopping cart pattern for selecting match predictions
- **Odds-Centric Schedule Cards**: 홈승/무승부/원정승 buttons with trend indicators (HOT badge on falling odds)
- **Floating FAB Button**: Shows "분석함" with selected picks count at bottom right
- **AI Analysis Drawer**: Slide-up panel showing picked matches with total odds and AI combination analysis
- **Analysis Logic**: Provides success/warning messages based on pick combination (high odds warning, draw count, etc.)

### 광장 (Live) Community Tab
- **Live Scoreboard**: Real-time match scores with status indicators (전반/하프타임/후반)
- **Real-time Chat**: Mock chat messages with auto-population, user can send messages
- **Match Selection**: Click scoreboards to switch chat rooms between matches

### Odds Movement Visualization
- Displays domestic and overseas betting odds with trend arrows (up/down/stable)
- HOT tags appear on falling odds indicating "money flowing" (배당 하락 = 돈이 몰림)
- Legend explaining trend meanings: up = decreasing popularity, down = increasing popularity
- Three columns for home win, draw, and away win odds

### AI Comprehensive Analysis Report (AI 종합 분석 리포트)
- Rule-based text generation providing narrative analysis at bottom of match detail page
- Dark card UI with "expert memo/briefing" style for professional appearance
- Sections: Home team analysis, Away team analysis, Weather impact (if applicable), Conclusion
- Text generation based on detected factors: fatigue, form, streaks, league ranking, probability differences
- Formal Korean tone (입니다/예상됩니다 style) for authoritative voice
- Conclusion logic: 20%+ probability gap = decisive winner, close match = draw prediction

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state caching and synchronization
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Animations**: Framer Motion for probability chart animations
- **Build Tool**: Vite with hot module replacement

The frontend follows a page-based structure with reusable components:
- `/` - Home dashboard with AI Top Picks and Dropping Odds
- `/schedule` - Match schedule with odds-centric cards (홈승/무승부/원정승 buttons) and pick selection
- `/match/:id` - Detailed match analysis with lineup badge, voting, and probability controls
- `/live` - 광장 (Live) page with live scoreboards and real-time chat
- `/history` - AI prediction accuracy tracking with line chart and prediction records
- `/my` - User profile with accuracy comparison chart and settings
- `/admin` - Hidden admin page (URL-only access) for data collection and AI training

### Bottom Tab Navigation
Five main tabs at bottom of screen:
- **홈 (Home)**: Main dashboard with Soccer Brain header, ticker banner, AI Top Picks, Dropping Odds
- **일정 (Schedule)**: Full match schedule list with odds-centric buttons and pick selection
- **리그 (League)**: League data center with standings table and top scorers
- **적중내역 (History)**: AI prediction accuracy line chart and prediction records list
- **마이 (My)**: User vs AI accuracy comparison bar chart and settings

### 리그 (League) Data Center
- **순위표 (Table)**: Full 20-team standings with rank, logo, team name, matches played, points, goal difference, and recent 5-game form icons
- **선수 순위 (Top Players)**: Top 5 scorers with player photos, team logos, goals and assists
- **Form Icons**: Color-coded circles (green=W, gray=D, red=L) for visual form display
- **Zone Indicators**: Green left border for UCL spots, red for relegation zone

### Match Detail H2H Section
- **양 팀 맞대결 (H2H)**: Head-to-head statistics between teams
- **Horizontal Bar Chart**: Stacked bar showing home wins (green), draws (gray), away wins (red) with percentages
- **H2H Timeline**: Vertical timeline with colored result dots (H/D/A) and match details
- **Recent 5 Games Section**: Two-column layout with timeline UI for each team's recent form
- **Timeline Features**: Vertical line connector, colored dots (W=green, D=gray, L=red), date, opponent, score, result

### Admin Page (/admin - Hidden)
Admin functionality is separated and accessible only via direct URL:
- Data collection from API-Football (2023-24 Premier League season)
- Batch data enrichment for training set quality improvement
- AI training mode with weight adjustments and insights
- Backup download for training_set.json

### Backend Architecture
- **Framework**: Express.js 5 on Node.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful JSON endpoints under `/api/` prefix
- **Development**: Vite middleware for HMR, production serves static build

API Endpoints:
- `GET /api/matches` - Returns list of matches with date info
- `GET /api/matches/:id/analysis` - Returns detailed match analysis data with lineup status
- `GET /api/historical-matches` - Returns 20 historical matches for backtesting
- `POST /api/backtest` - Runs backtest simulation with auto-tuning logic
- `POST /api/votes` - Submit user vote (matchId, choice: home/draw/away)
- `GET /api/votes/:matchId` - Get user vote for specific match
- `GET /api/votes` - Get all user votes
- `GET /api/prediction-records` - Returns AI prediction records with actual results
- `GET /api/daily-accuracy` - Returns daily accuracy data for line chart
- `GET /api/user-stats` - Returns user vs AI accuracy comparison stats

### Backtesting & Auto-Tuning System
The Laboratory feature analyzes past match predictions to improve AI accuracy:
- **Real Data Training**: Uses actual API-Football historical matches for AI training
- **Auto-Tuning Logic**: If prediction differs from actual result by 30%+, the system identifies the primary cause variable (fatigue/injury/weather/form/home_advantage)
- **Weight Adjustment**: Variables with 2+ significant errors get a 1.2x weight multiplier
- **Insights**: System generates human-readable insights about weight adjustments

### Smart Data Collection System
The admin page (/admin) includes a data collection feature for building training datasets:
- **Fixture ID Deduplication**: Checks `training_set.json` for existing fixture IDs before saving
- **Daily Quota**: Limits to 80 new matches per collection run to preserve API quota (100/day free limit)
- **Append-Only Storage**: New data is appended to existing `training_set.json`, never overwrites
- **Progress Logs**: Real-time logs showing collection status, duplicates skipped, and matches saved
- **Date Range Batching**: Fetches 2023-24 season fixtures in monthly batches for efficiency

### Auto-Mining Scheduler (Smart Cron)
Automated data collection runs via node-cron scheduler:
- **Cron Schedule**: Daily at 00:00 UTC for consistent data collection
- **Server Startup**: Initial mining check runs 5 seconds after server start
- **Rate Limit Safety**: Queries API `/status` endpoint before collection, stops if remaining < 5 calls
- **Daily Limit Enforcement**: Maximum 80 matches per day, counter resets at midnight
- **State Persistence**: Mining state saved to `mining_state.json` with run history
- **Log History**: Stores last 50 log entries with timestamp, status, and message
- **Statuses**: success (completed), stopped (quota limit), error (API failure), safe_mode (rate limit low)

API Endpoints for Data Collection:
- `GET /api/training-set/stats` - Returns { totalMatches, lastUpdated, uniqueTeams }
- `GET /api/training-set` - Returns full training dataset
- `POST /api/collect-data` - Runs smart collection with deduplication
- `GET /api/mining-state` - Returns current mining scheduler state
- `POST /api/trigger-mining` - Manually trigger mining task (admin only)

### API-Football Integration
The app integrates with API-Football (https://www.api-football.com/) for real Premier League data:
- **Client**: `server/api-football.ts` using axios with x-apisports-key header
- **API Key**: Stored in `API_SPORTS_KEY` secret (server-side only)
- **Endpoints Used**: `/fixtures` for upcoming matches, `/standings` for league rankings
- **Cache TTL**: 5-minute cache to prevent excessive API calls
- **Fallback**: Uses mock data if API is not configured or fails
- **Data Mapping**: API responses mapped to Match/Team schema with logos, standings, and form data

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` for shared types between client and server
- **Current State**: In-memory storage with API-Football integration and mock data fallback
- **Migration Tool**: Drizzle Kit (`db:push` script for schema sync)

### Design System
The application implements a Toss app-inspired design:
- Primary accent: Blue (#0064FF / HSL 217 100% 50%)
- Success states: Green for high probabilities
- Destructive states: Red for negative impacts
- Light/dark mode support via CSS variables
- Mobile-first responsive layout (max-width: lg for content)

### Build Pipeline
- **Client Build**: Vite outputs to `dist/public`
- **Server Build**: esbuild bundles server code to `dist/index.cjs`
- **Optimization**: Selective dependency bundling for faster cold starts

## External Dependencies

### Core Dependencies
- **PostgreSQL**: Database (requires `DATABASE_URL` environment variable)
- **Drizzle ORM**: Database interactions and type-safe queries

### UI Component Libraries
- **Radix UI**: Headless accessible primitives (dialog, switch, tooltip, etc.)
- **shadcn/ui**: Pre-styled components built on Radix
- **Lucide React**: Icon library
- **Framer Motion**: Animation library

### Development Tools
- **Vite**: Development server and build tool
- **TypeScript**: Type checking across client, server, and shared code
- **Drizzle Kit**: Database migration management

### Path Aliases
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`