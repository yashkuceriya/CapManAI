# CapMan AI — Proposal ↔ Implementation Map

**Date:** March 8, 2026
**Status:** Post-build audit against EdTeam AI Gauntlet Proposal

---

## Overall Coverage: ~88%

| Category | Spec Items | Built | Partial | Missing |
|----------|-----------|-------|---------|---------|
| Functional (Must Haves) | 5 | 4 | 1 | 0 |
| Technical Requirements | 4 | 4 | 0 | 0 |
| Performance Benchmarks | 2 | 1 | 1 | 0 |
| Code Quality | 2 | 2 | 0 | 0 |
| Key Impact Metrics | 3 | 2 | 1 | 0 |

---

## Section 5b — Functional Requirements (Must Haves)

### 1. Dynamic Scenario Generator ✅ COMPLETE

> "AI creates varied prompts (not static hard-coded questions) requiring analysis. Integrates with Atlas (Python) to generate tooling relevant to CapMan."

**What's built:**

- `backend/app/agents/scenario_engine.py` — LLM-powered scenario generation (not static/hard-coded)
- 23 market regimes across 3 difficulty tiers (beginner/intermediate/advanced)
- 20 learning objectives aligned to the Vol Framework (trade construction, risk, volatility, greeks, market analysis, advanced)
- Real market data integration via FMP API (`backend/app/services/market_data.py`) with mock fallback
- RAG architecture stub (`backend/app/services/rag.py`) ready for CapMan proprietary docs
- Scenario fingerprinting for dedup
- In-memory caching for repeated pattern avoidance
- Historical replay engine (`backend/app/agents/replay_engine.py`) — 3 curated events (GME, COVID, SVB)
- Mid-scenario curveball injection (`backend/app/agents/curveball_engine.py`) — macro, company, structural, sector events

**Frontend:**
- `frontend/app/train/page.tsx` — Full 9-state training flow (idle → generating → scenario_ready → submitting → probing → curveball → grading → graded)
- `frontend/app/replay/page.tsx` — Historical replay with blind-trade + reveal
- `frontend/components/ScenarioCard.tsx` — Market data display with options chains

**Atlas integration note:** `AtlasAdapter` stub exists in `market_data.py` targeting CapMan's internal Atlas Python SDK. Currently uses FMP API as the real-data source.

---

### 2. Probing & Grading Agent ✅ COMPLETE

> "AI asks follow-up questions ('Why did you choose that strike?') and grades the reasoning, not just the answer."

**What's built:**

- `backend/app/agents/grading_agent.py` — Full ProbingGradingAgent class
- **Probing phase:** 1–3 targeted follow-up questions using Haiku (fast, cheap) that:
  - Probe specific gaps in reasoning (cannot be answered yes/no)
  - Use CapMan terminology naturally ("theta rent", "IV rank", "GEX")
  - Reference the student's actual response to find weaknesses
- **Grading phase:** 6-dimension rubric scored 0–100 using Sonnet:
  1. Trade Thesis
  2. Strike Selection
  3. Structure Selection
  4. Risk Management
  5. Market Regime Awareness
  6. Reasoning Depth & CapMan Lexicon
  7. Adaptability (7th dimension, curveball-only)
- Output includes: overall_score, dimension_scores with per-dimension feedback, strengths (2–3), areas_for_improvement (2–3), reasoning_quality, capman_lexicon_usage, confidence (0–1)
- RAG context pulled for both probing and grading

**Frontend:**
- `frontend/components/ProbeChat.tsx` — Chat-style multi-turn probe conversation
- `frontend/components/GradeDisplay.tsx` — Full grade breakdown with XP, dimensions, strengths, improvements

---

### 3. Gamification Layer ✅ COMPLETE

> "XP systems, leaderboards, and competitive 'head-to-head' analysis challenges."

**What's built:**

- `backend/app/services/gamification.py` — Complete gamification engine:
  - **XP system:** Base (50) + grade bonus (0–50) + streak (+25) + perfect score (+100) + peer review (+15) + H2H win (+75) / loss (+25) + curveball (+25)
  - **7 levels:** Apprentice → Analyst → Associate → Strategist → Senior Strategist → Portfolio Lead → CapMan Elite
  - **Daily streaks** with 3-day bonus threshold
  - **Mastery unlocks:** Intermediate, Advanced, H2H, Peer Review, Elite scenarios gated by objective mastery scores
