"""Seed demo data for development and demos."""
import logging
from sqlalchemy import select
from app.core.database import async_session
from app.models.database_models import User, LearningObjective

logger = logging.getLogger(__name__)


DEMO_USERS = [
    {"id": "demo-user", "username": "demo-student", "email": "student@capman.dev", "role": "student"},
    {"id": "alex-trader-id", "username": "alex_trader", "email": "alex@capman.dev", "role": "student", "xp": 2100, "level": 3, "scenarios_completed": 28, "streak_days": 5},
    {"username": "jordan_opts", "email": "jordan@capman.dev", "role": "student", "xp": 4500, "level": 4, "scenarios_completed": 52, "streak_days": 12},
    {"username": "sam_greeks", "email": "sam@capman.dev", "role": "student", "xp": 800, "level": 2, "scenarios_completed": 12, "streak_days": 2},
    {"username": "taylor_vol", "email": "taylor@capman.dev", "role": "student", "xp": 6200, "level": 5, "scenarios_completed": 71, "streak_days": 20},
    {"username": "riley_newb", "email": "riley@capman.dev", "role": "student", "xp": 150, "level": 1, "scenarios_completed": 3, "streak_days": 1},
    {"username": "casey_mid", "email": "casey@capman.dev", "role": "student", "xp": 1200, "level": 2, "scenarios_completed": 18, "streak_days": 0},
    {"username": "morgan_pro", "email": "morgan@capman.dev", "role": "student", "xp": 14000, "level": 6, "scenarios_completed": 120, "streak_days": 30},
    {"username": "drew_steady", "email": "drew@capman.dev", "role": "student", "xp": 3000, "level": 3, "scenarios_completed": 35, "streak_days": 7},
    {"username": "pat_struggle", "email": "pat@capman.dev", "role": "student", "xp": 400, "level": 1, "scenarios_completed": 8, "streak_days": 0},
    {"username": "coach_smith", "email": "coach@capman.dev", "role": "educator", "password": "CapmanCoach1"},
    {"username": "admin_capman", "email": "admin@capman.dev", "role": "admin"},
]

