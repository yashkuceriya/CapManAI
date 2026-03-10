# CapMan AI — Architecture & Build Plan

## System Overview

An AI-powered gamified training platform for options traders. Students face dynamically generated trading scenarios, respond with analysis, get probed by an AI agent on their reasoning, and receive mastery-based grades. Educators monitor real-time skill progression through an MTSS dashboard.

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Backend** | Python + FastAPI | Required for Atlas integration; async-native, fast, great LLM ecosystem |
| **Market Data** | FMP API (prototype) → Atlas SDK (production) | Real options chains, greeks, prices via adapter pattern; FMP for demo, Atlas swap-in for prod |
| **LLM Orchestration** | LangChain + Claude API | Multi-turn probing agent, structured output for grading |
| **RAG / Vector Store** | ChromaDB (local) or Pinecone | Embed proprietary CapMan trading docs for grounded scenario generation |
| **Database** | PostgreSQL + SQLAlchemy | Relational data (users, scores, scenarios, MTSS tiers); strong for analytics queries |
| **Frontend** | React + Next.js + Tailwind CSS | Fast to build, polished UI, SSR for dashboard performance |
| **Real-time** | WebSockets (FastAPI native) | Leaderboard updates, head-to-head challenges |
| **Auth** | NextAuth.js or simple JWT | Lightweight; role-based (student vs. educator) |
| **Charting** | Recharts or Chart.js | MTSS dashboard visualizations |

---

## Architecture Diagram (Logical)

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                  │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Scenario │  │  Leader-  │  │   MTSS   │  │  Peer  │  │
│  │  Player  │  │  board    │  │Dashboard │  │ Review │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
└───────┼──────────────┼──────────────┼────────────┼──────┘
        │              │              │            │
        ▼              ▼              ▼            ▼
┌─────────────────────────────────────────────────────────┐
│                   API GATEWAY (FastAPI)                  │
│                                                         │
│  /scenarios   /grading   /users   /mtss   /leaderboard  │
└───────┬──────────────┬──────────────┬───────────────────┘
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Scenario   │ │   Probing    │ │   MTSS       │
│   Engine     │ │   & Grading  │ │   Engine     │
│              │ │   Agent      │ │              │
│  LLM + RAG  │ │  LLM + Rubric│ │  Analytics   │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       ▼                ▼                ▼
┌─────────────────────────────────────────────────────────┐
│                    DATA LAYER                           │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ PostgreSQL │  │  ChromaDB  │  │  CapMan Context    │ │
│  │ (users,    │  │  (trading  │  │  Documents (RAG)   │ │
│  │  scores,   │  │   docs     │  │                    │ │
│  │  sessions) │  │   vectors) │  │                    │ │
│  └────────────┘  └────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Core Data Models

### User
```python
class User:
    id: UUID
    username: str
    email: str
    role: Enum["student", "educator", "admin"]
    xp: int = 0
    level: int = 1
    current_tier: Enum["tier1", "tier2", "tier3"]  # MTSS tier
    created_at: datetime
```

### Scenario
```python
class Scenario:
    id: UUID
    market_regime: str          # e.g., "high_vol_bearish", "low_vol_range"
    asset_class: str            # e.g., "equity_options", "index_options"
    difficulty: Enum["beginner", "intermediate", "advanced"]
    context_prompt: str         # The market setup shown to student
    chart_data: Optional[dict]  # Simulated price/vol data
    learning_objectives: list[str]  # What skills this scenario tests
    created_at: datetime
    generated_by: str           # model version for tracking
```

### ScenarioSession (a student's attempt)
```python
class ScenarioSession:
    id: UUID
    user_id: UUID
    scenario_id: UUID
    status: Enum["in_progress", "graded", "reviewed"]
    conversation: list[Message]  # Full back-and-forth with probing agent
    initial_response: str
    grade: Optional[GradeResult]
    xp_earned: int = 0
    time_spent_seconds: int
    created_at: datetime
```

