"""Historical Market Replay Engine — "You just traded the SVB collapse."

The killer demo feature: students face reconstructed real market events using
actual historical data from FMP. They don't know which event it is until AFTER
they're graded. The reveal moment creates a powerful learning experience.

Flow:
1. Select a curated historical event
2. Pull real historical price/options data from that date window via FMP
3. Generate scenario WITHOUT revealing the event identity
4. Student analyzes and responds normally (probing + grading)
5. After grading → REVEAL: "You just traded the March 2020 COVID crash"
6. Show what actually happened + how the student's trade would have performed
"""
import json
import random
from datetime import datetime, timedelta
from typing import Optional

from app.core.config import settings
from app.core.tracing import TracedAnthropicClient
from app.services.market_data import get_market_data_adapter, FMPAdapter
from app.services.rag import get_rag


# ─── Curated Historical Events ─────────────────────────────────
# Each event has: the date window, ticker(s), what regime it maps to,
# the "reveal" narrative, and difficulty level.

HISTORICAL_EVENTS = {
    "gme_squeeze_2021": {
        "name": "GameStop Short Squeeze",
        "date": "2021-01-27",
        "date_range": {"start": "2021-01-20", "end": "2021-01-27"},
        "primary_symbol": "GME",
        "alt_symbols": ["AMC", "BB"],
        "regime": "gamma_squeeze_setup",
        "difficulty": "advanced",
        "iv_context": "IV exploded from ~100% to 800%+ in days. Call skew inverted completely.",
        "reveal_narrative": (
            "You just traded the GameStop short squeeze of January 2021. "
            "GME went from $40 to $483 in 5 trading days as retail traders on r/WallStreetBets "
            "triggered a massive gamma squeeze against heavily shorted hedge fund positions. "
            "Melvin Capital lost 53% in January. Options market makers were forced to delta-hedge "
            "by buying shares, creating a self-reinforcing feedback loop."
        ),
        "what_happened": {
            "price_move": "+1,600% in 2 weeks",
            "iv_peak": "~850% on 1/27",
            "key_lesson": "Gamma exposure (GEX) can create non-linear price moves. "
                          "Short squeezes are reflexive — the hedging IS the catalyst.",
        },
        "learning_objectives": ["gamma_mechanics", "order_flow", "risk_management"],
    },
    "covid_crash_2020": {
        "name": "COVID-19 Market Crash",
        "date": "2020-03-16",
        "date_range": {"start": "2020-03-09", "end": "2020-03-16"},
        "primary_symbol": "SPY",
        "alt_symbols": ["AAPL", "MSFT"],
        "regime": "macro_driven_vol_spike",
        "difficulty": "advanced",
        "iv_context": "VIX hit 82.69 on 3/16 — highest since 2008. Term structure fully inverted.",
        "reveal_narrative": (
            "You just traded the COVID-19 crash of March 2020. "
            "The S&P 500 fell 34% in 23 trading days — the fastest bear market in history. "
            "Circuit breakers triggered 4 times in 2 weeks. The VIX hit 82.69. "
            "The Fed cut rates to zero and launched unlimited QE on March 23rd, "
            "which marked the exact bottom."
        ),
        "what_happened": {
            "price_move": "SPY -34% in 23 days, then +68% by year end",
            "iv_peak": "VIX 82.69 on 3/16",
            "key_lesson": "Tail risk events can overwhelm any model. "
                          "Liquidity dried up — even 'safe' assets sold off. "
                          "The policy response (unlimited QE) was the regime change signal.",
        },
        "learning_objectives": ["tail_risk", "macro_awareness", "vol_regime"],
    },
    "svb_collapse_2023": {
        "name": "Silicon Valley Bank Collapse",
        "date": "2023-03-10",
        "date_range": {"start": "2023-03-06", "end": "2023-03-13"},
        "primary_symbol": "KRE",
        "alt_symbols": ["JPM", "XLF"],
        "regime": "credit_spread_widening_risk_off",
        "difficulty": "advanced",
        "iv_context": "Bank sector IV tripled overnight. Correlation spiked across financials.",
        "reveal_narrative": (
            "You just traded the Silicon Valley Bank collapse of March 2023. "
            "SVB failed in 48 hours — the largest bank failure since 2008. "
            "Regional bank ETF (KRE) dropped 28% in a week. "
            "Contagion fears spread to First Republic, Signature Bank, and Credit Suisse. "
            "The FDIC, Fed, and Treasury intervened with emergency backstop facilities."
        ),
        "what_happened": {
            "price_move": "KRE -28% in 5 days, SIVB -100% (delisted)",
            "iv_peak": "Regional bank IV tripled",
            "key_lesson": "Sector contagion happens fast in a connected financial system. "
                          "Duration risk in bond portfolios was the root cause. "
                          "Correlation spikes during crises make diversification fail.",
        },
        "learning_objectives": ["correlation_rv", "macro_awareness", "tail_risk"],
    },
    "volmageddon_2018": {
        "name": "Volmageddon — The XIV Blow-Up",
        "date": "2018-02-05",
        "date_range": {"start": "2018-02-01", "end": "2018-02-06"},
        "primary_symbol": "SPY",
        "alt_symbols": ["AAPL", "QQQ"],
        "regime": "vol_of_vol_expansion",
        "difficulty": "advanced",
        "iv_context": "VIX spiked from 13 to 50 in one session. Short-vol ETPs collapsed.",
        "reveal_narrative": (
            "You just traded Volmageddon — February 5, 2018. "
            "The VIX spiked 115% in a single day (from 17 to 37, then to 50 after hours). "
            "The XIV (inverse VIX ETN) lost 96% of its value overnight and was terminated. "
            "This event exposed the reflexive feedback loop in VIX-linked products: "
            "short-vol selling → low VIX → more selling → massive unwind when vol spikes."
        ),
        "what_happened": {
            "price_move": "SPY -4.1% in one day, VIX +115%",
            "iv_peak": "VIX 50 (from 13 a week earlier)",
            "key_lesson": "Short volatility is picking up pennies in front of a steamroller. "
                          "The convexity of VIX products means losses are non-linear. "
                          "Crowded trades unwind violently.",
        },
        "learning_objectives": ["vol_regime", "tail_risk", "gamma_mechanics"],
    },
    "nvda_earnings_2024": {
        "name": "NVDA Earnings Blowout Q4 2024",
        "date": "2024-02-22",
        "date_range": {"start": "2024-02-16", "end": "2024-02-22"},
        "primary_symbol": "NVDA",
        "alt_symbols": ["AMD", "SMCI"],
        "regime": "pre_earnings_iv_expansion",
        "difficulty": "intermediate",
        "iv_context": "NVDA IV rank at 85 pre-earnings. Implied move ~11%. Actual move: +16%.",
        "reveal_narrative": (
            "You just traded NVIDIA's Q4 2024 earnings on February 21, 2024. "
            "NVDA beat estimates massively — revenue up 265% YoY driven by AI data center demand. "
            "The stock jumped 16% after hours, adding $277 billion in market cap in a single day — "
            "the largest single-day market cap gain in stock market history at that time."
        ),
        "what_happened": {
            "price_move": "+16% post-earnings ($674 → $785)",
            "iv_peak": "IV rank 85 pre-earnings, crushed to 35 post",
            "key_lesson": "Earnings implied moves can severely understate actual moves "
                          "when there's a fundamental narrative shift (AI revolution). "
                          "IV crush is real — but if you're right on direction AND magnitude, "
                          "long premium can still win.",
        },
        "learning_objectives": ["event_driven", "iv_analysis", "structure_selection"],
    },
    "fed_pivot_2023": {
        "name": "Fed Pivot — December 2023 FOMC",
        "date": "2023-12-13",
        "date_range": {"start": "2023-12-08", "end": "2023-12-14"},
        "primary_symbol": "SPY",
        "alt_symbols": ["TLT", "QQQ"],
        "regime": "yield_curve_inversion_regime",
        "difficulty": "intermediate",
        "iv_context": "SPY IV rank dropped from 40 to 15 as dovish pivot removed tail risk.",
        "reveal_narrative": (
            "You just traded the Fed's dovish pivot of December 13, 2023. "
            "Powell signaled rate cuts were coming in 2024 — a dramatic shift from 'higher for longer.' "
            "SPY rallied to all-time highs. TLT (long bonds) surged 8% in two weeks. "
            "The everything rally was on — stocks, bonds, gold, and crypto all ripped higher."
        ),
        "what_happened": {
            "price_move": "SPY +4.5% in 2 weeks, TLT +8%",
            "iv_peak": "IV crushed across the board as uncertainty removed",
            "key_lesson": "Central bank communication IS the market catalyst. "
                          "When the Fed pivots, correlation across asset classes converges. "
                          "Vol sellers thrive when uncertainty is resolved — IV crush is the trade.",
        },
        "learning_objectives": ["macro_awareness", "vol_regime", "trade_thesis"],
    },
    "meme_stock_amc_2021": {
        "name": "AMC Entertainment Squeeze",
        "date": "2021-06-02",
        "date_range": {"start": "2021-05-26", "end": "2021-06-02"},
        "primary_symbol": "AMC",
        "alt_symbols": ["GME", "BB"],
        "regime": "gamma_squeeze_setup",
        "difficulty": "intermediate",
        "iv_context": "AMC IV hit 400%+. Massive call buying drove gamma squeeze mechanics.",
        "reveal_narrative": (
            "You just traded the AMC Entertainment squeeze of June 2021. "
            "AMC went from $12 to $72 in 8 trading days as retail traders piled in. "
            "AMC's CEO Adam Aron leaned into the meme stock narrative, even offering free popcorn "
            "to retail shareholders. Options volume on AMC exceeded SPY options volume for multiple days."
        ),
        "what_happened": {
            "price_move": "+500% in 8 trading days ($12 → $72)",
            "iv_peak": "~420% at peak",
            "key_lesson": "When options volume dominates, the tail wags the dog. "
                          "Gamma exposure from market makers creates mechanical buying pressure. "
                          "Fundamentals become irrelevant in a gamma squeeze — positioning IS the fundamental.",
        },
        "learning_objectives": ["order_flow", "gamma_mechanics", "sentiment_analysis"],
    },
    "yen_carry_unwind_2024": {
        "name": "Yen Carry Trade Unwind",
        "date": "2024-08-05",
        "date_range": {"start": "2024-08-01", "end": "2024-08-05"},
        "primary_symbol": "SPY",
        "alt_symbols": ["NVDA", "QQQ"],
        "regime": "cross_asset_contagion",
        "difficulty": "advanced",
        "iv_context": "VIX spiked from 16 to 65 intraday on 8/5. Cross-asset correlations exploded.",
        "reveal_narrative": (
            "You just traded the Yen carry trade unwind of August 5, 2024. "
            "The Bank of Japan unexpectedly raised rates, causing the Yen to surge 12% in days. "
            "This unwound trillions in carry trades — investors who borrowed cheap Yen to buy "
            "US tech stocks were forced to liquidate. The Nikkei fell 12% in one day (largest since 1987). "
            "VIX hit 65 intraday — briefly higher than during COVID."
        ),
        "what_happened": {
            "price_move": "SPY -6% in 3 days, Nikkei -12% on 8/5",
            "iv_peak": "VIX 65 intraday (from 16 a week earlier)",
            "key_lesson": "Cross-asset contagion through leverage is the hidden risk. "
                          "The carry trade unwind shows how FX moves can crash equity markets. "
                          "When VIX gaps that hard, selling premium is suicide — but buying puts "
                          "AFTER the spike is often the wrong trade too (IV crush).",
        },
        "learning_objectives": ["macro_awareness", "correlation_rv", "tail_risk"],
    },
    "flash_crash_2010": {
        "name": "Flash Crash",
        "date": "2010-05-06",
        "date_range": {"start": "2010-05-03", "end": "2010-05-06"},
        "primary_symbol": "SPY",
        "alt_symbols": ["QQQ", "DIA"],
        "regime": "vol_of_vol_expansion",
        "difficulty": "advanced",
        "iv_context": "Market experienced extreme intraday volatility. Bid-ask spreads widened dramatically. Circuit breakers halted trading.",
        "reveal_narrative": (
            "You just traded the Flash Crash of May 6, 2010. "
            "The Dow Jones Industrial Average plunged nearly 1,000 points (9%) in minutes due to a combination of "
            "algorithmic selling, thin liquidity, and a fat-finger error. The decline was triggered by a large institutional sale "
            "that hit the market during a period of already elevated volatility from European debt concerns. "
            "The market recovered most losses within minutes, but the event exposed serious risks in market structure."
        ),
        "what_happened": {
            "price_move": "Dow -1000 points intraday (-9%), recovered ~600 points by close",
            "iv_peak": "VIX spiked to 48, then fell back as market recovered",
            "key_lesson": "Liquidity can evaporate instantaneously. Algorithmic feedback loops can amplify moves. "
                          "When spreads widen and volume dries up, your market order could be executed miles away from fair value. "
                          "Tail risk hedging needs to account for flash crashes, not just Black Swan events.",
        },
        "learning_objectives": ["microstructure", "tail_risk", "order_flow"],
    },
    "oil_negative_2020": {
        "name": "WTI Crude Turns Negative",
        "date": "2020-04-20",
        "date_range": {"start": "2020-04-16", "end": "2020-04-21"},
        "primary_symbol": "USO",
        "alt_symbols": ["XLE", "CVX"],
        "regime": "macro_driven_vol_spike",
        "difficulty": "advanced",
        "iv_context": "Energy sector IV at historically elevated levels. Contango in oil futures exacerbated bearish pressure.",
        "reveal_narrative": (
            "You just traded the day WTI crude oil went negative — April 20, 2020. "
            "During the COVID-19 lockdown, US crude storage hit physical limits. May 2020 WTI futures contracts, "
            "set to expire on April 21st, fell to -$37.63 per barrel. Producers were literally paying traders to take oil off their hands. "
            "The USO energy ETF collapsed, and energy stocks went into freefall. This was the first time in history "
            "that a major commodity future closed with a negative price."
        ),
        "what_happened": {
            "price_move": "WTI May futures -$37.63 (went negative), XLE -48% in 2 weeks",
            "iv_peak": "Energy IV exploded as storage crisis unfolded",
            "key_lesson": "Contango curves and physical storage limits are real risks. An options trader holding puts on oil sees unlimited profits, "
                          "but a futures trader with a long position faces margin calls and forced liquidation. "
                          "Commodity markets have unique structural risks that equity traders often ignore.",
        },
        "learning_objectives": ["macro_awareness", "tail_risk", "commodity_vol"],
    },
    "fed_pivot_2018": {
        "name": "Fed Pivot — December 2018 Dovish Reversal",
        "date": "2018-12-19",
        "date_range": {"start": "2018-12-14", "end": "2018-12-19"},
        "primary_symbol": "SPY",
        "alt_symbols": ["IWM", "QQQ"],
        "regime": "yield_curve_inversion_regime",
        "difficulty": "intermediate",
        "iv_context": "Fed pivot reversed 9-month sell-off narrative. VIX compression accelerated. Vol term structure inverted.",
        "reveal_narrative": (
            "You just traded the Fed's dovish pivot of December 19, 2018. "
            "After SPY fell 20% from September peaks, Powell signaled a pause in rate hikes at the December FOMC meeting. "
            "The market rallied 5% in two days on the dovish surprise. Small caps (IWM) outperformed as it became clear "
            "that the 'higher for longer' narrative was ending. The 10-year yield fell from 2.8% to 2.5% in one week."
        ),
        "what_happened": {
            "price_move": "SPY +5% in 2 days, IWM +8%, TLT +3%",
            "iv_peak": "VIX fell from 24 to 14 as dovish pivot removed tail risk",
            "key_lesson": "Central banks control risk sentiment more than fundamentals. A single FOMC pivot can erase months of losses. "
                          "When the Fed stops hiking, vol crushes and correlations collapse — everyone buys equities. "
                          "Trading around policy meetings requires understanding how market participants are positioned.",
        },
        "learning_objectives": ["macro_awareness", "vol_regime", "trade_thesis"],
    },
    "archegos_collapse_2021": {
        "name": "Archegos Capital Margin Call",
        "date": "2021-03-26",
        "date_range": {"start": "2021-03-22", "end": "2021-03-26"},
        "primary_symbol": "VIAC",
        "alt_symbols": ["DISCA", "VIA"],
        "regime": "credit_spread_widening_risk_off",
        "difficulty": "intermediate",
        "iv_context": "Media stocks IV spiked 150% intraday as margin liquidation unfolded. Cross-asset contagion across prime brokers.",
        "reveal_narrative": (
            "You just traded the Archegos Capital collapse of March 26, 2021. "
            "Bill Hwang's $30 billion family office faced massive margin calls on leveraged positions in media stocks. "
            "ViacomCBS (VIAC) and Discovery (DISCA) each dropped 25%+ as banks forced-sold positions to meet collateral requirements. "
            "The liquidation was so large that Goldman Sachs, Morgan Stanley, and other prime brokers took billion-dollar losses. "
            "This event revealed how much leverage could hide in a single account."
        ),
        "what_happened": {
            "price_move": "VIAC -25% in 1 day, DISCA -27%, VIA -16%",
            "iv_peak": "Media sector IV +150% intraday",
            "key_lesson": "Leverage through swaps and total return agreements can hide from public view. "
                          "When margin calls hit, forced sellers create gaps that destroy options pricing models. "
                          "Correlation between seemingly uncorrelated stocks can spike when a mega-leveraged account unwinds.",
        },
        "learning_objectives": ["tail_risk", "correlation_rv", "microstructure"],
    },
    "china_tech_crackdown_2021": {
        "name": "China Tech Crackdown",
        "date": "2021-07-02",
        "date_range": {"start": "2021-06-28", "end": "2021-07-02"},
        "primary_symbol": "BABA",
        "alt_symbols": ["JD", "DIDI"],
        "regime": "macro_driven_vol_spike",
        "difficulty": "intermediate",
        "iv_context": "Chinese tech IV exploded as regulatory risk materialized. VIX spiked to 20 on contagion fears.",
        "reveal_narrative": (
            "You just traded the China tech regulatory crackdown of July 2, 2021. "
            "China's government announced sweeping new regulations on online tutoring, data privacy, and platform monopolies. "
            "Alibaba (BABA) fell 11%, JD.com (JD) fell 8%, and Didi (DIDI), which had just IPO'd weeks earlier, cratered 26%. "
            "US-listed Chinese ADRs lost $500 billion in market cap. The selloff reflected fears of sustained regulatory pressure "
            "on the entire sector and potential delisting risks."
        ),
        "what_happened": {
            "price_move": "BABA -11%, JD -8%, DIDI -26% (from IPO peak), Hang Seng Tech -8%",
            "iv_peak": "Chinese tech IV spiked 200%+, VIX +30%",
            "key_lesson": "Geopolitical and regulatory risk can wipe out years of gains. International equities carry hidden tail risks. "
                          "IV expansion in one region can spill over to correlated sectors globally. "
                          "Long calls on heavily regulated industries need to price in government intervention risk.",
        },
        "learning_objectives": ["macro_awareness", "tail_risk", "geopolitical_alt"],
    },
    "tsla_sp500_2020": {
        "name": "TSLA S&P 500 Inclusion",
        "date": "2020-12-21",
        "date_range": {"start": "2020-12-16", "end": "2020-12-21"},
        "primary_symbol": "TSLA",
        "alt_symbols": ["SPY", "QQQ"],
        "regime": "gamma_squeeze_setup",
        "difficulty": "intermediate",
        "iv_context": "TSLA IV compressed as index fund rebalancing became front-run. Gamma exposure spiked as options traders hedged.",
        "reveal_narrative": (
            "You just traded TESLA's historic inclusion into the S&P 500 on December 21, 2020. "
            "The largest single-stock addition in index history triggered $100+ billion in passive flows. "
            "TSLA rallied 70% in the month leading up to inclusion as traders front-ran the rebalancing. "
            "On inclusion day, TSLA surged another 13% as index fund buying hit the market. The stock hit $880, "
            "adding $130 billion in market cap in 4 weeks."
        ),
        "what_happened": {
            "price_move": "TSLA +70% in December, +13% on inclusion day",
            "iv_peak": "TSLA IV compressed from 60 to 40 as realized vol exceeded implied",
            "key_lesson": "Index rebalancing flows are predictable but enormous. Front-running index inclusion is the opposite of alpha. "
                          "When a mega-cap stock joins the index, gamma exposure inverts — buying calls becomes the main hedge for long equity positions. "
                          "One-way markets during index rebalancing can invalidate delta hedging assumptions.",
        },
        "learning_objectives": ["gamma_mechanics", "order_flow", "event_driven"],
    },
    "regional_bank_crisis_2023": {
        "name": "Regional Bank Contagion Crisis",
        "date": "2023-03-17",
        "date_range": {"start": "2023-03-13", "end": "2023-03-17"},
        "primary_symbol": "KRE",
        "alt_symbols": ["SIVB", "FRC"],
        "regime": "credit_spread_widening_risk_off",
        "difficulty": "intermediate",
        "iv_context": "Bank sector IV tripled in 48 hours. Credit spreads on small-cap financials widened 400+ basis points.",
        "reveal_narrative": (
            "You just traded the regional bank crisis of March 17, 2023. "
            "Following Silicon Valley Bank's failure on March 10th, contagion spread to First Republic Bank (FRC) and other weak capitalized banks. "
            "KRE (regional bank ETF) fell 28% in a week. Uninsured deposits began fleeing smaller banks, forcing fire sales of bond portfolios. "
            "The FDIC extended emergency backup liquidity, but bank stocks continued to sell off as depositor confidence evaporated. "
            "Credit Suisse's share price collapsed 60%, ultimately forcing a forced sale to UBS."
        ),
        "what_happened": {
            "price_move": "KRE -28% in 5 days, FRC -45%, SIVB -100%",
            "iv_peak": "Regional bank IV +300%, financial sector IV +150%",
            "key_lesson": "Bank runs can happen in hours thanks to mobile banking. Duration risk in bond portfolios created systemic fragility. "
                          "Contagion through the uninsured deposit channel spreads to even well-capitalized banks. "
                          "Put spreads on regional banks can offer asymmetric risk/reward during crises, but correlation breaks hedges.",
        },
        "learning_objectives": ["tail_risk", "correlation_rv", "macro_awareness"],
    },
}

