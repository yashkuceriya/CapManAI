# CapMan AI — Production Readiness Checklist

> Use this to plan remaining work before deploying to **Railway (backend) + Vercel (frontend)**.
> Items marked ✅ are done. Items marked ❌ need work. Items marked ⚠️ are recommended but not blocking.

---

## 🔴 CRITICAL (Must fix before deploy)

### 1. Secrets Exposure in `.env`
- ❌ **`.env` file contains real API keys and is tracked in git**
- Keys exposed: `ANTHROPIC_API_KEY`, `FMP_API_KEY`, `OPENROUTER_API_KEY`, `LANGCHAIN_API_KEY`
- **TODO:**
  - [ ] Rotate ALL exposed API keys immediately (Anthropic console, FMP, OpenRouter, LangSmith)
  - [ ] Remove `.env` from git tracking: `git rm --cached backend/.env`
  - [ ] Scrub from git history: `git filter-repo --path backend/.env --invert-paths` (or BFG)
  - [ ] Verify `.gitignore` already has `.env` (it does — just needs the file untracked)
  - [ ] Use Railway/Vercel environment variables instead

### 2. Alembic Hardcoded SQLite URL
- ❌ **`alembic.ini` line 5 has `sqlalchemy.url = sqlite+aiosqlite:///./capman.db`**
- On Railway with PostgreSQL, `alembic upgrade head` will try to migrate SQLite instead of Postgres
- **TODO:**
  - [ ] Update `alembic/env.py` to read `DATABASE_URL` from environment:
    ```python
    import os
    url = os.getenv("DATABASE_URL", config.get_main_option("sqlalchemy.url"))
    # Also handle Railway's postgres:// → postgresql+asyncpg:// conversion
    if url and url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    config.set_main_option("sqlalchemy.url", url)
    ```
  - [ ] Test locally: `DATABASE_URL=postgresql+asyncpg://... alembic upgrade head`

### 3. SECRET_KEY Default Value
- ❌ **Default `SECRET_KEY` in code is `dev-secret-key-change-in-production-capman-2024`**
- The app does check for this in production mode, but Railway needs it set explicitly
- **TODO:**
  - [ ] Generate a production key: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
  - [ ] Add as `SECRET_KEY` env var in Railway

---

## 🟡 HIGH PRIORITY (Fix in Week 1)

### 4. CORS Configuration
- ⚠️ Default CORS origin is `http://localhost:3000`
- **TODO:**
  - [ ] After Vercel deploy, set `CORS_ORIGINS=https://your-app.vercel.app` in Railway env vars
  - [ ] Consider adding your custom domain if applicable

### 5. Database: PostgreSQL Readiness
- ✅ `asyncpg` driver in requirements.txt
- ✅ `DATABASE_URL` env var handling in `app/core/database.py`
- ✅ Auto-detects SQLite vs PostgreSQL mode
- ✅ Alembic migration exists (`001_initial_schema.py`)
- ❌ No unique constraint on `(user_id, objective_id)` in `UserObjectiveProgress`
- **TODO:**
  - [ ] Add missing database indexes (user_id, email, created_at)
  - [ ] Add unique constraint on `(user_id, objective_id)`
  - [ ] Create migration: `alembic revision --autogenerate -m "add indexes and constraints"`
  - [ ] Test migration on fresh PostgreSQL