### GradeResult
```python
class GradeResult:
    overall_score: float           # 0-100
    dimension_scores: dict         # e.g., {"strike_selection": 85, "risk_mgmt": 60, ...}
    strengths: list[str]
    areas_for_improvement: list[str]
    reasoning_quality: float       # 0-100, key MTSS metric
    capman_lexicon_usage: float    # 0-100, did they use firm terminology?
    confidence: float              # model's confidence in its own grading
```

### LearningObjective (for MTSS tracking)
```python
class LearningObjective:
    id: str                        # e.g., "strike_selection", "delta_hedging"
    name: str
    description: str
    category: str                  # e.g., "trade_construction", "risk_management"

class UserObjectiveProgress:
    user_id: UUID
    objective_id: str
    attempts: int
    mastery_score: float           # rolling average
    trend: Enum["improving", "stable", "declining"]
    last_assessed: datetime
```

---

## AI Pipeline — The Heart of the System

### 1. Scenario Generation Engine

**Input:** Difficulty level, target learning objectives, market regime (or random)
**Output:** A complete trading scenario with context, data, and expected analysis points

```
Flow:
  1. Select market regime + asset parameters
  2. Call Atlas (Python) to generate relevant options chain data, greeks, P&L profiles
  3. RAG retrieval: pull relevant CapMan context docs (lexicon, strategies, trade logic)
  4. LLM generates scenario grounded in Atlas output + retrieved context
  5. Validate: scenario is coherent, novel (not duplicate), and tests target objectives
  6. Store and serve to student
```

#### Atlas Integration Layer (FMP for Prototype)
Atlas is CapMan's internal Python tooling for options analytics. For the prototype, we use **Financial Modeling Prep (FMP) API** as a drop-in data source — it provides real options chains, greeks, historical prices, and market data. The adapter pattern means swapping FMP → Atlas is a one-file change.

```python
# market_data_adapter.py — adapter pattern for clean separation
from abc import ABC, abstractmethod

class MarketDataAdapter(ABC):
    """Abstract interface — swap implementations without touching scenario engine"""

    @abstractmethod
    def get_options_chain(self, symbol, expiry_range) -> dict: ...

    @abstractmethod
    def get_stock_quote(self, symbol) -> dict: ...

    @abstractmethod
    def get_historical_prices(self, symbol, period) -> list: ...

    @abstractmethod
    def get_market_snapshot(self, symbol) -> dict: ...


class FMPAdapter(MarketDataAdapter):
    """Prototype: uses Financial Modeling Prep API for real market data"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://financialmodelingprep.com/api/v3"

    def get_options_chain(self, symbol, expiry_range) -> dict:
        """Real options chain with strikes, premiums, greeks, IV, OI"""
        # GET /api/v3/stock_option_chain?symbol={symbol}&apikey={key}

    def get_stock_quote(self, symbol) -> dict:
        """Current price, change, volume, market cap"""
        # GET /api/v3/quote/{symbol}?apikey={key}

    def get_historical_prices(self, symbol, period) -> list:
        """Daily OHLCV for regime detection and chart generation"""
        # GET /api/v3/historical-price-full/{symbol}?apikey={key}

    def get_market_snapshot(self, symbol) -> dict:
        """IV rank, HV, sector performance — for regime context"""
        # Composite of multiple FMP endpoints


class AtlasAdapter(MarketDataAdapter):
    """Production: wraps CapMan's internal Atlas Python SDK"""
    # Same interface, calls Atlas instead of FMP
    # Swap in when Atlas SDK is available — zero changes to scenario engine


class MockAdapter(MarketDataAdapter):
    """Testing: returns realistic hardcoded data for unit tests"""
    # Returns static fixtures — used in CI/CD and offline dev
```

**Why this matters for the demo:** Scenarios are powered by *actual* AAPL/TSLA/SPY options data, not LLM-hallucinated numbers. When an evaluator sees a scenario with real greeks and a real options chain, it immediately feels credible.

**Key prompt structure:**
```
SYSTEM: You are a senior CapMan trading instructor. Generate a trading scenario
that tests {learning_objectives}. Use the following firm-specific context:

{rag_retrieved_context}

The scenario must:
- Present a specific market environment with concrete data points
- Require the student to make a trading decision (entry, strike, sizing, hedge)
- Have a clear "best" answer according to CapMan methodology
- Be solvable in 3-5 minutes of analysis

REGIME: {market_regime}
DIFFICULTY: {difficulty}
```

