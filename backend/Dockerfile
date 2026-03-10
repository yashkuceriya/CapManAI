# CapMan AI Backend — production image
# Build: docker build -t capman-backend .
# Run:   docker run -p 8000:8000 -e ANTHROPIC_API_KEY=... -e SECRET_KEY=... capman-backend

FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY app/ ./app/
COPY alembic.ini ./
COPY alembic/ ./alembic/

# Non-root user
RUN useradd -m -u 1000 app
USER app

ENV PORT=8000
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Override in production via env vars
ENV DATABASE_URL=sqlite+aiosqlite:///./capman.db

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# WEB_CONCURRENCY: set to 2× CPU cores in production (default: 2 for safety)
ENV WEB_CONCURRENCY=2

CMD ["sh", "-c", "python -m alembic upgrade head 2>/dev/null || true && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY} --loop uvloop --http httptools --log-level info"]