### 6. Token/Auth Security Hardening
- ✅ JWT auth with bcrypt password hashing
- ❌ No token revocation / logout endpoint
- ❌ No password reset flow
- ❌ No rate limiting on login endpoint (SlowAPI is installed but verify it's applied)
- **TODO:**
  - [ ] Add `POST /api/auth/logout` (token blacklist or short-lived tokens + refresh)
  - [ ] Add rate limit on `/api/auth/login` (e.g., 5 attempts/minute)
  - [ ] Consider password complexity requirements (currently no validation)

### 7. Error Handling & Observability
- ❌ No structured logging (just print/basic logging)
- ❌ No error tracking service (Sentry, etc.)
- ❌ No request timeout on LLM calls (Claude can hang for 60s+)
- **TODO:**
  - [ ] Add `httpx` timeout to Anthropic client calls (30s recommended)
  - [ ] Add Sentry or similar: `pip install sentry-sdk[fastapi]`
  - [ ] Add request correlation IDs via middleware
  - [ ] Add structured JSON logging for Railway log viewer

---

## 🟢 MEDIUM PRIORITY (Fix in Week 2-3)

### 8. Frontend Production Readiness
- ✅ `output: 'standalone'` in `next.config.mjs` (required for Docker/Vercel)
- ✅ `NEXT_PUBLIC_API_URL` reads from env var
- ✅ Multi-stage Dockerfile with non-root user
- ✅ Axios interceptor for JWT token injection
- ⚠️ No error boundary components (React crashes show white screen)
- ⚠️ No token refresh mechanism (expired JWT = forced re-login)
- ⚠️ SSE EventSource in `train/page.tsx` doesn't pass auth header (EventSource limitation)
- **TODO:**
  - [ ] Add React Error Boundary wrapper for graceful error pages
  - [ ] Add token refresh logic or silent re-auth
  - [ ] For SSE auth: pass token as query param or switch to fetch-based SSE
  - [ ] Run `npm run build` to verify zero TypeScript errors

### 9. Head-to-Head (H2H) — Incomplete Feature
- ✅ Basic match creation + grading works
- ❌ No WebSocket real-time flow (spec requires `ws://` for typing indicators)
- ❌ No matchmaking queue (MMR-based)
- ❌ No shared countdown timer
- ❌ No AI opponent fallback (spec: after 60s queue timeout)
- **TODO:**
  - [ ] Implement WebSocket endpoint for real-time H2H state
  - [ ] Add matchmaking queue with MMR scoring
  - [ ] Add shared timer component
  - [ ] Add AI opponent as fallback

### 10. MTSS Dashboard Gaps
- ✅ Tier classification, student drill-down, heatmap, alerts
- ❌ No educator grade override UI (DB fields exist, no page)
- ❌ No AI vs educator grading correlation scatter plot
- ❌ No recommended next scenarios engine
- **TODO:**
  - [ ] Build educator override form on student detail page
  - [ ] Add correlation chart endpoint + frontend visualization
  - [ ] Implement weak-objective targeting for scenario recommendations

### 11. Testing Coverage
- ✅ 64 test functions across 5 test files (auth, config, gamification, health, RAG)
- ❌ No frontend tests
- ❌ No integration/E2E tests
- ❌ No CI/CD pipeline (GitHub Actions)
- **TODO:**
  - [ ] Add pytest coverage for scenario generation, peer review, H2H endpoints
  - [ ] Add GitHub Actions workflow: lint → test → build → deploy
  - [ ] Consider Playwright/Cypress for critical user flows

---

## 🔵 NICE TO HAVE (Post-launch)

### 12. Performance & Scaling
- [ ] Add Redis for session caching / rate limiting (Railway has Redis plugin)
- [ ] Add CDN for static assets (Vercel handles this automatically)
- [ ] Add pagination on leaderboard and session list endpoints
- [ ] Add database connection pooling tuning for PostgreSQL
- [ ] Monitor LLM costs via LangSmith (already configured)

### 13. Leaderboard Enhancements
- [ ] Weekly sprint leaderboard (time-filtered queries)
- [ ] Cohort/class filter (requires organization model)

### 14. Data & Analytics
- [ ] Export student performance as CSV/PDF
- [ ] Admin dashboard for system health metrics
- [ ] LLM call latency and cost tracking

---

## Deployment Steps (Quick Reference)

### Railway (Backend)
```bash
# 1. Push to GitHub (ensure .env is NOT tracked)
git rm --cached backend/.env
git commit -m "Remove .env from tracking"
git push

# 2. Railway: New Project → Deploy from GitHub
#    Root Directory: backend
#    Add PostgreSQL plugin

# 3. Set environment variables in Railway:
ANTHROPIC_API_KEY=sk-ant-...       # NEW rotated key
FMP_API_KEY=...                     # NEW rotated key
SECRET_KEY=<generated-32-char>
CORS_ORIGINS=https://your-app.vercel.app
DATABASE_URL=<auto-injected by Railway PostgreSQL plugin>
LOG_LEVEL=INFO
```

### Vercel (Frontend)
```bash
# 1. Vercel: New Project → Import from GitHub
#    Root Directory: frontend
#    Framework: Next.js (auto-detected)

# 2. Set environment variable:
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app

# 3. Deploy → get URL → update Railway CORS_ORIGINS
```

---

## Summary

| Category | Status | Blocking? |
|----------|--------|-----------|
| Secrets rotation | ❌ Must fix | **YES** |
| Alembic DB URL | ❌ Must fix | **YES** |
| SECRET_KEY | ❌ Must fix | **YES** |
| CORS config | ⚠️ Post-deploy | No |
| DB indexes/constraints | ⚠️ Week 1 | No |
| Auth hardening | ⚠️ Week 1 | No |
| Observability | ⚠️ Week 1 | No |
| Error boundaries | ⚠️ Week 2 | No |
| H2H WebSocket | ❌ Incomplete | No (feature works partially) |
| MTSS gaps | ⚠️ Week 2-3 | No |
| Testing/CI | ⚠️ Week 2 | No |

**Bottom line: Fix items 1-3 (30 minutes of work), then you can deploy to Railway + Vercel immediately.** Everything else can be iterated on post-deploy.