### 2. Probing & Grading Agent

This is a multi-turn conversational agent, not a single-shot grader.

**Flow:**
```
Student submits initial response
  → Agent evaluates response dimensions
  → Agent asks 1-3 targeted follow-up questions
    ("Why that strike and not 2 strikes wider?")
    ("What's your max loss if vol crushes 20%?")
    ("How does this change if earnings are tomorrow?")
  → Student responds to each probe
  → Agent produces structured GradeResult
```

**Grading rubric dimensions:**
1. **Trade Construction** — Is the structure appropriate for the thesis?
2. **Strike Selection** — Is the strike choice justified given the setup?
3. **Risk Management** — Does the student understand and bound their risk?
4. **Market Regime Awareness** — Does analysis account for the current environment?
5. **CapMan Lexicon** — Is the student using firm-specific terminology correctly?
6. **Reasoning Depth** — Can the student explain *why*, not just *what*?

**Grading prompt structure:**
```
SYSTEM: You are a CapMan grading agent. Evaluate this student's trading analysis.

RUBRIC:
{structured_rubric_with_scoring_criteria}

FIRM CONTEXT (retrieved via RAG):
{relevant_capman_methodology_docs}

SCENARIO:
{scenario_context}

STUDENT CONVERSATION:
{full_conversation_history}

Produce a structured grade as JSON with dimension scores, strengths,
areas for improvement, and an overall score. Be calibrated:
70 = competent, 85 = strong, 95+ = exceptional.
```

### 3. MTSS Classification Engine

**Runs after each grading event:**
```
1. Update UserObjectiveProgress for each assessed objective
2. Compute rolling mastery scores (weighted recent performance higher)
3. Classify user into MTSS tier:
   - Tier 1 (On Track): mastery ≥ 75% across all core objectives
   - Tier 2 (Targeted Support): mastery 50-74% in 1+ objectives
   - Tier 3 (Intensive Support): mastery < 50% in 2+ objectives
4. Flag tier transitions for educator notification
5. Generate recommended next scenarios (target weak objectives)
```

---

## Gamification System

### XP & Leveling
```
XP Sources:
  - Complete a scenario:        base 50 XP
  - Grade bonus:                +(score/100 × 50) XP → max 50 bonus
  - Streak bonus (3+ days):     +25 XP per scenario
  - Peer review given:          +15 XP
  - Head-to-head win:           +75 XP
  - Perfect score (95+):        +100 XP bonus

Level Thresholds:
  Level 1:     0 XP      (Apprentice)
  Level 2:   500 XP      (Analyst)
  Level 3:  1500 XP      (Associate)
  Level 4:  3500 XP      (Strategist)
  Level 5:  7000 XP      (Senior Strategist)
  Level 6: 12000 XP      (Portfolio Lead)
  Level 7: 20000 XP      (CapMan Elite)
```

### Leaderboard
- Real-time, sorted by XP (default) or mastery score
- Weekly and all-time views
- Filterable by cohort/class

### Mastery-Based Unlocks (NOT XP-Based)
Progression gates are tied to **mastery scores**, not just XP grinding. This is a spec requirement.
```
Unlock Conditions (all require mastery thresholds):
  Intermediate Scenarios:  mastery ≥ 60% on 3+ core objectives
  Advanced Scenarios:      mastery ≥ 75% on all core objectives
  Head-to-Head Challenges: mastery ≥ 50% on 3+ objectives + Level 3 XP
  Peer Review Privileges:  mastery ≥ 65% on "trade_construction" objective
  Elite Scenarios:         mastery ≥ 85% on all objectives
```
XP still drives the leaderboard ranking and cosmetic levels, but *content access* is gated by demonstrated mastery. This prevents students from grinding easy scenarios to unlock hard ones without actually learning.

