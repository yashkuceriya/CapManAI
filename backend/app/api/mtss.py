"""MTSS Dashboard API routes (Educator view)."""
import logging
from pydantic import BaseModel, Field
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.auth import require_educator
from app.core.database import get_db
from app.models.database_models import User, UserObjectiveProgress, ScenarioSession, Scenario, EventLog
from app.services.mtss import MTSSEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mtss", tags=["mtss"])
mtss_engine = MTSSEngine()


@router.get("/overview")
async def get_mtss_overview(
    current_user: User = Depends(require_educator),
    db: AsyncSession = Depends(get_db),
):
    """Get all students grouped by MTSS tier — the 'God View'."""
    result = await db.execute(
        select(User).where(User.role == "student")
    )
    students = result.scalars().all()

    tiers = {"tier1": [], "tier2": [], "tier3": []}

    for student in students:
        # Get their objective progress
        prog_result = await db.execute(
            select(UserObjectiveProgress).where(
                UserObjectiveProgress.user_id == student.id
            )
        )
        progress = prog_result.scalars().all()
        progress_dicts = [
            {"objective_id": p.objective_id, "mastery_score": p.mastery_score}
            for p in progress
        ]

        classification = mtss_engine.classify_student(progress_dicts)
        weakest = classification["weak_objectives"][0] if classification["weak_objectives"] else None
        overall_mastery = (
            sum(p.mastery_score for p in progress) / len(progress)
            if progress else 0
        )

        student_summary = {
            "user_id": student.id,
            "username": student.username,
            "tier": classification["tier"],
            "tier_label": classification["tier_label"],
            "overall_mastery": round(overall_mastery, 1),
            "weakest_objective": weakest,
            "scenarios_completed": student.scenarios_completed,
            "xp": student.xp,
            "level": student.level,
            "streak_days": student.streak_days,
        }

        tiers[classification["tier"]].append(student_summary)

    return {
        "tier1": {"label": "On Track", "students": tiers["tier1"], "count": len(tiers["tier1"])},
        "tier2": {"label": "Targeted Support", "students": tiers["tier2"], "count": len(tiers["tier2"])},
        "tier3": {"label": "Intensive Support", "students": tiers["tier3"], "count": len(tiers["tier3"])},
        "total_students": len(students),
    }


