# CapMan AI — Defensible Architecture Decisions

Your cheat sheet for "Why did you build it this way?" questions.

## The 30-Second Pitch

"CapMan is an AI-powered training platform for options traders. Students face realistic market scenarios — including reconstructed real historical events like the GME squeeze and COVID crash — get probed on their reasoning through multi-turn Socratic dialogue, and receive structured grades across 6-7 dimensions. Mid-scenario curveballs test real-time adaptability. Educators monitor skill progression through an MTSS dashboard that shows exactly which students are struggling and on what, without manual review."

## Why This Project Matters (The Business Story)

- **Problem**: Manual coaching doesn't scale. One educator can review maybe 20 student sessions per week in depth.
- **Solution**: AI handles the scenario generation, Socratic probing, and structured assessment. The educator focuses on the students who need help most (Tier 2/3 in MTSS).
- **Metric it targets**: Student throughput per educator. 10x more students, same quality signal.
- **Why now**: LLMs are finally good enough at domain-specific reasoning to do pedagogically sound assessment — not just "did they get the right answer" but "do they understand WHY."

## Core Architecture Decisions

### 1. FastAPI + Async Python
**What I chose**: FastAPI with async SQLAlchemy
**Why**:
- Every request involves an LLM call (1-5 seconds). Async means we don't block threads waiting for Claude to respond.
- Python is the natural choice for AI/ML workloads — the entire ecosystem (Anthropic SDK, LangChain, ChromaDB) is Python-first.
- FastAPI gives us auto-generated OpenAPI docs, type validation via Pydantic, and easy dependency injection.
**What I'd change at scale**: Add a task queue (Celery/Redis) for grading calls so they don't block the request cycle. At 1000+ concurrent users, I'd move grading to async workers.

### 2. SQLite → Postgres Migration Path
**What I chose**: SQLite with aiosqlite for MVP
**Why**:
- Zero setup, zero infra. `pip install` and you have a database.
- For an MVP with <100 concurrent users, SQLite handles it fine.
- All queries go through SQLAlchemy ORM, so swapping to Postgres is literally one line in config: change the DATABASE_URL.
**When I'd switch**: The moment you need concurrent writes from multiple workers, or when you deploy to a multi-process production environment.

### 3. Adapter Pattern for Market Data
**What I chose**: Abstract `MarketDataAdapter` with `FMPAdapter`, `MockAdapter`, `AtlasAdapter` implementations
**Why**:
- The PRD specifies Atlas for production market data, but Atlas has no public SDK yet.
- FMP (Financial Modeling Prep) gives us real options chains, stock quotes, and greeks through a REST API — same data shape Atlas would provide.
- The adapter pattern means swapping to Atlas is one file: implement `AtlasAdapter`, change the factory function. Zero changes to the scenario engine or any other code.
- MockAdapter ensures the system works even without API keys (for demos, testing, development).
**Trade-off I accepted**: FMP's options data is delayed 15min. Fine for training scenarios — we're not executing live trades.

### 4. Multi-Turn Probing (Not Single-Shot Grading)
**What I chose**: 1-3 follow-up probe questions before grading
**Why**:
- Single-shot grading rewards memorized answers. A student could paste a textbook response and score 95%.
- Multi-turn probing tests actual understanding: "You said you'd sell a put spread — what happens to your position if IV spikes 20% before expiry?"
- This is pedagogically sound (Socratic method) and produces much higher-confidence grades.
- Each probe is targeted at a gap the AI detected in the initial response.
**Trade-off**: More LLM calls per session (3-5 instead of 2). Cost is ~$0.05-0.08 per full session instead of ~$0.02. Worth it for grade quality.