### Leaderboard Ranking Modes
The spec requires ranking by both **mastery and repetition volume**:
```
Leaderboard Views:
  1. XP Ranking (default)     — Total XP earned
  2. Mastery Ranking          — Average mastery across all objectives
  3. Volume Ranking           — Total scenarios completed (repetition count)
  4. Weekly Sprint            — XP earned this week only
```
All views filterable by cohort/class. Educators can toggle views to identify both high-performers and high-effort students.

---

## Head-to-Head Challenge System

A **must-have** feature per the spec. Two students compete on the same scenario simultaneously.

### Data Model
```python
class HeadToHeadMatch:
    id: UUID
    scenario_id: UUID
    player_1_id: UUID
    player_2_id: UUID
    player_1_session_id: Optional[UUID]
    player_2_session_id: Optional[UUID]
    status: Enum["pending", "in_progress", "grading", "completed"]
    winner_id: Optional[UUID]
    created_at: datetime
    time_limit_seconds: int = 300  # 5 min default
```

### Matchmaking Engine
```
Matchmaking Algorithm:
  1. Student requests a head-to-head match
  2. Enter matchmaking queue with their mastery_score as MMR
  3. Pair with closest-MMR player in queue (±15% tolerance)
  4. If no match within 30 seconds, widen tolerance to ±25%
  5. If no match within 60 seconds, offer AI opponent (grading agent plays devil's advocate)
  6. Both players receive the SAME dynamically generated scenario
  7. Both respond independently under a shared timer
  8. Both graded by the same rubric → higher score wins
  9. Winner gets +75 XP, loser gets +25 XP (participation)
```

### Real-Time Flow (WebSocket)
```
Channel: ws://api/matches/{match_id}

Events:
  match_found       → Both players notified, scenario delivered
  opponent_typing    → Typing indicator (engagement signal)
  opponent_submitted → Pressure signal ("they're done!")
  time_warning       → 60 seconds remaining
  results_ready      → Both grades revealed simultaneously
```

---

## API Design (Key Endpoints)

### Scenario Engine
```
POST   /api/scenarios/generate        → Generate new scenario for user
GET    /api/scenarios/{id}             → Get scenario details
POST   /api/scenarios/{id}/respond     → Submit initial response
POST   /api/scenarios/{id}/probe       → Get next probing question
POST   /api/scenarios/{id}/grade       → Trigger final grading
```

### User & Gamification
```
GET    /api/users/me                   → Current user profile + stats
GET    /api/users/me/progress          → Objective-level progress
GET    /api/leaderboard                → Leaderboard (query: weekly/alltime)
GET    /api/users/me/recommended       → AI-recommended next scenarios
```

### MTSS (Educator only)
```
GET    /api/mtss/overview              → All students by tier
GET    /api/mtss/student/{id}          → Deep dive on one student
GET    /api/mtss/objectives            → Class-wide objective heatmap
GET    /api/mtss/alerts                → Tier transition notifications
```

### Peer Review
```
GET    /api/reviews/queue              → Get a session to review
POST   /api/reviews/{session_id}       → Submit peer review
```

---

## Frontend Pages

### 1. Dashboard (Student Home)
- Current level, XP bar, streak counter
- "Start Training" CTA → scenario generation
- Recent scores, objective radar chart
- Leaderboard preview (top 5 + your rank)

### 2. Scenario Player
- Split view: scenario context (left) + response area (right)
- Real-time probing: agent questions appear below initial response
- Timer (optional, for competitive mode)
- Submit → grading animation → grade reveal with dimension breakdown

### 3. Grade Review
- Overall score with breakdown by dimension
- Strengths and improvement areas highlighted
- "Try Similar Scenario" button (targets same weak objectives)
- Option to send to peer review

### 4. Leaderboard
- XP ranking with level badges
- Weekly/all-time toggle
- Filterable by cohort

### 5. MTSS Dashboard (Educator View)
- Three-tier swimlane: Tier 1 / Tier 2 / Tier 3 with student cards
- Click student → objective-level radar chart + attempt history
- Class-wide heatmap: objectives × students, color-coded by mastery
- Alert feed: recent tier transitions, struggling students

---

## 4-Day Build Sprint

### Day 1 — AI Core + Data Foundation
**Goal:** Scenario generation and grading work end-to-end in the terminal.

