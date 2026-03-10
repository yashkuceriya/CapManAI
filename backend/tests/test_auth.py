"""Tests for authentication endpoints and utilities."""
import pytest
from httpx import AsyncClient

from app.core.auth import hash_password, verify_password, create_access_token
from app.core.config import settings


# ─── Unit tests for auth utilities ───


class TestPasswordHashing:
    def test_hash_returns_bcrypt_string(self):
        h = hash_password("test123")
        assert h.startswith("$2b$")

    def test_verify_correct_password(self):
        h = hash_password("secret")
        assert verify_password("secret", h) is True

    def test_verify_wrong_password(self):
        h = hash_password("secret")
        assert verify_password("wrong", h) is False

    def test_different_hashes_for_same_password(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # bcrypt uses random salt


class TestJWT:
    def test_create_token_returns_string(self):
        token = create_access_token(data={"sub": "user-123"})
        assert isinstance(token, str)
        assert len(token) > 20

    def test_token_decodes_correctly(self):
        from jose import jwt

        token = create_access_token(data={"sub": "user-456"})
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        assert payload["sub"] == "user-456"
        assert "exp" in payload


# ─── Integration tests for auth endpoints ───


class TestRegisterEndpoint:
    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/register",
            json={
                "username": "testuser",
                "email": "test@example.com",
                "password": "StrongPass123!",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["username"] == "testuser"
        assert data["user"]["role"] == "student"

    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, client: AsyncClient):
        # Register first
        await client.post(
            "/api/auth/register",
            json={
                "username": "dupe",
                "email": "a@example.com",
                "password": "Pass123!",
            },
        )
        # Try again
        resp = await client.post(
            "/api/auth/register",
            json={
                "username": "dupe",
                "email": "b@example.com",
                "password": "Pass123!",
            },
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_register_always_assigns_student_role(self, client: AsyncClient):
        """Even if the client sends role=admin, the server must force 'student'."""
        resp = await client.post(
            "/api/auth/register",
            json={
                "username": "hacker",
                "email": "hacker@example.com",
                "password": "Pass123!",
                "role": "admin",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "student"


class TestLoginEndpoint:
    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient):
        # Register first
        await client.post(
            "/api/auth/register",
            json={
                "username": "loginuser",
                "email": "login@example.com",
                "password": "Pass123!",
            },
        )
        # Login
        resp = await client.post(
            "/api/auth/login",
            data={"username": "loginuser", "password": "Pass123!"},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient):
        await client.post(
            "/api/auth/register",
            json={
                "username": "loginuser2",
                "email": "login2@example.com",
                "password": "Pass123!",
            },
        )
        resp = await client.post(
            "/api/auth/login",
            data={"username": "loginuser2", "password": "wrong"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post(
            "/api/auth/login",
            data={"username": "nobody", "password": "nope"},
        )
        assert resp.status_code == 401