### 5. RAG Pipeline with ChromaDB
**What I chose**: ChromaDB vector store with 3 proprietary CapMan documents
**Why**:
- The grading rubric and scenario generation need domain-specific knowledge (CapMan's trading methodology, not generic options theory).
- Fine-tuning a model would be expensive, slow to iterate, and overkill for 3 documents.
- RAG lets us update the knowledge base by dropping in new markdown files — no retraining.
- ChromaDB is lightweight (runs in-process, no server needed) and perfect for MVP scale.
**What I'd change at scale**: Move to a hosted vector DB (Pinecone, Weaviate) if the document corpus grows past ~50 docs or if you need multi-tenant isolation.

### 6. Structured Rubric Grading (6 Dimensions)
**What I chose**: JSON-structured grading across trade_thesis, strike_selection, structure_selection, risk_management, regime_awareness, reasoning_and_lexicon
**Why**:
- A single "score: 78" tells the student nothing. They need to know WHERE they're weak.
- The 6 dimensions map directly to the learning objectives, which feed the MTSS tier classification.
- Structured output (JSON) means we can programmatically update mastery scores, detect trends, and drive the gamification system — no parsing free-text grades.
- Each dimension has a 4-tier rubric (0-30, 31-60, 61-85, 86-100) with explicit criteria, so grading is consistent across sessions.
**Why not LLM-as-judge with a single score**: Can't drive MTSS tier classification or targeted remediation from a single number. The dimensions ARE the product.

### 7. MTSS 3-Tier Classification
**What I chose**: Tier 1 (on-track), Tier 2 (needs support), Tier 3 (intensive intervention) based on objective-level mastery
**Why**:
- MTSS is a well-established framework in education (Response to Intervention). Educators already understand it.
- Tier classification drives the "God View" dashboard — the educator's single screen for "who needs help."
- Mastery-based (not XP-based) because XP measures effort, mastery measures competence. A student grinding 100 easy scenarios shouldn't be classified as Tier 1 if they can't handle intermediate concepts.
**The algorithm**: Rolling weighted average with exponential decay on objective scores. Recent performance matters more than old performance. Trend detection (improving/declining/stable) catches students who are sliding before they hit Tier 3.

### 8. LangSmith Tracing + Cost Tracking
**What I chose**: Every LLM call wrapped with LangSmith traces + in-app SessionCostTracker
**Why**:
- LLM costs are the #1 operational expense. Without tracking, you're flying blind.
- LangSmith gives external observability: traces per call with input/output/tokens/latency.
- SessionCostTracker gives in-app cost data: "This student's session cost $0.06 across 4 LLM calls."
- Tagged by purpose (scenario_gen, probing, grading) so you can see where money goes.
**Practical impact**: If grading is 70% of cost, you know to optimize there first (smaller model, shorter prompts, cached rubric context).

### 9. OpenRouter Support
**What I chose**: Dual provider support — direct Anthropic or OpenRouter via config toggle
**Why**:
- OpenRouter provides access to multiple models through one API key.
- If Anthropic has an outage, switch to OpenRouter in one env var change.
- OpenRouter uses the same Anthropic SDK format (just different base_url), so zero code changes.
- Useful for cost optimization: test if Claude Haiku produces acceptable grades at 1/4 the cost.

### 10. Mastery-Based Unlocks (Not XP-Based)
**What I chose**: Content unlocked by objective mastery scores, not total XP
**Why**:
- XP-based unlocks reward grinding. A student could spam easy scenarios to unlock advanced content they're not ready for.
- Mastery-based unlocks ensure pedagogical progression: you can't access "Gamma Squeeze Mechanics" scenarios until you've demonstrated competence in "Core Greeks Analysis."
- This is the same principle as prerequisite courses in university — proven effective.
**The thresholds**: Intermediate content requires ≥60% mastery on 3+ foundational objectives. Advanced requires ≥70% on 5+ intermediate objectives.

## Demo Narrative (5-10 Minutes)

1. **"Meet Alex"** — Show a student profile with some XP and level progress (30 sec)
2. **Generate a scenario** — Real market data, difficulty-appropriate regime, specific learning objectives targeted (1 min)
3. **Submit a response** — Show the student's trading analysis (30 sec)
4. **Watch the probing** — AI asks a targeted follow-up question that tests real understanding (1 min)
5. **See the grade** — 6-dimension structured assessment with specific strengths and areas for improvement (1 min)
6. **XP and mastery update** — Level progress, mastery scores move, maybe an unlock (30 sec)
7. **Switch to educator view** — MTSS God View showing all students by tier, click into Alex to see their objective heatmap (1.5 min)
8. **The business story** — "An educator can now monitor 100+ students with this dashboard instead of manually reviewing sessions." (1 min)

Total: ~7 minutes, focused, each screen has a reason to exist.

## Unique Differentiators (What Makes This Stand Out)

### Historical Market Replay
- 8 curated real market events (GME squeeze, COVID crash, SVB collapse, Volmageddon, NVDA earnings, Fed pivot, AMC squeeze, Yen carry unwind)
- Real historical data from FMP fed into scenario engine WITHOUT revealing the event identity
- After grading → REVEAL: "You just traded the March 2020 COVID crash"
- Shows what actually happened + how the student's trade would have performed
- WHY: Creates a memorable learning moment. Static quizzes can't do this.

### Mid-Scenario Curveballs
- 9 curveball types across macro, company-specific, and volatility categories
- Contextually matched to the active scenario's regime and symbol
- LLM customizes the breaking event to reference the student's specific position
- Adds a 7th grading dimension: "Adaptability" — scored 0-100
- WHY: Tests what no static platform can — real-time adaptation under pressure, exactly what a trading desk demands.

## "What I'd Build Next" (Shows You've Thought Ahead)

- **Head-to-Head challenges**: Same scenario, two students, compared grades. Adds competitive engagement.
- **WebSocket live probing**: Stream LLM responses for better UX during multi-turn dialogue.
- **Educator override + calibration**: Let educators correct AI grades, feed corrections back to improve grading quality.
- **Pre-generated scenario cache**: Generate scenarios in advance during off-peak hours to reduce latency to <2s.
- **Replay event library expansion**: Community-contributed events, sector-specific replays (crypto, commodities).

## Questions You Should Be Ready For

**"Why not use GPT-4 / Gemini?"**
Claude excels at structured output and following complex rubrics. The grading system requires consistent JSON output with 6 scored dimensions — Claude's instruction-following is the best in class for this. But the architecture supports model swapping via OpenRouter if needed.

**"How does this scale?"**
Current: SQLite + single process handles ~50 concurrent users.
Next step: Postgres + async workers (Celery) handles ~500.
Production: Add Redis caching for RAG results, pre-generate scenario pools, move grading to background workers. Handles 5000+.

**"What if the AI grades incorrectly?"**
Three safeguards: (1) Structured rubric with explicit criteria reduces variance, (2) Confidence scores flag low-certainty grades for educator review, (3) Educator override capability feeds corrections back for calibration. This is why MTSS uses rolling weighted averages — one bad grade doesn't tank a student's tier.

**"Why not a React frontend?"**
It's on the roadmap (Day 2-3 of the sprint). The API-first approach means the backend is fully testable and demoable via Swagger UI right now. Frontend is presentation — the intelligence lives in the API.
