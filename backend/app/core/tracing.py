"""LangSmith tracing integration for LLM cost & performance monitoring.

Every LLM call in the system flows through this module, which:
1. Wraps Anthropic calls with LangSmith tracing
2. Tracks token usage, latency, and estimated cost per call
3. Tags calls by purpose (scenario_gen, probing, grading)
4. Aggregates session-level cost for MTSS reporting

LangSmith Dashboard: https://smith.langchain.com
- View traces: every LLM call with input/output/tokens/latency
- Cost analysis: per-session, per-user, per-feature breakdowns
- Quality monitoring: flag low-confidence grades for review
"""
import asyncio
import os
import time
import logging
import functools
from datetime import datetime
from typing import Optional, Callable
from contextlib import asynccontextmanager

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── LangSmith Setup ────────────────────────────────────────
# LangSmith reads these env vars automatically
os.environ["LANGCHAIN_TRACING_V2"] = str(settings.LANGCHAIN_TRACING_V2).lower()
os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT
os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGCHAIN_ENDPOINT

# Try to import langsmith — graceful fallback if not installed
try:
    from langsmith import traceable, Client as LangSmithClient
    from langsmith.run_helpers import get_current_run_tree
    LANGSMITH_AVAILABLE = True
except ImportError:
    LANGSMITH_AVAILABLE = False
    logger.warning("langsmith not installed — tracing disabled")


# ─── Cost Estimation ────────────────────────────────────────

# Anthropic pricing per 1M tokens (as of 2025)
MODEL_PRICING = {
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.00},
    "claude-opus-4-6": {"input": 15.00, "output": 75.00},
}


