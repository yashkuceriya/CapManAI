#!/usr/bin/env python3
"""CapMan AI — Run all tests.

1. Offline validation (no server, no API keys) — always runs.
2. E2E (optional) — runs if server is up at BASE_URL.

Usage:
    python run_all_tests.py                    # offline only
    python run_all_tests.py --e2e              # offline + E2E (fail if server down)
    python run_all_tests.py --e2e --base-url http://localhost:8000

For E2E, start the server first:
    cd backend && uvicorn app.main:app --reload
"""
import subprocess
import sys
import argparse

def main():
    p = argparse.ArgumentParser(description="Run CapMan test suites")
    p.add_argument("--e2e", action="store_true", help="Also run E2E tests (requires server)")
    p.add_argument("--base-url", default="http://localhost:8000", help="E2E base URL")
    args = p.parse_args()

    # 1. Offline suite
    print("Running offline validation suite...\n")
    r = subprocess.run([sys.executable, "test_offline.py"], cwd=".")
    if r.returncode != 0:
        print("\nOffline suite failed. Fix errors before running E2E.")
        return r.returncode

    if not args.e2e:
        print("\nAll offline checks passed. (Use --e2e to run E2E against a running server.)")
        return 0

    # 2. E2E
    print("\nRunning E2E test suite...\n")
    r = subprocess.run(
        [sys.executable, "test_full_flow.py", "--base-url", args.base_url],
        cwd=".",
    )
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
