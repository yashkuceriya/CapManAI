# CapMan AI Frontend - Quick Start

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API
Create `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Open in Browser
Navigate to `http://localhost:3000`

### 5. Test the App

**Default Credentials** (create your own via registration):
- Username: `testuser`
- Password: `password123`

## What You Can Do

### As a Student
- **Train**: Generate AI scenarios, respond, answer probes, handle curveballs
- **Replay**: Learn from historical market events
- **Leaderboard**: See your ranking vs other traders

### As an Educator
- All student features PLUS:
- **MTSS Dashboard**: Monitor student progress across 3 tiers
- **Alerts**: Get notified of at-risk students
- **Mastery Tracking**: See which objectives students need help with

## Page Map

| Route | Purpose | Role |
|-------|---------|------|
| `/` | Dashboard & quick stats | All users |
| `/login` | Authentication | Guests |
| `/train` | Main training module | Students |
| `/replay` | Historical event replay | Students |
| `/leaderboard` | Rankings (XP/Volume/Mastery) | All users |
| `/mtss` | Student monitoring | Educators |

## Key Features Demonstrated

✅ **Full State Management** - Training flow with 6+ states
✅ **Real-time API Integration** - All endpoints functional
✅ **Authentication** - JWT token handling
✅ **Responsive Design** - Mobile-friendly dark theme
✅ **Dark Mode** - Professional finance aesthetic
✅ **Animations** - XP gains, transitions, loaders
✅ **Educator Tools** - MTSS heatmaps, alerts, tier tracking
✅ **Gamification** - XP, levels, streaks, achievements

## Project Scripts

```bash
# Development
npm run dev          # Start dev server on port 3000

# Production
npm run build        # Build optimized bundle
npm start           # Run production server

# Quality
npm run lint        # Run ESLint
```

## Architecture Highlights

### Frontend Stack
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS + Custom CSS
- **State**: React Context for auth
- **HTTP**: Axios with interceptors
- **Icons**: Lucide-react (40+ icons)
- **Font**: Inter from next/font

### Key Files

**lib/api.ts** (100+ lines)
- Centralized Axios client
- All 20+ API endpoints
- Auth token handling
- Error interceptors

**app/train/page.tsx** (350+ lines)
- Complex state machine
- 6 distinct states
- Scenario management
- Probe conversations
- Curveball adaptation
- Grading flow

**components/** (8 components, 1000+ lines)
- Reusable UI components
- Professional styling
- Animations and interactions
- Data visualization

## Backend Requirements

The backend must provide these endpoints:

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`

### Users
- `GET /api/users/me`
- `GET /api/users/leaderboard`

### Scenarios
- `POST /api/scenarios/generate`
- `POST /api/scenarios/{sessionId}/respond`
- `POST /api/scenarios/{sessionId}/probe`
- `POST /api/scenarios/{sessionId}/grade`
- `POST /api/scenarios/{sessionId}/curveball`
- `POST /api/scenarios/{sessionId}/adapt`
- `GET /api/scenarios/replay/events`
- `POST /api/scenarios/replay`
- `GET /api/scenarios/{sessionId}/reveal`

### MTSS
- `GET /api/mtss/overview`
- `GET /api/mtss/student/{userId}`
- `GET /api/mtss/objectives`
- `GET /api/mtss/alerts`

## Customization

### Change Colors
Edit `tailwind.config.ts`:
```typescript
theme: {
  extend: {
    colors: {
      // Your custom colors here
    }
  }
}
```

### Add New Pages
1. Create `app/new-page/page.tsx`
2. Export default React component
3. Add link to Navbar if needed

### Modify API Endpoints
Edit `lib/api.ts` - add functions to respective groups (auth, users, scenarios, mtss)

## Troubleshooting

**Port 3000 in use?**
```bash
npm run dev -- -p 3001
```

**Build fails?**
```bash
rm -rf .next node_modules
npm install
npm run build
```

**Styles not loading?**
```bash
npm run dev  # Restart dev server
```

## Next Steps

1. **Run the dev server**: `npm run dev`
2. **Create an account** at `/login`
3. **Start a training session** at `/train`
4. **Check leaderboards** at `/leaderboard`
5. **Try replay mode** at `/replay` (if events exist)
6. **View MTSS** at `/mtss` (educators only)

## File Statistics

- **Total Files**: 25+
- **Lines of Code**: 2,500+
- **Components**: 8
- **Pages**: 7
- **API Endpoints**: 20+
- **Custom CSS Classes**: 15+

Enjoy the platform!
