"""Market data adapter — FMP for live data, Yahoo Finance for historical.

Architecture:
  - FMPAdapter:  real-time quotes + options chains (works on free tier)
  - YahooHistoricalProvider: 30/60-day OHLCV history (free, no key needed)
  - HybridAdapter: combines FMP live + Yahoo historical (the default)
  - MockAdapter:  offline fallback for dev/testing
  - _HistoryCache: in-memory TTL cache so we don't hammer Yahoo on every request
"""
from abc import ABC, abstractmethod
from typing import Optional
import asyncio
import httpx
import random
import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
#  In-memory cache with TTL (avoids hammering Yahoo/FMP)
# ═══════════════════════════════════════════════════════════

class _HistoryCache:
    """Simple in-memory {key: (data, expires_at)} cache."""

    def __init__(self, ttl_seconds: int = 3600):
        self._store: dict[str, tuple[list, float]] = {}
        self._ttl = ttl_seconds

    def get(self, key: str) -> Optional[list]:
        entry = self._store.get(key)
        if entry and entry[1] > time.time():
            return entry[0]
        return None

    def set(self, key: str, data: list):
        self._store[key] = (data, time.time() + self._ttl)

    def clear(self):
        self._store.clear()


# One shared cache — 1 hour TTL (historical data doesn't change intraday)
_history_cache = _HistoryCache(ttl_seconds=3600)


# ═══════════════════════════════════════════════════════════
#  Yahoo Finance historical provider
# ═══════════════════════════════════════════════════════════

class YahooHistoricalProvider:
    """Fetches historical OHLCV from Yahoo Finance via yfinance.

    yfinance is synchronous, so all calls are wrapped in run_in_executor
    to keep the FastAPI event loop responsive.  Results are cached for 1 hour.
    """

    @staticmethod
    def _is_available() -> bool:
        try:
            import yfinance  # noqa: F401
            return True
        except ImportError:
            return False

    @staticmethod
    def _fetch_history(symbol: str, period: str = "3mo") -> list:
        """Synchronous fetch — runs inside a thread executor."""
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, auto_adjust=True)

        if df is None or df.empty:
            return []

        out = []
        for idx, row in df.iterrows():
            try:
                out.append({
                    "date": idx.strftime("%Y-%m-%d"),
                    "open": round(float(row.get("Open", 0)), 2),
                    "high": round(float(row.get("High", 0)), 2),
                    "low": round(float(row.get("Low", 0)), 2),
                    "close": round(float(row.get("Close", 0)), 2),
                    "volume": int(row.get("Volume", 0)),
                })
            except (TypeError, ValueError):
                continue
        return out

    @staticmethod
    def _fetch_range(symbol: str, start: str, end: str) -> list:
        """Synchronous fetch for a specific date range — runs inside a thread executor."""
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start, end=end, auto_adjust=True)

        if df is None or df.empty:
            return []

        out = []
        for idx, row in df.iterrows():
            try:
                out.append({
                    "date": idx.strftime("%Y-%m-%d"),
                    "open": round(float(row.get("Open", 0)), 2),
                    "high": round(float(row.get("High", 0)), 2),
                    "low": round(float(row.get("Low", 0)), 2),
                    "close": round(float(row.get("Close", 0)), 2),
                    "volume": int(row.get("Volume", 0)),
                })
            except (TypeError, ValueError):
                continue
        return out

    @classmethod
    async def get_history(cls, symbol: str, days: int = 60) -> list:
        """Async wrapper — checks cache, then fetches via thread executor."""
        cache_key = f"yf:{symbol}:{days}"
        cached = _history_cache.get(cache_key)
        if cached is not None:
            logger.debug("Yahoo cache hit: %s (%d days)", symbol, days)
            return cached

        if not cls._is_available():
            logger.warning("yfinance not installed — cannot fetch Yahoo historical data")
            return []

        # Map days to yfinance period string
        if days <= 5:
            period = "5d"
        elif days <= 30:
            period = "1mo"
        elif days <= 90:
            period = "3mo"
        elif days <= 180:
            period = "6mo"
        else:
            period = "1y"

        try:
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(None, cls._fetch_history, symbol, period)
            # Trim to requested days and reverse so newest first (matching FMP behavior)
            data = data[-days:] if len(data) > days else data
            if data:
                _history_cache.set(cache_key, data)
                logger.info("Yahoo fetched %d days for %s", len(data), symbol)
            return data
        except Exception as e:
            logger.warning("Yahoo historical fetch error for %s: %s", symbol, e)
            return []

    @classmethod
    async def get_history_range(cls, symbol: str, start_date: str, end_date: str) -> list:
        """Async wrapper for date-range fetch."""
        cache_key = f"yf:{symbol}:{start_date}:{end_date}"
        cached = _history_cache.get(cache_key)
        if cached is not None:
            return cached

        if not cls._is_available():
            return []

        try:
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(None, cls._fetch_range, symbol, start_date, end_date)
            if data:
                _history_cache.set(cache_key, data)
                logger.info("Yahoo fetched %s range %s→%s (%d rows)", symbol, start_date, end_date, len(data))
            return data
        except Exception as e:
            logger.warning("Yahoo range fetch error for %s: %s", symbol, e)
            return []


