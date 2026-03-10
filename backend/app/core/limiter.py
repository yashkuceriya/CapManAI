"""Shared rate limiter for the app (SlowAPI). Use this single instance so auth and other routes are tracked together."""
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
except ImportError:
    limiter = None
