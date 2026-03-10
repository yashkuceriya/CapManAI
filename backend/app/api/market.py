"""Market data API — live quotes and trading flash cards."""
import random
from fastapi import APIRouter

from app.services.market_data import get_market_data_adapter
from app.core.config import settings

router = APIRouter(prefix="/api/market", tags=["market"])

# Trading flash card facts (static knowledge)
TRADING_FACTS = [
    {"category": "Greeks", "fact": "Delta measures the rate of change of option price per $1 move in the underlying. ATM options have ~0.50 delta."},
    {"category": "Greeks", "fact": "Gamma is highest for ATM options near expiration. It measures the rate of change of delta."},
    {"category": "Greeks", "fact": "Theta decay accelerates in the final 30 days before expiration — this is called the 'theta burn zone'."},
    {"category": "Greeks", "fact": "Vega measures sensitivity to implied volatility. Long options are long vega; short options are short vega."},
    {"category": "Volatility", "fact": "IV Rank compares current IV to the past year's range. Above 50 means IV is historically high — favor selling premium."},
    {"category": "Volatility", "fact": "IV Crush: After earnings, implied volatility collapses. Straddle sellers profit from this if the move is smaller than expected."},
    {"category": "Volatility", "fact": "VIX above 30 signals fear in the market. VIX below 15 signals complacency. Mean reversion is a core vol strategy."},
    {"category": "Volatility", "fact": "Historical Volatility (HV) vs Implied Volatility (IV): when IV > HV, options are 'expensive' — good for sellers."},
    {"category": "Strategy", "fact": "The iron condor profits from low volatility and time decay. Max profit = net credit received. Max loss = width of spread minus credit."},
    {"category": "Strategy", "fact": "A bull call spread limits your upside but reduces cost. Use when moderately bullish with defined risk."},
    {"category": "Strategy", "fact": "Selling puts is equivalent to buying stock with a discount (the premium). It's a bullish strategy with defined risk on cash-secured puts."},
    {"category": "Strategy", "fact": "Calendar spreads profit from differences in time decay between front and back month options. Best in low-vol environments."},
    {"category": "Risk", "fact": "The 2% rule: never risk more than 2% of your portfolio on a single trade. This preserves capital through losing streaks."},
    {"category": "Risk", "fact": "Position sizing matters more than entry timing. A great trade idea with wrong sizing can still blow up your account."},
    {"category": "Risk", "fact": "Max drawdown measures the worst peak-to-trough loss. Professional traders target max drawdown under 15%."},
    {"category": "Risk", "fact": "Always define your exit before entry. Set profit targets, stop losses, and time stops for every position."},
    {"category": "Market", "fact": "0DTE (zero days to expiration) options have extreme gamma. Small moves create large P&L swings. Use with caution."},
    {"category": "Market", "fact": "GEX (Gamma Exposure) shows where market makers' hedging flows will amplify or dampen moves. Negative GEX = volatile."},
    {"category": "Market", "fact": "The put/call ratio above 1.0 indicates bearish sentiment. Below 0.7 signals complacency. Extreme readings often precede reversals."},
    {"category": "Market", "fact": "Max pain is the strike price where the most options expire worthless. Price tends to gravitate toward max pain near expiration."},
    {"category": "CapMan", "fact": "CapMan's Vol Framework identifies 5 vol regimes: trending bull, trending bear, range-bound, expansion, and compression. Each has optimal strategies."},
    {"category": "CapMan", "fact": "CapMan methodology: always start with the macro regime, then analyze vol, then select strategy. Never trade in a vacuum."},
    {"category": "CapMan", "fact": "The Sharpe ratio measures risk-adjusted return. Above 1.0 is good, above 2.0 is excellent. CapMan targets ≥1.5 for all strategies."},
    {"category": "CapMan", "fact": "CapMan's adaptability score measures how well you adjust to breaking news. Real traders must pivot — curveballs test this skill."},
]


@router.get("/quotes")
async def get_market_quotes():
    """Get current quotes for all scenario symbols — used for dashboard flash cards."""
    adapter = get_market_data_adapter()
    is_live = bool(settings.FMP_API_KEY and settings.FMP_API_KEY != "your_fmp_api_key_here")

    from app.agents.scenario_engine import SCENARIO_SYMBOLS, SYMBOL_NAMES

    quotes = []
    for symbol in SCENARIO_SYMBOLS[:6]:  # Top 6 for speed
        try:
            q = await adapter.get_stock_quote(symbol)
            quotes.append({
                "symbol": symbol,
                "company_name": SYMBOL_NAMES.get(symbol, symbol),
                "price": q.get("price", 0),
                "change": q.get("change", 0),
                "change_percent": q.get("change_percent", 0),
            })
        except Exception:
            continue

    return {
        "quotes": quotes,
        "data_source": "live" if is_live else "simulated",
    }


@router.get("/flashcards")
async def get_flash_cards(count: int = 5):
    """Get random trading flash cards — mix of facts + live market snippets."""
    count = min(max(count, 1), 10)

    # Pick random facts
    facts = random.sample(TRADING_FACTS, min(count, len(TRADING_FACTS)))

    # Optionally enrich with a live market snippet
    adapter = get_market_data_adapter()
    is_live = bool(settings.FMP_API_KEY and settings.FMP_API_KEY != "your_fmp_api_key_here")

    from app.agents.scenario_engine import SCENARIO_SYMBOLS, SYMBOL_NAMES
    market_card = None
    try:
        symbol = random.choice(SCENARIO_SYMBOLS)
        q = await adapter.get_stock_quote(symbol)
        price = q.get("price", 0)
        change_pct = q.get("change_percent", 0)
        direction = "up" if change_pct >= 0 else "down"
        market_card = {
            "category": "Live Market",
            "fact": f"{SYMBOL_NAMES.get(symbol, symbol)} ({symbol}) is trading at ${price:.2f}, {direction} {abs(change_pct):.2f}% today. {'Bullish momentum — look for call spreads.' if change_pct > 1 else 'Bearish pressure — consider put spreads.' if change_pct < -1 else 'Choppy action — range-bound strategies may work.'}",
            "is_live": True,
            "symbol": symbol,
        }
    except Exception:
        pass

    cards = [{"category": f["category"], "fact": f["fact"], "is_live": False} for f in facts]
    if market_card:
        cards.insert(0, market_card)

    return {
        "cards": cards,
        "data_source": "live" if is_live else "simulated",
    }
