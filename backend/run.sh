#!/bin/bash
# CapMan AI — Quick Start
# Usage: ./run.sh

set -e

echo "============================================"
echo "  CapMan AI — Quick Start"
echo "============================================"

# Check Python
python3 --version 2>/dev/null || { echo "Python3 not found"; exit 1; }

# Create venv if not exists
if [ ! -d "venv" ]; then
    echo "[1/4] Creating virtual environment..."
    python3 -m venv venv
fi

echo "[2/4] Installing dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt
pip install -q pydantic-settings  # Not in requirements but needed

# Check .env
if [ ! -f ".env" ]; then
    echo ""
    echo "  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo ""
    echo "  ⚠  IMPORTANT: Edit .env and add your API keys:"
    echo "     - ANTHROPIC_API_KEY (required for LLM calls)"
    echo "     - FMP_API_KEY (optional — uses mock data without it)"
    echo ""
    echo "  Then re-run: ./run.sh"
    exit 0
fi

echo "[3/4] Checking API key..."
source .env 2>/dev/null
if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "your_anthropic_api_key_here" ]; then
    echo ""
    echo "  ⚠  ANTHROPIC_API_KEY not set in .env"
    echo "     Get one at: https://console.anthropic.com/settings/keys"
    echo ""
    exit 1
fi
echo "  Anthropic key: ...${ANTHROPIC_API_KEY: -8}"

echo "[4/4] Starting server..."
echo ""
echo "  Server: http://localhost:8000"
echo "  Docs:   http://localhost:8000/docs"
echo ""
echo "  To test: python test_full_flow.py"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
