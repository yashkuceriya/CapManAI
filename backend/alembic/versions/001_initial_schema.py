"""Initial schema creation with all tables.

Revision ID: 001_initial_schema
Revises: None
Create Date: 2026-03-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table (no foreign keys)
    op.create_table(
        'users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('xp', sa.Integer(), nullable=False),
        sa.Column('level', sa.Integer(), nullable=False),
        sa.Column('current_tier', sa.String(10), nullable=False),
        sa.Column('streak_days', sa.Integer(), nullable=False),
        sa.Column('last_active_date', sa.String(10), nullable=True),
        sa.Column('scenarios_completed', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
        sa.UniqueConstraint('email'),
    )
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # Create scenarios table (no foreign keys)
    op.create_table(
        'scenarios',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('market_regime', sa.String(50), nullable=False),
        sa.Column('asset_class', sa.String(50), nullable=False),
        sa.Column('difficulty', sa.String(20), nullable=False),
        sa.Column('context_prompt', sa.Text(), nullable=False),
        sa.Column('market_data', sa.JSON(), nullable=True),
        sa.Column('learning_objectives', sa.JSON(), nullable=False),
        sa.Column('expected_analysis', sa.Text(), nullable=True),
        sa.Column('generated_by', sa.String(50), nullable=False),
        sa.Column('fingerprint', sa.String(64), nullable=True),
        sa.Column('is_replay', sa.Boolean(), nullable=False),
        sa.Column('replay_event_id', sa.String(100), nullable=True),
        sa.Column('replay_reveal', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_scenarios_fingerprint'), 'scenarios', ['fingerprint'], unique=False)

    # Create learning_objectives table (no foreign keys, static reference data)
    op.create_table(
        'learning_objectives',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create scenario_sessions table (foreign keys to users and scenarios)
    op.create_table(
        'scenario_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('scenario_id', sa.String(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('initial_response', sa.Text(), nullable=True),
        sa.Column('conversation', sa.JSON(), nullable=False),
        sa.Column('probe_count', sa.Integer(), nullable=False),
        sa.Column('overall_score', sa.Float(), nullable=True),
        sa.Column('dimension_scores', sa.JSON(), nullable=True),
        sa.Column('strengths', sa.JSON(), nullable=True),
        sa.Column('areas_for_improvement', sa.JSON(), nullable=True),
        sa.Column('reasoning_quality', sa.Float(), nullable=True),
        sa.Column('capman_lexicon_usage', sa.Float(), nullable=True),
        sa.Column('grade_confidence', sa.Float(), nullable=True),
        sa.Column('educator_override_score', sa.Float(), nullable=True),
        sa.Column('educator_override_note', sa.Text(), nullable=True),
        sa.Column('educator_override_by', sa.String(), nullable=True),
        sa.Column('xp_earned', sa.Integer(), nullable=False),
        sa.Column('time_spent_seconds', sa.Integer(), nullable=False),
        sa.Column('curveball_injected', sa.Boolean(), nullable=False),
        sa.Column('curveball_id', sa.String(100), nullable=True),
        sa.Column('curveball_data', sa.JSON(), nullable=True),
        sa.Column('curveball_response', sa.Text(), nullable=True),
        sa.Column('adaptability_score', sa.Float(), nullable=True),
        sa.Column('peer_review_score', sa.Float(), nullable=True),
        sa.Column('peer_review_feedback', sa.Text(), nullable=True),
        sa.Column('peer_reviewed_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ),
        sa.ForeignKeyConstraint(['educator_override_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['peer_reviewed_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create user_objective_progress table (foreign keys to users and learning_objectives)
    op.create_table(
        'user_objective_progress',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('objective_id', sa.String(50), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('mastery_score', sa.Float(), nullable=False),
        sa.Column('trend', sa.String(20), nullable=False),
        sa.Column('recent_scores', sa.JSON(), nullable=False),
        sa.Column('last_assessed', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['objective_id'], ['learning_objectives.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create h2h_matches table (foreign keys to users and scenario_sessions)
    op.create_table(
        'h2h_matches',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('scenario_id', sa.String(), nullable=True),
        sa.Column('player_1_id', sa.String(), nullable=False),
        sa.Column('player_2_id', sa.String(), nullable=True),
        sa.Column('player_1_session_id', sa.String(), nullable=True),
        sa.Column('player_2_session_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('winner_id', sa.String(), nullable=True),
        sa.Column('time_limit_seconds', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['scenario_id'], ['scenarios.id'], ),
        sa.ForeignKeyConstraint(['player_1_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['player_2_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['player_1_session_id'], ['scenario_sessions.id'], ),
        sa.ForeignKeyConstraint(['player_2_session_id'], ['scenario_sessions.id'], ),
        sa.ForeignKeyConstraint(['winner_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Create event_logs table (foreign key to users)
    op.create_table(
        'event_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_event_logs_timestamp'), 'event_logs', ['timestamp'], unique=False)
    op.create_index(op.f('ix_event_logs_event_type'), 'event_logs', ['event_type'], unique=False)


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_index(op.f('ix_event_logs_event_type'), table_name='event_logs')
    op.drop_index(op.f('ix_event_logs_timestamp'), table_name='event_logs')
    op.drop_table('event_logs')

    op.drop_table('h2h_matches')

    op.drop_table('user_objective_progress')

    op.drop_table('scenario_sessions')

    op.drop_table('learning_objectives')

    op.drop_index(op.f('ix_scenarios_fingerprint'), table_name='scenarios')
    op.drop_table('scenarios')

    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_table('users')
