"""Authentication API routes (login, register) with rate limiting."""
import logging
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, field_validator

from app.core.database import get_db
from app.core.auth import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.models.database_models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Rate limiting via shared app limiter (same instance as main.py so limits apply) ──
try:
    from app.core.limiter import limiter

    _login_limit = limiter.limit("10/minute") if limiter else (lambda f: f)
    _register_limit = limiter.limit("5/minute") if limiter else (lambda f: f)
except ImportError:
    def _login_limit(func):
        return func

    def _register_limit(func):
        return func


# ── Request schemas ──

_PASSWORD_MIN_LENGTH = 8


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "student"

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 30:
            raise ValueError("Username must be 3-30 characters")
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username can only contain letters, numbers, and underscores")
        return v

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email address")
        return v

    @field_validator("password")
    @classmethod
    def password_strong(cls, v: str) -> str:
        if len(v) < _PASSWORD_MIN_LENGTH:
            raise ValueError(f"Password must be at least {_PASSWORD_MIN_LENGTH} characters")
        return v


# ── Endpoints ──


@router.post("/login")
@_login_limit
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Login endpoint. Accepts username and password, returns access token.

    Rate limited to 10 requests/minute per IP to prevent brute force.
    """
    # Look up user by username
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
        )

    # Verify password
    if not user.password_hash or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
        )

    # Create access token
    access_token = create_access_token(data={"sub": user.id})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "xp": user.xp,
            "level": user.level,
        },
    }


@router.post("/register")
@_register_limit
async def register(
    request: Request,
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user with username, email, and password.

    Rate limited to 5 requests/minute per IP to prevent abuse.
    Input is validated: username 3-30 alphanumeric chars, valid email, password >= 8 chars.
    """
    # Check if username already exists
    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Username already exists",
        )

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    # Hash password and create user
    # Always assign "student" on self-registration — role field in request is ignored.
    # Elevating to educator/admin requires direct DB update by an admin.
    password_hash = hash_password(body.password)
    user = User(
        username=body.username,
        email=body.email,
        password_hash=password_hash,
        role="student",
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Username or email already exists",
        )

    # Create access token
    access_token = create_access_token(data={"sub": user.id})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "xp": user.xp,
            "level": user.level,
        },
    }


@router.post("/logout")
async def logout(request: Request):
    """Logout endpoint.

    With stateless JWT tokens, the actual token invalidation happens client-side
    by removing the token from localStorage. This endpoint exists for:
    1. Future token blacklist implementation
    2. Audit logging of logout events
    3. Frontend consistency (call API on logout)
    """
    # Future: add token to blacklist (Redis/DB)
    logger.info("User logged out")
    return {"status": "logged_out"}
