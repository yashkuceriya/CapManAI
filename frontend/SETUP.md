# CapMan AI Frontend - Setup Guide

A gamified AI-powered options trading training platform built with Next.js 14, TypeScript, and Tailwind CSS.

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with dark theme
│   ├── page.tsx                # Dashboard/landing page
│   ├── globals.css             # Global styles and CSS utilities
│   ├── train/
│   │   └── page.tsx            # Main training flow with scenario generation
│   ├── replay/
│   │   └── page.tsx            # Historical event replay mode
│   ├── leaderboard/
│   │   └── page.tsx            # XP/volume/mastery leaderboards
│   ├── mtss/
│   │   └── page.tsx            # Educator MTSS dashboard
│   └── login/
│       └── page.tsx            # Login and registration page
├── components/
│   ├── Navbar.tsx              # Navigation bar with user info
│   ├── ScenarioCard.tsx        # Market scenario display component
│   ├── ResponseInput.tsx       # Student response textarea
│   ├── ProbeChat.tsx           # AI probe Q&A chat interface
│   ├── GradeDisplay.tsx        # Grade results and feedback
│   ├── XPAnimation.tsx         # XP earning animation
│   ├── LeaderboardTable.tsx    # Leaderboard ranking display
│   └── MTSSHeatmap.tsx         # MTSS objective mastery heatmap
├── lib/
│   ├── api.ts                  # Axios client and all API functions
│   └── auth-context.tsx        # React context for authentication
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
├── postcss.config.js
└── globals.css

```

## Installation & Setup

### Prerequisites
- Node.js 16+ installed
- npm or yarn package manager
- Backend API running at `http://localhost:8000`

### Step 1: Install Dependencies

```bash
cd /sessions/affectionate-youthful-ptolemy/mnt/Capman/frontend
npm install
```

### Step 2: Configure Environment

Create a `.env.local` file (copy from `.env.example`):

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Step 3: Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Step 4: Build for Production

```bash
npm run build
npm start
```

## Features

### Authentication
- Login and registration with JWT token management
- Automatic token refresh and logout on 401
- User session persistence in localStorage
- AuthProvider context for global user state

### Training Module (`/train`)
- **States**: Idle → Scenario Ready → Probing → Curveball (optional) → Grading → Graded
- Difficulty selection (Beginner, Intermediate, Advanced)
- Market scenario with context and real-time data
- AI probe questions for deeper learning
- Optional curveball injection for adaptation
- Detailed grading with dimension breakdown
- XP rewards with celebration animation

### Historical Replay (`/replay`)
- Browse historical market events
- Generate replay scenarios with selected difficulty
- Compare your response to actual market outcomes
- Learn from past decisions

### Leaderboards (`/leaderboard`)
- Three ranking modes: XP, Volume, Mastery
- Real-time rank tracking
- User profiling and tier information
- Competitive gamification

### MTSS Dashboard (`/mtss`)
- Educator-only dashboard for student monitoring
- Tier-based student organization (Tier 1-3)
- Objective proficiency heatmap
- Alert system for at-risk students
- Individual student progress tracking

### Dashboard (`/`)
- User profile card with XP, Level, Streak, Tier
- Quick action buttons to training modules
- Recent performance statistics
- Daily tips and recommendations

## API Integration

### API Client (`lib/api.ts`)

All API calls go through a centralized Axios client with:
- Automatic JWT token injection in Authorization header
- Request/response interceptors
- Error handling with automatic logout on 401
- Form data support for authentication endpoints

### API Functions

**Authentication**
- `auth.login(username, password)` - POST /api/auth/login
- `auth.register(username, email, password)` - POST /api/auth/register
- `auth.logout()` - Clear local storage

**Users**
- `users.getProfile()` - GET /api/users/me
- `users.getLeaderboard(mode)` - GET /api/users/leaderboard

**Scenarios**
- `scenarios.generateScenario(difficulty, marketRegime, objectives)` - POST /api/scenarios/generate
- `scenarios.submitResponse(sessionId, responseText)` - POST /api/scenarios/{sessionId}/respond
- `scenarios.answerProbe(sessionId, answerText)` - POST /api/scenarios/{sessionId}/probe
- `scenarios.gradeSession(sessionId)` - POST /api/scenarios/{sessionId}/grade
- `scenarios.injectCurveball(sessionId)` - POST /api/scenarios/{sessionId}/curveball
- `scenarios.submitAdaptation(sessionId, adaptationText)` - POST /api/scenarios/{sessionId}/adapt
- `scenarios.listReplayEvents()` - GET /api/scenarios/replay/events
- `scenarios.generateReplay(difficulty, eventId)` - POST /api/scenarios/replay
- `scenarios.getReveal(sessionId)` - GET /api/scenarios/{sessionId}/reveal

