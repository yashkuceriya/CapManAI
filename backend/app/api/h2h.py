"""Head-to-Head (H2H) competitive scenario matching and grading."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.database_models import (
    HeadToHeadMatch, ScenarioSession, Scenario, User
)
from app.models.schemas import (
    MatchStatus, StudentResponseSubmit
)
from app.agents.scenario_engine import ScenarioEngine
from app.agents.grading_agent import ProbingGradingAgent
from app.services.gamification import GamificationEngine
from app.services.event_logger import EventLogger

LLM_UNAVAILABLE_MSG = (
    "Scenario or grading service is temporarily unavailable. "
    "Please try again in a moment. If the problem persists, check your API key and network."
)

router = APIRouter(prefix="/api/h2h", tags=["h2h"])

scenario_engine = ScenarioEngine()
grading_agent = ProbingGradingAgent()
gamification = GamificationEngine()


# ────────────────────────────────────────────────────────────────
# Core H2H Flow
# ────────────────────────────────────────────────────────────────

@router.post("/create")
async def create_h2h_match(
    difficulty: str = "intermediate",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new H2H match waiting for an opponent.

    - Generates a scenario using ScenarioEngine
    - Creates a HeadToHeadMatch with player_1_id=user_id, status="pending"
    - Creates a ScenarioSession for player 1
    - Returns: match_id, scenario info, status "waiting_for_opponent"
    """
    logger = EventLogger(db)
    user_id = current_user.id
    user = current_user

    # Generate scenario
    try:
        result = await scenario_engine.generate_scenario(
            difficulty=difficulty,
            market_regime=None,
            target_objectives=None,
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=LLM_UNAVAILABLE_MSG,
        ) from e

    # Store scenario in database
    scenario = Scenario(
        market_regime=result["market_regime"],
        asset_class=result["asset_class"],
        difficulty=result["difficulty"],
        context_prompt=result["context_prompt"],
        market_data=result["market_data"],
        learning_objectives=result["learning_objectives"],
        expected_analysis=result.get("expected_analysis", ""),
        fingerprint=result.get("fingerprint"),
        is_replay=False,
    )
    db.add(scenario)
    await db.flush()

    # Create ScenarioSession for player 1
    session_p1 = ScenarioSession(
        user_id=user_id,
        scenario_id=scenario.id,
        status="in_progress",
        conversation=[],
    )
    db.add(session_p1)
    await db.flush()

    # Create H2H match
    match = HeadToHeadMatch(
        scenario_id=scenario.id,
        player_1_id=user_id,
        player_1_session_id=session_p1.id,
        status="pending",
    )
    db.add(match)
    await db.flush()

    # Log event
    await logger.log(user_id, "h2h_match_created", {
        "match_id": match.id,
        "scenario_id": scenario.id,
        "difficulty": result["difficulty"],
    }, session_id=session_p1.id)

    return {
        "match_id": match.id,
        "scenario": {
            "id": scenario.id,
            "session_id": session_p1.id,
            "market_regime": scenario.market_regime,
            "asset_class": scenario.asset_class,
            "difficulty": scenario.difficulty,
            "context_prompt": scenario.context_prompt,
            "market_data": scenario.market_data,
            "learning_objectives": scenario.learning_objectives,
            "is_replay": False,
            "created_at": scenario.created_at,
        },
        "status": "waiting_for_opponent",
        "time_limit_seconds": 300,
    }