# ═══════════════════════════════════════════════════════════
#  Abstract interface
# ═══════════════════════════════════════════════════════════

class MarketDataAdapter(ABC):
    """Abstract interface — swap implementations without touching scenario engine."""

    @abstractmethod
    async def get_options_chain(self, symbol: str, expiry_range: int = 30) -> dict:
        ...

    @abstractmethod
    async def get_stock_quote(self, symbol: str) -> dict:
        ...

    @abstractmethod
    async def get_historical_prices(self, symbol: str, days: int = 60) -> list:
        ...

    @abstractmethod
    async def get_market_snapshot(self, symbol: str) -> dict:
        ...

    @abstractmethod
    async def get_historical_prices_range(self, symbol: str, start_date: str, end_date: str) -> list:
        """Get historical prices for a specific date range (YYYY-MM-DD format)."""
        ...


# ═══════════════════════════════════════════════════════════
#  FMP Adapter — live quotes + options chains only
# ═══════════════════════════════════════════════════════════

class FMPAdapter(MarketDataAdapter):
    """FMP free tier: real-time quotes + options chains.

    Historical prices are NOT reliable on free tier (returns only 1 day),
    so this adapter is NOT used standalone — see HybridAdapter instead.
    """

    def __init__(self, api_key: str = None):
        self.api_key = api_key or settings.FMP_API_KEY
        self.base_url = "https://financialmodelingprep.com/stable"
        self.client = httpx.AsyncClient(
            timeout=15.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=5, keepalive_expiry=30),
        )

    async def close(self):
        """Close the underlying HTTP client to release connections."""
        await self.client.aclose()

    async def get_options_chain(self, symbol: str, expiry_range: int = 30) -> dict:
        """Real options chain with strikes, premiums, greeks, IV, OI."""
        try:
            resp = await self.client.get(
                f"{self.base_url}/options-chain",
                params={"symbol": symbol, "apikey": self.api_key}
            )
            resp.raise_for_status()
            data = resp.json()

            if isinstance(data, list) and len(data) > 0:
                chain = self._restructure_fmp_chain(data, expiry_range)
                return {
                    "symbol": symbol,
                    "chain": chain[:12],
                    "count": len(chain),
                }
            return {"symbol": symbol, "chain": [], "count": 0}
        except Exception as e:
            logger.warning("FMP options chain error, falling back to mock: %s", e)
            return await MockAdapter().get_options_chain(symbol, expiry_range)

    def _restructure_fmp_chain(self, flat_data: list, expiry_range: int = 30) -> list:
        """Convert FMP's flat option list into paired call/put by strike."""
        # Filter to nearest expiration within range
        target_date = (datetime.now() + timedelta(days=expiry_range)).strftime("%Y-%m-%d")
        expirations = sorted(set(o.get("expiration", "") for o in flat_data if o.get("expiration")))

        chosen_expiry = None
        for exp in expirations:
            if exp <= target_date:
                chosen_expiry = exp
            else:
                if chosen_expiry is None:
                    chosen_expiry = exp
                break
        if chosen_expiry is None and expirations:
            chosen_expiry = expirations[0]

        by_strike = defaultdict(lambda: {"call": {}, "put": {}})
        for opt in flat_data:
            if opt.get("expiration") != chosen_expiry:
                continue
            strike = opt.get("strike", 0)
            opt_type = opt.get("type", "").lower()
            if opt_type not in ("call", "put"):
                continue

            by_strike[strike][opt_type] = {
                "bid": opt.get("bid", 0),
                "ask": opt.get("ask", 0),
                "last": opt.get("lastPrice", opt.get("last", 0)),
                "iv": round((opt.get("impliedVolatility", 0) or 0) * 100, 1),
                "delta": opt.get("delta", 0),
                "gamma": opt.get("gamma", 0),
                "theta": opt.get("theta", 0),
                "vega": opt.get("vega", 0),
                "open_interest": opt.get("openInterest", 0),
                "volume": opt.get("volume", 0),
            }

        chain = []
        for strike in sorted(by_strike.keys()):
            pair = by_strike[strike]
            if pair["call"] or pair["put"]:
                chain.append({
                    "strike": strike,
                    "expiration": chosen_expiry,
                    "call": pair["call"],
                    "put": pair["put"],
                })
        return chain

    async def get_stock_quote(self, symbol: str) -> dict:
        """Current price, change, volume, market cap."""
        try:
            resp = await self.client.get(
                f"{self.base_url}/quote",
                params={"symbol": symbol, "apikey": self.api_key}
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                q = data[0]
                return {
                    "symbol": q.get("symbol", symbol),
                    "price": q.get("price", 0),
                    "change": q.get("change", 0),
                    "change_percent": q.get("changePercentage", q.get("changesPercentage", 0)),
                    "volume": q.get("volume", 0),
                    "market_cap": q.get("marketCap", 0),
                    "day_high": q.get("dayHigh", 0),
                    "day_low": q.get("dayLow", 0),
                    "year_high": q.get("yearHigh", 0),
                    "year_low": q.get("yearLow", 0),
                }
            return await MockAdapter().get_stock_quote(symbol)
        except Exception as e:
            logger.warning("FMP quote error, falling back to mock: %s", e)
            return await MockAdapter().get_stock_quote(symbol)

    # ── Historical methods — stub for interface compliance ──
    # These are not used directly; HybridAdapter routes historical to Yahoo.

    async def get_historical_prices(self, symbol: str, days: int = 60) -> list:
        """FMP historical daily prices."""
        try:
            resp = await self.client.get(
                f"{self.base_url}/historical-price-eod/full",
                params={"symbol": symbol, "apikey": self.api_key, "timeseries": days}
            )
            resp.raise_for_status()
            data = resp.json()
            # New stable API returns list directly, not nested under "historical"
            historical = data if isinstance(data, list) else data.get("historical", []) or []
            out = []
            for h in historical[:days]:
                if not isinstance(h, dict):
                    continue
                try:
                    out.append({
                        "date": h.get("date", ""),
                        "open": float(h.get("open", 0) or 0),
                        "high": float(h.get("high", 0) or 0),
                        "low": float(h.get("low", 0) or 0),
                        "close": float(h.get("close", 0) or 0),
                        "volume": int(h.get("volume", 0) or 0),
                    })
                except (TypeError, ValueError):
                    continue
            return out
        except Exception as e:
            logger.warning("FMP historical error: %s", e)
            return []

    async def get_market_snapshot(self, symbol: str) -> dict:
        """Snapshot — historical portion will be incomplete on free tier."""
        quote = await self.get_stock_quote(symbol)
        history = await self.get_historical_prices(symbol, 30)

        if len(history) >= 2:
            import statistics
            returns = []
            for i in range(1, len(history)):
                curr = history[i].get("close")
                prev = history[i - 1].get("close")
                if curr and prev and prev > 0:
                    returns.append((float(curr) - float(prev)) / float(prev))
            hv_30 = statistics.stdev(returns) * (252 ** 0.5) * 100 if len(returns) > 1 else 20.0
        else:
            hv_30 = 20.0

        return {
            "symbol": symbol,
            "quote": quote,
            "historical_volatility_30d": round(hv_30, 1),
            "price_history_30d": history[:30],
        }

    async def get_historical_prices_range(self, symbol: str, start_date: str, end_date: str) -> list:
        try:
            resp = await self.client.get(
                f"{self.base_url}/historical-price-eod/full",
                params={"symbol": symbol, "from": start_date, "to": end_date, "apikey": self.api_key}
            )
            resp.raise_for_status()
            data = resp.json()
            # New stable API returns list directly
            historical = data if isinstance(data, list) else data.get("historical", []) or []
            out = []
            for h in historical:
                if not isinstance(h, dict):
                    continue
                try:
                    out.append({
                        "date": h.get("date", ""),
                        "open": float(h.get("open", 0) or 0),
                        "high": float(h.get("high", 0) or 0),
                        "low": float(h.get("low", 0) or 0),
                        "close": float(h.get("close", 0) or 0),
                        "volume": int(h.get("volume", 0) or 0),
                    })
                except (TypeError, ValueError):
                    continue
            return out
        except Exception as e:
            logger.warning("FMP historical range error: %s", e)
            return []


# ═══════════════════════════════════════════════════════════
#  Hybrid Adapter — FMP live + Yahoo historical (THE DEFAULT)
# ═══════════════════════════════════════════════════════════

class HybridAdapter(MarketDataAdapter):
    """Best of both worlds:
      - FMP  → real-time quote, options chain  (needs API key, free tier is fine)
      - Yahoo → 30/60/90 day historical OHLCV  (free, no key)
      - Mock  → fallback if both fail
    """

    def __init__(self):
        self._fmp = FMPAdapter()
        self._mock = MockAdapter()

    async def close(self):
        """Close the FMP client connections."""
        await self._fmp.close()

    async def get_options_chain(self, symbol: str, expiry_range: int = 30) -> dict:
        """FMP for live options chain."""
        return await self._fmp.get_options_chain(symbol, expiry_range)

    async def get_stock_quote(self, symbol: str) -> dict:
        """FMP for live quote."""
        return await self._fmp.get_stock_quote(symbol)

    async def get_historical_prices(self, symbol: str, days: int = 60) -> list:
        """Yahoo for historical OHLCV — falls back to mock if yfinance unavailable."""
        data = await YahooHistoricalProvider.get_history(symbol, days)
        if data and len(data) >= 2:
            return data

        # Fallback: try FMP (may only get 1 day on free tier)
        fmp_data = await self._fmp.get_historical_prices(symbol, days)
        if fmp_data and len(fmp_data) >= 2:
            return fmp_data

        # Last resort: mock
        logger.warning("No historical data from Yahoo or FMP for %s — using mock", symbol)
        return await self._mock.get_historical_prices(symbol, days)

    async def get_historical_prices_range(self, symbol: str, start_date: str, end_date: str) -> list:
        """Yahoo for date-range historical — falls back to FMP then mock."""
        data = await YahooHistoricalProvider.get_history_range(symbol, start_date, end_date)
        if data and len(data) >= 2:
            return data

        fmp_data = await self._fmp.get_historical_prices_range(symbol, start_date, end_date)
        if fmp_data and len(fmp_data) >= 2:
            return fmp_data

        logger.warning("No range data from Yahoo or FMP for %s — using mock", symbol)
        return await self._mock.get_historical_prices_range(symbol, start_date, end_date)

    async def get_market_snapshot(self, symbol: str) -> dict:
        """FMP quote + Yahoo history → proper 30-day vol calculation."""
        # Fetch quote (FMP) and history (Yahoo) in parallel
        quote, history = await asyncio.gather(
            self.get_stock_quote(symbol),
            self.get_historical_prices(symbol, 30),
        )

        # Compute 30-day historical volatility from real data
        hv_30 = 20.0  # default
        if len(history) >= 5:
            import statistics
            returns = []
            for i in range(1, len(history)):
                curr = history[i].get("close")
                prev = history[i - 1].get("close")
                if curr and prev and prev > 0:
                    try:
                        returns.append((float(curr) - float(prev)) / float(prev))
                    except (TypeError, ValueError):
                        continue
            if len(returns) > 1:
                hv_30 = statistics.stdev(returns) * (252 ** 0.5) * 100

        return {
            "symbol": symbol,
            "quote": quote,
            "historical_volatility_30d": round(hv_30, 1),
            "price_history_30d": history[:30],
        }


# ═══════════════════════════════════════════════════════════
#  Mock Adapter — offline dev/testing fallback
# ═══════════════════════════════════════════════════════════

class MockAdapter(MarketDataAdapter):
    """Testing/fallback: returns realistic hardcoded data for development."""

    MOCK_STOCKS = {
        # Mega-cap tech
        "AAPL": {"price": 227.50, "iv": 24.5},
        "MSFT": {"price": 415.30, "iv": 22.1},
        "GOOGL": {"price": 175.80, "iv": 28.3},
        "AMZN": {"price": 198.40, "iv": 30.2},
        "TSLA": {"price": 248.60, "iv": 55.8},
        "NVDA": {"price": 138.70, "iv": 48.5},
        "META": {"price": 595.20, "iv": 32.7},
        # ETFs
        "SPY": {"price": 572.10, "iv": 15.2},
        "QQQ": {"price": 490.30, "iv": 19.8},
        "IWM": {"price": 222.40, "iv": 22.5},
        "DIA": {"price": 428.70, "iv": 14.1},
        # Semiconductors
        "AMD": {"price": 162.30, "iv": 42.1},
        "INTC": {"price": 31.20, "iv": 38.5},
        "AVGO": {"price": 178.50, "iv": 30.2},
        "MU": {"price": 108.90, "iv": 44.3},
        # Finance
        "JPM": {"price": 198.40, "iv": 20.5},
        "GS": {"price": 510.60, "iv": 24.8},
        "BAC": {"price": 42.30, "iv": 22.7},
        "V": {"price": 290.10, "iv": 18.3},
        # Healthcare
        "JNJ": {"price": 158.70, "iv": 16.2},
        "UNH": {"price": 525.40, "iv": 21.8},
        "PFE": {"price": 28.90, "iv": 28.4},
        "ABBV": {"price": 185.20, "iv": 22.1},
        # Energy
        "XOM": {"price": 112.30, "iv": 24.6},
        "CVX": {"price": 158.90, "iv": 22.8},
        "SLB": {"price": 52.40, "iv": 32.5},
        # Consumer
        "WMT": {"price": 168.50, "iv": 17.2},
        "COST": {"price": 742.30, "iv": 20.5},
        "NKE": {"price": 98.40, "iv": 32.8},
        "SBUX": {"price": 95.70, "iv": 26.4},
        # Industrial
        "BA": {"price": 178.50, "iv": 38.2},
        "CAT": {"price": 342.10, "iv": 24.1},
        "DE": {"price": 398.70, "iv": 26.3},
        # Media
        "NFLX": {"price": 628.40, "iv": 35.2},
        "DIS": {"price": 112.30, "iv": 28.7},
        "CRM": {"price": 272.50, "iv": 30.4},
        # Crypto proxies
        "COIN": {"price": 225.80, "iv": 72.5},
        "MARA": {"price": 18.40, "iv": 95.3},
        "MSTR": {"price": 178.60, "iv": 88.7},
        "RIOT": {"price": 12.50, "iv": 92.1},
        "BITO": {"price": 24.30, "iv": 58.4},
    }

    async def get_options_chain(self, symbol: str, expiry_range: int = 30) -> dict:
        stock = self.MOCK_STOCKS.get(symbol, {"price": 100, "iv": 25})
        price = stock["price"]
        iv = stock["iv"]

        chain = []
        strikes = [round(price * (1 + pct / 100), 0) for pct in range(-10, 11, 2)]
        for strike in strikes:
            moneyness = (strike - price) / price
            call_price = max(0.5, price * 0.03 * (1 - moneyness * 2))
            put_price = max(0.5, price * 0.03 * (1 + moneyness * 2))
            chain.append({
                "strike": strike,
                "expiration": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
                "call": {
                    "bid": round(call_price * 0.95, 2),
                    "ask": round(call_price * 1.05, 2),
                    "last": round(call_price, 2),
                    "iv": round(iv + random.uniform(-3, 3), 1),
                    "delta": round(max(0.05, min(0.95, 0.5 - moneyness * 2)), 2),
                    "gamma": round(random.uniform(0.01, 0.05), 3),
                    "theta": round(-random.uniform(0.02, 0.15), 3),
                    "vega": round(random.uniform(0.05, 0.25), 3),
                    "open_interest": random.randint(100, 5000),
                    "volume": random.randint(10, 2000),
                },
                "put": {
                    "bid": round(put_price * 0.95, 2),
                    "ask": round(put_price * 1.05, 2),
                    "last": round(put_price, 2),
                    "iv": round(iv + random.uniform(-3, 5), 1),
                    "delta": round(max(-0.95, min(-0.05, -0.5 + moneyness * 2)), 2),
                    "gamma": round(random.uniform(0.01, 0.05), 3),
                    "theta": round(-random.uniform(0.02, 0.15), 3),
                    "vega": round(random.uniform(0.05, 0.25), 3),
                    "open_interest": random.randint(100, 5000),
                    "volume": random.randint(10, 2000),
                },
            })

        return {"symbol": symbol, "chain": chain, "count": len(chain)}

    async def get_stock_quote(self, symbol: str) -> dict:
        stock = self.MOCK_STOCKS.get(symbol, {"price": 100, "iv": 25})
        price = stock["price"]
        change = round(random.uniform(-3, 3), 2)
        return {
            "symbol": symbol,
            "price": price,
            "change": change,
            "change_percent": round(change / price * 100, 2),
            "volume": random.randint(10_000_000, 80_000_000),
            "market_cap": int(price * random.randint(1_000_000_000, 3_000_000_000)),
            "day_high": round(price * 1.015, 2),
            "day_low": round(price * 0.985, 2),
            "year_high": round(price * 1.35, 2),
            "year_low": round(price * 0.70, 2),
        }

    async def get_historical_prices(self, symbol: str, days: int = 60) -> list:
        stock = self.MOCK_STOCKS.get(symbol, {"price": 100, "iv": 25})
        price = stock["price"]
        history = []
        current = price
        for i in range(days):
            date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            daily_return = random.gauss(0, 0.015)
            open_p = current * (1 + random.uniform(-0.005, 0.005))
            high_p = current * (1 + abs(random.gauss(0, 0.01)))
            low_p = current * (1 - abs(random.gauss(0, 0.01)))
            history.append({
                "date": date,
                "open": round(open_p, 2),
                "high": round(high_p, 2),
                "low": round(low_p, 2),
                "close": round(current, 2),
                "volume": random.randint(10_000_000, 80_000_000),
            })
            current = current * (1 - daily_return)
        return history

    async def get_market_snapshot(self, symbol: str) -> dict:
        quote = await self.get_stock_quote(symbol)
        history = await self.get_historical_prices(symbol, 30)
        return {
            "symbol": symbol,
            "quote": quote,
            "historical_volatility_30d": round(random.uniform(15, 55), 1),
            "price_history_30d": history,
        }

    async def get_historical_prices_range(self, symbol: str, start_date: str, end_date: str) -> list:
        """Generate mock data for a specific date range (YYYY-MM-DD format)."""
        stock = self.MOCK_STOCKS.get(symbol, {"price": 100, "iv": 25})
        price = stock["price"]
        history = []

        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            end = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            return []

        current = price
        current_date = end
        while current_date >= start:
            if current_date.weekday() < 5:
                date_str = current_date.strftime("%Y-%m-%d")
                daily_return = random.gauss(0, 0.015)
                open_p = current * (1 + random.uniform(-0.005, 0.005))
                high_p = current * (1 + abs(random.gauss(0, 0.01)))
                low_p = current * (1 - abs(random.gauss(0, 0.01)))
                history.append({
                    "date": date_str,
                    "open": round(open_p, 2),
                    "high": round(high_p, 2),
                    "low": round(low_p, 2),
                    "close": round(current, 2),
                    "volume": random.randint(10_000_000, 80_000_000),
                })
                current = current * (1 - daily_return)
            current_date -= timedelta(days=1)

        history.reverse()
        return history


# ═══════════════════════════════════════════════════════════
#  Atlas Adapter — CapMan's internal production market data API
# ═══════════════════════════════════════════════════════════

# In-memory cache for Atlas responses (avoids hammering the API)
_atlas_cache = _HistoryCache(ttl_seconds=300)   # 5-min TTL for live data
_atlas_hist_cache = _HistoryCache(ttl_seconds=3600)   # 1-hour for historical


class AtlasAdapter(MarketDataAdapter):
    """Production adapter: wraps CapMan's internal Atlas market data API.

    Atlas provides a unified REST API for:
      - Real-time quotes (tick-level, 200ms refresh)
      - Full options chains with Greeks, OI, flow data
      - Historical OHLCV at 1m/5m/1d granularity
      - GEX / dark pool / order flow analytics (future)

    Expected Atlas API endpoints:
      GET /quotes/{symbol}           → real-time quote
      GET /options/{symbol}/chain    → options chain (query: expiry_range)
      GET /history/{symbol}          → OHLCV (query: days | start & end)
      GET /snapshot/{symbol}         → quote + history + vol metrics combined

    All responses are JSON. Atlas returns data in the shapes that CapMan expects,
    so minimal transformation is needed.
    """

    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or settings.ATLAS_API_KEY
        self.base_url = (base_url or settings.ATLAS_BASE_URL).rstrip("/")
        self.client = httpx.AsyncClient(
            timeout=20.0,
            limits=httpx.Limits(max_connections=30, max_keepalive_connections=10, keepalive_expiry=60),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "X-Client": "capman-ai",
                "Accept": "application/json",
            },
        )
        # Fallback adapter for when Atlas is down
        self._fallback = MockAdapter()

    async def close(self):
        """Close the underlying HTTP client to release connections."""
        await self.client.aclose()

    # ── Core Methods ─────────────────────────────────────────

    async def get_stock_quote(self, symbol: str) -> dict:
        """Real-time quote from Atlas."""
        cache_key = f"atlas:quote:{symbol}"
        cached = _atlas_cache.get(cache_key)
        if cached is not None:
            return cached[0] if isinstance(cached, list) and len(cached) == 1 else cached

        try:
            resp = await self.client.get(f"{self.base_url}/quotes/{symbol}")
            resp.raise_for_status()
            data = resp.json()

            # Atlas returns the quote directly or nested under "data"
            quote_data = data.get("data", data) if isinstance(data, dict) else data

            result = {
                "symbol": quote_data.get("symbol", symbol),
                "price": float(quote_data.get("price", 0)),
                "change": float(quote_data.get("change", 0)),
                "change_percent": float(quote_data.get("change_percent", quote_data.get("changesPercentage", 0))),
                "volume": int(quote_data.get("volume", 0)),
                "market_cap": int(quote_data.get("market_cap", quote_data.get("marketCap", 0))),
                "day_high": float(quote_data.get("day_high", quote_data.get("dayHigh", 0))),
                "day_low": float(quote_data.get("day_low", quote_data.get("dayLow", 0))),
                "year_high": float(quote_data.get("year_high", quote_data.get("yearHigh", 0))),
                "year_low": float(quote_data.get("year_low", quote_data.get("yearLow", 0))),
            }
            _atlas_cache.set(cache_key, result)
            return result

        except Exception as e:
            logger.warning("Atlas quote error for %s, falling back to mock: %s", symbol, e)
            return await self._fallback.get_stock_quote(symbol)

    async def get_options_chain(self, symbol: str, expiry_range: int = 30) -> dict:
        """Full options chain with Greeks, IV, OI from Atlas."""
        cache_key = f"atlas:chain:{symbol}:{expiry_range}"
        cached = _atlas_cache.get(cache_key)
        if cached is not None:
            return cached[0] if isinstance(cached, list) and len(cached) == 1 else cached

        try:
            resp = await self.client.get(
                f"{self.base_url}/options/{symbol}/chain",
                params={"expiry_range": expiry_range},
            )
            resp.raise_for_status()
            data = resp.json()

            # Atlas may return chain directly or under "data"
            raw_chain = data.get("chain", data.get("data", []))

            chain = []
            for opt in raw_chain[:12]:
                chain.append({
                    "strike": float(opt.get("strike", 0)),
                    "expiration": opt.get("expiration", ""),
                    "call": self._normalize_option_leg(opt.get("call", {})),
                    "put": self._normalize_option_leg(opt.get("put", {})),
                })

            result = {"symbol": symbol, "chain": chain, "count": len(chain)}
            _atlas_cache.set(cache_key, result)
            return result

        except Exception as e:
            logger.warning("Atlas options chain error for %s, falling back to mock: %s", symbol, e)
            return await self._fallback.get_options_chain(symbol, expiry_range)

    async def get_historical_prices(self, symbol: str, days: int = 60) -> list:
        """Historical OHLCV from Atlas."""
        cache_key = f"atlas:hist:{symbol}:{days}"
        cached = _atlas_hist_cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            resp = await self.client.get(
                f"{self.base_url}/history/{symbol}",
                params={"days": days},
            )
            resp.raise_for_status()
            data = resp.json()

            # Atlas returns array directly or under "data"/"history"
            raw_history = data.get("data", data.get("history", data)) if isinstance(data, dict) else data

            result = self._normalize_ohlcv(raw_history, limit=days)
            if result:
                _atlas_hist_cache.set(cache_key, result)
            return result

        except Exception as e:
            logger.warning("Atlas historical error for %s (%d days), falling back: %s", symbol, days, e)
            return await self._fallback.get_historical_prices(symbol, days)

    async def get_historical_prices_range(self, symbol: str, start_date: str, end_date: str) -> list:
        """Historical OHLCV for a specific date range from Atlas."""
        cache_key = f"atlas:range:{symbol}:{start_date}:{end_date}"
        cached = _atlas_hist_cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            resp = await self.client.get(
                f"{self.base_url}/history/{symbol}",
                params={"start": start_date, "end": end_date},
            )
            resp.raise_for_status()
            data = resp.json()

            raw_history = data.get("data", data.get("history", data)) if isinstance(data, dict) else data

            result = self._normalize_ohlcv(raw_history)
            if result:
                _atlas_hist_cache.set(cache_key, result)
                logger.info("Atlas fetched %s range %s→%s (%d rows)", symbol, start_date, end_date, len(result))
            return result

        except Exception as e:
            logger.warning("Atlas range error for %s %s→%s, falling back: %s", symbol, start_date, end_date, e)
            return await self._fallback.get_historical_prices_range(symbol, start_date, end_date)

    async def get_market_snapshot(self, symbol: str) -> dict:
        """All-in-one snapshot: quote + history + vol.

        Tries Atlas's combined /snapshot endpoint first.
        Falls back to parallel quote + history calls.
        """
        # Try the combined endpoint first (single request, lower latency)
        try:
            resp = await self.client.get(f"{self.base_url}/snapshot/{symbol}")
            resp.raise_for_status()
            data = resp.json()

            snapshot_data = data.get("data", data)

            return {
                "symbol": symbol,
                "quote": self._extract_quote_from_snapshot(snapshot_data, symbol),
                "historical_volatility_30d": round(float(snapshot_data.get("hv_30d", snapshot_data.get("historical_volatility_30d", 20.0))), 1),
                "price_history_30d": self._normalize_ohlcv(
                    snapshot_data.get("price_history_30d", snapshot_data.get("history", [])),
                    limit=30,
                ),
            }
        except Exception as e:
            logger.debug("Atlas snapshot endpoint not available for %s (%s), falling back to parallel calls", symbol, e)

        # Fallback: parallel quote + history calls
        quote, history = await asyncio.gather(
            self.get_stock_quote(symbol),
            self.get_historical_prices(symbol, 30),
        )

        # Compute 30-day HV from historical data
        hv_30 = self._compute_hv(history)

        return {
            "symbol": symbol,
            "quote": quote,
            "historical_volatility_30d": round(hv_30, 1),
            "price_history_30d": history[:30],
        }

    # ── Helpers ──────────────────────────────────────────────

    @staticmethod
    def _normalize_option_leg(leg: dict) -> dict:
        """Normalize an option leg (call/put) to CapMan's expected shape."""
        if not leg:
            return {}
        return {
            "bid": float(leg.get("bid", 0)),
            "ask": float(leg.get("ask", 0)),
            "last": float(leg.get("last", leg.get("lastPrice", 0))),
            "iv": round(float(leg.get("iv", leg.get("impliedVolatility", 0))), 1),
            "delta": float(leg.get("delta", 0)),
            "gamma": float(leg.get("gamma", 0)),
            "theta": float(leg.get("theta", 0)),
            "vega": float(leg.get("vega", 0)),
            "open_interest": int(leg.get("open_interest", leg.get("openInterest", 0))),
            "volume": int(leg.get("volume", 0)),
        }

    @staticmethod
    def _normalize_ohlcv(raw: list, limit: int = 0) -> list:
        """Normalize OHLCV rows to CapMan's expected shape."""
        if not isinstance(raw, list):
            return []
        out = []
        for h in raw:
            if not isinstance(h, dict):
                continue
            try:
                out.append({
                    "date": h.get("date", ""),
                    "open": round(float(h.get("open", 0)), 2),
                    "high": round(float(h.get("high", 0)), 2),
                    "low": round(float(h.get("low", 0)), 2),
                    "close": round(float(h.get("close", 0)), 2),
                    "volume": int(h.get("volume", 0)),
                })
            except (TypeError, ValueError):
                continue
        if limit > 0:
            out = out[:limit]
        return out

    def _extract_quote_from_snapshot(self, snapshot: dict, symbol: str) -> dict:
        """Extract quote fields from a snapshot response."""
        quote = snapshot.get("quote", snapshot)
        return {
            "symbol": quote.get("symbol", symbol),
            "price": float(quote.get("price", 0)),
            "change": float(quote.get("change", 0)),
            "change_percent": float(quote.get("change_percent", quote.get("changesPercentage", 0))),
            "volume": int(quote.get("volume", 0)),
            "market_cap": int(quote.get("market_cap", quote.get("marketCap", 0))),
            "day_high": float(quote.get("day_high", quote.get("dayHigh", 0))),
            "day_low": float(quote.get("day_low", quote.get("dayLow", 0))),
            "year_high": float(quote.get("year_high", quote.get("yearHigh", 0))),
            "year_low": float(quote.get("year_low", quote.get("yearLow", 0))),
        }

    @staticmethod
    def _compute_hv(history: list) -> float:
        """Compute annualized 30-day historical volatility from OHLCV data."""
        if len(history) < 5:
            return 20.0
        import statistics
        returns = []
        for i in range(1, len(history)):
            curr = history[i].get("close")
            prev = history[i - 1].get("close")
            if curr and prev and prev > 0:
                try:
                    returns.append((float(curr) - float(prev)) / float(prev))
                except (TypeError, ValueError):
                    continue
        if len(returns) > 1:
            return statistics.stdev(returns) * (252 ** 0.5) * 100
        return 20.0