**MTSS**
- `mtss.getOverview()` - GET /api/mtss/overview
- `mtss.getStudent(userId)` - GET /api/mtss/student/{userId}
- `mtss.getObjectives()` - GET /api/mtss/objectives
- `mtss.getAlerts()` - GET /api/mtss/alerts

## Styling

### Design System

**Colors**
- Primary: Emerald-500 (#10B981)
- Warning: Amber-500 (#F59E0B)
- Danger: Red-500 (#EF4444)
- Background: Gray-950 (#030712)
- Card: Gray-900 (#0F172A)
- Border: Gray-800 (#1E293B)

### Custom CSS Classes

Available utility classes in `globals.css`:

- `.btn-primary` - Green primary button
- `.btn-secondary` - Gray secondary button
- `.btn-danger` - Red danger button
- `.btn-warning` - Amber warning button
- `.card` - Card container with hover effect
- `.card-compact` - Smaller card variant
- `.input-field` - Styled input with focus ring
- `.textarea-field` - Styled textarea
- `.badge` - Badge component with variants
- `.loader` - Spinning loader animation

### Animations

Built-in animations:
- `animate-fade-in` - Fade in effect
- `animate-slide-in` - Slide in from left
- `animate-float-up` - Float upward animation
- `animate-spin` - Rotation animation (Tailwind default)

## Icons

Using `lucide-react` icon library. Common icons:

- `Zap` - Lightning bolt (XP, energy)
- `TrendingUp` - Upward trend
- `Trophy` - Achievement/leaderboard
- `BookOpen` - Training/learning
- `BarChart3` - Analytics/replay
- `Users` - Team/educator
- `AlertCircle` - Alert/warning
- `Loader` - Loading spinner

## Key Components Deep Dive

### ScenarioCard
Displays market context with:
- Difficulty badge
- Scenario context prompt
- Market data grid (price, change, volume, IV)
- Learning objectives list

### ResponseInput
Student response input with:
- Textarea field with character count
- Submit and clear buttons
- Loading state
- Validation

### ProbeChat
Interactive Q&A interface with:
- Message history display
- Current question highlight
- Answer input
- Optional curveball button

### GradeDisplay
Comprehensive results display:
- Overall score with progress bar
- XP earned animation
- Level up indicator
- Achievement unlocked badge
- Dimension breakdown with scores
- Strengths and improvements lists

### LeaderboardTable
Ranked player display with:
- Rank badge (medals for top 3)
- Player info and avatar
- Sortable columns
- Current user highlight
- Mode-specific data (XP, Volume, Mastery)

### MTSSHeatmap
Student mastery visualization:
- Objective proficiency bars
- Alert status indicators
- Tier distribution cards
- Color-coded severity

## Development Tips

### Adding New API Endpoints

1. Add function to appropriate group in `lib/api.ts`
2. Use the `apiClient` instance with interceptors
3. Handle errors with try-catch in components

### Creating New Pages

1. Create directory in `app/`
2. Add `page.tsx` with 'use client' directive
3. Import components and use API functions
4. Add navigation link in Navbar if needed

### Styling New Components

- Use Tailwind utility classes
- Reference custom classes in `globals.css`
- Follow color scheme and spacing guidelines
- Ensure dark theme consistency

### Testing API Integration

Use browser DevTools Network tab to inspect:
- Request/response payloads
- Authorization headers
- Status codes
- Timing

## Environment Variables

`NEXT_PUBLIC_API_URL` - Backend API base URL (default: http://localhost:8000)

All environment variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

## Performance Optimization

- Next.js 14 App Router with automatic code splitting
- Image optimization (built-in)
- Font optimization (Inter via next/font)
- CSS-in-JS with Tailwind for minimal bundle
- Component-level code splitting
- Lazy loading for heavy components

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### "Cannot connect to API"
- Verify backend is running at configured URL
- Check NEXT_PUBLIC_API_URL in .env.local
- Check browser console for CORS errors

### "401 Unauthorized"
- Clear localStorage and login again
- Verify JWT token format
- Check token expiration

### Styles not applying
- Restart dev server (PostCSS rebuild)
- Clear .next directory
- Verify tailwind.config.ts paths

### Build errors
- Delete node_modules and reinstall
- Clear .next directory
- Check TypeScript errors with `npm run build`

## Contributing

Follow these guidelines:
1. Use TypeScript for type safety
2. Create components in `components/` directory
3. Keep pages minimal, logic in components
4. Use custom CSS classes for consistency
5. Test all API integrations

## License

Proprietary - CapMan AI
