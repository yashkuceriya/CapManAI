"""User, leaderboard, and gamification API routes."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, cast, Date

from app.core.database import get_db
from app.core.config import settings
from app.core.auth import get_optional_user, get_current_user
from app.models.database_models import User, UserObjectiveProgress, ScenarioSession
from app.services.gamification import GamificationEngine

router = APIRouter(prefix="/api/users", tags=["users"])
gamification = GamificationEngine()

VALID_LEADERBOARD_MODES = ("xp", "volume", "mastery")
MAX_LEADERBOARD_LIMIT = 100


@router.get("/me")
async def get_current_user_profile(
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile with gamification stats.

    Uses optional auth — if authenticated, returns that user's profile.
    If not authenticated, falls back to demo-user for development/testing.
    """
    # Fall back to demo-user only in DEBUG mode — production returns 401
    if current_user is None:
        if not settings.DEBUG:
            raise HTTPException(status_code=401, detail="Authentication required")
        user_id = "demo-user"
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Demo user not found")
    else:
        user = current_user
        user_id = user.id

    level_info = gamification.calculate_level(user.xp)

    # Get objective progress
    result = await db.execute(
        select(UserObjectiveProgress).where(UserObjectiveProgress.user_id == user_id)
    )
    progress = result.scalars().all()

    # Check mastery unlocks
    progress_dicts = [
        {"objective_id": p.objective_id, "mastery_score": p.mastery_score}
        for p in progress
    ]
    unlocks = gamification.check_mastery_unlocks(progress_dicts)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "xp": user.xp,
        "level": user.level,
        "level_info": level_info,
        "current_tier": user.current_tier,
        "streak_days": user.streak_days,
        "scenarios_completed": user.scenarios_completed,
        "unlocks": unlocks,
        "objective_progress": [
            {
                "objective_id": p.objective_id,
                "mastery_score": p.mastery_score,
                "trend": p.trend,
                "attempts": p.attempts,
            }
            for p in progress
        ],
    }


@router.get("/leaderboard")
async def get_leaderboard(
    mode: str = "xp",
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Get leaderboard in different ranking modes (xp, volume, mastery)."""
    if mode not in VALID_LEADERBOARD_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode. Use one of: {', '.join(VALID_LEADERBOARD_MODES)}",
        )
    limit = max(1, min(limit, MAX_LEADERBOARD_LIMIT))

    if mode == "xp":
        result = await db.execute(
            select(User)
            .where(User.role == "student")
            .order_by(desc(User.xp))
            .limit(limit)
        )
        users = result.scalars().all()
        entries = [
            {
                "rank": i + 1,
                "user_id": u.id,
                "username": u.username,
                "level": u.level,
                "level_name": gamification.calculate_level(u.xp)["level_name"],
                "value": u.xp,
                "label": "XP",
            }
            for i, u in enumerate(users)
        ]

    elif mode == "volume":
        result = await db.execute(
            select(User)
            .where(User.role == "student")
            .order_by(desc(User.scenarios_completed))
            .limit(limit)
        )
        users = result.scalars().all()
        entries = [
            {
                "rank": i + 1,
                "user_id": u.id,
                "username": u.username,
                "level": u.level,
                "level_name": gamification.calculate_level(u.xp)["level_name"],
                "value": u.scenarios_completed,
                "label": "Scenarios",
            }
            for i, u in enumerate(users)
        ]

    elif mode == "mastery":
        avg_mastery = func.avg(UserObjectiveProgress.mastery_score).label("avg_mastery")
        result = await db.execute(
            select(
                UserObjectiveProgress.user_id,
                avg_mastery,
            )
            .group_by(UserObjectiveProgress.user_id)
            .order_by(desc(avg_mastery))
            .limit(limit)
        )
        rows = result.all()

        entries = []
        for i, row in enumerate(rows):
            user = await db.get(User, row.user_id)
            if user:
                entries.append({
                    "rank": i + 1,
                    "user_id": user.id,
                    "username": user.username,
                    "level": user.level,
                    "level_name": gamification.calculate_level(user.xp)["level_name"],
                    "value": round(row.avg_mastery, 1),
                    "label": "Mastery %",
                    "tier": user.current_tier,
                })
    else:
        entries = []

    return {
        "mode": mode,
        "entries": entries,
    }


@router.get("/activity")
async def get_user_activity(
    days: int = 14,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return per-day XP earned and session counts for sparkline charts.

    Returns the last `days` calendar days (default 14), filling in zeros
    for days with no activity.
    """
    days = max(1, min(days, 90))
    since = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            func.date(ScenarioSession.completed_at).label("day"),
            func.count().label("sessions"),
            func.coalesce(func.sum(ScenarioSession.xp_earned), 0).label("xp"),
        )
        .where(
            ScenarioSession.user_id == current_user.id,
            ScenarioSession.completed_at.isnot(None),
            ScenarioSession.completed_at >= since,
        )
        .group_by(func.date(ScenarioSession.completed_at))
        .order_by(func.date(ScenarioSession.completed_at))
    )
    rows = result.all()

    by_day = {str(r.day): {"sessions": r.sessions, "xp": int(r.xp)} for r in rows}
    today = datetime.utcnow().date()
    timeline = []
    for i in range(days):
        d = today - timedelta(days=days - 1 - i)
        key = str(d)
        entry = by_day.get(key, {"sessions": 0, "xp": 0})
        timeline.append({"date": key, **entry})

    return {"days": days, "timeline": timeline}


@router.get("/daily-goal")
async def get_daily_goal(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return today's completion count, daily target, and recommended objectives.

    Provides a "scenarios_today" counter, a simple daily goal (1 scenario),
    and the weakest objectives the student should focus on next.
    """
    from app.services.mtss import MTSSEngine

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    result = await db.execute(
        select(func.count())
        .where(
            ScenarioSession.user_id == current_user.id,
            ScenarioSession.completed_at.isnot(None),
            func.date(ScenarioSession.completed_at) == today_str,
        )
    )
    completed_today = result.scalar() or 0

    prog_result = await db.execute(
        select(UserObjectiveProgress).where(UserObjectiveProgress.user_id == current_user.id)
    )
    progress = prog_result.scalars().all()
    progress_dicts = [
        {"objective_id": p.objective_id, "mastery_score": p.mastery_score}
        for p in progress
    ]

    mtss = MTSSEngine()
    recommended = mtss.get_recommended_objectives(progress_dicts)

    daily_target = 1
    return {
        "completed_today": completed_today,
        "daily_target": daily_target,
        "goal_met": completed_today >= daily_target,
        "recommended_objectives": recommended,
        "streak_days": current_user.streak_days,
    }