LEARNING_OBJECTIVES_DATA = [
    # Core Trade Construction
    {"id": "trade_thesis", "name": "Trade Thesis Formation", "category": "trade_construction", "description": "Forming a clear, justified directional or volatility thesis"},
    {"id": "strike_selection", "name": "Strike Selection", "category": "trade_construction", "description": "Choosing appropriate strike prices based on thesis, IV, and risk tolerance"},
    {"id": "structure_selection", "name": "Strategy Structure Selection", "category": "trade_construction", "description": "Picking the right options structure for the market regime"},

    # Risk Management
    {"id": "risk_management", "name": "Risk Management", "category": "risk", "description": "Position sizing (2% rule), stop losses, max loss calculation, portfolio delta"},
    {"id": "exit_strategy", "name": "Exit Strategy", "category": "risk", "description": "Defining profit targets, stop losses, time stops, and rolling criteria"},
    {"id": "portfolio_management", "name": "Portfolio Management", "category": "risk", "description": "Sharpe ratio, max drawdown, concentration risk, Kelly criterion sizing"},

    # Volatility (from Vol Framework)
    {"id": "iv_analysis", "name": "Implied Volatility Analysis", "category": "volatility", "description": "IV rank, IV percentile, HV/IV gap, IV surface/skew, term structure"},
    {"id": "realized_vol", "name": "Realized Volatility Analysis", "category": "volatility", "description": "HV measures (Yang-Zhang, Parkinson), vol clusters, RV decay rate"},
    {"id": "vol_regime", "name": "Volatility Regime Detection", "category": "volatility", "description": "Identifying vol expansion/compression, VIX term structure, VVIX"},

    # Greeks
    {"id": "greeks_understanding", "name": "Core Greeks Analysis", "category": "greeks", "description": "Understanding and managing delta, gamma, theta, vega exposures"},
    {"id": "higher_order_greeks", "name": "Higher-Order Greeks", "category": "greeks", "description": "Vanna, charm, vomma, color — advanced risk sensitivities"},

    # Market Analysis
    {"id": "regime_awareness", "name": "Market Regime Awareness", "category": "market_analysis", "description": "Identifying trending/ranging/volatile environments and adapting strategy"},
    {"id": "order_flow", "name": "Order Flow & Liquidity", "category": "market_analysis", "description": "OI change, volume/OI ratio, dark pool prints, sweep volume, MM hedging pressure"},
    {"id": "event_driven", "name": "Event-Driven Analysis", "category": "market_analysis", "description": "Earnings implied move, IV crush, FOMC/CPI impact, event sizing"},
    {"id": "sentiment_analysis", "name": "Sentiment & Behavioral Data", "category": "market_analysis", "description": "Put/call ratio, AAII sentiment, Fear & Greed, fund flows, insider activity"},
    {"id": "macro_awareness", "name": "Macroeconomic Awareness", "category": "market_analysis", "description": "Yield curve, credit spreads, DXY, central bank policy impact on vol"},

    # Advanced / Structural
    {"id": "tail_risk", "name": "Tail Risk Assessment", "category": "advanced", "description": "Skew index, VaR/CVaR, stress tests, fat tail probabilities"},
    {"id": "gamma_mechanics", "name": "Gamma & Structural Mechanics", "category": "advanced", "description": "GEX, gamma squeeze probability, 0DTE impact, pinning risk, max pain"},
    {"id": "correlation_rv", "name": "Correlation & Relative Value", "category": "advanced", "description": "Stock-index correlation, dispersion trades, vol arb spreads, sector rotation"},

    # Technical Analysis (Vol Framework §9)
    {"id": "technical_analysis", "name": "Technical Analysis & Price Action", "category": "market_analysis", "description": "RSI, MACD, Bollinger Bands, ATR, volume profile, gap analysis for trade timing"},

    # Interest Rates (Vol Framework §13)
    {"id": "interest_rate_vol", "name": "Interest Rate & Fixed Income Vol", "category": "advanced", "description": "MOVE index, Fed Funds futures, TIPS breakeven, CDS spreads, term premium"},

    # Seasonality (Vol Framework §14)
    {"id": "seasonality", "name": "Seasonality & Time-Based Patterns", "category": "market_analysis", "description": "Monthly seasonality, quarterly OpEx, tax-loss harvesting, VIX expiration dynamics"},

    # Fundamentals (Vol Framework §15)
    {"id": "fundamental_analysis", "name": "Fundamental Equity Analysis", "category": "market_analysis", "description": "P/E ratio, short interest, earnings quality, FCF yield impact on vol"},

    # Commodities (Vol Framework §16)
    {"id": "commodity_vol", "name": "Commodity & Energy Volatility", "category": "advanced", "description": "Gold/silver ratio, Dr. Copper, oil spikes, BDI, natgas storage as vol drivers"},

    # Crypto (Vol Framework §17)
    {"id": "crypto_vol", "name": "Crypto & Digital Asset Volatility", "category": "advanced", "description": "BTC dominance, crypto IV vs equity IV, funding rates, stablecoin flows"},

    # Microstructure (Vol Framework §18)
    {"id": "microstructure", "name": "Market Microstructure", "category": "advanced", "description": "Dark pool ratio, effective spread, flash crash indicators, auction imbalance, 0DTE impact"},

    # Geopolitical & Alternative Data (Vol Framework §19)
    {"id": "geopolitical_alt", "name": "Geopolitical & Alternative Data", "category": "advanced", "description": "Geopolitical stress index, satellite data, credit card data, ESG risk as vol catalysts"},
]


async def seed_demo_data():
    """Seed the database with demo users and learning objectives."""
    async with async_session() as db:
        # Seed learning objectives
        for obj_data in LEARNING_OBJECTIVES_DATA:
            result = await db.execute(
                select(LearningObjective).where(LearningObjective.id == obj_data["id"])
            )
            if not result.scalar_one_or_none():
                obj = LearningObjective(**obj_data)
                db.add(obj)

        # Seed demo users
        for user_data in DEMO_USERS:
            result = await db.execute(
                select(User).where(User.username == user_data["username"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                # Ensure password is set for users that have one defined
                if "password" in user_data and not existing.password_hash:
                    from app.core.auth import hash_password
                    existing.password_hash = hash_password(user_data["password"])
            else:
                user_kwargs = {
                    "username": user_data["username"],
                    "email": user_data["email"],
                    "role": user_data["role"],
                    "xp": user_data.get("xp", 0),
                    "level": user_data.get("level", 1),
                    "scenarios_completed": user_data.get("scenarios_completed", 0),
                    "streak_days": user_data.get("streak_days", 0),
                }
                # Use explicit ID if provided (for demo/testing routes)
                if "id" in user_data:
                    user_kwargs["id"] = user_data["id"]
                # Hash and store password when present (for demo login)
                if "password" in user_data:
                    from app.core.auth import hash_password
                    user_kwargs["password_hash"] = hash_password(user_data["password"])
                user = User(**user_kwargs)
                db.add(user)

        await db.commit()
        logger.info("Seeded %d objectives and %d users", len(LEARNING_OBJECTIVES_DATA), len(DEMO_USERS))
