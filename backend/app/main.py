"""CapMan AI — Main FastAPI Application."""
import os
import sys
import logging
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.database import init_db, engine
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.api import scenarios, users, mtss, auth, h2h, peer_review, market
from app.services.rag import get_rag
from app.scripts.seed_data import seed_demo_data

logger = logging.getLogger(__name__)

# ── Rate limiter (shared instance; auth uses same from app.core.limiter) ──
try:
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from app.core.limiter import limiter

    _HAS_SLOWAPI = limiter is not None
except ImportError:
    _HAS_SLOWAPI = False
    limiter = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and RAG on startup."""
    # ── Sentry error tracking (optional — set SENTRY_DSN env var) ──
    if settings.SENTRY_DSN:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
            sentry_sdk.init(
                dsn=settings.SENTRY_DSN,
                environment=settings.SENTRY_ENV,
                traces_sample_rate=0.1,
                send_default_pii=False,
                integrations=[FastApiIntegration(), SqlalchemyIntegration()],
            )
            logger.info("Sentry error tracking enabled (env=%s)", settings.SENTRY_ENV)
        except ImportError:
            logger.warning("SENTRY_DSN set but sentry-sdk not installed — pip install sentry-sdk[fastapi]")

    # ── Safety check: refuse to start with default secret in production ──
    if not settings.DEBUG and settings.SECRET_KEY == "dev-secret-key-change-in-prod":
        logger.critical("FATAL: default SECRET_KEY detected in production. Set SECRET_KEY env var.")
        sys.exit(1)

    # Setup logging first
    setup_logging()

    # Initialize database tables
    await init_db()

    # Log market data adapter in use
    if settings.USE_ATLAS:
        if not settings.ATLAS_API_KEY:
            logger.warning("USE_ATLAS=true but ATLAS_API_KEY is empty — will fall back to mock data")
        else:
            logger.info("Atlas market data enabled → %s", settings.ATLAS_BASE_URL)

    # Load RAG documents
    get_rag()

    # Seed demo data
    await seed_demo_data()
    logger.info("Demo data seeded")

    yield

    # ── Graceful shutdown: close open connections ──
    logger.info("CapMan AI shutting down — cleaning up resources...")

    # Close market data HTTP clients
    try:
        adapter = scenarios.scenario_engine.market_data
        if hasattr(adapter, 'close'):
            await adapter.close()
            logger.info("Market data adapter closed")
    except Exception as e:
        logger.warning("Error closing market data adapter: %s", e)

    # Close database engine connections
    try:
        await engine.dispose()
        logger.info("Database engine disposed")
    except Exception as e:
        logger.warning("Error disposing database engine: %s", e)

    logger.info("CapMan AI shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered gamified trading scenario training with MTSS reporting",
    version="1.0.0",
    lifespan=lifespan,
    # Disable docs in production
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ── Request ID middleware — adds X-Request-ID for log correlation ──
import contextvars
_request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

# Patch log record factory once (thread/async-safe via contextvars)
_original_factory = logging.getLogRecordFactory()
def _record_factory(*args, **kwargs):
    record = _original_factory(*args, **kwargs)
    record.request_id = _request_id_var.get("-")  # type: ignore[attr-defined]
    return record
logging.setLogRecordFactory(_record_factory)

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
    request.state.request_id = request_id
    token = _request_id_var.set(request_id)
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    finally:
        _request_id_var.reset(token)

# ── Rate limiter middleware ──
if _HAS_SLOWAPI:
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS middleware — restrict in production via CORS_ORIGINS env var ──
_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Trusted host middleware (production only) ──
_trusted_hosts = os.getenv("TRUSTED_HOSTS", "")
if _trusted_hosts:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=_trusted_hosts.split(","),
    )

# Include routers
app.include_router(auth.router)
app.include_router(scenarios.router)
app.include_router(users.router)
app.include_router(mtss.router)
app.include_router(h2h.router)
app.include_router(peer_review.router)
app.include_router(market.router)


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "features": [
            "Dynamic scenario generation with real market data (FMP)",
            "Multi-turn Socratic probing (1-3 follow-up questions)",
            "Structured 6-dimension grading with RAG-enhanced rubrics",
            "Historical Market Replay — trade real events (GME, COVID, SVB)",
            "Mid-Scenario Curveballs — breaking events + 7th Adaptability dimension",
            "Gamification (XP, 7 levels, mastery-based unlocks)",
            "MTSS 3-tier educator dashboard",
            "LangSmith cost tracing per LLM call",
        ],
        "endpoints": {
            "scenarios": "/api/scenarios",
            "replay": "/api/scenarios/replay",
            "replay_events": "/api/scenarios/replay/events",
            "users": "/api/users",
            "mtss": "/api/mtss",
            "docs": "/docs",
        },
    }


@app.get("/health")
async def health():
    """Production health check — tests DB connectivity and reports service status."""
    checks = {}

    # Check database
    try:
        from app.core.database import async_session
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    # Check Anthropic API key configured
    checks["llm_configured"] = bool(settings.ANTHROPIC_API_KEY and settings.ANTHROPIC_API_KEY != "your_anthropic_api_key_here")

    # Check market data source
    if settings.USE_ATLAS:
        checks["market_data"] = "atlas" if settings.ATLAS_API_KEY else "atlas_no_key"
    elif settings.FMP_API_KEY and settings.FMP_API_KEY != "your_fmp_api_key_here":
        checks["market_data"] = "fmp_hybrid"
    else:
        checks["market_data"] = "mock"

    all_ok = checks["database"] == "ok"

    return {
        "status": "healthy" if all_ok else "degraded",
        "checks": checks,
    }
