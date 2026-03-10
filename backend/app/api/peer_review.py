"""Peer Review — evaluate other students' trading analyses for XP."""
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Optional

from app.core.database import get_db
from app.core.auth import get_current_user, get_optional_user, require_educator
from app.models.database_models import ScenarioSession, Scenario, User
from app.services.gamification import GamificationEngine
from app.services.event_logger import EventLogger

router = APIRouter(prefix="/api/peer-review", tags=["peer_review"])

gamification = GamificationEngine()


class PeerReviewSubmit(BaseModel):
    peer_review_score: float
    peer_review_feedback: str


# ────────────────────────────────────────────────────────────────
# Available Sessions
# ────────────────────────────────────────────────────────────────

@router.get("/available")
async def list_available_sessions(
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """List graded sessions available for peer review.

    Returns sessions that are:
    - status="graded"
    - peer_reviewed_by IS NULL (not yet claimed)
    - user_id != current user (can't review your own)
    """
    user_id = current_user.id if current_user else "demo-user"

    result = await db.execute(
        select(ScenarioSession).where(
            and_(
                ScenarioSession.status == "graded",
                ScenarioSession.peer_reviewed_by.is_(None),
                ScenarioSession.user_id != user_id,
            )
        ).order_by(ScenarioSession.completed_at.desc()).limit(20)
    )
    sessions = result.scalars().all()

    available = []
    for sess in sessions:
        # Get username and scenario context
        owner = await db.get(User, sess.user_id)
        scenario = await db.get(Scenario, sess.scenario_id)
        if owner and scenario:
            available.append({
                "session_id": sess.id,
                "user_id": sess.user_id,
                "username": owner.username,
                "scenario_id": sess.scenario_id,
                "overall_score": sess.overall_score,
                "difficulty": scenario.difficulty,
                "market_regime": scenario.market_regime,
                "context_preview": (scenario.context_prompt or "")[:300],
                "initial_response": sess.initial_response,
                "learning_objectives": scenario.learning_objectives,
                "completed_at": sess.completed_at,
            })

    return {
        "total": len(available),
        "sessions": available,
    }


# ────────────────────────────────────────────────────────────────
# Claim a Session
# ────────────────────────────────────────────────────────────────

@router.post("/{session_id}/claim")
async def claim_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claim a session for peer review.

    Sets peer_reviewed_by to prevent others from claiming the same session.
    """
    logger = EventLogger(db)
    user_id = current_user.id

    session = await db.get(ScenarioSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "graded":
        raise HTTPException(status_code=400, detail="Session is not available for review")

    if session.peer_reviewed_by is not None:
        raise HTTPException(status_code=400, detail="Session already claimed by another reviewer")

    if session.user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot review your own session")

    # Claim it
    session.peer_reviewed_by = user_id
    await db.flush()

    # Get scenario for response context
    scenario = await db.get(Scenario, session.scenario_id)

    await logger.log(user_id, "peer_review_claimed", {
        "session_id": session_id,
        "session_owner": session.user_id,
    }, session_id=session_id)

    return {
        "session_id": session_id,
        "status": "claimed",
        "session": {
            "initial_response": session.initial_response or "",
            "conversation": session.conversation or [],
            "overall_score": session.overall_score or 0,
            "dimension_scores": session.dimension_scores or {},
            "strengths": session.strengths or [],
            "areas_for_improvement": session.areas_for_improvement or [],
        },
        "scenario": {
            "context_prompt": scenario.context_prompt if scenario else "",
            "market_data": scenario.market_data if scenario else {},
            "difficulty": scenario.difficulty if scenario else "",
            "market_regime": scenario.market_regime if scenario else "",
            "learning_objectives": scenario.learning_objectives if scenario else [],
        },
    }


# ────────────────────────────────────────────────────────────────
# Submit Review
# ────────────────────────────────────────────────────────────────

@router.post("/{session_id}/submit")
async def submit_review(
    session_id: str,
    request: PeerReviewSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit peer review score and feedback. Awards +15 XP to reviewer."""
    logger = EventLogger(db)
    user_id = current_user.id

    session = await db.get(ScenarioSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.peer_reviewed_by != user_id:
        raise HTTPException(status_code=403, detail="You have not claimed this session for review")

    if session.peer_review_score is not None:
        raise HTTPException(status_code=400, detail="Review already submitted for this session")

    # Validate score range
    score = max(0.0, min(100.0, request.peer_review_score))

    # Store the review
    session.peer_review_score = score
    session.peer_review_feedback = request.peer_review_feedback

    # Award XP to the reviewer
    reviewer = current_user

    level_before = reviewer.level

    xp_breakdown = gamification.calculate_xp(
        overall_score=100,  # Fixed for peer review
        streak_days=reviewer.streak_days or 0,
        is_peer_review=True,
    )

    reviewer.xp += xp_breakdown["total"]
    level_info = gamification.calculate_level(reviewer.xp)
    reviewer.level = level_info["level"]

    await db.flush()

    await logger.log(user_id, "peer_review_submitted", {
        "session_id": session_id,
        "session_owner": session.user_id,
        "peer_review_score": score,
        "xp_earned": xp_breakdown["total"],
    }, session_id=session_id)

    return {
        "session_id": session_id,
        "status": "submitted",
        "xp_earned": xp_breakdown,
        "level_before": level_before,
        "level_after": reviewer.level,
        "level_info": level_info,
    }


# ────────────────────────────────────────────────────────────────
# My Reviews
# ────────────────────────────────────────────────────────────────

@router.get("/my-reviews")
async def my_reviews(
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """List sessions the current user has reviewed."""
    user_id = current_user.id if current_user else "demo-user"

    result = await db.execute(
        select(ScenarioSession).where(
            ScenarioSession.peer_reviewed_by == user_id
        ).order_by(ScenarioSession.completed_at.desc())
    )
    sessions = result.scalars().all()

    reviews = []
    for sess in sessions:
        owner = await db.get(User, sess.user_id)
        reviews.append({
            "session_id": sess.id,
            "user_id": sess.user_id,
            "username": owner.username if owner else "Unknown",
            "peer_review_score": sess.peer_review_score,
            "peer_review_feedback": sess.peer_review_feedback,
            "overall_score": sess.overall_score,
            "completed_at": sess.completed_at,
        })

    return {
        "total": len(reviews),
        "reviews": reviews,
    }


# ────────────────────────────────────────────────────────────────
# Reviews Received
# ────────────────────────────────────────────────────────────────

@router.get("/my-received")
async def my_received_reviews(
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """List peer reviews received on the current user's sessions."""
    user_id = current_user.id if current_user else "demo-user"

    result = await db.execute(
        select(ScenarioSession).where(
            and_(
                ScenarioSession.user_id == user_id,
                ScenarioSession.peer_reviewed_by.isnot(None),
                ScenarioSession.peer_review_score.isnot(None),
            )
        ).order_by(ScenarioSession.completed_at.desc())
    )
    sessions = result.scalars().all()

    reviews = []
    for sess in sessions:
        reviewer = await db.get(User, sess.peer_reviewed_by)
        reviews.append({
            "session_id": sess.id,
            "reviewer_id": sess.peer_reviewed_by,
            "reviewer_username": reviewer.username if reviewer else "Anonymous",
            "peer_review_score": sess.peer_review_score,
            "peer_review_feedback": sess.peer_review_feedback,
            "overall_score": sess.overall_score,
            "completed_at": sess.completed_at,
        })

    return {
        "total": len(reviews),
        "reviews": reviews,
    }


# ────────────────────────────────────────────────────────────────
# Seed Test Data (dev helper)
# ────────────────────────────────────────────────────────────────

@router.post("/seed-test-data")
async def seed_peer_review_data(
    current_user: User = Depends(require_educator),
    db: AsyncSession = Depends(get_db),
):
    """Seed peer-reviewable sessions by duplicating the current user's graded
    sessions and assigning them to demo accounts.

    This is an admin/educator-only helper — call once to populate the peer review queue.
    """
    user_id = current_user.id

    # Check if we already seeded
    existing = await db.execute(
        select(func.count(ScenarioSession.id)).where(
            and_(
                ScenarioSession.status == "graded",
                ScenarioSession.peer_reviewed_by.is_(None),
                ScenarioSession.user_id != user_id,
            )
        )
    )
    existing_count = existing.scalar() or 0
    if existing_count > 0:
        return {"status": "already_seeded", "available": existing_count}

    # Get current user's graded sessions
    result = await db.execute(
        select(ScenarioSession).where(
            and_(
                ScenarioSession.user_id == user_id,
                ScenarioSession.status == "graded",
            )
        )
    )
    graded_sessions = result.scalars().all()

    if not graded_sessions:
        raise HTTPException(
            status_code=400,
            detail="No graded sessions found. Complete some training first.",
        )

    # Demo users to assign copies to
    demo_user_ids = [
        "alex-trader-id",
        "288f509b-0f72-484d-abe3-2ad67748b16a",
        "be95b415-7d55-4af1-a3fa-6797ff590a22",
        "84b93ba4-5d07-48e2-a8c3-d3a92ecca486",
        "a34e2579-0089-452b-ae40-55802bb89304",
    ]

    valid_demo_ids = []
    for uid in demo_user_ids:
        u = await db.get(User, uid)
        if u:
            valid_demo_ids.append(uid)

    if not valid_demo_ids:
        raise HTTPException(status_code=400, detail="No demo users found.")

    inserted = 0
    for i, sess in enumerate(graded_sessions):
        target_uid = valid_demo_ids[i % len(valid_demo_ids)]
        new_id = str(uuid.uuid4())
        base_time = datetime.utcnow() - timedelta(hours=(i + 1) * 3)

        new_session = ScenarioSession(
            id=new_id,
            user_id=target_uid,
            scenario_id=sess.scenario_id,
            status="graded",
            initial_response=sess.initial_response,
            conversation=sess.conversation,
            probe_count=sess.probe_count,
            overall_score=sess.overall_score,
            dimension_scores=sess.dimension_scores,
            strengths=sess.strengths,
            areas_for_improvement=sess.areas_for_improvement,
            reasoning_quality=sess.reasoning_quality,
            capman_lexicon_usage=sess.capman_lexicon_usage,
            grade_confidence=sess.grade_confidence,
            xp_earned=sess.xp_earned,
            time_spent_seconds=sess.time_spent_seconds,
            curveball_injected=sess.curveball_injected,
            curveball_id=sess.curveball_id,
            curveball_data=sess.curveball_data,
            curveball_response=sess.curveball_response,
            adaptability_score=sess.adaptability_score,
            peer_review_score=None,
            peer_review_feedback=None,
            peer_reviewed_by=None,
            created_at=base_time,
            completed_at=base_time + timedelta(minutes=15),
        )
        db.add(new_session)
        inserted += 1

    await db.flush()
    return {
        "status": "seeded",
        "sessions_created": inserted,
        "from_graded": len(graded_sessions),
        "demo_users_used": len(valid_demo_ids),
    }
