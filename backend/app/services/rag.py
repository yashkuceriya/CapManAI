"""RAG for CapMan — lightweight in-memory document retrieval.

Loads the three CapMan methodology docs on startup and returns
relevant sections based on keyword matching against market regime
and learning objectives. No vector DB needed — the corpus is small
(~300 lines) so keyword retrieval is fast and reliable.
"""

import re
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── Document directory ───
_DOCS_DIR = Path(__file__).resolve().parent.parent / "data" / "capman_docs"

# ─── Mapping from regime/objective keywords → doc section headers ───
_KEYWORD_SECTIONS: dict[str, list[str]] = {
    # Market regimes
    "bullish": ["Bull Put Spread", "Call Debit Spread", "Core Philosophy", "Structure Selection Matrix"],
    "bearish": ["Bear Call Spread", "Put Debit Spread", "Protective Put", "Structure Selection Matrix"],
    "neutral": ["Iron Condor", "Calendar Spreads", "Structure Selection Matrix"],
    "high_iv": ["IV Rank", "Iron Condor", "Theta Burn", "Vega"],
    "low_iv": ["Calendar Spreads", "IV Rank"],
    "earnings": ["Earnings Trade Framework", "Pre-Earnings", "Post-Earnings", "Expected Move"],
    "gamma_squeeze": ["Gamma Squeeze", "GEX", "0DTE Volume", "Gamma Exposure", "Pinning Risk"],
    "vol_expansion": ["Volatility Clusters", "Term Structure", "Vega", "Calendar Spreads"],
    "trending": ["Directional Thesis", "Delta", "Bull Put Spread", "Bear Call Spread"],
    "range_bound": ["Iron Condor", "Calendar Spreads", "Theta Burn"],
    "crash": ["Protective Put", "Collar", "Tail Risk", "VIX", "Skew Index", "CVaR"],
    # Learning objectives
    "trade_thesis": ["Core Philosophy", "Directional Thesis", "Four Pillars"],
    "strike_selection": ["Strike Selection Principles", "ATM vs OTM", "Width Selection", "Delta as Probability"],
    "structure_selection": ["Structure Selection Matrix", "Defined-Risk Strategies"],
    "risk_management": ["Risk Management Rules", "Position Sizing", "Stop Loss Framework"],
    "iv_analysis": ["Implied Volatility", "IV Rank", "IV vs. HV Gap", "IV Surface", "Term Structure"],
    "greeks_understanding": ["Greeks Quick Reference", "Core Greeks", "Delta", "Gamma", "Theta", "Vega"],
    "earnings_plays": ["Earnings Trade Framework", "Expected Move Calculation"],
    "vol_regime": ["Realized (Historical) Volatility", "Volatility Clusters", "IV Mean Reversion"],
    "spread_mechanics": ["Defined-Risk Strategies", "Bull Put Spread", "Bear Call Spread", "Iron Condor"],
    "time_decay": ["Theta", "Time Horizon", "Calendar Spreads"],
    "portfolio_greeks": ["Delta Exposure", "Gamma Exposure", "Theta Burn", "Vega (Aggregate)"],
    "macro_awareness": ["Macroeconomic Indicators", "Yield Curve", "Credit Spreads"],
    "order_flow": ["Order Flow", "Open Interest", "Sweep Volume", "Dark Pool"],
    "skew_analysis": ["IV Surface/Skew", "Skew Index", "IV Smile Curvature"],
    "tail_risk": ["Tail Risk", "VaR", "CVaR", "Stress Test", "Skew Index"],
    "gex_mechanics": ["Gamma Exposure", "Gamma Squeeze", "0DTE Volume", "Pinning Risk"],
    "correlation_rv": ["Correlation", "Dispersion", "Sector Rotation", "Volatility Arbitrage"],
    # New objectives (Vol Framework §9, §13-19)
    "technical_analysis": ["RSI", "MACD", "Bollinger Band", "ATR", "Volume Profile", "Gap Analysis", "Technical Analysis"],
    "interest_rate_vol": ["MOVE Index", "Fed Funds Futures", "TIPS Breakeven", "Corporate Bond CDS", "Term Premium", "Interest Rate"],
    "seasonality": ["Monthly Return Seasonality", "Quarterly OpEx", "Tax-Loss Harvesting", "VIX Expiration", "Seasonality"],
    "fundamental_analysis": ["Price-to-Earnings", "Short Interest", "Earnings Quality", "Free Cash Flow", "Revenue Growth", "Fundamental"],
    "commodity_vol": ["Gold/Silver Ratio", "Copper", "Oil Prices", "Shipping Freight", "Natural Gas", "Commodity"],
    "crypto_vol": ["Bitcoin Dominance", "Crypto", "Stablecoin", "Funding Rates", "Exchange Reserves"],
    "microstructure": ["Dark Pool Ratio", "Effective Spread", "Flash Crash", "Auction Imbalance", "Market Microstructure"],
    "geopolitical_alt": ["Geopolitical Stress", "Election Poll", "Satellite Imagery", "ESG Scores", "Alternative Data"],
}


