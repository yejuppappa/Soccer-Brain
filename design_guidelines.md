# Design Guidelines: Soccer Win Rate Simulator

## Design Approach
**Reference-Based: Toss App Aesthetic**
Clean, data-driven interface inspired by Toss's minimalist financial app design. Focus on clarity, trust, and mobile-first usability while avoiding any gambling site aesthetics.

## Core Design Principles
1. **Data Transparency**: Numbers and probabilities displayed prominently with clear hierarchy
2. **Interactive Clarity**: Controls (switches) are obvious and their impact immediately visible
3. **Professional Simplicity**: Clean, focused interface that builds user trust
4. **Mobile-First**: All interactions optimized for thumb-friendly mobile use

## Color System
- **Primary Background**: Pure white (#FFFFFF)
- **Primary Text**: Bold black (#000000) 
- **Accent Color**: Toss-style blue (#0064FF) for interactive elements, charts, CTAs
- **Success/Positive**: Green (#00C73C) for high win probabilities
- **Warning/Negative**: Red (#FF3B30) for probability drops
- **Neutral Gray**: (#F8F9FA) for card backgrounds, subtle separations

## Typography
**Font Stack**: System fonts for performance
- Headings: Bold (700), large sizes (24-32px mobile, 32-48px desktop)
- Body: Medium (500), 16-18px for readability
- Data/Numbers: Bold (700), oversized for emphasis (36-64px for probabilities)
- Labels: Regular (400), 14px for secondary information

## Layout System
**Spacing Units**: Tailwind's 4, 8, 16, 24, 32 (p-4, p-8, etc.)
- Consistent 16px padding for cards
- 24-32px gaps between sections
- 8px for tight groupings (switch labels)

## Component Library

### Match List (Main Screen)
- **Card Design**: White cards with subtle shadow, 16px rounded corners
- **Layout**: Single column stack on mobile, each card shows:
  - Team names (bold, 18px)
  - Match time (gray, 14px)
  - Quick win probability indicator (blue pill badge)
  - Tap affordance (subtle chevron right)
- **Spacing**: 12px between cards
- **Touch Target**: Minimum 56px height for easy tapping

### Analysis Report (Detail Screen)
- **Header Section**:
  - Team matchup (bold, 24px)
  - Current probability (huge, 48-64px, color-coded)
  - Back button (top-left)

- **Interactive Controls Section**:
  - White card container
  - Two toggle switches, stacked vertically:
    - "원정 팀 휴식 부족" (Away Team Fatigue)
    - "핵심 선수 부상" (Key Player Injury)
  - Each switch row: Label (16px, left) + iOS-style toggle (right)
  - Impact indicator showing "-10%" or "-20%" when toggled
  - 16px vertical spacing between switches

- **Probability Chart**:
  - Large, centered visualization
  - Bar chart or radial gauge showing 0-100%
  - Animated transitions (300ms ease-out) when switches toggle
  - Color gradient: Green (80-100%) → Blue (50-79%) → Red (0-49%)

- **Analysis Breakdown**:
  - Three cards showing Core 1, 2, 3 calculations
  - Each card: Icon (left) + Label + Value (right-aligned)
  - Clear math showing how final probability is calculated

### Toggle Switches
- **Style**: iOS-style switches (not checkbox-style)
- **Size**: 51x31px touch target
- **Colors**: 
  - OFF: Gray background (#E5E5EA)
  - ON: Blue background (#0064FF)
- **Animation**: Smooth 200ms slide transition

## Interaction Patterns

### Real-Time Probability Updates
When user toggles a switch:
1. Probability number animates down (counting animation, 500ms)
2. Chart bar/gauge shrinks with smooth easing (300ms)
3. Color shifts if crossing threshold (green→blue→red)
4. Subtle haptic feedback (if mobile)

### Chart Animation
- Use Chart.js or Recharts for smooth transitions
- Animate on data change, not on scroll
- Show percentage change with small "+/-X%" indicator

## Mobile Optimization
- **Fixed Header**: Match title stays visible while scrolling
- **Thumb Zone**: All controls in bottom 2/3 of screen
- **Safe Areas**: 16px minimum margin from screen edges
- **Scrollable Content**: Analysis breakdown scrolls, controls stay accessible
- **No Horizontal Scroll**: Everything fits in viewport width

## Data Display

### Mock Data Structure
Display for 5-6 Premier League matches:
- Manchester City vs Arsenal
- Liverpool vs Chelsea  
- Manchester United vs Tottenham
- Each with realistic probability ranges (40-75%)

### Probability Display Format
- Large percentage: "67%" (bold, huge font)
- Small context: "홈팀 승리 확률" below (gray, 14px)
- Change indicator: "↓ -20%" when variables applied (red)

## Images
**No images required** - this is a data-focused utility interface. Use only:
- Team badges/logos (small, 32x32px icons)
- Chart/graph visualizations
- Icon set for Core 1/2/3 indicators (simple line icons)

## Animations
**Minimal but purposeful**:
- Probability number counting animation (Core feature)
- Chart transitions (Core feature)  
- Switch toggle animation (Standard iOS behavior)
- Card tap feedback (subtle scale 0.98)
- No decorative animations

## Accessibility
- High contrast black text on white background
- Touch targets minimum 44x44px
- Clear labels for all interactive elements
- Screen reader support for probability changes
- Visible focus states for keyboard navigation