"""Event logging service for audit trail and analytics."""
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database_models import EventLog


class EventLogger:
    """Logs all user and system events for long-term trajectory tracking."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        user_id: str,
        event_type: str,
        payload: dict = None,
        session_id: Optional[str] = None,
    ):
        """Log an event to the database."""
        event = EventLog(
            user_id=user_id,
            event_type=event_type,
            payload=payload or {},
            session_id=session_id,
            timestamp=datetime.utcnow(),
        )
        self.db.add(event)
        # Don't commit here — let the request lifecycle handle it
