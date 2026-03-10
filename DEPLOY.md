# CapMan AI — Deployment Guide

## Architecture

```
 Vercel (Free)          Railway (~$5/mo)         Railway (Free add-on)
┌──────────────┐      ┌──────────────────┐      ┌──────────────┐
│  Next.js 14  │─────>│  FastAPI Backend  │─────>│  PostgreSQL  │
│  Frontend    │ API  │  + Uvicorn        │      │  16-alpine   │
└──────────────┘      └──────────────────┘      └──────────────┘
                              │
                              ├── Anthropic Claude API
                              └── FMP Market Data API
```

## Option A: Railway + Vercel (Recommended)

### 1. Deploy Backend on Railway

1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the repo, set **Root Directory** = `backend`
4. Add a **PostgreSQL** plugin (free) — Railway auto-injects `DATABASE_URL`
5. Go to **Variables** tab and add:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `FMP_API_KEY` | Your Financial Modeling Prep key |
| `SECRET_KEY` | Run: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `CORS_ORIGINS` | `https://your-app.vercel.app` (set after Vercel deploy) |

6. Railway detects the Dockerfile and builds automatically
7. Note the public URL (e.g., `https://capman-backend-production.up.railway.app`)

### 2. Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Select the repo, set **Root Directory** = `frontend`
3. Framework Preset: **Next.js** (auto-detected)
4. Add environment variable:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Your Railway backend URL (e.g., `https://capman-backend-production.up.railway.app`) |

5. Deploy — Vercel builds and serves your frontend
6. Go back to Railway and update `CORS_ORIGINS` with your Vercel URL

### 3. Verify

```bash
# Backend health
curl https://your-backend.up.railway.app/health
# → {"status":"healthy"}

# Frontend
# Open https://your-app.vercel.app in browser
# Register → Login → Start Training
```

---

## Option B: Docker Compose (Self-hosted / Local Testing)

### Prerequisites
- Docker + Docker Compose
- API keys for Anthropic and FMP

### Steps

```bash
# 1. Clone and enter project
git clone <your-repo> && cd capman-ai

# 2. Create .env in project root
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-api03-...
FMP_API_KEY=...
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
EOF

# 3. Build and run
docker compose up --build

# 4. Access
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Tear down
```bash
docker compose down          # stop services (keep data)
docker compose down -v       # stop services + delete database
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key for scenario gen + grading |
| `FMP_API_KEY` | Yes | — | Financial Modeling Prep for real market data |
| `SECRET_KEY` | Yes | `dev-secret-...` | JWT signing key (change in production!) |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///./capman.db` | Database connection string |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed frontend origins |
| `LOG_LEVEL` | No | `INFO` | Python log level |
| `LOG_FORMAT` | No | `json` | `json` for structured logs (Railway), blank for plain text |
| `SENTRY_DSN` | No | — | Sentry error tracking DSN (optional) |
| `SENTRY_ENV` | No | `production` | Sentry environment label |
| `LANGCHAIN_API_KEY` | No | — | LangSmith key for LLM cost tracing |
| `USE_OPENROUTER` | No | `false` | Use OpenRouter instead of Anthropic |
| `NEXT_PUBLIC_API_URL` | Yes (frontend) | `http://localhost:8000` | Backend API URL |

---

## Database

**Local dev:** SQLite (zero config, file-based)
**Production:** PostgreSQL 16 (Railway plugin or any managed Postgres)

The app auto-detects which database is in use from `DATABASE_URL`:
- `sqlite+aiosqlite:///...` → SQLite mode (no connection pool)
- `postgresql+asyncpg://...` → PostgreSQL mode (connection pooling enabled)

Tables are auto-created on startup via `init_db()` for fresh deployments.

### Alembic Migrations (Production)

For PostgreSQL production deployments, Alembic manages schema migrations:

```bash
# Run migrations (done automatically in Docker CMD)
cd backend && alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "describe your change"

# Check current migration status
alembic current
```

The Docker entrypoint runs `alembic upgrade head` before starting Uvicorn, so migrations are applied automatically on each deploy. For SQLite (local dev), `create_all` handles schema creation and Alembic is optional.

---

## Costs

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Railway (Backend) | Starter | ~$5 |
| Railway (PostgreSQL) | Free plugin | $0 |
| Vercel (Frontend) | Hobby | $0 |
| Anthropic API | Pay-per-use | ~$2-10 (depends on usage) |
| FMP API | Free tier | $0 (250 req/day) |
| **Total** | | **~$7-15/mo** |

---

## Pre-Deploy Checklist

Before your first production deployment, complete these steps:

```bash
# 1. Remove .env from git tracking (keys are in it!)
git rm --cached backend/.env
git commit -m "Stop tracking .env (secrets)"
# Optional: scrub from history
# pip install git-filter-repo
# git filter-repo --path backend/.env --invert-paths --force

# 2. Rotate ALL API keys that were exposed:
#    - Anthropic: https://console.anthropic.com/settings/keys
#    - FMP: https://financialmodelingprep.com/developer/docs/dashboard
#    - OpenRouter: https://openrouter.ai/keys
#    - LangSmith: https://smith.langchain.com/settings

# 3. Generate a production SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# → copy this value into Railway env vars

# 4. Push clean repo to GitHub
git push origin main
```

## Production Features

### Structured Logging
Backend logs are JSON-formatted in production (parseable by Railway log viewer):
```json
{"timestamp": "2026-03-09T20:00:00+00:00", "level": "INFO", "logger": "capman", "message": "Demo data seeded", "request_id": "a1b2c3d4"}
```
Set `LOG_FORMAT=json` (default in production) or `DEBUG=true` for plain text during development.

### Request Correlation IDs
Every request gets an `X-Request-ID` header (auto-generated or forwarded from client). This ID appears in all log lines for that request, enabling end-to-end tracing.

### Error Tracking (Sentry)
Optional — set `SENTRY_DSN` in Railway to enable. If the env var is not set, Sentry is completely disabled (zero overhead). The `sentry-sdk` package is included in requirements.txt.

### Health Check
```bash
curl https://your-backend.up.railway.app/health
# → {"status": "healthy", "checks": {"database": "ok", "llm_configured": true, "market_data": "fmp_hybrid"}}
```
