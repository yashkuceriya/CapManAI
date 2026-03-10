"""Tests for the gamification engine — XP, leveling, streaks, mastery unlocks."""
from datetime import date, timedelta

from app.services.gamification import GamificationEngine
from app.core.config import settings


engine = GamificationEngine()


class TestXPCalculation:
    def test_base_xp_always_awarded(self):
        result = engine.calculate_xp(overall_score=50)
        assert result["base"] == settings.XP_BASE_SCENARIO

    def test_grade_bonus_proportional(self):
        result = engine.calculate_xp(overall_score=80)
        expected_bonus = int((80 / 100) * settings.XP_MAX_GRADE_BONUS)
        assert result["grade_bonus"] == expected_bonus

    def test_zero_score_gives_zero_grade_bonus(self):
        result = engine.calculate_xp(overall_score=0)
        assert result["grade_bonus"] == 0

    def test_perfect_score_bonus(self):
        result = engine.calculate_xp(overall_score=96)
        assert result["perfect_bonus"] == settings.XP_PERFECT_SCORE_BONUS

    def test_below_perfect_no_bonus(self):
        result = engine.calculate_xp(overall_score=94)
        assert result["perfect_bonus"] == 0

    def test_streak_bonus_at_3_days(self):
        result = engine.calculate_xp(overall_score=70, streak_days=3)
        assert result["streak_bonus"] == settings.XP_STREAK_BONUS

    def test_no_streak_bonus_under_3_days(self):
        result = engine.calculate_xp(overall_score=70, streak_days=2)
        assert result["streak_bonus"] == 0

    def test_h2h_win_bonus(self):
        result = engine.calculate_xp(overall_score=70, is_h2h_win=True)
        assert result["h2h"] == settings.XP_H2H_WIN

    def test_h2h_lose_bonus(self):
        result = engine.calculate_xp(overall_score=70, is_h2h_lose=True)
        assert result["h2h"] == settings.XP_H2H_LOSE

    def test_total_is_sum_of_parts(self):
        result = engine.calculate_xp(overall_score=96, streak_days=5, is_h2h_win=True)
        expected = (
            result["base"]
            + result["grade_bonus"]
            + result["streak_bonus"]
            + result["perfect_bonus"]
            + result["peer_review"]
            + result["h2h"]
        )
        assert result["total"] == expected


class TestLevelCalculation:
    def test_zero_xp_is_level_1(self):
        result = engine.calculate_level(0)
        assert result["level"] == 1
        assert result["level_name"] == "Apprentice"

    def test_max_level(self):
        result = engine.calculate_level(50000)
        assert result["level"] == 7
        assert result["is_max_level"] is True

    def test_level_progression(self):
        # Just above level 3 threshold
        result = engine.calculate_level(1500)
        assert result["level"] == 3
        assert result["level_name"] == "Associate"

    def test_progress_percentage(self):
        # Halfway between level 1 (0) and level 2 (500)
        result = engine.calculate_level(250)
        assert abs(result["progress_to_next"] - 0.5) < 0.01

    def test_xp_to_next_level(self):
        result = engine.calculate_level(300)
        assert result["xp_to_next_level"] == 200  # 500 - 300


class TestStreaks:
    def test_first_activity_starts_streak(self):
        result = engine.update_streak(last_active_date=None, current_streak=0)
        assert result["streak_days"] == 1
        assert result["streak_broken"] is False

    def test_same_day_no_change(self):
        today = date.today().isoformat()
        result = engine.update_streak(last_active_date=today, current_streak=5)
        assert result["streak_days"] == 5

    def test_consecutive_day_increments(self):
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        result = engine.update_streak(last_active_date=yesterday, current_streak=3)
        assert result["streak_days"] == 4
        assert result["streak_broken"] is False

    def test_missed_day_resets_streak(self):
        two_days_ago = (date.today() - timedelta(days=2)).isoformat()
        result = engine.update_streak(last_active_date=two_days_ago, current_streak=10)
        assert result["streak_days"] == 1
        assert result["streak_broken"] is True


class TestMasteryUnlocks:
    def test_empty_progress_unlocks_nothing(self):
        result = engine.check_mastery_unlocks([])
        assert result["intermediate_scenarios"] is False
        assert result["advanced_scenarios"] is False
        assert result["head_to_head"] is False

    def test_intermediate_unlocked_with_3_above_60(self):
        progress = [
            {"objective_id": "a", "mastery_score": 65},
            {"objective_id": "b", "mastery_score": 70},
            {"objective_id": "c", "mastery_score": 61},
        ]
        result = engine.check_mastery_unlocks(progress)
        assert result["intermediate_scenarios"] is True

    def test_advanced_requires_all_above_75(self):
        progress = [
            {"objective_id": "a", "mastery_score": 80},
            {"objective_id": "b", "mastery_score": 74},  # below 75
        ]
        result = engine.check_mastery_unlocks(progress)
        assert result["advanced_scenarios"] is False

    def test_peer_review_requires_trade_construction_avg_65(self):
        progress = [
            {"objective_id": "trade_thesis", "mastery_score": 70},
            {"objective_id": "strike_selection", "mastery_score": 65},
            {"objective_id": "structure_selection", "mastery_score": 60},
        ]
        result = engine.check_mastery_unlocks(progress)
        assert result["peer_review"] is True
