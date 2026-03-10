# CapMan AI — Production Readiness & Deploy

Use this with **Railway (backend)** and **Vercel (frontend)**. Items marked ✅ are done in code; you must complete the **manual steps** below before first deploy.

---

## 🔴 CRITICAL (do before deploy)

### 1. Secrets and `.env` not in git

**If `backend/.env` was ever committed:**

1. **Rotate all exposed API keys** (they are compromised):
   - Anthropic console
   - FMP (Financial Modeling Prep)
   - OpenRouter
   - LangSmith / LangChain
2. Remove the file from tracking (keeps file on disk, stops tracking):
   ```bash
   git rm --cached backend/.env
   git commit -m "Stop tracking backend/.env"
   git push
   ```
3. **Scrub from history** so old keys are not in the repo:
   - Option A: `git filter-repo --path backend/.env --invert-paths` (install: `pip install git-filter-repo`)
   - Option B: [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
4. Confirm `backend/.gitignore` and `frontend/.gitignore` contain `.env` (they do).
5. **Use only env vars in Railway and Vercel** — never commit real keys.

### 2. Alembic and PostgreSQL on Railway

✅ **Done in code:** `alembic/env.py` reads `DATABASE_URL` from the environment and normalizes `postgres://` to `postgresql+asyncpg://`. `app/core/config.py` does the same for the app.

- In Railway, add the **PostgreSQL** plugin; it sets `DATABASE_URL` automatically.
- Run migrations in Railway (e.g. in a one-off command or in your start command):
  ```bash
  cd backend && alembic upgrade head
  ```
- Test locally with Postgres:
  ```bash
  DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/capman alembic upgrade head
  ```

### 3. SECRET_KEY in production

✅ **Done in code:** The app exits at startup if `DEBUG` is false and `SECRET_KEY` is still the default.

- Generate a strong key:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- Set in Railway:
  ```
  SECRET_KEY=<paste-generated-key>
  ```
- Do **not** use the default `dev-secret-key-change-in-prod` in production.

---

## 🟡 HIGH (Week 1)

### 4. CORS

- After the frontend is on Vercel, set in Railway:
  ```
  CORS_ORIGINS=https://your-app.vercel.app
  ```
- For multiple origins, use a comma-separated list (no spaces).

### 5. Database indexes and constraints

✅ **Done in code:** Migration `002_add_indexes_and_constraints.py` adds:

- Unique constraint on `(user_id, objective_id)` in `user_objective_progress`
- Index on `users.created_at`
- Index on `scenario_sessions(user_id, created_at)`

Run `alembic upgrade head` so this migration is applied.

### 6. Auth and rate limiting

✅ **Done in code:**

- Login is rate limited (10/minute per IP) via the shared limiter in `app.core.limiter`; auth routes use the same limiter as the app.
- Password length and validation exist in register.

Still recommended later:

- Logout/token revocation or short-lived tokens + refresh.
- Optional: stricter login rate limit (e.g. 5/minute) if you see abuse.

### 7. Observability and timeouts

✅ **Done in code:**

- LLM client (Anthropic/OpenRouter) uses a **30s timeout** in `app/core/tracing.py` so requests don’t hang indefinitely.

Recommended next:

- Add **Sentry** (or similar): `pip install sentry-sdk[fastapi]` and init in `main.py`.
- Use **LOG_LEVEL=INFO** (or WARNING) in Railway.
- Add request correlation IDs in middleware if you want traceable logs.

---

## 🟢 MEDIUM (Week 2–3)

- **Frontend:** Error boundary, token refresh or re-auth on expiry, and (if needed) passing auth to SSE (e.g. query param or fetch-based SSE).
- **H2H:** WebSocket, matchmaking, shared timer, AI fallback — per product roadmap.
- **MTSS:** Educator override UI, correlation chart, scenario recommendations — per roadmap.
- **Testing / CI:** More backend tests, frontend tests, and a GitHub Actions workflow (lint → test → build).

---

## Deploy steps (quick reference)

### Railway (backend)

1. New project → Deploy from GitHub; **root directory:** `backend`.
2. Add **PostgreSQL** plugin (sets `DATABASE_URL`).
3. Set env vars (no `.env` in repo):
   - `ANTHROPIC_API_KEY`, `FMP_API_KEY` (and others as needed)
   - `SECRET_KEY` (generated)
   - `CORS_ORIGINS=https://your-app.vercel.app`
   - `LOG_LEVEL=INFO`
4. Run migrations (e.g. in a release command or one-off):
   ```bash
  alembic upgrade head
  ```
5. Deploy and note the backend URL (e.g. `https://your-backend.up.railway.app`).

### Vercel (frontend)

1. Import from GitHub; **root directory:** `frontend`.
2. Set:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
   ```
3. Deploy; then set that Vercel URL in Railway’s `CORS_ORIGINS`.

---

## Summary

| Item                         | Status   | Blocking? |
|-----------------------------|----------|-----------|
| Rotate keys, untrack `.env` | Manual   | Yes       |
| Alembic DATABASE_URL        | ✅ Code  | —         |
| SECRET_KEY set in Railway   | Manual   | Yes       |
| CORS_ORIGINS                | Post-deploy | No     |
| DB indexes/constraints      | ✅ Migration | No    |
| Auth rate limit (login)    | ✅ Code  | —         |
| LLM timeout                 | ✅ Code  | —         |

**Bottom line:** Do the **manual** steps for secrets (rotate keys, untrack `.env`, set `SECRET_KEY` in Railway). The codebase is ready for Alembic on Postgres, shared rate limiting, and LLM timeouts. Deploy backend to Railway and frontend to Vercel, then set `CORS_ORIGINS` and iterate on observability and features.