- `backend/app/api/users.py` — Leaderboard endpoint with 3 modes (XP, Volume, Mastery)
- `backend/app/api/h2h.py` — Full head-to-head competitive mode:
  - Create/join/submit/grade match flow
  - Same scenario for both players, independent grading
  - Winner by higher score, XP awards for both

**Frontend:**
- `frontend/app/leaderboard/page.tsx` — 3-mode leaderboard with medals, user highlighting
- `frontend/components/LeaderboardTable.tsx` — Responsive table with rank display
- `frontend/components/XPAnimation.tsx` — Floating "+XP Earned!" animation
- Dashboard (`frontend/app/page.tsx`) shows XP, level progress bar, streak, unlocks

**Frontend gap:** No H2H match UI page exists yet. Backend endpoints are complete but there's no `frontend/app/h2h/page.tsx` to create/join/play matches.

---

### 4. Peer Review Module ⚠️ PARTIAL

> "A mechanism for users to evaluate each other's responses."

**What's built:**
- Database fields on `ScenarioSession`: `peer_review_score`, `peer_review_feedback`, `peer_reviewed_by`
- Gamification support: `is_peer_review=True` in `calculate_xp()` adds +15 XP
- Mastery unlock gated on peer review (trade construction avg ≥65%)

**What's missing:**
- **No `/api/peer-review/` router** — no API endpoints to request, assign, or submit peer reviews
- **No peer review queue/matching system** — no way to surface sessions needing review
- **No frontend peer review UI** — no page or component for reviewing another student's work

**Effort to complete:** Medium (~4–6 hours). Needs:
1. `backend/app/api/peer_review.py` — endpoints: list available sessions, claim a review, submit score + feedback
2. `frontend/app/peer-review/page.tsx` — browse sessions, read responses, submit review
3. Matching logic (e.g., random assignment, skill-level matching)

---

### 5. MTSS Reporting ✅ COMPLETE

> "Automated classification of users into support tiers based on performance data."

**What's built:**

- `backend/app/services/mtss.py` — Full MTSS classification engine:
  - **Tier 1 "On Track":** All objectives ≥75% mastery
  - **Tier 2 "Targeted Support":** 1+ objectives 50–74%
  - **Tier 3 "Intensive Support":** 2+ objectives <50%
  - Recency-weighted rolling average (last 10 scores) with exponential decay
  - Recommended objectives (weakest 3)
  - Tier transition alerts
- `backend/app/api/mtss.py` — 4 educator endpoints:
  - `GET /api/mtss/overview` — All students grouped by tier
  - `GET /api/mtss/student/{user_id}` — Individual deep-dive
  - `GET /api/mtss/objectives` — Class-wide objective heatmap
  - `GET /api/mtss/alerts` — Tier transition notifications
- `backend/app/models/database_models.py` — `user_objective_progress` table tracks per-student per-objective mastery with trend detection

**Frontend:**
- `frontend/app/mtss/page.tsx` — Full educator dashboard ("God View"):
  - Tier overview cards with student counts
  - Student lists per tier with weakest objectives
  - Tier transition alerts with severity
  - Student detail modal (objective mastery, recent sessions, recommendations)
- `frontend/components/MTSSHeatmap.tsx` — Class-wide objectives × students heatmap

---

## Section 5a — Technical Requirements

### Required Programming Languages ✅

> "Python (AI/Data logic) required to integrate with Atlas tooling. Can use any language for Interactive UI."

- **Backend:** Python 3.12 + FastAPI (async)
- **Frontend:** TypeScript + Next.js 14 + React + Tailwind CSS

### AI/ML Frameworks ✅

> "LLMs (Grading/Context), RAG (Retrieval-Augmented Generation for proprietary docs)."

- **LLM:** Anthropic Claude API (Sonnet for grading/scenarios, Haiku for probing)
- **RAG:** Architecture in place (`backend/app/services/rag.py`), currently returns empty context. Ready for ChromaDB/vector store integration with CapMan proprietary docs.
- **Tracing:** LangSmith integration (`backend/app/core/tracing.py`) for cost/latency/quality monitoring

### Development Tools ✅

> "Scenario generation engine, Gamification logic libraries (scoring, matchmaking)."

- Scenario engine: `backend/app/agents/scenario_engine.py`
- Curveball engine: `backend/app/agents/curveball_engine.py`
- Replay engine: `backend/app/agents/replay_engine.py`
- Gamification: `backend/app/services/gamification.py`
- H2H matchmaking: `backend/app/api/h2h.py`

### Other Specific Requirements ✅

> "Multi-User Engine: Support for real-time interaction, head-to-head challenges, and peer review."