# ═══════════════════════════════════════════════════════════
#  Factory
# ═══════════════════════════════════════════════════════════

def get_market_data_adapter() -> MarketDataAdapter:
    """Factory: returns the right adapter based on config.

    Priority:
      1. AtlasAdapter (USE_ATLAS=true + ATLAS_API_KEY set) — production, unified API
      2. HybridAdapter (FMP key present + yfinance installed) — best free experience
      3. FMPAdapter (FMP key present, no yfinance) — live only, limited history
      4. MockAdapter (no keys) — offline development
    """
    # 1. Atlas — CapMan's internal production API (highest priority)
    has_atlas = settings.USE_ATLAS and settings.ATLAS_API_KEY
    if has_atlas:
        logger.info("Market data: AtlasAdapter (CapMan internal — %s)", settings.ATLAS_BASE_URL)
        return AtlasAdapter()

    # 2. HybridAdapter — FMP live + Yahoo historical
    has_fmp = settings.FMP_API_KEY and settings.FMP_API_KEY != "your_fmp_api_key_here"
    if has_fmp:
        if YahooHistoricalProvider._is_available():
            logger.info("Market data: HybridAdapter (FMP live + Yahoo historical)")
            return HybridAdapter()
        else:
            logger.info("Market data: FMPAdapter only (install yfinance for full historical)")
            return FMPAdapter()

    # 3. MockAdapter — offline fallback
    logger.info("Market data: MockAdapter (no FMP key — set FMP_API_KEY in .env)")
    return MockAdapter()
