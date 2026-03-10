# CapMan Backend — Fixes & Research Summary

This document summarizes the deep codebase review and the fixes applied.

---

## Research Summary (Findings)

A full pass over `app/api`, `app/agents`, `app/services`, `app/core`, and `app/models` identified:

| Category | Issues | Severity |
|----------|--------|----------|
| **Bugs** | Null scenario after `db.get`, replay `event_id` not validated, wrong gamification objective key, leaderboard `order_by`/limit/mode, duplicate email on register, FMP response key errors | High |
| **Inconsistencies** | LLM/API error handling, input validation (length, enums) | Medium |
| **Safeguards** | No auth (by design for demo), session ownership not enforced, MTSS/user data not restricted | Known / TODO |
| **Integration** | LLM/RAG/FMP failures could 500 with no clear message, partial state if probe generation fails | High |
| **Code quality** | Unused import, `print` vs logging, duplicated scenario-creation logic | Low |

---

## Fixes Applied

### 1. **Null checks for `Scenario`** (`api/scenarios.py`)
- After `db.get(Scenario, session.scenario_id)` in **inject_curveball**, **answer_probe**, and **grade_session**, added an explicit check. If `scenario` is `None`, the API now returns **404** with "Scenario not found" instead of raising when accessing `scenario.context_prompt` or other attributes.

### 2. **Replay `event_id` validation** (`api/scenarios.py`)
- **POST /api/scenarios/replay** now validates `event_id` against `HISTORICAL_EVENTS`. If the client sends an invalid `event_id`, the API returns **400** with a message listing valid event IDs instead of silently falling back to a random event.

### 3. **User registration** (`api/users.py`)
- **Duplicate email**: Registration now checks for an existing user with the same `email` and returns **400** "Email already registered".
- **IntegrityError**: Wrapped `db.flush()` in `try/except IntegrityError` so a duplicate username/email from a race condition returns **400** with a clear message instead of an unhandled 500.

### 4. **Leaderboard** (`api/users.py`)
- **Mode**: Only `xp`, `volume`, and `mastery` are allowed. Any other `mode` returns **400** with the list of valid modes.
- **Limit**: `limit` is clamped to `[1, 100]` to avoid unbounded queries.
- **Mastery ordering**: Replaced `order_by(desc("avg_mastery"))` with ordering by the same expression used in the SELECT (`desc(avg_mastery)`), so the query is valid and sorts correctly in SQLAlchemy 2.0.

### 5. **Gamification peer_review unlock** (`services/gamification.py`)
- The unlock previously used `scores.get("trade_construction", ...)`, but `trade_construction` is a **category**, not an objective ID. Progress is keyed by objective IDs (`trade_thesis`, `strike_selection`, `structure_selection`).
- **Fix**: Peer-review unlock now uses the **average** of the three trade-construction objective scores (`trade_thesis`, `strike_selection`, `structure_selection`) and requires that average ≥ 65.

### 6. **Market data safe access** (`services/market_data.py`)
- **FMP historical prices**: Building the list of OHLCV dicts now uses `.get()` for keys and skips malformed entries; numeric fields are cast with `float()`/`int()` inside try/except to avoid `KeyError` or `TypeError` on unexpected API shapes.
- **HV calculation**: In `get_market_snapshot`, the returns loop now uses `.get("close")` and checks for `None` and `prev > 0` before computing returns; invalid entries are skipped.

### 7. **API-level error handling for LLM/external calls** (`api/scenarios.py`)
- All calls to **scenario_engine**, **replay_engine**, **grading_agent**, and **curveball_engine** are wrapped in `try/except`. On any exception, the API returns **503** with a single, user-facing message: *"Scenario or grading service is temporarily unavailable. Please try again in a moment..."* instead of a raw 500 and stack trace.

### 8. **Input validation** (`models/schemas.py`)
- **StudentResponseSubmit.response_text**: `Field(..., min_length=1, max_length=15000)`.
- **CurveballAdaptRequest.adaptation_text**: Same.
- **StudentProbeAnswer.answer_text**: Same.

### 9. **Dead import** (`agents/scenario_engine.py`)
- Removed unused `from app.core.config import settings`.

---

## Not Changed (By Design or Deferred)

- **Auth / session ownership**: Still using `user_id: str = "demo-user"` and no ownership checks on session endpoints; left as documented TODO for production.
- **Replay historical date range**: Replay engine still uses “last N days” from FMP rather than event-specific date ranges; fixing requires FMP date-range support and is deferred.
- **Structured logging**: Replaced no `print` calls; moving to a proper logger is left as a follow-up.
- **Duplicate scenario/session creation**: Logic in generate vs replay was not refactored into a shared helper in this pass.

---

## Verification

- **Offline suite**: `python test_offline.py` — **142/142** passed after all changes.
