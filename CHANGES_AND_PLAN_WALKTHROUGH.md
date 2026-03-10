# CapMan — Full Walkthrough: Claude’s Changes and the Plan

This document walks through **every change** made during the review/fix pass and the **plan** that was created for next steps. It also notes how the repo has evolved (e.g. auth and H2H) relative to that plan.

---

## Part 1: Code and Test Changes (What Claude Did)

### 1. [backend/app/api/scenarios.py](backend/app/api/scenarios.py)

| Change | What it does |
|--------|----------------|
| **Null checks for `Scenario`** | After `db.get(Scenario, session.scenario_id)` in **inject_curveball**, **answer_probe**, and **grade_session**, added `if not scenario: raise HTTPException(404, "Scenario not found")`. Prevents 500s when a scenario was deleted or FK is broken. |
| **Replay `event_id` validation** | At the start of `generate_replay_scenario`, if `request.event_id` is not `None` and not in `HISTORICAL_EVENTS`, raise **400** with a message listing valid event IDs. Stops silent fallback to a random event. |
| **LLM/external error handling** | Introduced constant `LLM_UNAVAILABLE_MSG` and wrapped all calls to `scenario_engine.generate_scenario`, `replay_engine.generate_replay_scenario`, `grading_agent.generate_probes` (both in respond and probe), `grading_agent.grade_session`, and `curveball_engine.generate_curveball` in `try/except`. On exception, raise **503** with that message instead of leaking 500 and stack traces. |

### 2. [backend/app/api/users.py](backend/app/api/users.py)

| Change | What it does |
|--------|----------------|
| **Duplicate email on register** | Before creating a user, added a check for existing user with same `email`; if found, return **400** "Email already registered". |
| **IntegrityError on register** | Wrapped `await db.flush()` in `try/except IntegrityError`; on catch, rollback and raise **400** "Username or email already exists" so race-condition duplicates don’t surface as 500. |
| **Leaderboard mode validation** | Introduced `VALID_LEADERBOARD_MODES = ("xp", "volume", "mastery")`. If `mode` is not in that tuple, return **400** with the list of valid modes. |
| **Leaderboard limit cap** | Introduced `MAX_LEADERBOARD_LIMIT = 100`. Set `limit = max(1, min(limit, MAX_LEADERBOARD_LIMIT))` so the query is bounded. |
| **Mastery ordering fix** | Replaced `order_by(desc("avg_mastery"))` with ordering by the same expression used in the SELECT: `desc(avg_mastery)` where `avg_mastery = func.avg(UserObjectiveProgress.mastery_score).label("avg_mastery")`. Fixes SQLAlchemy 2.0 label ordering. |

### 3. [backend/app/services/gamification.py](backend/app/services/gamification.py)

| Change | What it does |
|--------|----------------|
| **Peer-review unlock key** | Progress is keyed by **objective IDs** (e.g. `trade_thesis`, `strike_selection`, `structure_selection`), not by category. Replaced `scores.get("trade_construction", scores.get("structure_selection", 0))` with the **average** of the three trade-construction objective scores; **peer_review** is now `avg_trade_construction >= 65`. |

### 4. [backend/app/services/market_data.py](backend/app/services/market_data.py)

| Change | What it does |
|--------|----------------|
| **FMP historical prices** | Building the list of OHLCV dicts now uses `.get()` for keys and builds each row in a try/except; invalid or missing fields are skipped so malformed FMP responses don’t raise `KeyError` or `TypeError`. |
| **HV calculation in get_market_snapshot** | The returns loop uses `.get("close")` and checks for `None` and `prev > 0` before computing returns; invalid entries are skipped. |

### 5. [backend/app/models/schemas.py](backend/app/models/schemas.py)

| Change | What it does |
|--------|----------------|
| **Input length limits** | `StudentResponseSubmit.response_text`, `CurveballAdaptRequest.adaptation_text`, and `StudentProbeAnswer.answer_text` now use `Field(..., min_length=1, max_length=15000)` so overly long or empty text is rejected by Pydantic. |

### 6. [backend/app/agents/scenario_engine.py](backend/app/agents/scenario_engine.py)

| Change | What it does |
|--------|----------------|
| **Dead import removed** | Removed unused `from app.core.config import settings`. |

### 7. [backend/test_full_flow.py](backend/test_full_flow.py)

| Change | What it does |
|--------|----------------|
| **Health check handling** | When `GET /health` returns non-200 or body is not JSON, the script no longer calls `.json()` on the response (which could raise). It now records the failure, prints a short “server not running?” message, and returns `results.summary()` so the E2E run exits cleanly with a failure count. |
| **Root endpoint** | Only parses `r.json()` for `GET /` when `r.status_code == 200`, and asserts features list inside that branch to avoid decoding errors on failure. |

### 8. New and updated repo files

