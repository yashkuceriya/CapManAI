"""Pydantic schemas for API request/response models."""
from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional
## Note: DB uses String UUIDs (gen_uuid returns str), so we use str for IDs
from pydantic import BaseModel, Field


# ─── Enums ───────────────────────────────────────────────

class UserRole(str, Enum):
    student = "student"
    educator = "educator"
    admin = "admin"


class MTSSTier(str, Enum):
    tier1 = "tier1"  # On Track
    tier2 = "tier2"  # Targeted Support
    tier3 = "tier3"  # Intensive Support


class Difficulty(str, Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class SessionStatus(str, Enum):
    in_progress = "in_progress"
    probing = "probing"
    graded = "graded"
    reviewed = "reviewed"


class MatchStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    grading = "grading"
    completed = "completed"


class Trend(str, Enum):
    improving = "improving"
    stable = "stable"
    declining = "declining"


# ─── User Schemas ────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: str
    role: UserRole = UserRole.student


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: UserRole
    xp: int
    level: int
    level_name: str
    current_tier: MTSSTier
    streak_days: int
    scenarios_completed: int
    created_at: datetime


class UserProgress(BaseModel):
    user_id: str
    objectives: list[ObjectiveProgress]
    overall_mastery: float
    tier: MTSSTier
    recent_scores: list[float]


# ─── Scenario Schemas ────────────────────────────────────

class ScenarioGenerateRequest(BaseModel):
    difficulty: Difficulty = Difficulty.beginner
    market_regime: Optional[str] = None  # e.g. "high_vol_bearish"
    target_objectives: Optional[list[str]] = None


class ReplayGenerateRequest(BaseModel):
    difficulty: Difficulty = Difficulty.intermediate
    event_id: Optional[str] = None  # Specific event or random selection


class ScenarioResponse(BaseModel):
    id: str  # Scenario ID
    session_id: str  # Session ID — needed for /respond, /probe, /grade endpoints
    market_regime: str
    asset_class: str
    difficulty: Difficulty
    context_prompt: str
    market_data: Optional[dict] = None
    learning_objectives: list[str]
    is_replay: bool = False
    created_at: datetime


class ReplayRevealResponse(BaseModel):
    event_name: str
    narrative: str
    what_happened: dict
    date: str
    key_objectives_tested: list[str]


class CurveballResponse(BaseModel):
    curveball_id: str
    type: str
    severity: str
    headline: str
    customized_context: str
    market_impact: dict
    data_update: dict
    probing_angle: str


class CurveballAdaptRequest(BaseModel):
    adaptation_text: str = Field(..., min_length=1, max_length=15000)


class StudentResponseSubmit(BaseModel):
    response_text: str = Field(..., min_length=1, max_length=15000)


class ProbeResponse(BaseModel):
    probe_question: str
    probe_number: int
    total_probes: int


class StudentProbeAnswer(BaseModel):
    answer_text: str = Field(..., min_length=1, max_length=15000)


# ─── Grade Schemas ───────────────────────────────────────

class DimensionScore(BaseModel):
    dimension: str
    score: float
    feedback: str


class GradeResult(BaseModel):
    overall_score: float
    dimension_scores: list[DimensionScore]
    strengths: list[str]
    areas_for_improvement: list[str]
    reasoning_quality: float
    capman_lexicon_usage: float
    confidence: float
    xp_earned: int


class EducatorOverride(BaseModel):
    adjusted_score: float
    note: Optional[str] = None


# ─── Session Schemas ─────────────────────────────────────

class Message(BaseModel):
    role: str  # "student", "agent", "system"
    content: str
    timestamp: datetime


class SessionResponse(BaseModel):
    id: str
    scenario_id: str
    user_id: str
    status: SessionStatus
    conversation: list[Message]
    grade: Optional[GradeResult] = None
    xp_earned: int
    time_spent_seconds: int
    created_at: datetime


# ─── Objective Schemas ───────────────────────────────────

class ObjectiveProgress(BaseModel):
    objective_id: str
    objective_name: str
    category: str
    attempts: int
    mastery_score: float
    trend: Trend


# ─── MTSS Schemas ────────────────────────────────────────

class MTSSOverview(BaseModel):
    tier1_students: list[MTSSStudentSummary]
    tier2_students: list[MTSSStudentSummary]
    tier3_students: list[MTSSStudentSummary]


class MTSSStudentSummary(BaseModel):
    user_id: str
    username: str
    tier: MTSSTier
    overall_mastery: float
    weakest_objective: Optional[str] = None
    scenarios_completed: int
    last_active: datetime


class MTSSStudentDetail(BaseModel):
    user: UserResponse
    objectives: list[ObjectiveProgress]
    recent_sessions: list[SessionResponse]
    tier_history: list[dict]


# ─── Leaderboard Schemas ─────────────────────────────────

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    level: int
    level_name: str
    value: float  # XP, mastery, or volume depending on mode
    label: str  # "XP", "Mastery %", "Scenarios"


class LeaderboardResponse(BaseModel):
    mode: str  # "xp", "mastery", "volume", "weekly"
    entries: list[LeaderboardEntry]
    your_rank: Optional[int] = None


# ─── Head-to-Head Schemas ────────────────────────────────

class H2HMatchRequest(BaseModel):
    pass  # Just trigger matchmaking


class H2HMatchResponse(BaseModel):
    match_id: str
    opponent_username: str
    scenario: ScenarioResponse
    time_limit_seconds: int
    status: MatchStatus


class H2HResultResponse(BaseModel):
    match_id: str
    your_score: float
    opponent_score: float
    winner_username: str
    xp_earned: int


# ─── Peer Review Schemas ─────────────────────────────────

class PeerReviewSubmit(BaseModel):
    score: float = Field(ge=0, le=100)
    feedback: str


class PeerReviewResponse(BaseModel):
    session: SessionResponse
    reviewer_score: Optional[float] = None
    reviewer_feedback: Optional[str] = None


# ─── Event Log ───────────────────────────────────────────

class EventLogEntry(BaseModel):
    id: str
    timestamp: datetime
    user_id: str
    event_type: str
    payload: dict
    session_id: Optional[str] = None


# Fix forward references
UserProgress.model_rebuild()
MTSSOverview.model_rebuild()
