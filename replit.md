# Soccer Win Rate Simulator (축구 승률 분석 시뮬레이터)

## Overview

A mobile-first web application that analyzes soccer match win probabilities using the Triple Core analysis system. Users can view upcoming Premier League matches and explore detailed analysis reports with interactive probability adjustments. The design follows a clean, Toss app-inspired aesthetic with data transparency and professional simplicity.

### Triple Core Analysis System
- **Core 1 (기초 체력)**: Base win rate calculated from team's league ranking and recent 5-game performance
- **Core 2 (피로도 변수)**: If rest days < 3, subtract 10-15% from base probability
- **Core 3 (핵심 선수 변수)**: If top scorer is injured, subtract 20% from probability

### Interactive Features
- Win/Draw/Loss horizontal gauge bar showing all three probabilities (always sums to 100%)
- 3-section control panels: Environment (weather), Home Team, Away Team
- Toggle switches to simulate weather, fatigue, and injury scenarios
- Weather toggle: Rain adds +8% to draw probability
- Fatigue toggle: -10% to affected team's win probability
- Injury toggle: -15% to affected team's win probability
- Real-time animated probability chart that updates when switches are toggled
- Responsive desktop layout: 3-column grid (Home panel | Gauge | Away panel)
- Weather information displayed on match cards (icon + temperature)
- Dark mode support

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
- `/` - Match list showing today's games
- `/match/:id` - Detailed match analysis with interactive probability controls

### Backend Architecture
- **Framework**: Express.js 5 on Node.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful JSON endpoints under `/api/` prefix
- **Development**: Vite middleware for HMR, production serves static build

API Endpoints:
- `GET /api/matches` - Returns list of matches with date info
- `GET /api/matches/:id/analysis` - Returns detailed match analysis data

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` for shared types between client and server
- **Current State**: Mock data implementation in `server/storage.ts` with interface ready for database integration
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