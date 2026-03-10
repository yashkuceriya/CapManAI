"""CapMan AI — End-to-End Test Script.

Run this AFTER starting the server:
    uvicorn app.main:app --reload

Usage:
    python test_full_flow.py [--base-url http://localhost:8000]

Tests the complete training loop:
1. Health check
2. Generate scenario → get session_id
3. Submit response → get first probe
4. Answer probe → get next probe or ready_for_grading
5. Grade session → check XP, dimension scores
6. Historical Replay flow (generate → respond → grade → reveal)
7. Curveball flow (generate → respond → inject curveball → adapt → grade)
8. MTSS overview + student detail
9. Leaderboard + user profile
"""
import sys
import json
import httpx
import asyncio
from datetime import datetime

BASE_URL = "http://localhost:8000"
PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
WARN = "\033[93m⚠\033[0m"


class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.errors = []

    def ok(self, name, detail=""):
        self.passed += 1
        print(f"  {PASS} {name}" + (f"  ({detail})" if detail else ""))

    def fail(self, name, detail=""):
        self.failed += 1
        self.errors.append(f"{name}: {detail}")
        print(f"  {FAIL} {name}" + (f"  ({detail})" if detail else ""))

    def warn(self, name, detail=""):
        self.warnings += 1
        print(f"  {WARN} {name}" + (f"  ({detail})" if detail else ""))

    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"Results: {self.passed}/{total} passed, {self.failed} failed, {self.warnings} warnings")
        if self.errors:
            print(f"\nFailures:")
            for e in self.errors:
                print(f"  - {e}")
        return self.failed == 0