class CapManRAG:
    """In-memory RAG: loads CapMan docs on init, retrieves by keyword match."""

    def __init__(self):
        self._sections: dict[str, str] = {}  # header → content
        self._full_text: str = ""
        self._load_docs()

    def _load_docs(self):
        """Load all markdown files and split into sections by ## headers."""
        if not _DOCS_DIR.exists():
            logger.warning("CapMan docs directory not found: %s", _DOCS_DIR)
            return

        full_parts = []
        for md_file in sorted(_DOCS_DIR.glob("*.md")):
            try:
                text = md_file.read_text(encoding="utf-8")
                full_parts.append(text)
                current_header = md_file.stem.replace("_", " ").title()
                current_lines: list[str] = []
                for line in text.split("\n"):
                    header_match = re.match(r"^#{1,3}\s+(.+)", line)
                    if header_match:
                        if current_lines:
                            self._sections[current_header] = "\n".join(current_lines).strip()
                        current_header = header_match.group(1).strip()
                        current_lines = [line]
                    else:
                        current_lines.append(line)
                if current_lines:
                    self._sections[current_header] = "\n".join(current_lines).strip()
            except Exception as e:
                logger.warning("Failed to load %s: %s", md_file, e)

        self._full_text = "\n\n".join(full_parts)
        logger.info(
            "CapMan RAG loaded %d sections from %d documents (%d chars)",
            len(self._sections), len(full_parts), len(self._full_text),
        )

    def _find_sections(self, keywords: list[str], max_chars: int = 2000) -> str:
        """Find sections matching any of the given keywords."""
        candidate_headers: list[str] = []
        for kw in keywords:
            kw_lower = kw.lower().replace(" ", "_")
            for map_key, headers in _KEYWORD_SECTIONS.items():
                if map_key in kw_lower or kw_lower in map_key:
                    candidate_headers.extend(headers)

        seen = set()
        unique_headers = []
        for h in candidate_headers:
            if h not in seen:
                seen.add(h)
                unique_headers.append(h)

        results: list[str] = []
        total_chars = 0
        for target_header in unique_headers:
            target_lower = target_header.lower()
            for section_header, section_text in self._sections.items():
                if target_lower in section_header.lower() and section_text not in results:
                    if total_chars + len(section_text) > max_chars:
                        break
                    results.append(section_text)
                    total_chars += len(section_text)
            if total_chars >= max_chars:
                break

        return "\n\n".join(results) if results else ""

    def retrieve_for_scenario(self, market_regime: str, objectives: list) -> str:
        """Retrieve relevant CapMan methodology for scenario generation."""
        keywords = [market_regime] + objectives
        context = self._find_sections(keywords, max_chars=2000)
        if not context:
            for header, text in self._sections.items():
                if "core philosophy" in header.lower() or "four pillars" in header.lower():
                    return text
        return context

    def retrieve_for_grading(self, scenario_context: str, student_response: str) -> str:
        """Retrieve relevant CapMan methodology for grading a student response."""
        combined = (scenario_context + " " + student_response).lower()
        keywords = []
        for kw in _KEYWORD_SECTIONS:
            if kw.replace("_", " ") in combined or kw in combined:
                keywords.append(kw)
        return self._find_sections(keywords[:6], max_chars=1500)


_rag_instance: CapManRAG | None = None


def get_rag() -> CapManRAG:
    global _rag_instance
    if _rag_instance is None:
        _rag_instance = CapManRAG()
    return _rag_instance