| File | What it does |
|------|----------------|
| **[backend/run_all_tests.py](backend/run_all_tests.py)** | New script. Runs `test_offline.py` first; optionally runs `test_full_flow.py` with `--e2e` and `--base-url`. Usage: `python run_all_tests.py` (offline only) or `python run_all_tests.py --e2e` (offline + E2E when server is up). |
| **[backend/FIXES_AND_RESEARCH.md](backend/FIXES_AND_RESEARCH.md)** | New doc. Summarizes the research findings (bugs, safeguards, integration risks, code quality) and each fix applied; lists what was intentionally not changed (auth, replay date range, logging, duplicate scenario creation). |
| **[README.md](README.md)** | New **Testing** section: how to run `test_offline.py`, `run_all_tests.py`, and E2E with a running server. |

---

## Part 2: The Plan (CapMan Next Steps)

A **prioritized plan** was created from a deep read-only review of the codebase and the deferred items in `FIXES_AND_RESEARCH.md`. It lives in Cursor as **CapMan Next Steps** (e.g. in `.cursor/plans/`). Summary:

### Current state (as of the plan)

- Backend: Full scenario flow, replay, curveballs, users, MTSS; recent fixes as above.
- Auth: Not implemented in the code reviewed; `user_id: str = "demo-user"` everywhere; `User.password_hash` and auth deps present but unused.
- Session ownership: Not enforced on session_id endpoints.
- Head-to-Head: Model and schemas exist; no API in the reviewed code.
- Replay: `_fetch_historical_context` uses last 30 days, not event date range.
- Logging: `print()` in several modules; no stdlib `logging`.
- DB: Alembic in requirements but no migrations; tables created via `init_db` only.
- Frontend: None.

### Recommended next steps (from the plan)

1. **Auth and session ownership** — Login/register with password, JWT, `get_current_user` dependency, and enforce `session.user_id == current_user.id` on respond/probe/grade/curveball/adapt/reveal.
2. **Structured logging** — Replace `print()` with `logging` and configurable level (e.g. `LOG_LEVEL`).
3. **Head-to-Head API** — Matchmaking, shared scenario, two sessions, submit/grade, winner result (using existing `HeadToHeadMatch` and gamification).
4. **Replay event-date data** — FMP date-range support and use event `date_range` in replay so historical events use the correct window.
5. **Alembic migrations** — Add `alembic.ini` and initial migration from current models; document in README.
6. **Frontend** — Minimal UI: login (if auth exists), scenario flow, MTSS; optional replay, curveball, leaderboard, H2H.
7. **Refactors** — Shared scenario/session creation helper, CORS tightening, extra E2E for auth/H2H.

The plan includes dependency order (e.g. auth unblocks H2H and frontend), a small summary table (effort vs impact), and a recommendation to do **1 (Auth)** and **2 (Logging)** first, then **3 (H2H)** / **5 (Migrations)** or **6 (Frontend)**.

---

## Part 3: How This Relates to the Repo Today

The repo **now** also contains:

- **[backend/app/api/auth.py](backend/app/api/auth.py)** — Login (OAuth2PasswordRequestForm) and register-with-password; uses `app.core.auth` (hash, verify, create_access_token). So **auth** from the plan is (at least partially) implemented elsewhere.
- **[backend/app/api/h2h.py](backend/app/api/h2h.py)** — Head-to-Head API (create match, submit, grade, result) using `get_optional_user` and the same `LLM_UNAVAILABLE_MSG` pattern. So **H2H** from the plan is (at least partially) implemented elsewhere.

Claude’s changes in this pass were **only** the items in **Part 1** (scenarios, users, gamification, market_data, schemas, scenario_engine, test_full_flow, run_all_tests, FIXES_AND_RESEARCH, README) and the **creation of the plan** in **Part 2**. The presence of `auth.py` and `h2h.py` means someone (or another session) has already started implementing the plan’s steps 1 and 3; you can use this walkthrough to see what was in the “original” fix pass vs what the plan recommended and what now exists.

---

## Quick reference: Files touched by Claude in this pass

| File | Action |
|------|--------|
| `backend/app/api/scenarios.py` | Modified (null checks, event_id validation, LLM try/except) |
| `backend/app/api/users.py` | Modified (email check, IntegrityError, leaderboard mode/limit/order_by) |
| `backend/app/services/gamification.py` | Modified (peer_review objective key) |
| `backend/app/services/market_data.py` | Modified (FMP safe access, HV safe access) |
| `backend/app/models/schemas.py` | Modified (Field max_length/min_length on three schemas) |
| `backend/app/agents/scenario_engine.py` | Modified (removed unused import) |
| `backend/test_full_flow.py` | Modified (health/root error handling) |
| `backend/run_all_tests.py` | Created |
| `backend/FIXES_AND_RESEARCH.md` | Created |
| `README.md` | Modified (Testing section) |
| Plan (CapMan Next Steps) | Created in Cursor (e.g. `.cursor/plans/`) |

Verification: **Offline suite** — `python test_offline.py` — **142/142** passed after all changes.
