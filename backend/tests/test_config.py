"""Tests for application configuration."""
from app.core.config import settings


class TestConfig:
    def test_app_name(self):
        assert settings.APP_NAME == "CapMan AI"

    def test_level_thresholds_are_monotonic(self):
        thresholds = list(settings.LEVEL_THRESHOLDS.values())
        for i in range(1, len(thresholds)):
            assert thresholds[i] > thresholds[i - 1]

    def test_all_levels_have_names(self):
        for level in settings.LEVEL_THRESHOLDS:
            assert level in settings.LEVEL_NAMES

    def test_xp_values_are_positive(self):
        assert settings.XP_BASE_SCENARIO > 0
        assert settings.XP_MAX_GRADE_BONUS > 0
        assert settings.XP_STREAK_BONUS > 0

    def test_perfect_score_threshold_is_reasonable(self):
        assert 80 <= settings.PERFECT_SCORE_THRESHOLD <= 100

    def test_token_expiry_is_set(self):
        assert settings.ACCESS_TOKEN_EXPIRE_MINUTES > 0
