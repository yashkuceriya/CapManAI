"""Gamification engine — XP, leveling, streaks, mastery unlocks."""
from datetime import datetime, date

from app.core.config import settings


class GamificationEngine:
    """Calculates XP, levels, streaks, and mastery-based unlocks."""

    def calculate_xp(
        self,
        overall_score: float,
        streak_days: int = 0,
        is_h2h_win: bool = False,
        is_h2h_lose: bool = False,
    ) -> dict:
        """Calculate total XP earned from a graded session."""
        breakdown = {}

        # Base XP for completing a scenario
        breakdown["base"] = settings.XP_BASE_SCENARIO

        # Grade bonus: (score/100) * max_bonus
        grade_bonus = int((overall_score / 100) * settings.XP_MAX_GRADE_BONUS)
        breakdown["grade_bonus"] = grade_bonus

        # Streak bonus (3+ consecutive days)
        if streak_days >= 3:
            breakdown["streak_bonus"] = settings.XP_STREAK_BONUS
        else:
            breakdown["streak_bonus"] = 0

        # Perfect score bonus
        if overall_score >= settings.PERFECT_SCORE_THRESHOLD:
            breakdown["perfect_bonus"] = settings.XP_PERFECT_SCORE_BONUS
        else:
            breakdown["perfect_bonus"] = 0

        # Head-to-head bonus
        if is_h2h_win:
            breakdown["h2h"] = settings.XP_H2H_WIN
        elif is_h2h_lose:
            breakdown["h2h"] = settings.XP_H2H_LOSE
        else:
            breakdown["h2h"] = 0

        breakdown["total"] = sum(breakdown.values())
        return breakdown

    def calculate_level(self, total_xp: int) -> dict:
        """Determine level and progress from total XP."""
        thresholds = settings.LEVEL_THRESHOLDS
        names = settings.LEVEL_NAMES
        current_level = 1

        for level, threshold in sorted(thresholds.items()):
            if total_xp >= threshold:
                current_level = level
            else:
                break

        # Calculate progress to next level
        next_level = current_level + 1
        if next_level in thresholds:
            current_threshold = thresholds[current_level]
            next_threshold = thresholds[next_level]
            progress = (total_xp - current_threshold) / (next_threshold - current_threshold)
            xp_to_next = next_threshold - total_xp
            xp_for_next = next_threshold - current_threshold
            xp_progress = total_xp - current_threshold
        else:
            progress = 1.0
            xp_to_next = 0
            xp_for_next = 0
            xp_progress = 0

        return {
            "level": current_level,
            "level_name": names.get(current_level, "Unknown"),
            "total_xp": total_xp,
            "progress_to_next": min(1.0, max(0.0, progress)),
            "xp_to_next_level": max(0, xp_to_next),
            "xp_for_next": xp_for_next,
            "xp_progress": xp_progress,
            "is_max_level": next_level not in thresholds,
        }

    def update_streak(self, last_active_date: str, current_streak: int) -> dict:
        """Update the user's daily streak."""
        today = date.today().isoformat()

        if last_active_date is None:
            return {"streak_days": 1, "last_active_date": today, "streak_broken": False}

        if last_active_date == today:
            # Already active today
            return {"streak_days": current_streak, "last_active_date": today, "streak_broken": False}

        # Check if yesterday
        from datetime import timedelta
        yesterday = (date.today() - timedelta(days=1)).isoformat()

        if last_active_date == yesterday:
            return {"streak_days": current_streak + 1, "last_active_date": today, "streak_broken": False}
        else:
            # Streak broken
            return {"streak_days": 1, "last_active_date": today, "streak_broken": True}

    def check_mastery_unlocks(self, objective_progress: list[dict]) -> dict:
        """Check what content is unlocked based on mastery scores."""
        if not objective_progress:
            return {
                "intermediate_scenarios": False,
                "advanced_scenarios": False,
                "head_to_head": False,
                "elite_scenarios": False,
            }

        scores = {op["objective_id"]: op["mastery_score"] for op in objective_progress}
        above_60 = sum(1 for s in scores.values() if s >= 60)
        above_50 = sum(1 for s in scores.values() if s >= 50)
        above_75 = all(s >= 75 for s in scores.values()) if scores else False
        above_85 = all(s >= 85 for s in scores.values()) if scores else False

        return {
            "intermediate_scenarios": above_60 >= 3,
            "advanced_scenarios": above_75,
            "head_to_head": above_50 >= 3,
            "elite_scenarios": above_85,
        }