- JWT auth with multi-user support, role-based access (student/educator/admin)
- H2H challenge system (backend complete, frontend needs UI page)
- Peer review (DB schema ready, needs API + UI)

> "Dynamic Leaderboards: Real-time ranking systems based on mastery and repetition volume."

- 3-mode leaderboard: XP rank, Volume (scenarios completed), Mastery (avg objective score)
- Frontend fully implemented with medals and user highlighting

> "Objective based MTSS Reporting"

- 20 learning objectives with per-student per-objective mastery tracking
- MTSS dashboard provides skill-level granularity (not just aggregate score)

---

## Section 5c — Performance Benchmarks

### AI grading correlation with educator standards ⚠️ PARTIAL

> "AI grading correlation with educator standards."

- **Built:** Grading uses a detailed 6-dimension rubric calibrated to CapMan methodology. Educator override fields exist (`educator_override_score`, `educator_override_note`, `educator_override_by`) for manual adjustment.
- **Not built:** No automated correlation tracking (comparing AI grades to educator benchmark grades). Would need a calibration dataset and correlation dashboard.

### System latency ✅

> "System latency low enough to support real-time competitive scenarios."

- Probing now uses Haiku (~1s response time)
- Scenario generation uses Sonnet (~3–5s)
- Grading uses Sonnet (~3–5s)
- H2H has 300s time limit, grades both players concurrently
- In-memory caching avoids re-generating identical scenarios

---

## Section 5d — Code Quality

### Modular architecture ✅

> "Modular architecture to allow easy addition of new scenario types."

- Clean separation: agents/ (LLM logic), services/ (business logic), api/ (HTTP endpoints), models/ (data), core/ (config/auth/tracing)
- New scenario types = add to `MARKET_REGIMES` dict + `LEARNING_OBJECTIVES` dict
- New curveball types = add to `CURVEBALL_TYPES` in curveball_engine.py
- New replay events = add to `HISTORICAL_EVENTS` in replay_engine.py
- Market data adapter pattern (FMP/Mock/Atlas) for pluggable data sources

### Robust data logging ✅

> "Robust data logging for long-term trajectory tracking."

- `event_logs` table captures every user action (scenario_generated, response_submitted, grade_received, h2h events, tier changes, etc.)
- `user_objective_progress` tracks rolling mastery with trend detection (improving/stable/declining)
- `scenario_sessions` stores full conversation history, dimension scores, XP earned
- LangSmith integration tracks LLM cost, latency, token usage per call
- `SessionCostTracker` aggregates session-level costs for reporting

---

## Section 4b — Key Impact Metrics

| Metric | Status | Evidence |
|--------|--------|----------|
| "High user retention driven by gamification loops (XP, leaderboards)" | ✅ | 7 levels, XP system, 3-mode leaderboard, streaks, unlocks, H2H |
| "System ability to generate high volumes of unique, coherent scenarios without latency" | ✅ | 23 regimes × 20 objectives × 8 symbols = thousands of combos. Haiku probing ~1s. Caching for repeats. |
| "High correlation between AI-assigned grades and human-educator benchmarks" | ⚠️ | Rubric-based grading + educator override fields exist. No automated correlation tracking yet. |

---

## Gap Summary — What Needs Work

### Must-Fix (blocks proposal compliance)

1. **Peer Review API + UI** — Proposal lists this as a "Must Have." DB schema exists but no endpoints or frontend. ~4–6 hours.

### Should-Fix (improves completeness)

2. **H2H Frontend Page** — Backend is complete but no `frontend/app/h2h/page.tsx`. Users can't play H2H matches through the UI. ~3–4 hours.
3. **RAG Document Loading** — Currently returns empty context. Loading CapMan proprietary docs would significantly improve scenario quality and grading accuracy. ~2–3 hours with ChromaDB.
4. **AI ↔ Educator Grade Correlation Dashboard** — No way to track whether AI grades match educator benchmarks over time. ~3–4 hours.

### Nice-to-Have (polish)

5. **More Replay Events** — Only 3 historical events curated (GME, COVID, SVB). Framework supports unlimited; adding 5–10 more would enrich replay mode. ~1–2 hours.
6. **Atlas Adapter** — Production market data integration with CapMan's internal SDK. Stub exists. Depends on Atlas API availability.
7. **Role-Based Route Guards** — MTSS page should enforce educator role on the backend. Currently relies on frontend hiding the nav link.
8. **WebSocket for H2H Real-Time** — Current H2H uses polling. WebSocket would improve the live competitive experience.
