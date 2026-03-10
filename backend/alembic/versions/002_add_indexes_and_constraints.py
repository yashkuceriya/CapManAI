"""Add indexes and unique constraint for production readiness.

Revision ID: 002_indexes_constraints
Revises: 001_initial_schema
Create Date: Production readiness

- Unique constraint on (user_id, objective_id) in user_objective_progress
- Index on users.created_at for listing/sorting
- Index on scenario_sessions(user_id, created_at) for user session lists
"""
from typing import Sequence, Union

from alembic import op
from alembic import context
import sqlalchemy as sa


revision: str = "002_indexes_constraints"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # user_objective_progress: one row per (user, objective)
    # SQLite requires batch_alter_table for adding constraints
    if context.get_context().dialect.name == "sqlite":
        with op.batch_alter_table("user_objective_progress") as batch_op:
            batch_op.create_unique_constraint(
                "uq_user_objective_progress_user_objective",
                ["user_id", "objective_id"],
            )
    else:
        op.create_unique_constraint(
            "uq_user_objective_progress_user_objective",
            "user_objective_progress",
            ["user_id", "objective_id"],
        )
    # users: index for sorting/filtering by created_at
    op.create_index(
        op.f("ix_users_created_at"),
        "users",
        ["created_at"],
        unique=False,
    )
    # scenario_sessions: common query pattern "sessions for user, by date"
    op.create_index(
        op.f("ix_scenario_sessions_user_created"),
        "scenario_sessions",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_scenario_sessions_user_created"), table_name="scenario_sessions")
    op.drop_index(op.f("ix_users_created_at"), table_name="users")
    if context.get_context().dialect.name == "sqlite":
        with op.batch_alter_table("user_objective_progress") as batch_op:
            batch_op.drop_constraint(
                "uq_user_objective_progress_user_objective",
                type_="unique",
            )
    else:
        op.drop_constraint(
            "uq_user_objective_progress_user_objective",
            "user_objective_progress",
            type_="unique",
        )