@router.get("/student/{user_id}")
async def get_student_detail(
    user_id: str,
    current_user: User = Depends(require_educator),
    db: AsyncSession = Depends(get_db),
):
    """Deep dive on a single student — objective-level progress + session history."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")

    # Get objective progress
    prog_result = await db.execute(
        select(UserObjectiveProgress).where(UserObjectiveProgress.user_id == user_id)
    )
    progress = prog_result.scalars().all()

    # Get recent sessions
    sessions_result = await db.execute(
        select(ScenarioSession)
        .where(ScenarioSession.user_id == user_id)
        .order_by(desc(ScenarioSession.created_at))
        .limit(20)
    )
    sessions = sessions_result.scalars().all()

    # MTSS classification
    progress_dicts = [
        {"objective_id": p.objective_id, "mastery_score": p.mastery_score}
        for p in progress
    ]
    classification = mtss_engine.classify_student(progress_dicts)
    recommendations = mtss_engine.get_recommended_objectives(progress_dicts)

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "xp": user.xp,
            "level": user.level,
            "tier": classification["tier"],
            "tier_label": classification["tier_label"],
            "scenarios_completed": user.scenarios_completed,
            "streak_days": user.streak_days,
        },
        "classification": classification,
        "recommended_objectives": recommendations,
        "objective_progress": [
            {
                "objective_id": p.objective_id,
                "mastery_score": p.mastery_score,
                "trend": p.trend,
                "attempts": p.attempts,
                "recent_scores": p.recent_scores,
            }
            for p in progress
        ],
        "recent_sessions": [
            {
                "id": s.id,
                "scenario_id": s.scenario_id,
                "status": s.status,
                "overall_score": s.overall_score,
                "xp_earned": s.xp_earned,
                "educator_override_score": s.educator_override_score,
                "educator_override_note": s.educator_override_note,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sessions
        ],
    }


@router.get("/objectives")
async def get_class_objective_heatmap(
    current_user: User = Depends(require_educator),
    db: AsyncSession = Depends(get_db),
):
    """Class-wide heatmap: objectives × students, color-coded by mastery."""
    result = await db.execute(
        select(UserObjectiveProgress)
    )
    all_progress = result.scalars().all()

    # Group by objective
    by_objective = {}
    for p in all_progress:
        if p.objective_id not in by_objective:
            by_objective[p.objective_id] = []
        by_objective[p.objective_id].append({
            "user_id": p.user_id,
            "mastery_score": p.mastery_score,
            "trend": p.trend,
        })

    # Calculate per-objective stats
    heatmap = []
    for obj_id, students in by_objective.items():
        scores = [s["mastery_score"] for s in students]
        heatmap.append({
            "objective_id": obj_id,
            "avg_mastery": round(sum(scores) / len(scores), 1) if scores else 0,
            "min_mastery": min(scores) if scores else 0,
            "max_mastery": max(scores) if scores else 0,
            "student_count": len(students),
            "at_risk_count": sum(1 for s in scores if s < 50),
            "students": students,
        })

    return {"heatmap": heatmap}


@router.get("/alerts")
async def get_mtss_alerts(
    limit: int = 20,
    current_user: User = Depends(require_educator),
    db: AsyncSession = Depends(get_db),
):
    """Get recent tier transition alerts and students needing attention."""
    # Get recent tier change events
    result = await db.execute(
        select(EventLog)
        .where(EventLog.event_type == "tier_change")
        .order_by(desc(EventLog.timestamp))
        .limit(limit)
    )
    events = result.scalars().all()

    alerts = [
        {
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "user_id": e.user_id,
            "event_type": e.event_type,
            "details": e.payload,
        }
        for e in events
    ]

    return {"alerts": alerts}


@router.get("/trajectory/{user_id}")
async def get_student_trajectory(
    user_id: str,
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(require_educator),
    db: AsyncSession = Depends(get_db),
):
    """Long-term performance trajectory for a student.

    Returns session-by-session scores over time, objective mastery trends,
    and tier transition history — for charting progress.
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")

    # Score trajectory: session scores over time
    sessions_result = await db.execute(
        select(ScenarioSession)
        .where(
            ScenarioSession.user_id == user_id,
            ScenarioSession.status.in_(["graded", "reviewed"]),
        )
        .order_by(ScenarioSession.completed_at)
        .limit(limit)
    )
    sessions = sessions_result.scalars().all()

    score_trajectory = []
    for s in sessions:
        scenario = await db.get(Scenario, s.scenario_id) if s.scenario_id else None
        score_trajectory.append({
            "session_id": s.id,
            "overall_score": s.overall_score,
            "xp_earned": s.xp_earned,
            "difficulty": scenario.difficulty if scenario else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "curveball_active": s.curveball_injected or False,
            "adaptability_score": s.adaptability_score,
        })

    # Objective mastery over time (current snapshot + recent_scores history)
    prog_result = await db.execute(
        select(UserObjectiveProgress).where(UserObjectiveProgress.user_id == user_id)
    )
    progress = prog_result.scalars().all()

    objective_trends = [
        {
            "objective_id": p.objective_id,
            "mastery_score": p.mastery_score,
            "trend": p.trend,
            "attempts": p.attempts,
            "recent_scores": p.recent_scores or [],
        }
        for p in progress
    ]

    # Tier transition history from event logs
    tier_result = await db.execute(
        select(EventLog)
        .where(EventLog.user_id == user_id, EventLog.event_type == "tier_change")
        .order_by(EventLog.timestamp)
    )
    tier_events = tier_result.scalars().all()

    tier_history = [
        {
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "old_tier": e.payload.get("old_tier") if e.payload else None,
            "new_tier": e.payload.get("new_tier") if e.payload else None,
            "reason": e.payload.get("reason") if e.payload else None,
        }
        for e in tier_events
    ]

    # Summary stats
    scores = [s.overall_score for s in sessions if s.overall_score is not None]

    return {
        "user_id": user_id,
        "username": user.username,
        "summary": {
            "total_sessions": len(sessions),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "best_score": max(scores) if scores else 0,
            "recent_avg": round(sum(scores[-5:]) / len(scores[-5:]), 1) if scores else 0,
            "current_tier": user.current_tier,
            "xp": user.xp,
            "level": user.level,
        },
        "score_trajectory": score_trajectory,
        "objective_trends": objective_trends,
        "tier_history": tier_history,
    }


