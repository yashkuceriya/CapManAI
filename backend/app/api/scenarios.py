"""Scenario generation, training session, replay, and curveball API routes."""
import json as _json
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from typing import Optional

# Message returned when LLM or external service (e.g. RAG, market data) fails
LLM_UNAVAILABLE_MSG = (
    "Scenario or grading service is temporarily unavailable. "
    "Please try again in a moment. If the problem persists, check your API key and network."
)

from app.core.database import get_db
from app.core.auth import get_current_user, get_optional_user
from app.models.database_models import Scenario, ScenarioSession, User, UserObjectiveProgress
from app.models.schemas import (
    ScenarioGenerateRequest, ScenarioResponse, StudentResponseSubmit,
    ProbeResponse, StudentProbeAnswer, GradeResult, DimensionScore,
    SessionStatus, ReplayGenerateRequest, ReplayRevealResponse,
    CurveballResponse, CurveballAdaptRequest,
)
from app.agents.scenario_engine import ScenarioEngine, strip_watermarks_for_llm
from app.agents.grading_agent import ProbingGradingAgent
from app.agents.replay_engine import ReplayEngine, HISTORICAL_EVENTS
from app.agents.curveball_engine import CurveballEngine
from app.services.gamification import GamificationEngine
from app.services.mtss import MTSSEngine
from app.services.event_logger import EventLogger

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])

scenario_engine = ScenarioEngine()
grading_agent = ProbingGradingAgent()
replay_engine = ReplayEngine()
curveball_engine = CurveballEngine()
gamification = GamificationEngine()
mtss_engine = MTSSEngine()


# ────────────────────────────────────────────────────────────────
# Standard Scenario Flow
# ────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=ScenarioResponse)
async def generate_scenario(
    request: ScenarioGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new dynamic trading scenario."""
    user_id, user = current_user.id, current_user

    try:
        result = await scenario_engine.generate_scenario(
            difficulty=request.difficulty.value,
            market_regime=request.market_regime,
            target_objectives=request.target_objectives,
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=LLM_UNAVAILABLE_MSG,
        ) from e

    scenario, session = await _create_scenario_and_session(
        db, user_id, result, is_replay=False, event_type="scenario_generated"
    )

    return ScenarioResponse(
        id=scenario.id,
        session_id=session.id,
        market_regime=scenario.market_regime,
        asset_class=scenario.asset_class,
        difficulty=scenario.difficulty,
        context_prompt=scenario.context_prompt,
        market_data=scenario.market_data,
        learning_objectives=scenario.learning_objectives,
        is_replay=False,
        created_at=scenario.created_at,
    )


# ────────────────────────────────────────────────────────────────
# Streaming Scenario Generation (SSE)
# ────────────────────────────────────────────────────────────────

@router.post("/generate/stream")
async def generate_scenario_stream(
    request: ScenarioGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream scenario generation via Server-Sent Events.

    Emits a sequence of SSE events:
      data: {"type": "text_delta", "text": "..."}   — one per token in scenario_text
      data: {"type": "scenario_complete", "scenario": {...}}  — final structured scenario
      data: [DONE]

    The frontend can render the scenario_text live as it arrives, then switch to the
    full ScenarioCard once scenario_complete fires.
    """
    user_id, user = current_user.id, current_user

    async def event_gen():
        try:
            async for event in scenario_engine.generate_scenario_stream(
                difficulty=request.difficulty.value,
                market_regime=request.market_regime,
                target_objectives=request.target_objectives,
            ):
                if event["type"] == "progress":
                    yield f"data: {_json.dumps(event)}\n\n"

                elif event["type"] == "text_delta":
                    yield f"data: {_json.dumps(event)}\n\n"

                elif event["type"] == "scenario_complete":
                    # Persist the scenario + session records, then attach their IDs
                    scenario_rec, session_rec = await _create_scenario_and_session(
                        db, user_id, event["scenario"],
                        is_replay=False, event_type="scenario_generated",
                    )
                    # ── CRITICAL: commit immediately so the session exists in DB
                    # before the client receives the session_id. Without this,
                    # the /respond endpoint may not find the session (race condition
                    # with get_db() cleanup on StreamingResponse). ──
                    await db.commit()
                    logger.info("SSE: committed scenario=%s session=%s",
                                scenario_rec.id, session_rec.id)

                    event["scenario"]["id"] = scenario_rec.id
                    event["scenario"]["session_id"] = session_rec.id
                    yield f"data: {_json.dumps(event)}\n\n"
                    yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {_json.dumps({'type': 'error', 'detail': LLM_UNAVAILABLE_MSG})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # prevent nginx from buffering the stream
        },
    )