async def run_tests():
    results = TestResults()
    client = httpx.AsyncClient(base_url=BASE_URL, timeout=60.0)

    # ─── 1. Health + Root ─────────────────────────────────
    print("\n[1] Health & Root")
    try:
        r = await client.get("/health")
        if r.status_code == 200:
            data = r.json()
            if data.get("status") == "healthy":
                results.ok("GET /health")
            else:
                results.fail("GET /health", f"body={data}")
        else:
            results.fail("GET /health", f"status={r.status_code} body={r.text[:200]}")
            print("\n  Server not running? Start with: cd backend && uvicorn app.main:app --reload\n")
            return results.summary()
    except Exception as e:
        results.fail("GET /health", str(e))
        print("\n  Server not running? Start with: cd backend && uvicorn app.main:app --reload\n")
        return results.summary()

    r = await client.get("/")
    if r.status_code != 200:
        results.fail("GET / — root", f"status={r.status_code}")
    else:
        data = r.json()
        if "features" in data and len(data["features"]) >= 6:
            results.ok("GET / — root", f"{len(data['features'])} features listed")
        else:
            results.fail("GET / — root", "missing features list")

    # ─── 2. User Profile ──────────────────────────────────
    print("\n[2] User Profile")
    # No auth: API falls back to demo-user
    r = await client.get("/api/users/me")
    if r.status_code == 200:
        user = r.json()
        results.ok("GET /api/users/me", f"user={user.get('username')}, xp={user.get('xp')}")
    else:
        results.fail("GET /api/users/me", f"status={r.status_code}, body={r.text[:200]}")

    # ─── 3. Generate Scenario ─────────────────────────────
    print("\n[3] Standard Scenario Flow")
    r = await client.post("/api/scenarios/generate", json={
        "difficulty": "beginner",
    })
    if r.status_code != 200:
        results.fail("POST /generate", f"status={r.status_code}, body={r.text[:300]}")
        return results.summary()

    scenario = r.json()
    session_id = scenario.get("session_id")
    if session_id and scenario.get("context_prompt"):
        results.ok("POST /generate", f"session_id={session_id[:12]}...")
    else:
        results.fail("POST /generate", "missing session_id or context_prompt")
        return results.summary()

    print(f"     Regime: {scenario.get('market_regime')}")
    print(f"     Objectives: {scenario.get('learning_objectives')}")
    print(f"     Prompt length: {len(scenario.get('context_prompt', ''))} chars")

    # ─── 4. Submit Response ───────────────────────────────
    student_response = (
        "Looking at this scenario, I'd go with a bear put spread on the stock. "
        "The IV rank is elevated which means I want to be a net seller of premium, "
        "but I still want directional exposure. I'd buy the ATM put and sell the "
        "25-delta put one strike below. Position size would be 2% of portfolio, "
        "max loss is the net debit. I'd set a time stop at 50% of DTE remaining "
        "and a profit target at 50% of max profit. The regime looks bearish with "
        "rising vol, so puts are the right vehicle here. Exit if thesis invalidated "
        "by a break above the 20-day SMA."
    )
    r = await client.post(f"/api/scenarios/{session_id}/respond", json={
        "response_text": student_response,
    })
    if r.status_code == 200:
        resp = r.json()
        probe = resp.get("probe", {})
        if probe and probe.get("probe_question"):
            results.ok("POST /respond", f"probe: '{probe['probe_question'][:80]}...'")
        else:
            results.warn("POST /respond", "no probe returned (might be ok)")
    else:
        results.fail("POST /respond", f"status={r.status_code}, body={r.text[:300]}")

    # ─── 5. Answer Probe ──────────────────────────────────
    r = await client.post(f"/api/scenarios/{session_id}/probe", json={
        "answer_text": (
            "The short leg delta is around 0.25 which gives roughly 75% probability of "
            "expiring OTM. On the ATM put, delta is 0.50 so the net delta is about -0.25 "
            "per spread. For a $100k portfolio, 2% risk is $2,000 max loss. If the spread "
            "is $5 wide and costs $2.50 debit, I'd do 8 contracts ($2,000 / $250 per contract). "
            "Theta decay works for me on the short leg. Vega is net short since the far OTM "
            "short put has lower vega, so an IV crush helps slightly."
        ),
    })
    if r.status_code == 200:
        resp = r.json()
        if resp.get("probe"):
            results.ok("POST /probe (1)", f"next probe: '{resp['probe']['probe_question'][:60]}...'")
        elif resp.get("ready_for_grading"):
            results.ok("POST /probe (1)", "ready for grading")
        else:
            results.ok("POST /probe (1)", f"status={resp.get('status')}")
    else:
        results.fail("POST /probe (1)", f"status={r.status_code}")

    # ─── 6. Grade Session ─────────────────────────────────
    print("\n[4] Grading")
    r = await client.post(f"/api/scenarios/{session_id}/grade")
    if r.status_code == 200:
        grade = r.json()
        g = grade.get("grade", {})
        results.ok("POST /grade", f"score={g.get('overall_score')}, confidence={g.get('confidence')}")
        xp = grade.get("xp_earned", {})
        results.ok("XP calculation", f"total={xp.get('total', 'N/A')}, breakdown={json.dumps({k:v for k,v in xp.items() if k != 'total'})}")

        dims = g.get("dimension_scores", [])
        if len(dims) >= 6:
            results.ok(f"Dimension scores ({len(dims)} dims)")
            for d in dims:
                print(f"       {d.get('dimension')}: {d.get('score')}")
        else:
            results.warn("Dimension scores", f"only {len(dims)} dims (expected 6)")
    else:
        results.fail("POST /grade", f"status={r.status_code}, body={r.text[:300]}")

    # ─── 7. Historical Replay ─────────────────────────────
    print("\n[5] Historical Market Replay")
    r = await client.get("/api/scenarios/replay/events")
    if r.status_code == 200:
        events = r.json()
        results.ok("GET /replay/events", f"{events.get('total', 0)} events available")
    else:
        results.fail("GET /replay/events", f"status={r.status_code}")

    r = await client.post("/api/scenarios/replay", json={
        "difficulty": "intermediate",
        "event_id": "nvda_earnings_2024",
    })
    replay_session_id = None
    if r.status_code == 200:
        replay = r.json()
        replay_session_id = replay.get("session_id")
        results.ok("POST /replay", f"session_id={replay_session_id[:12]}..., is_replay={replay.get('is_replay')}")
    else:
        results.fail("POST /replay", f"status={r.status_code}, body={r.text[:300]}")

    if replay_session_id:
        # Submit response + grade to unlock reveal
        await client.post(f"/api/scenarios/{replay_session_id}/respond", json={
            "response_text": "I'd sell a put credit spread below support. IV is elevated pre-earnings so I want to be short premium. The implied move is 11% but I think it overshoots. Short the 30-delta put, buy the 15-delta as protection.",
        })
        r = await client.post(f"/api/scenarios/{replay_session_id}/grade")
        if r.status_code == 200:
            grade_resp = r.json()
            reveal = grade_resp.get("replay_reveal")
            if reveal:
                results.ok("Replay reveal", f"event: {reveal.get('event_name', 'N/A')}")
            else:
                results.warn("Replay reveal", "no reveal in grade response")
        else:
            results.fail("Replay grade", f"status={r.status_code}")

        # Also test the reveal endpoint
        r = await client.get(f"/api/scenarios/{replay_session_id}/reveal")
        if r.status_code == 200:
            rev = r.json()
            results.ok("GET /reveal", f"message: {rev.get('message', 'N/A')[:80]}")
        else:
            results.warn("GET /reveal", f"status={r.status_code} (might need graded status)")

    # ─── 8. Curveball Flow ────────────────────────────────
    print("\n[6] Mid-Scenario Curveball")
    r = await client.post("/api/scenarios/generate", json={"difficulty": "intermediate"})
    if r.status_code == 200:
        cb_scenario = r.json()
        cb_session_id = cb_scenario.get("session_id")

        # Submit initial response
        await client.post(f"/api/scenarios/{cb_session_id}/respond", json={
            "response_text": "I'm going long a straddle here. IV is low and I expect a move. Buying ATM call and put, risking the premium.",
        })

        # Inject curveball
        r = await client.post(f"/api/scenarios/{cb_session_id}/curveball")
        if r.status_code == 200:
            cb = r.json()
            results.ok("POST /curveball", f"type={cb['curveball']['type']}, severity={cb['curveball']['severity']}")
            print(f"     Headline: {cb['curveball']['headline'][:100]}")

            # Submit adaptation
            r = await client.post(f"/api/scenarios/{cb_session_id}/adapt", json={
                "adaptation_text": "Given the breaking event, I need to adjust. My straddle is now directionally exposed. I'll close the call leg and add to the put position. The new risk is defined by the put premium. I need to reassess my max loss.",
            })
            if r.status_code == 200:
                results.ok("POST /adapt", f"status={r.json().get('status')}")
            else:
                results.fail("POST /adapt", f"status={r.status_code}")

            # Grade with adaptability
            r = await client.post(f"/api/scenarios/{cb_session_id}/grade")
            if r.status_code == 200:
                grade = r.json()
                cb_result = grade.get("curveball_result")
                if cb_result:
                    results.ok("Curveball grading", f"adaptability_score={cb_result.get('adaptability_score')}")
                else:
                    results.warn("Curveball grading", "no curveball_result in grade response")
            else:
                results.fail("Curveball grade", f"status={r.status_code}")
        else:
            results.fail("POST /curveball", f"status={r.status_code}, body={r.text[:300]}")
    else:
        results.fail("Generate for curveball", f"status={r.status_code}")

    # ─── 9. MTSS Dashboard ────────────────────────────────
    print("\n[7] MTSS Educator Dashboard")
    r = await client.get("/api/mtss/overview")
    if r.status_code == 200:
        mtss = r.json()
        results.ok("GET /mtss/overview", f"total_students={mtss.get('total_students')}, "
                    f"tier1={mtss['tier1']['count']}, tier2={mtss['tier2']['count']}, tier3={mtss['tier3']['count']}")
    else:
        results.fail("GET /mtss/overview", f"status={r.status_code}")

    r = await client.get("/api/mtss/student/demo-user")
    if r.status_code == 200:
        detail = r.json()
        results.ok("GET /mtss/student/demo-user", f"tier={detail.get('classification', {}).get('tier')}")
    else:
        results.fail("GET /mtss/student", f"status={r.status_code}")

    r = await client.get("/api/mtss/objectives")
    if r.status_code == 200:
        results.ok("GET /mtss/objectives (heatmap)", f"{len(r.json().get('heatmap', []))} objectives")
    else:
        results.fail("GET /mtss/objectives", f"status={r.status_code}")

    r = await client.get("/api/mtss/alerts")
    if r.status_code == 200:
        results.ok("GET /mtss/alerts", f"{len(r.json().get('alerts', []))} alerts")
    else:
        results.fail("GET /mtss/alerts", f"status={r.status_code}")

    # ─── 10. Leaderboard ──────────────────────────────────
    print("\n[8] Leaderboard")
    for mode in ["xp", "volume", "mastery"]:
        r = await client.get("/api/users/leaderboard", params={"mode": mode})
        if r.status_code == 200:
            entries = r.json().get("entries", [])
            results.ok(f"GET /leaderboard?mode={mode}", f"{len(entries)} entries")
        else:
            results.fail(f"GET /leaderboard?mode={mode}", f"status={r.status_code}")

    # ─── 11. User Profile After Grading ───────────────────
    print("\n[9] Post-Grade Verification")
    # No auth: API falls back to demo-user
    r = await client.get("/api/users/me")
    if r.status_code == 200:
        user = r.json()
        results.ok("User XP updated", f"xp={user.get('xp')}, level={user.get('level_info', {}).get('level_name')}, "
                    f"scenarios={user.get('scenarios_completed')}, streak={user.get('streak_days')}")
    else:
        results.fail("Post-grade user check", f"status={r.status_code}")

    # ─── Summary ──────────────────────────────────────────
    await client.aclose()
    return results.summary()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].startswith("--base-url"):
        if "=" in sys.argv[1]:
            BASE_URL = sys.argv[1].split("=")[1]
        elif len(sys.argv) > 2:
            BASE_URL = sys.argv[2]

    print(f"{'='*60}")
    print(f"  CapMan AI — End-to-End Test Suite")
    print(f"  Target: {BASE_URL}")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")

    success = asyncio.run(run_tests())
    sys.exit(0 if success else 1)