@router.post("/{match_id}/join")
async def join_h2h_match(
    match_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Join an existing H2H match.

    - Validates: match exists, status is "pending", joiner != creator
    - Sets player_2_id, creates a ScenarioSession for player 2 (same scenario_id)
    - Sets player_2_session_id, status="in_progress"
    - Returns: match_id, scenario info, session_id for player 2
    """
    logger = EventLogger(db)
    user_id = current_user.id

    # Get match
    match = await db.get(HeadToHeadMatch, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Validate match is pending
    if match.status != "pending":
        raise HTTPException(status_code=400, detail=f"Match is not available for joining (status: {match.status})")

    # Validate joiner is not creator
    if match.player_1_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot join your own match")

    # Get scenario
    scenario = await db.get(Scenario, match.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Create ScenarioSession for player 2
    session_p2 = ScenarioSession(
        user_id=user_id,
        scenario_id=match.scenario_id,
        status="in_progress",
        conversation=[],
    )
    db.add(session_p2)
    await db.flush()

    # Update match
    match.player_2_id = user_id
    match.player_2_session_id = session_p2.id
    match.status = "in_progress"

    await db.flush()

    # Log event
    await logger.log(user_id, "h2h_match_joined", {
        "match_id": match.id,
        "opponent_id": match.player_1_id,
    }, session_id=session_p2.id)

    return {
        "match_id": match.id,
        "scenario": {
            "id": scenario.id,
            "session_id": session_p2.id,
            "market_regime": scenario.market_regime,
            "asset_class": scenario.asset_class,
            "difficulty": scenario.difficulty,
            "context_prompt": scenario.context_prompt,
            "market_data": scenario.market_data,
            "learning_objectives": scenario.learning_objectives,
            "is_replay": False,
            "created_at": scenario.created_at,
        },
        "status": "in_progress",
        "time_limit_seconds": 300,
    }


@router.get("/open")
async def list_open_matches(
    db: AsyncSession = Depends(get_db),
):
    """List open matches waiting for opponents."""
    result = await db.execute(
        select(HeadToHeadMatch).where(HeadToHeadMatch.status == "pending")
    )
    matches = result.scalars().all()

    open_matches = []
    for match in matches:
        player_1 = await db.get(User, match.player_1_id)
        if player_1:
            open_matches.append({
                "match_id": match.id,
                "player_1_username": player_1.username,
                "difficulty": (await db.get(Scenario, match.scenario_id)).difficulty if match.scenario_id else None,
                "created_at": match.created_at,
            })

    return {
        "total": len(open_matches),
        "matches": open_matches,
    }


@router.post("/{match_id}/submit")
async def submit_response(
    match_id: str,
    request: StudentResponseSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit response for your session in the match.

    - Determines which player this is (player_1 or player_2 by user_id)
    - Gets their session_id from the match
    - Stores the response on the session (initial_response, conversation)
    - Returns: session_id, status
    """
    logger = EventLogger(db)
    user_id = current_user.id

    # Get match
    match = await db.get(HeadToHeadMatch, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Determine which player this is
    if match.player_1_id == user_id:
        session_id = match.player_1_session_id
    elif match.player_2_id == user_id:
        session_id = match.player_2_session_id
    else:
        raise HTTPException(status_code=403, detail="You are not part of this match")

    if not session_id:
        raise HTTPException(status_code=400, detail="Match session not initialized")

    # Get session
    session = await db.get(ScenarioSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update session with response
    conversation = session.conversation or []
    conversation.append({
        "role": "student",
        "content": request.response_text,
        "timestamp": datetime.utcnow().isoformat(),
    })

    session.initial_response = request.response_text
    session.conversation = conversation
    flag_modified(session, "conversation")

    await db.flush()

    # Log event
    await logger.log(user_id, "h2h_response_submitted", {
        "match_id": match.id,
        "session_id": session_id,
        "response_length": len(request.response_text),
    }, session_id=session_id)

    return {
        "match_id": match.id,
        "session_id": session_id,
        "status": "response_submitted",
    }


@router.post("/{match_id}/grade")
async def grade_h2h_match(
    match_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Grade both players and determine winner.

    - Validates both players have submitted responses
    - Grades both sessions using ProbingGradingAgent (skip probing for H2H — direct grade)
    - Compares overall_score, sets winner_id on match
    - Awards XP: winner gets XP_H2H_WIN (75), loser gets XP_H2H_LOSE (25)
    - Updates both users' XP and scenarios_completed
    - Sets match status="completed", completed_at
    - Returns: both scores, winner info, XP earned
    """
    logger = EventLogger(db)

    # Get match
    match = await db.get(HeadToHeadMatch, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Validate both players exist
    player_1 = await db.get(User, match.player_1_id)
    player_2 = await db.get(User, match.player_2_id)

    if not player_1 or not player_2:
        raise HTTPException(status_code=400, detail="Match is not complete — missing player(s)")

    # Get sessions
    session_p1 = await db.get(ScenarioSession, match.player_1_session_id)
    session_p2 = await db.get(ScenarioSession, match.player_2_session_id)

    if not session_p1 or not session_p2:
        raise HTTPException(status_code=400, detail="Match sessions not found")

    # Validate both have submitted responses
    if not session_p1.initial_response or not session_p2.initial_response:
        raise HTTPException(status_code=400, detail="Both players must submit responses before grading")

    # Get scenario
    scenario = await db.get(Scenario, match.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Grade both sessions (skip probing for H2H — direct grade)
    try:
        grade_p1 = await grading_agent.grade_session(
            scenario_context=scenario.context_prompt,
            expected_analysis=scenario.expected_analysis or "",
            conversation_history=session_p1.conversation or [],
            curveball_active=False,
            curveball_data=None,
        )

        grade_p2 = await grading_agent.grade_session(
            scenario_context=scenario.context_prompt,
            expected_analysis=scenario.expected_analysis or "",
            conversation_history=session_p2.conversation or [],
            curveball_active=False,
            curveball_data=None,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=LLM_UNAVAILABLE_MSG) from e

    # Determine winner
    score_p1 = grade_p1["overall_score"]
    score_p2 = grade_p2["overall_score"]

    if score_p1 > score_p2:
        winner_id = match.player_1_id
        loser_id = match.player_2_id
    elif score_p2 > score_p1:
        winner_id = match.player_2_id
        loser_id = match.player_1_id
    else:
        # Tie — player 1 wins on tie
        winner_id = match.player_1_id
        loser_id = match.player_2_id

    # Update sessions with grades
    session_p1.overall_score = score_p1
    session_p1.dimension_scores = grade_p1["dimension_scores"]
    session_p1.strengths = grade_p1["strengths"]
    session_p1.areas_for_improvement = grade_p1["areas_for_improvement"]
    session_p1.reasoning_quality = grade_p1["reasoning_quality"]
    session_p1.capman_lexicon_usage = grade_p1["capman_lexicon_usage"]
    session_p1.grade_confidence = grade_p1["confidence"]
    session_p1.status = "graded"
    session_p1.completed_at = datetime.utcnow()

    session_p2.overall_score = score_p2
    session_p2.dimension_scores = grade_p2["dimension_scores"]
    session_p2.strengths = grade_p2["strengths"]
    session_p2.areas_for_improvement = grade_p2["areas_for_improvement"]
    session_p2.reasoning_quality = grade_p2["reasoning_quality"]
    session_p2.capman_lexicon_usage = grade_p2["capman_lexicon_usage"]
    session_p2.grade_confidence = grade_p2["confidence"]
    session_p2.status = "graded"
    session_p2.completed_at = datetime.utcnow()

    # Award XP
    winner_xp = gamification.calculate_xp(
        overall_score=100,  # For H2H win, use fixed multiplier
        streak_days=player_1.streak_days if winner_id == player_1.id else player_2.streak_days,
        is_h2h_win=True,
    )

    loser_xp = gamification.calculate_xp(
        overall_score=0,  # For H2H loss, use fixed multiplier
        streak_days=player_1.streak_days if loser_id == player_1.id else player_2.streak_days,
        is_h2h_lose=True,
    )

    # Update winner
    winner = player_1 if winner_id == player_1.id else player_2
    winner.xp += winner_xp["total"]
    winner.scenarios_completed += 1
    level_info_winner = gamification.calculate_level(winner.xp)
    winner.level = level_info_winner["level"]

    # Update loser
    loser = player_1 if loser_id == player_1.id else player_2
    loser.xp += loser_xp["total"]
    loser.scenarios_completed += 1
    level_info_loser = gamification.calculate_level(loser.xp)
    loser.level = level_info_loser["level"]

    # Update match
    match.winner_id = winner_id
    match.status = "completed"
    match.completed_at = datetime.utcnow()

    # Set XP earned on sessions for reference
    if winner_id == match.player_1_id:
        session_p1.xp_earned = winner_xp["total"]
        session_p2.xp_earned = loser_xp["total"]
    else:
        session_p1.xp_earned = loser_xp["total"]
        session_p2.xp_earned = winner_xp["total"]

    await db.flush()

    # Log events
    await logger.log(winner_id, "h2h_match_won", {
        "match_id": match.id,
        "opponent_id": loser_id,
        "your_score": score_p1 if winner_id == match.player_1_id else score_p2,
        "opponent_score": score_p2 if winner_id == match.player_1_id else score_p1,
        "xp_earned": winner_xp["total"],
    }, session_id=match.player_1_session_id if winner_id == match.player_1_id else match.player_2_session_id)

    await logger.log(loser_id, "h2h_match_lost", {
        "match_id": match.id,
        "opponent_id": winner_id,
        "your_score": score_p2 if loser_id == match.player_2_id else score_p1,
        "opponent_score": score_p1 if loser_id == match.player_2_id else score_p2,
        "xp_earned": loser_xp["total"],
    }, session_id=match.player_1_session_id if loser_id == match.player_1_id else match.player_2_session_id)

    return {
        "match_id": match.id,
        "player_1": {
            "username": player_1.username,
            "score": score_p1,
            "xp_earned": session_p1.xp_earned,
            "is_winner": winner_id == player_1.id,
        },
        "player_2": {
            "username": player_2.username,
            "score": score_p2,
            "xp_earned": session_p2.xp_earned,
            "is_winner": winner_id == player_2.id,
        },
        "winner": {
            "user_id": winner_id,
            "username": winner.username,
            "xp_earned": winner_xp["total"],
        },
        "status": "completed",
    }


@router.get("/{match_id}")
async def get_match_status(
    match_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get match status and results.

    Returns full match info including both players' scores if graded.
    """
    match = await db.get(HeadToHeadMatch, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    player_1 = await db.get(User, match.player_1_id)
    player_2 = await db.get(User, match.player_2_id) if match.player_2_id else None
    session_p1 = await db.get(ScenarioSession, match.player_1_session_id)
    session_p2 = await db.get(ScenarioSession, match.player_2_session_id) if match.player_2_session_id else None
    scenario = await db.get(Scenario, match.scenario_id)

    response = {
        "match_id": match.id,
        "status": match.status,
        "player_1": {
            "user_id": player_1.id,
            "username": player_1.username,
            "score": session_p1.overall_score if session_p1 else None,
            "xp_earned": session_p1.xp_earned if session_p1 else None,
        },
        "player_2": None,
        "winner_id": match.winner_id,
        "scenario": {
            "id": scenario.id,
            "difficulty": scenario.difficulty if scenario else None,
            "market_regime": scenario.market_regime if scenario else None,
            "asset_class": scenario.asset_class if scenario else None,
        },
        "created_at": match.created_at,
        "completed_at": match.completed_at,
    }

    if player_2 and session_p2:
        response["player_2"] = {
            "user_id": player_2.id,
            "username": player_2.username,
            "score": session_p2.overall_score,
            "xp_earned": session_p2.xp_earned,
        }

    return response