# ────────────────────────────────────────────────────────────────
# Historical Market Replay
# ────────────────────────────────────────────────────────────────

@router.post("/replay", response_model=ScenarioResponse)
async def generate_replay_scenario(
    request: ReplayGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a scenario from a REAL historical market event.

    The student doesn't know which event it is until after grading.
    """
    user_id, user = current_user.id, current_user

    if request.event_id is not None and request.event_id not in HISTORICAL_EVENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid event_id. Choose from: {list(HISTORICAL_EVENTS.keys())}",
        )

    try:
        result = await replay_engine.generate_replay_scenario(
            event_id=request.event_id,
            difficulty=request.difficulty.value,
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Replay generation failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=503,
            detail=f"{LLM_UNAVAILABLE_MSG} (Debug: {type(e).__name__}: {str(e)[:200]})",
        ) from e

    scenario, session = await _create_scenario_and_session(
        db, user_id, result, is_replay=True, event_type="replay_scenario_generated"
    )

    # Return WITHOUT the reveal — student sees a normal scenario
    return ScenarioResponse(
        id=scenario.id,
        session_id=session.id,
        market_regime=scenario.market_regime,
        asset_class=scenario.asset_class,
        difficulty=scenario.difficulty,
        context_prompt=scenario.context_prompt,
        market_data=scenario.market_data,
        learning_objectives=scenario.learning_objectives,
        is_replay=True,  # Frontend can show a subtle "Historical Replay" badge
        created_at=scenario.created_at,
    )


@router.get("/replay/events")
async def list_replay_events(
    difficulty: Optional[str] = Query(None, description="Filter by difficulty"),
):
    """List all available historical replay events (for educators/admins)."""
    return {
        "events": ReplayEngine.list_available_events(difficulty),
        "total": len(HISTORICAL_EVENTS),
    }


@router.get("/{session_id}/reveal")
async def get_replay_reveal(
    session_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the historical event reveal AFTER the session is graded.

    This is the 'You just traded the SVB collapse' moment.
    Only available after grading is complete.
    """
    session = await db.get(ScenarioSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify ownership if authenticated
    if current_user and session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    if session.status not in ("graded", "reviewed"):
        raise HTTPException(
            status_code=400,
            detail="Reveal is only available after grading. Complete the session first."
        )

    scenario = await db.get(Scenario, session.scenario_id)
    if not scenario or not scenario.is_replay:
        raise HTTPException(status_code=400, detail="This is not a replay scenario")

    reveal = scenario.replay_reveal
    if not reveal:
        raise HTTPException(status_code=404, detail="No reveal data found")

    return {
        "reveal": reveal,
        "your_score": session.overall_score,
        "your_thesis_summary": session.initial_response[:500] if session.initial_response else "",
        "message": f"This actually happened on {reveal.get('date', 'N/A')}: {reveal.get('event_name', 'Historical Event')}",
    }


# ────────────────────────────────────────────────────────────────
# Mid-Scenario Curveball
# ────────────────────────────────────────────────────────────────

@router.post("/{session_id}/curveball")
async def inject_curveball(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Inject a breaking event mid-scenario.

    Must be called AFTER the student submits their initial response
    but BEFORE final grading. This adds a 7th grading dimension: Adaptability.
    """
    session = await db.get(ScenarioSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    if session.status not in ("in_progress", "probing"):
        raise HTTPException(
            status_code=400,
            detail="Curveball can only be injected during an active session (before grading)"
        )

    if session.curveball_injected:
        raise HTTPException(status_code=400, detail="Curveball already injected for this session")

    if not session.initial_response:
        raise HTTPException(
            status_code=400,
            detail="Student must submit an initial response before a curveball can be injected"
        )

    scenario = await db.get(Scenario, session.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Extract current price from market data
    market_data = scenario.market_data or {}
    current_price = market_data.get("quote", {}).get("price", 0)

    try:
        curveball = await curveball_engine.generate_curveball(
            scenario_context=strip_watermarks_for_llm(scenario.context_prompt),
            student_response=session.initial_response,
            market_regime=scenario.market_regime,
            symbol=market_data.get("symbol", "SPY"),
            current_price=current_price,
            difficulty=scenario.difficulty,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=LLM_UNAVAILABLE_MSG) from e

    # Add curveball to conversation history
    conversation = session.conversation or []
    conversation.append({
        "role": "curveball",
        "content": curveball["customized_context"],
        "timestamp": datetime.utcnow().isoformat(),
        "headline": curveball["headline"],
        "severity": curveball["severity"],
    })
    conversation.append({
        "role": "agent",
        "content": curveball["probing_angle"],
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Update session
    session.curveball_injected = True
    session.curveball_id = curveball["curveball_id"]
    session.curveball_data = curveball
    session.conversation = conversation
    session.status = "probing"
    flag_modified(session, "conversation")
    flag_modified(session, "curveball_data")

    # Log event
    evt_logger = EventLogger(db)
    await evt_logger.log(session.user_id, "curveball_injected", {
        "session_id": session_id,
        "curveball_id": curveball["curveball_id"],
        "type": curveball["type"],
        "severity": curveball["severity"],
    }, session_id=session_id)

    await db.flush()

    return {
        "session_id": session_id,
        "curveball": {
            "id": curveball["curveball_id"],
            "type": curveball["type"],
            "severity": curveball["severity"],
            "headline": curveball["headline"],
            "context": curveball["customized_context"],
            "market_impact": curveball["market_impact"],
            "data_update": curveball["data_update"],
        },
        "prompt": curveball["probing_angle"],
        "message": "Breaking event injected. The student must now adapt their thesis.",
    }


@router.post("/{session_id}/adapt")
async def submit_adaptation(
    session_id: str,
    request: CurveballAdaptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit the student's adapted thesis after a curveball event."""
    session = await db.get(ScenarioSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    if not session.curveball_injected:
        raise HTTPException(status_code=400, detail="No curveball was injected in this session")

    # Add adaptation to conversation
    conversation = session.conversation or []
    conversation.append({
        "role": "adaptation",
        "content": request.adaptation_text,
        "timestamp": datetime.utcnow().isoformat(),
    })

    session.conversation = conversation
    session.curveball_response = request.adaptation_text
    flag_modified(session, "conversation")

    # Log event
    evt_logger = EventLogger(db)
    await evt_logger.log(session.user_id, "curveball_adaptation_submitted", {
        "session_id": session_id,
        "adaptation_length": len(request.adaptation_text),
    }, session_id=session_id)

    await db.flush()

    return {
        "session_id": session_id,
        "status": "ready_for_grading",
        "message": "Adaptation received. Session is now ready for grading with the Adaptability dimension.",
    }


# ────────────────────────────────────────────────────────────────
# Core Training Flow (respond -> probe -> grade)
# ────────────────────────────────────────────────────────────────

@router.post("/{session_id}/respond")
async def submit_response(
    session_id: str,
    request: StudentResponseSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit initial response to a scenario. Returns first probe question."""
    logger.info("POST /respond — session_id=%s", session_id)
    session = await db.get(ScenarioSession, session_id)
    if not session:
        logger.error("Session not found: %s", session_id)
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    scenario = await db.get(Scenario, session.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Update session with initial response
    conversation = session.conversation or []
    conversation.append({
        "role": "student",
        "content": request.response_text,
        "timestamp": datetime.utcnow().isoformat(),
    })
    session.initial_response = request.response_text
    session.conversation = conversation
    session.status = "probing"

    # Persist student response BEFORE LLM call — so it's never lost on failure
    flag_modified(session, "conversation")
    await db.flush()

    # Log event
    evt_logger = EventLogger(db)
    await evt_logger.log(session.user_id, "response_submitted", {
        "session_id": session_id,
        "response_length": len(request.response_text),
    }, session_id=session_id)

    try:
        probe = await grading_agent.generate_probes(
            scenario_context=strip_watermarks_for_llm(scenario.context_prompt),
            student_response=request.response_text,
            conversation_history=conversation,
            probe_number=1,
        )
    except Exception as e:
        # Session is already persisted — student won't lose their response
        raise HTTPException(status_code=503, detail=LLM_UNAVAILABLE_MSG) from e

    if probe:
        conversation.append({
            "role": "agent",
            "content": probe["probe_question"],
            "timestamp": datetime.utcnow().isoformat(),
        })
        session.conversation = conversation
        session.probe_count = 1

    # SQLAlchemy won't detect mutations inside JSON columns — force it
    flag_modified(session, "conversation")
    await db.flush()

    return {
        "session_id": session_id,
        "status": "probing",
        "probe": probe,
        "curveball_eligible": True,  # Frontend can show "inject curveball" button
    }


@router.post("/{session_id}/probe")
async def answer_probe(
    session_id: str,
    request: StudentProbeAnswer,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Answer a probe question. Returns next probe or triggers grading."""
    logger.info("POST /probe — session_id=%s", session_id)
    session = await db.get(ScenarioSession, session_id)
    if not session:
        logger.error("Session not found for probe: %s", session_id)
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    scenario = await db.get(Scenario, session.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Add student's probe answer to conversation
    conversation = session.conversation or []
    conversation.append({
        "role": "student",
        "content": request.answer_text,
        "timestamp": datetime.utcnow().isoformat(),
    })
    session.conversation = conversation

    # Persist probe answer BEFORE LLM call — so it's never lost on failure
    flag_modified(session, "conversation")
    await db.flush()

    next_probe_num = (session.probe_count or 0) + 1

    try:
        probe = await grading_agent.generate_probes(
            scenario_context=strip_watermarks_for_llm(scenario.context_prompt),
            student_response=session.initial_response,
            conversation_history=conversation,
            probe_number=next_probe_num,
        )
    except Exception as e:
        # Session is already persisted — student won't lose their answer
        raise HTTPException(status_code=503, detail=LLM_UNAVAILABLE_MSG) from e

    if probe:
        conversation.append({
            "role": "agent",
            "content": probe["probe_question"],
            "timestamp": datetime.utcnow().isoformat(),
        })
        # Don't count clarifications — students can ask questions freely
        if not probe.get("is_clarification", False):
            session.probe_count = next_probe_num
        session.conversation = conversation
        flag_modified(session, "conversation")
        await db.flush()

        return {
            "session_id": session_id,
            "status": "probing",
            "probe": probe,
            "ready_for_grading": False,
            "curveball_eligible": not session.curveball_injected,
        }
    else:
        # No more probes — ready for grading
        session.conversation = conversation
        flag_modified(session, "conversation")
        await db.flush()

        return {
            "session_id": session_id,
            "status": "ready_for_grading",
            "probe": None,
            "ready_for_grading": True,
            "curveball_eligible": not session.curveball_injected,
            "curveball_active": session.curveball_injected,
        }


@router.post("/{session_id}/grade")
async def grade_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger final grading of the complete session.

    If a curveball was injected, grading includes the 7th Adaptability dimension.
    If this is a replay scenario, the response includes the reveal data.
    """
    logger.info("POST /grade — session_id=%s", session_id)
    session = await db.get(ScenarioSession, session_id)
    if not session:
        logger.error("Session not found for grading: %s", session_id)
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    scenario = await db.get(Scenario, session.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    user = await db.get(User, session.user_id)

    try:
        grade = await grading_agent.grade_session(
            scenario_context=strip_watermarks_for_llm(scenario.context_prompt),
            expected_analysis=scenario.expected_analysis or "",
            conversation_history=session.conversation or [],
            curveball_active=session.curveball_injected or False,
            curveball_data=session.curveball_data if session.curveball_injected else None,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=LLM_UNAVAILABLE_MSG) from e

    # Calculate XP (bonus for curveball sessions)
    xp_result = gamification.calculate_xp(
        overall_score=grade["overall_score"],
        streak_days=user.streak_days if user else 0,
    )

    # Curveball XP bonus: +25 XP for completing a curveball session
    if session.curveball_injected:
        curveball_bonus = 25
        xp_result["curveball_bonus"] = curveball_bonus
        xp_result["total"] += curveball_bonus

    # Update session with grade
    session.overall_score = grade["overall_score"]
    session.dimension_scores = grade["dimension_scores"]
    session.strengths = grade["strengths"]
    session.areas_for_improvement = grade["areas_for_improvement"]
    session.reasoning_quality = grade["reasoning_quality"]
    session.capman_lexicon_usage = grade["capman_lexicon_usage"]
    session.grade_confidence = grade["confidence"]
    session.xp_earned = xp_result["total"]
    session.status = "graded"
    session.completed_at = datetime.utcnow()

    # Store adaptability score if curveball was active
    if session.curveball_injected and "adaptability_score" in grade:
        session.adaptability_score = grade["adaptability_score"]

    # Update user XP and level
    if user:
        user.xp += xp_result["total"]
        user.scenarios_completed += 1
        level_info = gamification.calculate_level(user.xp)
        user.level = level_info["level"]

        # Update streak
        streak_info = gamification.update_streak(user.last_active_date, user.streak_days)
        user.streak_days = streak_info["streak_days"]
        user.last_active_date = streak_info["last_active_date"]

        # Update objective progress
        await _update_objective_progress(db, user.id, scenario.learning_objectives, grade)

        # Reclassify MTSS tier
        progress = await _get_user_objective_progress(db, user.id)
        classification = mtss_engine.classify_student(progress)
        old_tier = user.current_tier
        user.current_tier = classification["tier"]

        # Log tier transition if changed (feeds /api/mtss/alerts)
        if old_tier != classification["tier"]:
            tier_alert = mtss_engine.generate_tier_transition_alert(
                user_id=user.id,
                username=user.username,
                old_tier=old_tier,
                new_tier=classification["tier"],
                reason=classification["reason"],
            )
            if tier_alert:
                tier_logger = EventLogger(db)
                await tier_logger.log(user.id, "tier_change", tier_alert, session_id=session_id)

    # Log event
    evt_logger = EventLogger(db)
    await evt_logger.log(session.user_id, "grade_received", {
        "session_id": session_id,
        "overall_score": grade["overall_score"],
        "xp_earned": xp_result["total"],
        "xp_breakdown": xp_result,
        "curveball_active": session.curveball_injected or False,
        "is_replay": scenario.is_replay or False,
        "adaptability_score": grade.get("adaptability_score"),
    }, session_id=session_id)

    await db.flush()

    # Build response
    response = {
        "session_id": session_id,
        "grade": grade,
        "xp_earned": xp_result,
        "level_info": gamification.calculate_level(user.xp) if user else None,
    }

    # If this is a replay scenario, include the reveal
    if scenario.is_replay and scenario.replay_reveal:
        response["replay_reveal"] = {
            **scenario.replay_reveal,
            "message": f"You just traded the {scenario.replay_reveal.get('event_name', 'a historical event')}!",
        }

    # If curveball was active, highlight the adaptability score
    if session.curveball_injected and "adaptability_score" in grade:
        response["curveball_result"] = {
            "adaptability_score": grade["adaptability_score"],
            "curveball_type": session.curveball_id,
            "message": "Curveball session — your adaptability was tested!",
        }

    return response


# ────────────────────────────────────────────────────────────────
# Helper Functions
# ────────────────────────────────────────────────────────────────

async def _create_scenario_and_session(
    db: AsyncSession,
    user_id: str,
    result: dict,
    is_replay: bool = False,
    event_type: str = "scenario_generated",
) -> tuple[Scenario, ScenarioSession]:
    """Create Scenario + ScenarioSession from engine result. Returns (scenario, session)."""
    scenario = Scenario(
        market_regime=result["market_regime"],
        asset_class=result["asset_class"],
        difficulty=result["difficulty"],
        context_prompt=result["context_prompt"],
        market_data=result["market_data"],
        learning_objectives=result["learning_objectives"],
        expected_analysis=result.get("expected_analysis", ""),
        fingerprint=result.get("fingerprint"),
        is_replay=is_replay,
        replay_event_id=result.get("replay_event_id"),
        replay_reveal=result.get("replay_reveal"),
    )
    db.add(scenario)
    await db.flush()

    session = ScenarioSession(
        user_id=user_id,
        scenario_id=scenario.id,
        status="in_progress",
        conversation=[],
    )
    db.add(session)
    await db.flush()

    evt_logger = EventLogger(db)
    await evt_logger.log(user_id, event_type, {
        "scenario_id": scenario.id,
        "session_id": session.id,
        "difficulty": result["difficulty"],
        "regime": result["market_regime"],
        **({"replay_event_id": result["replay_event_id"]} if is_replay else {"objectives": result["learning_objectives"]}),
    }, session_id=session.id)

    return scenario, session


async def _update_objective_progress(db: AsyncSession, user_id: str, objectives: list, grade: dict):
    """Update per-objective mastery after a grading event."""
    dimension_map = {}
    for dim in grade.get("dimension_scores", []):
        dim_name = dim.get("dimension", "").lower().replace(" ", "_")
        dimension_map[dim_name] = dim.get("score", 50)

    # Map learning objectives → grading dimensions for score attribution.
    # Every objective from LEARNING_OBJECTIVES must be covered here.
    obj_to_dim = {
        # Core Trade Construction
        "trade_thesis": "trade_thesis",
        "strike_selection": "strike_selection",
        "structure_selection": "structure_selection",
        # Risk Management
        "risk_management": "risk_management",
        "exit_strategy": "risk_management",
        "portfolio_management": "risk_management",
        # Volatility
        "iv_analysis": "regime_awareness",
        "realized_vol": "regime_awareness",
        "vol_regime": "regime_awareness",
        # Greeks
        "greeks_understanding": "risk_management",
        "higher_order_greeks": "risk_management",
        # Market Analysis
        "regime_awareness": "regime_awareness",
        "order_flow": "regime_awareness",
        "event_driven": "trade_thesis",
        "sentiment_analysis": "regime_awareness",
        "macro_awareness": "regime_awareness",
        # Advanced
        "tail_risk": "risk_management",
        "gamma_mechanics": "regime_awareness",
        "correlation_rv": "regime_awareness",
        # New objectives (Vol Framework §9, §13-19)
        "technical_analysis": "regime_awareness",
        "interest_rate_vol": "regime_awareness",
        "seasonality": "regime_awareness",
        "fundamental_analysis": "trade_thesis",
        "commodity_vol": "regime_awareness",
        "crypto_vol": "regime_awareness",
        "microstructure": "regime_awareness",
        "geopolitical_alt": "regime_awareness",
    }

    for obj_id in objectives:
        dim_key = obj_to_dim.get(obj_id, "reasoning_and_lexicon")
        score = dimension_map.get(dim_key, grade.get("overall_score", 50))

        result = await db.execute(
            select(UserObjectiveProgress).where(
                UserObjectiveProgress.user_id == user_id,
                UserObjectiveProgress.objective_id == obj_id,
            )
        )
        progress = result.scalar_one_or_none()

        if progress:
            update = mtss_engine.update_objective_mastery(
                current_score=progress.mastery_score,
                recent_scores=progress.recent_scores or [],
                new_score=score,
            )
            progress.mastery_score = update["mastery_score"]
            progress.recent_scores = update["recent_scores"]
            progress.trend = update["trend"]
            progress.attempts += 1
            progress.last_assessed = datetime.utcnow()
        else:
            progress = UserObjectiveProgress(
                user_id=user_id,
                objective_id=obj_id,
                attempts=1,
                mastery_score=score,
                recent_scores=[score],
                trend="stable",
                last_assessed=datetime.utcnow(),
            )
            db.add(progress)


async def _get_user_objective_progress(db: AsyncSession, user_id: str) -> list[dict]:
    """Get all objective progress for MTSS classification."""
    result = await db.execute(
        select(UserObjectiveProgress).where(UserObjectiveProgress.user_id == user_id)
    )
    rows = result.scalars().all()
    return [
        {"objective_id": r.objective_id, "mastery_score": r.mastery_score}
        for r in rows
    ]