# Group events by difficulty for selection
REPLAY_BY_DIFFICULTY = {
    "beginner": [],  # No beginner replays — these are all real crises/events
    "intermediate": [k for k, v in HISTORICAL_EVENTS.items() if v["difficulty"] == "intermediate"],
    "advanced": [k for k, v in HISTORICAL_EVENTS.items() if v["difficulty"] == "advanced"],
}


class ReplayEngine:
    """Generates scenarios from real historical market events."""

    def __init__(self):
        self.client = TracedAnthropicClient()
        self.market_adapter = get_market_data_adapter()
        self.rag = get_rag()

    async def generate_replay_scenario(
        self,
        event_id: Optional[str] = None,
        difficulty: str = "intermediate",
    ) -> dict:
        """Generate a scenario based on a real historical market event.

        The scenario is presented WITHOUT revealing which event it is.
        The reveal comes after grading.
        """
        # 1. Select event
        if event_id and event_id in HISTORICAL_EVENTS:
            event = HISTORICAL_EVENTS[event_id]
        else:
            # Pick random event appropriate for difficulty
            pool = REPLAY_BY_DIFFICULTY.get(difficulty, [])
            if not pool:
                # Fall back to all events
                pool = list(HISTORICAL_EVENTS.keys())
            event_id = random.choice(pool)
            event = HISTORICAL_EVENTS[event_id]

        symbol = event["primary_symbol"]

        # Get objective names for RAG retrieval
        from app.agents.scenario_engine import LEARNING_OBJECTIVES
        objective_names = [
            LEARNING_OBJECTIVES[obj_id]["name"]
            for obj_id in event["learning_objectives"]
            if obj_id in LEARNING_OBJECTIVES
        ]

        # 2-3. Fetch RAG context (sync) and historical data (async)
        rag_context = self.rag.retrieve_for_scenario(
            event["regime"],
            objective_names,
        )
        historical_data = await self._fetch_historical_context(
            symbol=symbol,
            date_range=event["date_range"],
        )

        # 4. Generate the scenario WITHOUT revealing the event identity
        scenario_prompt = self._build_replay_prompt(
            event=event,
            historical_data=historical_data,
            rag_context=rag_context,
        )

        response = await self.client.create(
            messages=[{"role": "user", "content": scenario_prompt}],
            purpose="replay_scenario_generation",
            max_tokens=2000,
        )

        scenario_text = self._parse_response(response.text)

        # 5. Build the result — includes replay metadata for post-grade reveal
        return {
            "market_regime": event["regime"],
            "asset_class": "equity_options",
            "difficulty": event["difficulty"],
            "context_prompt": scenario_text.get("scenario_text", response.text),
            "market_data": {
                "symbol": symbol,
                "historical_context": historical_data,
            },
            "learning_objectives": event["learning_objectives"],
            "expected_analysis": scenario_text.get("expected_analysis", ""),
            "fingerprint": f"replay_{event_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            # Replay-specific fields
            "is_replay": True,
            "replay_event_id": event_id,
            "replay_reveal": {
                "event_name": event["name"],
                "narrative": event["reveal_narrative"],
                "what_happened": event["what_happened"],
                "date": event["date"],
            },
        }

    async def _fetch_historical_context(self, symbol: str, date_range: dict) -> dict:
        """Fetch real historical data for the event window.

        Uses the event's date range to fetch actual historical prices from FMP.
        Falls back to curated context on error.
        """
        start = date_range.get("start")
        end = date_range.get("end")

        try:
            history = await self.market_adapter.get_historical_prices_range(symbol, start, end)
            if history:
                return {
                    "symbol": symbol,
                    "price_history": history,
                    "source": "fmp_historical_range",
                    "date_range": date_range,
                }
        except Exception:
            pass

        # Fallback to curated context
        return {
            "symbol": symbol,
            "price_history": [],
            "source": "curated",
            "date_range": date_range,
        }

    def _build_replay_prompt(self, event: dict, historical_data: dict, rag_context: str) -> str:
        """Build the LLM prompt for replay scenario generation.

        CRITICAL: The prompt instructs the LLM to NOT reveal the actual event.
        The scenario should feel like it's happening in real-time.
        """
        symbol = event["primary_symbol"]
        regime = event["regime"].replace("_", " ")
        iv_context = event["iv_context"]

        price_context = ""
        prices = historical_data.get("price_history", [])
        if prices:
            price_context = "\n".join([
                f"  {p.get('date', 'N/A')}: O={p.get('open', 'N/A')} H={p.get('high', 'N/A')} "
                f"L={p.get('low', 'N/A')} C={p.get('close', 'N/A')} Vol={p.get('volume', 'N/A')}"
                for p in prices[:7]
            ])

        difficulty = event.get("difficulty", "intermediate")
        length_guide = {
            "beginner": "Target ~500-600 words. Provide thorough context — explain the setup so the student understands what they're seeing.",
            "intermediate": "Target ~400-500 words. Solid context with enough nuance for a confident trader.",
            "advanced": "Target ~350-500 words. Dense, data-rich — assume the student knows the basics.",
        }
        length_instruction = length_guide.get(difficulty, length_guide["intermediate"])

        return f"""You are a senior CapMan trading instructor creating a HISTORICAL REPLAY scenario.

=== CRITICAL INSTRUCTION ===
You are reconstructing a REAL market event as a training scenario.
DO NOT reveal which specific event this is. DO NOT mention dates, company names in news context,
or any details that would immediately identify the event.
Present it as if it's happening RIGHT NOW — the student is sitting at their desk seeing this unfold.

=== CAPMAN METHODOLOGY ===
{rag_context}

=== HISTORICAL CONTEXT ===
Symbol: {symbol}
Market Regime: {regime}
Volatility Context: {iv_context}

Recent Price Action:
{price_context if price_context else "Data shows significant price movement consistent with the regime."}

=== SCENARIO REQUIREMENTS ===
1. Present the market data as if it's LIVE — "You're looking at your screens and seeing..."
2. Include specific price levels, IV numbers, and options chain data from the context
3. The market regime is: {regime}
4. Test these objectives: {', '.join(event['learning_objectives'])}
5. Create urgency — things are moving, the student needs to act
6. DO NOT use phrases like "historically" or "this reminds me of" or reference the actual event by name
7. Include enough data clues that a skilled trader COULD guess the event, but it's not obvious

=== OUTPUT FORMAT ===
Respond in this exact JSON format:
{{
    "scenario_text": "<formatted scenario text — see structure rules below>",
    "expected_analysis": "What a strong response would cover. This is used by the grading agent, not shown to the student."
}}

=== SCENARIO TEXT STRUCTURE ===
Use these section headers, each on its own line. Leave a blank line between each section:

SITUATION:
2-4 short paragraphs (2-3 sentences each) setting the scene. Describe what the student is seeing on their screens RIGHT NOW — price action, headlines, market moves. Make it feel urgent and live. Blank line between paragraphs.

KEY DATA:
Present critical numbers in a clean, scannable bullet format:
• Price: $XXX.XX (change ±X.X%)
• IV Rank: XX% | HV30: XX%
• Key Levels: Support $XXX / Resistance $XXX
• Volume: XXX (vs XX-day avg)
• Notable: [skew, term structure, flow data]
Use 4-6 bullets. Each should be information-dense.

CONTEXT:
1-2 paragraphs of additional color — macro backdrop, sector dynamics, flow signals, or vol surface behavior. Give the student more to work with.

YOUR TASK:
Break into numbered sub-questions so the student knows exactly what to address:
1. What is your directional thesis and conviction level?
2. What specific options structure would you deploy? (strikes, expiry, legs)
3. How would you size the position and define your risk?
4. What would trigger you to adjust or exit?

=== LENGTH & STYLE RULES ===
{length_instruction}
- Write in plain, direct trading-desk language. No filler.
- Use short paragraphs (2-3 sentences max) with blank lines between them.
- KEY DATA bullets should start with "• " and be scannable at a glance.
- YOUR TASK should use numbered sub-questions.
- The scenario must feel like a live, urgent desk situation — not a textbook."""

    def _parse_response(self, text: str) -> dict:
        """Parse JSON response from LLM."""
        try:
            clean = text.strip()
            if clean.startswith("```json"):
                clean = clean[7:]
            if clean.startswith("```"):
                clean = clean[3:]
            if clean.endswith("```"):
                clean = clean[:-3]
            clean = clean.strip()
            return json.loads(clean)
        except json.JSONDecodeError:
            return {"scenario_text": text, "expected_analysis": ""}

    def get_reveal(self, event_id: str) -> Optional[dict]:
        """Get the reveal data for a completed replay scenario."""
        event = HISTORICAL_EVENTS.get(event_id)
        if not event:
            return None
        return {
            "event_name": event["name"],
            "narrative": event["reveal_narrative"],
            "what_happened": event["what_happened"],
            "date": event["date"],
            "key_objectives_tested": event["learning_objectives"],
        }

    @staticmethod
    def list_available_events(difficulty: Optional[str] = None) -> list[dict]:
        """List all available replay events (for educator/admin view)."""
        events = []
        for eid, event in HISTORICAL_EVENTS.items():
            if difficulty and event["difficulty"] != difficulty:
                continue
            events.append({
                "event_id": eid,
                "name": event["name"],
                "date": event["date"],
                "difficulty": event["difficulty"],
                "regime": event["regime"],
                "symbol": event["primary_symbol"],
                "primary_symbol": event["primary_symbol"],
                "description": event.get("iv_context", ""),
                "learning_objectives": event["learning_objectives"],
            })
        return events
