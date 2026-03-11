"""Application configuration."""
import os
from pydantic_settings import BaseSettings
from pydantic import field_validator
from dotenv import load_dotenv

load_dotenv()


def _normalize_database_url(url: str) -> str:
    """Railway and others may provide postgres:// or postgresql://; asyncpg needs postgresql+asyncpg://."""
    if not url:
        return url
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


class Settings(BaseSettings):
    # App
    APP_NAME: str = "CapMan AI"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Database (normalized for Railway PostgreSQL)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./capman.db")

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_db_url(cls, v: str) -> str:
        return _normalize_database_url(v) if isinstance(v, str) else v

    # API Keys
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    FMP_API_KEY: str = os.getenv("FMP_API_KEY", "")

    # Atlas — CapMan's internal production market data API
    ATLAS_API_KEY: str = os.getenv("ATLAS_API_KEY", "")
    ATLAS_BASE_URL: str = os.getenv("ATLAS_BASE_URL", "https://atlas.capman.io/api/v1")
    USE_ATLAS: bool = os.getenv("USE_ATLAS", "false").lower() == "true"

    # OpenRouter (alternative LLM provider — set USE_OPENROUTER=true to enable)
    USE_OPENROUTER: bool = os.getenv("USE_OPENROUTER", "false").lower() == "true"
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # LangSmith — LLM Observability & Cost Tracing
    LANGCHAIN_TRACING_V2: bool = os.getenv("LANGCHAIN_TRACING_V2", "true").lower() == "true"
    LANGCHAIN_API_KEY: str = os.getenv("LANGCHAIN_API_KEY", "")
    LANGCHAIN_PROJECT: str = os.getenv("LANGCHAIN_PROJECT", "capman-ai")
    LANGCHAIN_ENDPOINT: str = os.getenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com")

    # Sentry — error tracking (optional)
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")
    SENTRY_ENV: str = os.getenv("SENTRY_ENV", "production")

    # Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    @field_validator("SECRET_KEY", mode="after")
    @classmethod
    def check_secret_key(cls, v: str) -> str:
        insecure = {"dev-secret-key-change-in-prod", "your_secret_key_here", "changeme"}
        if v in insecure or len(v) < 20:
            import warnings
            warnings.warn(
                "SECRET_KEY is insecure — set a strong random key (>=20 chars) for production.",
                stacklevel=2,
            )
        return v

    # LLM Settings — use cheapest model that works for each task
    LLM_MODEL: str = "claude-sonnet-4-6"                    # default / scenario gen
    LLM_MODEL_FAST: str = "claude-haiku-4-5-20251001"       # probing & curveball (10× cheaper)
    LLM_MODEL_GRADE: str = "claude-sonnet-4-6"              # grading (needs quality)
    LLM_MAX_TOKENS: int = 2048                              # reduced from 4096
    LLM_MAX_TOKENS_FAST: int = 512                          # probing responses are short
    LLM_TEMPERATURE: float = 0.7

    # Gamification
    XP_BASE_SCENARIO: int = 50
    XP_MAX_GRADE_BONUS: int = 50
    XP_STREAK_BONUS: int = 25
    XP_H2H_WIN: int = 75
    XP_H2H_LOSE: int = 25
    XP_PERFECT_SCORE_BONUS: int = 100
    PERFECT_SCORE_THRESHOLD: float = 95.0

    LEVEL_THRESHOLDS: dict = {
        1: 0,
        2: 500,
        3: 1500,
        4: 3500,
        5: 7000,
        6: 12000,
        7: 20000,
    }

    LEVEL_NAMES: dict = {
        1: "Apprentice",
        2: "Analyst",
        3: "Associate",
        4: "Strategist",
        5: "Senior Strategist",
        6: "Portfolio Lead",
        7: "CapMan Elite",
    }

    class Config:
        env_file = ".env"


settings = Settings()
