# CapMan AI — Gamified Scenario Training & MTSS Agent

AI-powered gamified training platform for options traders. Students face dynamic trading scenarios, get probed on their reasoning by an AI agent, and receive mastery-based grades. Educators monitor skill progression through an MTSS dashboard.

## Quick Start

**Option A — Scripts (recommended; use project venv):**

All scripts use the project venv: `./venv/bin/python` and `./venv/bin/uvicorn`. They create the venv and install deps only when needed.

```bash
cd backend
cp .env.example .env   # ← Add your API keys (see below)
./run.sh               # Creates venv if needed, installs deps, starts server on :8000
```

Requires **Python 3.10, 3.11, or 3.12** (3.14 is not yet supported by some dependencies). If you have multiple versions install the right Python first, then `./run.sh`.

**Option B — Manual:**

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env
./venv/bin/uvicorn app.main:app --reload
```

Open http://localhost:8000/docs for the API explorer.

**Note:** Capman uses `asyncpg` and `pydantic`; some builds don’t support Python 3.14 yet. If `pip install` fails, use Python 3.10–3.12 (e.g. `python3.12 -m venv venv` then `./venv/bin/pip install -r requirements.txt`).

---

## Run locally (checklist)

1. **Python 3.10–3.13** (e.g. `python3.12 --version`).
2. **Setup:** `cd backend` then `cp .env.example .env`
3. **Edit `.env`** — set at least `ANTHROPIC_API_KEY=sk-ant-...` and `SECRET_KEY=<random string>`
4. **Start:** `./run.sh`
5. **Verify:** http://localhost:8000/health and http://localhost:8000/docs

Optional: `FMP_API_KEY` (real market data), `LANGCHAIN_API_KEY` (cost tracing).

---

## Required API Keys

You need **3 API keys** (only the first is strictly required):

### 1. Anthropic API — Claude LLM (**required**)
- **What it does:** Powers scenario generation, probing questions, and grading
- **Get it:** https://console.anthropic.com/settings/keys
- **Cost:** ~$0.02-0.05 per student training session

### 2. FMP (Financial Modeling Prep) — Market Data (*optional*)
- **What it does:** Provides real options chains, stock prices, greeks
- **Get it:** https://site.financialmodelingprep.com/developer/docs
- **Fallback:** System uses realistic mock data if no key provided

### 3. LangSmith — LLM Cost Tracing (*optional but recommended*)
- **What it does:** Tracks every LLM call — tokens, latency, cost, quality
- **Get it:** https://smith.langchain.com → Settings → API Keys
- **Free tier:** 5,000 traces/month

### Alternative: OpenRouter (instead of direct Anthropic)
- **What it does:** Multi-model API gateway — access Claude, GPT-4, Llama via one key
- **Get it:** https://openrouter.ai/keys
- **To enable:** Set `USE_OPENROUTER=true` and `OPENROUTER_API_KEY=...` in `.env`

## .env Configuration

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional — real market data
FMP_API_KEY=your_fmp_key

# Optional — LLM cost tracing
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=lsv2_...
LANGCHAIN_PROJECT=capman-ai

# Alternative — use OpenRouter instead of Anthropic
# USE_OPENROUTER=true
# OPENROUTER_API_KEY=sk-or-...
```

## Project Structure

```
backend/
├── app/
│   ├── agents/              # AI engines
│   │   ├── scenario_engine.py   # LLM + RAG + market data → scenarios
│   │   └── grading_agent.py     # Multi-turn probing + rubric grading
│   ├── api/                 # FastAPI routes
│   │   ├── scenarios.py         # Generate → Respond → Probe → Grade
│   │   ├── users.py             # Profile, XP, leaderboard
│   │   └── mtss.py              # Educator "God View" dashboard
│   ├── core/                # Configuration
│   │   ├── config.py            # All settings
│   │   ├── database.py          # Async SQLAlchemy
│   │   └── tracing.py           # LangSmith + cost tracking
│   ├── models/              # DB + Pydantic models
│   └── services/            # Business logic
│       ├── market_data.py       # FMP/Mock adapter
│       ├── rag.py               # RAG hook (no doc store)
│       ├── gamification.py      # XP, levels, streaks, unlocks
│       ├── mtss.py              # Tier classification
│       └── event_logger.py      # Audit trail
├── requirements.txt
└── .env.example
```

## API Endpoints

### Scenarios (Core Training Flow)
- `POST /api/scenarios/generate` — Generate a new AI scenario
- `POST /api/scenarios/{id}/respond` — Submit response, get first probe
- `POST /api/scenarios/{id}/probe` — Answer probe, get next or trigger grading
- `POST /api/scenarios/{id}/grade` — Get structured grade with 6 dimensions

### Users & Gamification
- `POST /api/users/register` — Create account
- `GET /api/users/me` — Profile with XP, level, unlocks
- `GET /api/users/leaderboard?mode=xp|mastery|volume` — Rankings

### MTSS Dashboard (Educator)
- `GET /api/mtss/overview` — All students by tier ("God View")
- `GET /api/mtss/student/{id}` — Deep dive on one student
- `GET /api/mtss/objectives` — Class-wide skill heatmap
- `GET /api/mtss/alerts` — Tier transition notifications

## Testing

**Run tests:**

```bash
cd backend
./venv/bin/pytest -v                           # Unit tests (pytest)
./venv/bin/python test_offline.py              # Offline checks (148)
./run.sh                                       # In one terminal: start server
./venv/bin/python run_all_tests.py --e2e       # In another: run E2E
```

E2E exercises health, scenario generate → respond → probe → grade, replay flow, curveball flow, MTSS endpoints, and leaderboard. For scenario/grading steps you need `ANTHROPIC_API_KEY` in `.env`.

---

## Production

### Build and run with Docker

```bash
cd backend
docker build -t capman-backend .
docker run -p 8000:8000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e SECRET_KEY=your-production-secret-key \
  capman-backend
```

**Required env vars in production:**

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude LLM (required for scenarios/grading) |
| `SECRET_KEY` | Long random string for JWT auth; **must** be different from dev |

**Optional:** `FMP_API_KEY`, `LANGCHAIN_API_KEY`, `LANGCHAIN_TRACING_V2`, `USE_OPENROUTER`, `OPENROUTER_API_KEY`, `LOG_LEVEL`, `DEBUG=false`.

**Database:** Default is SQLite (`DATABASE_URL=sqlite+aiosqlite:///./capman.db`). For production at scale, use Postgres and set:

```bash
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/capman
```

Then run migrations (e.g. in Docker entrypoint or a one-off job): `alembic upgrade head`.

**Deploying to a host (Railway, Fly.io, Render, etc.):**

1. Point the host at the repo; use **backend** as the app directory.
2. Set build command to `docker build -t capman .` (if using Docker) or use a Python buildpack with `pip install -r requirements.txt` and start command `uvicorn app.main:app --host 0.0.0.0 --port ${PORT}`.
3. Set all required and optional env vars in the host’s dashboard.
4. For SQLite, attach a persistent volume to the app directory so `capman.db` survives restarts. For Postgres, provision a DB and set `DATABASE_URL`.
5. Health check: `GET /health` should return 200.