- [ ] Set up Python project (FastAPI, SQLAlchemy, Alembic)
- [ ] Define database models and run migrations
- [ ] Build RAG pipeline: ingest sample CapMan docs into ChromaDB
- [ ] Build Scenario Engine: LLM generates scenarios grounded in RAG context
- [ ] Build Probing Agent: multi-turn follow-up question logic
- [ ] Build Grading Agent: structured rubric evaluation → GradeResult JSON
- [ ] Test full flow: generate → respond → probe → grade (CLI or API tests)

**Deliverable:** Hit the `/generate` → `/respond` → `/probe` → `/grade` endpoints and get back a structured grade. The AI backbone works.

### Day 2 — Gamification Backend + Frontend Shell
**Goal:** XP/leveling works. Frontend renders scenarios and grades.

- [ ] Implement XP calculation, leveling logic, leaderboard queries
- [ ] Build all API endpoints (scenarios, users, gamification, MTSS)
- [ ] Set up Next.js project with Tailwind
- [ ] Build Scenario Player page (scenario display + response form)
- [ ] Build probing interaction UI (chat-style follow-up questions)
- [ ] Build Grade Review page (score display with dimension breakdown)
- [ ] Wire frontend to backend APIs

**Deliverable:** A student can generate a scenario, respond, get probed, and see their grade — in the browser.

### Day 3 — Gamification UI + MTSS Dashboard + Head-to-Head
**Goal:** The product feels *gamified*, educators have their view, and competitive mode works.

- [ ] Student dashboard: XP bar, level badge, streak, recent scores
- [ ] Leaderboard page with all 4 ranking modes (XP, mastery, volume, weekly)
- [ ] Level-up animations and XP gain notifications
- [ ] Mastery-based unlock gates (not just XP)
- [ ] Head-to-head matchmaking engine + WebSocket real-time flow
- [ ] Head-to-head UI: shared timer, opponent status, simultaneous reveal
- [ ] MTSS classification engine (tier assignment logic)
- [ ] Educator dashboard: tier swimlanes, student drill-down
- [ ] Educator grade override UI (for calibration data collection)
- [ ] Objective heatmap visualization
- [ ] Seed database with sample students + history for demo

**Deliverable:** Both the student and educator experiences feel complete. Students can compete head-to-head.

### Day 4 — Polish, Demo Data & Ship
**Goal:** Production-quality demo. Everything looks and feels professional.

