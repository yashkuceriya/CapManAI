"""SQLAlchemy database models."""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, JSON,
    ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(20), default="student", nullable=False)  # student, educator, admin
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    current_tier = Column(String(10), default="tier1")  # tier1, tier2, tier3
    streak_days = Column(Integer, default=0)
    last_active_date = Column(String(10), nullable=True)  # YYYY-MM-DD for streak tracking
    scenarios_completed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sessions = relationship("ScenarioSession", back_populates="user", foreign_keys="[ScenarioSession.user_id]")
    objective_progress = relationship("UserObjectiveProgress", back_populates="user")
    event_logs = relationship("EventLog", back_populates="user", foreign_keys="[EventLog.user_id]")


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(String, primary_key=True, default=gen_uuid)
    market_regime = Column(String(50), nullable=False)
    asset_class = Column(String(50), nullable=False)
    difficulty = Column(String(20), nullable=False)
    context_prompt = Column(Text, nullable=False)
    market_data = Column(JSON, nullable=True)  # Options chain, greeks, prices
    learning_objectives = Column(JSON, nullable=False)  # list of objective IDs
    expected_analysis = Column(Text, nullable=True)  # Model answer for grading reference
    generated_by = Column(String(50), default="claude-sonnet")
    fingerprint = Column(String(64), nullable=True, index=True)  # For dedup

    # Historical Replay fields
    is_replay = Column(Boolean, default=False)
    replay_event_id = Column(String(100), nullable=True)  # e.g. "gme_squeeze_2021"
    replay_reveal = Column(JSON, nullable=True)  # Reveal narrative + what_happened

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    sessions = relationship("ScenarioSession", back_populates="scenario")


class ScenarioSession(Base):
    __tablename__ = "scenario_sessions"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    status = Column(String(20), default="in_progress")  # in_progress, probing, graded, reviewed
    initial_response = Column(Text, nullable=True)
    conversation = Column(JSON, default=list)  # List of {role, content, timestamp}
    probe_count = Column(Integer, default=0)

    # Grading
    overall_score = Column(Float, nullable=True)
    dimension_scores = Column(JSON, nullable=True)
    strengths = Column(JSON, nullable=True)
    areas_for_improvement = Column(JSON, nullable=True)
    reasoning_quality = Column(Float, nullable=True)
    capman_lexicon_usage = Column(Float, nullable=True)
    grade_confidence = Column(Float, nullable=True)

    # Educator override
    educator_override_score = Column(Float, nullable=True)
    educator_override_note = Column(Text, nullable=True)
    educator_override_by = Column(String, ForeignKey("users.id"), nullable=True)

    # Gamification
    xp_earned = Column(Integer, default=0)
    time_spent_seconds = Column(Integer, default=0)

    # Curveball fields
    curveball_injected = Column(Boolean, default=False)
    curveball_id = Column(String(100), nullable=True)  # e.g. "fed_emergency_cut"
    curveball_data = Column(JSON, nullable=True)  # Full curveball payload
    curveball_response = Column(Text, nullable=True)  # Student's adaptation response
    adaptability_score = Column(Float, nullable=True)  # 7th grading dimension when curveball active

    # Peer review
    peer_review_score = Column(Float, nullable=True)
    peer_review_feedback = Column(Text, nullable=True)
    peer_reviewed_by = Column(String, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions", foreign_keys=[user_id])
    scenario = relationship("Scenario", back_populates="sessions")


class LearningObjective(Base):
    __tablename__ = "learning_objectives"

    id = Column(String(50), primary_key=True)  # e.g., "strike_selection"
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=False)  # e.g., "trade_construction"


class UserObjectiveProgress(Base):
    __tablename__ = "user_objective_progress"

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    objective_id = Column(String(50), ForeignKey("learning_objectives.id"), nullable=False)
    attempts = Column(Integer, default=0)
    mastery_score = Column(Float, default=0.0)  # Rolling weighted average
    trend = Column(String(20), default="stable")  # improving, stable, declining
    recent_scores = Column(JSON, default=list)  # Last 10 scores for trend calc
    last_assessed = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="objective_progress")


class HeadToHeadMatch(Base):
    __tablename__ = "h2h_matches"

    id = Column(String, primary_key=True, default=gen_uuid)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=True)
    player_1_id = Column(String, ForeignKey("users.id"), nullable=False)
    player_2_id = Column(String, ForeignKey("users.id"), nullable=True)
    player_1_session_id = Column(String, ForeignKey("scenario_sessions.id"), nullable=True)
    player_2_session_id = Column(String, ForeignKey("scenario_sessions.id"), nullable=True)
    status = Column(String(20), default="pending")
    winner_id = Column(String, ForeignKey("users.id"), nullable=True)
    time_limit_seconds = Column(Integer, default=300)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class EventLog(Base):
    __tablename__ = "event_logs"

    id = Column(String, primary_key=True, default=gen_uuid)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    event_type = Column(String(50), nullable=False, index=True)
    payload = Column(JSON, default=dict)
    session_id = Column(String, nullable=True)

    # Relationships
    user = relationship("User", back_populates="event_logs")