@router.get("/correlation")
async def get_ai_educator_correlation(
    current_user: User = Depends(require_educator),
    db: AsyncSession = Depends(get_db),
):
    """Return sessions that have both an AI grade and an educator override.

    Used to build a scatter chart comparing AI vs educator scores and compute
    correlation metrics.
    """
    result = await db.execute(
        select(ScenarioSession)
        .where(
            ScenarioSession.overall_score.isnot(None),
            ScenarioSession.educator_override_score.isnot(None),
        )
        .order_by(desc(ScenarioSession.completed_at))
        .limit(200)
    )
    sessions = result.all()

    points = []
    for (s,) in sessions:
        user = await db.get(User, s.user_id)
        points.append({
            "session_id": s.id,
            "user_id": s.user_id,
            "username": user.username if user else s.user_id,
            "ai_score": round(s.overall_score, 1),
            "educator_score": round(s.educator_override_score, 1),
            "diff": round(s.educator_override_score - s.overall_score, 1),
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        })

    if len(points) >= 2:
        ai_scores = [p["ai_score"] for p in points]
        ed_scores = [p["educator_score"] for p in points]
        n = len(points)
        mean_ai = sum(ai_scores) / n
        mean_ed = sum(ed_scores) / n
        cov = sum((a - mean_ai) * (e - mean_ed) for a, e in zip(ai_scores, ed_scores)) / n
        std_ai = (sum((a - mean_ai) ** 2 for a in ai_scores) / n) ** 0.5
        std_ed = (sum((e - mean_ed) ** 2 for e in ed_scores) / n) ** 0.5
        r = cov / (std_ai * std_ed) if std_ai and std_ed else 0.0
        mae = sum(abs(p["diff"]) for p in points) / n
    else:
        r = None
        mae = None

    return {
        "count": len(points),
        "correlation_r": round(r, 3) if r is not None else None,
        "mean_absolute_error": round(mae, 1) if mae is not None else None,
        "points": points,
    }


class OverrideRequest(BaseModel):
    score: float = Field(..., ge=0, le=100)
    note: Optional[str] = Field(None, max_length=500)


@router.put("/session/{session_id}/override")
async def set_educator_override(
    session_id: str,
    body: OverrideRequest,
    current_user: User = Depends(require_educator),
    db: AsyncSession = Depends(get_db),
):
    """Educator sets an override score (and optional note) on a graded session.

    Overwrites the AI grade with the educator's assessment. The original AI
    score is preserved in `overall_score`; the override is in dedicated columns.
    """
    session = await db.get(ScenarioSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.educator_override_score = body.score
    session.educator_override_note = body.note or ""
    session.educator_override_by = current_user.id
    await db.flush()

    logger.info(
        "Educator %s overrode session %s: score=%s",
        current_user.username,
        session_id,
        body.score,
    )

    return {
        "session_id": session_id,
        "educator_override_score": session.educator_override_score,
        "educator_override_note": session.educator_override_note,
        "educator_override_by": current_user.id,
    }