- [ ] UI polish: loading states, transitions, responsive layout
- [ ] Seed rich demo data (10+ students, varied scores, clear tier distribution)
- [ ] Peer review flow (at least basic: view someone's response, submit feedback)
- [ ] End-to-end testing of full user journey
- [ ] Run grading calibration on 10+ sample responses, document correlation
- [ ] Event logging verification (spot-check that all actions are captured)
- [ ] Write README with setup instructions
- [ ] Record demo walkthrough or prepare live demo script
- [ ] Deploy (Vercel for frontend, Railway/Render for backend) OR docker-compose

**Deliverable:** Ship it. A working, polished, demoable product.

---

## Latency Strategy

The spec requires latency low enough for real-time competitive scenarios (head-to-head).

```
Target Latencies:
  Scenario generation:     < 5 seconds (acceptable — happens once before play)
  Probing question:        < 2 seconds (must feel conversational)
  Final grading:           < 4 seconds (behind a "grading..." animation)
  Head-to-head results:    < 6 seconds after both submit (both grades computed)
  Leaderboard refresh:     < 500ms (WebSocket push, cached query)
```

**Optimizations:**
1. **Streaming LLM responses** — Probing questions stream token-by-token to the UI (feels instant even if generation takes 2s)
2. **Pre-generation cache** — Generate a pool of 20+ scenarios during off-peak; serve from cache when student clicks "Start Training"; refill async
3. **Parallel grading** — In head-to-head, both students' responses graded concurrently (two async LLM calls)
4. **RAG retrieval caching** — Cache frequently-retrieved CapMan doc chunks in memory (they rarely change)
5. **Lightweight probing** — Probing questions use a smaller/faster model or fewer tokens than the full grading pass

---

## AI Grading Correlation — Measuring Quality

The spec lists "AI grading correlation with educator standards" as a performance benchmark. Here's how we demonstrate it:

### Calibration Approach
```
1. Educator Feedback Loop (built into the product):
   - Educators can view any graded session and override/adjust the AI grade
   - Each override is logged as a calibration data point
   - Dashboard shows: AI grade vs. educator grade scatter plot + correlation coefficient

2. Calibration Dataset (pre-seeded):
   - Create 20 sample scenario responses at varying quality levels
   - Have 2-3 educators grade them independently (gold standard)
   - Run AI grader on the same set
   - Report Pearson correlation and mean absolute error

3. Ongoing Drift Detection:
   - Track educator override rate over time
   - Alert if override rate exceeds 20% (grading prompts may need tuning)
   - Monthly calibration report: correlation trend, common disagreement areas
```

### Educator Override UI
```
On any graded session, educators see:
  [AI Grade: 78]  [✓ Agree]  [✏️ Override → ___]  [Add Note: ___]

Overrides update the calibration dataset automatically.
This is both a product feature AND a quality measurement tool.
```

---

## Data Logging & Audit Trail

The spec requires "robust data logging for long-term trajectory tracking."

### Event Log Schema
```python
class EventLog:
    id: UUID
    timestamp: datetime
    user_id: UUID
    event_type: str          # e.g., "scenario_started", "response_submitted",
                             #       "probe_answered", "grade_received",
                             #       "xp_earned", "level_up", "tier_change",
                             #       "h2h_match_started", "peer_review_submitted"
    payload: dict            # Full event data (scenario_id, scores, etc.)
    session_id: Optional[UUID]
```

### What Gets Logged (everything)
```
Every user action:
  - Scenario generation requests (with parameters)
  - Initial response submission (full text + timestamp)
  - Each probe question asked and student's response
  - Full grading result (all dimensions + overall)
  - XP calculations (breakdown of sources)
  - Level-ups and mastery unlock events
  - MTSS tier transitions (old tier → new tier + triggering scores)
  - Head-to-head match events (queue, match, results)
  - Peer review submissions and ratings
  - Educator overrides and calibration data

Every system action:
  - LLM calls (model, tokens, latency, cost)
  - RAG retrievals (query, chunks returned, relevance scores)
  - Atlas calls (parameters, response time)
  - Errors and retries
```

### Analytics Queries This Enables
```sql
-- Student trajectory: mastery over time per objective
-- Cohort comparison: average mastery by class/cohort
-- Scenario effectiveness: which scenarios best differentiate skill levels
-- AI grading quality: correlation with educator overrides over time
-- Engagement metrics: session frequency, time-on-task, streak data
-- MTSS movement: how many students move between tiers per week
```

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| LLM grading inconsistency | Use structured rubrics with explicit scoring criteria; few-shot examples in prompts; log all grades for analysis |
| Scenario repetition / staleness | Track generated scenario fingerprints; vary market regimes systematically; use temperature + diversity penalties |
| RAG retrieval quality | Pre-process and chunk CapMan docs carefully; test retrieval relevance before building on it |
| 4-day timeline pressure | Day 1 AI core is the critical path — if it works, everything else is standard web dev. Peer review + head-to-head are cut-able. |
| Demo without real CapMan docs | Create realistic sample trading methodology docs as stand-ins; system works the same way regardless of content |

---

## What Makes This Submission Shine

1. **The probing agent** — Most competitors will build a "submit answer, get grade" system. Ours *converses*. It asks "why?" — that's the differentiator.

2. **Grounding in firm methodology via RAG** — Not generic finance. The AI uses the firm's actual lexicon and logic. This shows you understood the business requirement, not just the tech.

3. **Objective-level MTSS tracking** — Not just "student got 72%." Instead: "student is Tier 2 because strike selection is at 45% mastery while risk management is at 82%." Granular, actionable.

4. **The gamification feels real** — XP, levels with trading-themed names, streaks, leaderboard. It's not a checkbox; it drives engagement.

5. **Clean architecture** — Modular, well-separated concerns. Easy to add new scenario types, new objectives, new game mechanics.
