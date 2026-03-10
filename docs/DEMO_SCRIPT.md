# CapMan AI — Demo Script (7 Minutes)

## Opening (30 seconds)

"CapMan is an AI training platform for options traders. The problem it solves: manual coaching doesn't scale. One educator can review maybe 20 student sessions a week in depth. CapMan automates the training loop — scenario generation, Socratic probing, and structured assessment — so educators can focus on the students who actually need help."

## Act 1: Student Experience (4 minutes)

### Scene 1: Generate a Scenario (1 min)
```
POST /api/scenarios/generate
{
  "user_id": "alex_trader",
  "difficulty": "intermediate",
  "topic_focus": "volatility"
}
```
**Talk through**: "The engine pulls real market data via FMP, selects a difficulty-appropriate market regime — in this case, maybe an IV expansion environment — retrieves relevant context from our proprietary knowledge base via RAG, and generates a unique scenario. Every student gets different market conditions."

### Scene 2: Submit a Response (30 sec)
```
POST /api/scenarios/{id}/respond
{
  "response_text": "I'd sell an iron condor on AAPL given the high IV rank..."
}
```
**Talk through**: "The student analyzes the scenario and submits their trade thesis with reasoning."

### Scene 3: Multi-Turn Probing (1.5 min)
```
POST /api/scenarios/{id}/probe
{
  "answer": "If IV spikes 20%, my vega exposure would..."
}
```
**Talk through**: "This is where it gets interesting. The AI doesn't just grade the initial response. It asks targeted follow-up questions — 'What happens to your position if IV spikes before expiry?' or 'How would you adjust if the underlying gaps down 5%?' This is Socratic method at scale. It catches memorized answers and tests genuine understanding."

### Scene 4: Structured Grade (1 min)
```
POST /api/scenarios/{id}/grade
```
**Show the response**: 6 dimension scores, strengths, areas for improvement, confidence score.

**Talk through**: "The grade isn't a single number. It's structured across 6 dimensions that map to specific learning objectives. This student scored 85 on trade thesis but only 55 on risk management — now we know exactly what to target next. The gamification layer updates their XP, checks for level-ups, and adjusts mastery scores."

## Act 2: Educator Experience (2 minutes)

### Scene 5: MTSS God View (1 min)
```
GET /api/mtss/overview
```
**Talk through**: "The educator's single screen. Every student classified into three tiers: Tier 1 is on-track, Tier 2 needs support, Tier 3 needs intensive intervention. This classification is driven by objective-level mastery scores, not just XP or grades. A student grinding easy scenarios won't show as Tier 1 if they can't handle the intermediate concepts."

### Scene 6: Student Deep Dive (30 sec)
```
GET /api/mtss/student/{alex_trader_id}
```
**Talk through**: "Click into any student. Objective-level heatmap, trend lines (improving, declining, stable), tier history. The educator knows exactly what this student struggles with and whether they're getting better or worse."

### Scene 7: Class Heatmap (30 sec)
```
GET /api/mtss/objectives
```
**Talk through**: "Class-wide view. If 60% of students are struggling with 'Risk Management,' that's a curriculum signal — the educator should run a targeted workshop. This is the data that drives pedagogical decisions."

## Closing (30 seconds)

"The result: an educator can monitor 100+ students through this dashboard. The AI handles the 1-on-1 assessment work. The educator focuses where they add the most value — targeted intervention for the students who need it most. That's the metric this project targets: student throughput per educator, 10x improvement."

## Anticipated Questions & Answers

**Q: "How accurate is the AI grading?"**
A: "The structured rubric with explicit criteria per dimension keeps it consistent. We also track confidence scores — low-confidence grades get flagged for educator review. There's an educator override path planned so corrections can calibrate the system over time."

**Q: "What if the market data is stale?"**
A: "FMP provides 15-min delayed data, which is fine for training scenarios — we're not executing live trades. The adapter pattern means switching to a real-time feed is one file change."

**Q: "How expensive is it per student?"**
A: "About $0.05-0.08 per full training session (scenario + probes + grading). LangSmith tracks every call. At 1000 sessions/month, that's $50-80 in LLM costs. Cheaper than a single hour of a human coach."

**Q: "Why not fine-tune instead of RAG?"**
A: "Three proprietary documents isn't enough to justify fine-tuning cost and iteration time. RAG lets us update the knowledge base by dropping in a new markdown file. If the document corpus grows past 50+ docs, I'd consider fine-tuning or a hybrid approach."