def estimate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Estimate USD cost for a single LLM call."""
    pricing = MODEL_PRICING.get(model, MODEL_PRICING["claude-sonnet-4-6"])
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost, 6)


# ─── Traced Anthropic Client ────────────────────────────────

class TracedAnthropicClient:
    """Wraps the Anthropic client with LangSmith tracing and cost tracking.

    Usage:
        client = TracedAnthropicClient()
        result = await client.create(
            messages=[...],
            purpose="scenario_generation",
            session_id="abc-123",
            user_id="user-456",
        )
        # result.content, result.usage, result.cost_usd all available
    """

    def __init__(self):
        from anthropic import AsyncAnthropic

        # 120s timeout — scenario generation includes market data fetch + RAG + LLM;
        # 30s was too aggressive and caused silent timeouts.
        llm_timeout = 120.0
        if settings.USE_OPENROUTER and settings.OPENROUTER_API_KEY:
            # OpenRouter uses Anthropic-compatible API with a different base URL
            self.client = AsyncAnthropic(
                api_key=settings.OPENROUTER_API_KEY,
                base_url=settings.OPENROUTER_BASE_URL,
                timeout=llm_timeout,
            )
            self.provider = "openrouter"
            logger.info("LLM Provider: OpenRouter")
        else:
            self.client = AsyncAnthropic(
                api_key=settings.ANTHROPIC_API_KEY,
                timeout=llm_timeout,
            )
            self.provider = "anthropic"
            logger.info("LLM Provider: Anthropic (direct)")

        self.model = settings.LLM_MODEL

    async def create(
        self,
        messages: list[dict],
        purpose: str = "general",
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        system: Optional[str] = None,
    ) -> "TracedResponse":
        """Make a traced LLM call with cost tracking."""
        use_model = model or self.model
        use_max_tokens = max_tokens or settings.LLM_MAX_TOKENS
        use_temp = temperature if temperature is not None else settings.LLM_TEMPERATURE

        # Build kwargs
        kwargs = {
            "model": use_model,
            "max_tokens": use_max_tokens,
            "temperature": use_temp,
            "messages": messages,
        }
        if system:
            kwargs["system"] = system

        # Track timing
        start_time = time.time()

        # Retry with exponential backoff — 3 attempts (2s, 4s delays)
        max_retries = 3
        last_err = None
        for attempt in range(max_retries):
            try:
                response = await self.client.messages.create(**kwargs)
                break
            except Exception as e:
                last_err = e
                if attempt < max_retries - 1:
                    delay = 2 ** (attempt + 1)
                    logger.warning(
                        "LLM call failed (attempt %d/%d, purpose=%s): %s — retrying in %ds",
                        attempt + 1, max_retries, purpose, str(e)[:100], delay,
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error("LLM call failed after %d attempts (purpose=%s): %s", max_retries, purpose, e)
                    raise last_err

        elapsed_ms = round((time.time() - start_time) * 1000, 1)

        # Extract token usage
        input_tokens = response.usage.input_tokens if response.usage else 0
        output_tokens = response.usage.output_tokens if response.usage else 0
        cost_usd = estimate_cost(use_model, input_tokens, output_tokens)

        # Log to LangSmith if available
        if LANGSMITH_AVAILABLE and settings.LANGCHAIN_API_KEY:
            try:
                _log_to_langsmith(
                    purpose=purpose,
                    model=use_model,
                    messages=messages,
                    response_text=response.content[0].text if response.content else "",
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost_usd=cost_usd,
                    latency_ms=elapsed_ms,
                    session_id=session_id,
                    user_id=user_id,
                    temperature=use_temp,
                )
            except Exception as e:
                logger.debug("LangSmith logging error (non-fatal): %s", e)

        return TracedResponse(
            content=response.content,
            text=response.content[0].text if response.content else "",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            latency_ms=elapsed_ms,
            model=use_model,
            purpose=purpose,
        )


class TracedResponse:
    """Enriched response with cost and performance data."""

    def __init__(
        self,
        content,
        text: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: float,
        latency_ms: float,
        model: str,
        purpose: str,
    ):
        self.content = content
        self.text = text
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.total_tokens = input_tokens + output_tokens
        self.cost_usd = cost_usd
        self.latency_ms = latency_ms
        self.model = model
        self.purpose = purpose

    def to_dict(self) -> dict:
        return {
            "model": self.model,
            "purpose": self.purpose,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "cost_usd": self.cost_usd,
            "latency_ms": self.latency_ms,
        }


_langsmith_client = None


def _get_langsmith_client():
    global _langsmith_client
    if _langsmith_client is None:
        _langsmith_client = LangSmithClient()
    return _langsmith_client


def _log_to_langsmith(
    purpose: str,
    model: str,
    messages: list,
    response_text: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
    latency_ms: float,
    session_id: Optional[str],
    user_id: Optional[str],
    temperature: float,
):
    """Log a trace to LangSmith with full metadata."""
    if not LANGSMITH_AVAILABLE:
        return

    try:
        import uuid
        client = _get_langsmith_client()
        run_id = uuid.uuid4()
        now = datetime.utcnow()
        start = now.timestamp() - (latency_ms / 1000)
        start_time = datetime.utcfromtimestamp(start)

        client.create_run(
            name=f"capman_{purpose}",
            run_type="llm",
            id=run_id,
            start_time=start_time,
            end_time=now,
            inputs={
                "messages": [{"role": m["role"], "content": m["content"][:500]} for m in messages],
                "model": model,
                "temperature": temperature,
            },
            outputs={
                "response": response_text[:1000],
            },
            extra={
                "metadata": {
                    "purpose": purpose,
                    "session_id": session_id,
                    "user_id": user_id,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": input_tokens + output_tokens,
                    "cost_usd": cost_usd,
                    "latency_ms": latency_ms,
                    "model": model,
                },
            },
        )
    except Exception as e:
        # Never let tracing break the main flow
        logger.debug("LangSmith trace error: %s", e)


# ─── Session Cost Aggregator ────────────────────────────────

class SessionCostTracker:
    """Tracks cumulative cost across all LLM calls in a training session.

    Usage:
        tracker = SessionCostTracker(session_id="abc", user_id="user-1")
        tracker.add(traced_response)
        tracker.add(traced_response_2)
        summary = tracker.summary()
        # {"total_cost_usd": 0.034, "total_tokens": 5200, "calls": 3, ...}
    """

    def __init__(self, session_id: str, user_id: str):
        self.session_id = session_id
        self.user_id = user_id
        self.calls: list[dict] = []

    def add(self, response: TracedResponse):
        self.calls.append(response.to_dict())

    def summary(self) -> dict:
        total_cost = sum(c["cost_usd"] for c in self.calls)
        total_tokens = sum(c["total_tokens"] for c in self.calls)
        total_input = sum(c["input_tokens"] for c in self.calls)
        total_output = sum(c["output_tokens"] for c in self.calls)
        avg_latency = (
            sum(c["latency_ms"] for c in self.calls) / len(self.calls)
            if self.calls else 0
        )

        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "total_cost_usd": round(total_cost, 6),
            "total_tokens": total_tokens,
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "num_calls": len(self.calls),
            "avg_latency_ms": round(avg_latency, 1),
            "calls_breakdown": self.calls,
            "cost_by_purpose": self._cost_by_purpose(),
        }

    def _cost_by_purpose(self) -> dict:
        by_purpose = {}
        for call in self.calls:
            purpose = call["purpose"]
            if purpose not in by_purpose:
                by_purpose[purpose] = {"cost_usd": 0, "tokens": 0, "count": 0}
            by_purpose[purpose]["cost_usd"] += call["cost_usd"]
            by_purpose[purpose]["tokens"] += call["total_tokens"]
            by_purpose[purpose]["count"] += 1
        return by_purpose
