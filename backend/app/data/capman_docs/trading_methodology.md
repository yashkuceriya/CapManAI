# CapMan Trading Methodology

## Core Philosophy
At CapMan, we believe that consistent profitability in options trading comes from disciplined scenario analysis, proper position sizing, and systematic risk management. Every trade must have a clearly defined thesis, a quantified risk profile, and an exit strategy before entry.

## Trade Construction Framework

### The Four Pillars
1. **Directional Thesis**: What is the expected move? Define magnitude and timeframe.
2. **Volatility Assessment**: Is implied volatility (IV) elevated or depressed relative to historical volatility (HV)? This determines structure selection.
3. **Risk Definition**: Maximum loss must be known and acceptable before entry. Position size follows from risk budget.
4. **Time Horizon**: Match expiration to thesis. Avoid theta decay working against you without compensation.

### Structure Selection Matrix
- **IV High + Bullish**: Sell put spreads (collect premium, benefit from IV crush)
- **IV High + Bearish**: Sell call spreads (collect premium)
- **IV High + Neutral**: Iron condors, strangles (collect premium from both sides)
- **IV Low + Bullish**: Buy calls or call debit spreads (cheap premium)
- **IV Low + Bearish**: Buy puts or put debit spreads (cheap premium)
- **IV Low + Neutral**: Calendar spreads (benefit from IV expansion)

## Strike Selection Principles

### ATM vs OTM
- **ATM strikes**: Highest gamma, most responsive to directional moves. Use when thesis has high conviction.
- **1-2 strikes OTM**: Better risk/reward ratio for defined-risk strategies. Standard for debit spreads.
- **Deep OTM**: Only for tail risk hedging or wide iron condors. Low probability but asymmetric payoff.

### Width Selection for Spreads
- **Narrow spreads (1-2 strikes wide)**: Lower max loss, lower max gain. Good for high-frequency setups.
- **Wide spreads (5+ strikes)**: Higher max gain potential, higher max loss. Use with high conviction + strong risk management.
- **CapMan Standard**: Default to 3-5 strike widths for credit spreads. Adjust based on IV environment.

### Delta as Probability Proxy
- Short strike delta ≈ probability of being in the money at expiration
- CapMan target: 20-30 delta for credit spreads (70-80% probability of profit)
- Adjust higher (35-40 delta) when IV rank > 50 for better premium

## Risk Management Rules

### Position Sizing
- **The 2% Rule**: No single trade should risk more than 2% of total portfolio value.
- **Correlation Check**: Avoid having more than 3 positions in the same sector or same directional bet.
- **Portfolio Delta**: Net portfolio delta should be managed. Don't let it drift beyond ±20% of portfolio value.

### Stop Loss Framework
- **Credit Spreads**: Exit at 2x premium received (e.g., sold for $1.00, stop at $2.00 loss).
- **Debit Spreads**: Exit if the position loses 50% of its value.
- **Time Stop**: If the trade hasn't moved in your favor by 50% of the time to expiration, reassess.

### Rolling and Adjustments
- Roll for credit: Only roll if you can collect additional credit.
- Never roll into a position with higher max loss than the original.
- **CapMan Rule**: If you need to roll more than once, the thesis was likely wrong. Close and reassess.

## Market Regime Analysis

### Regime Categories
1. **Trending Bull**: Rising prices, low/moderate VIX. Favor bullish strategies, sell puts.
2. **Trending Bear**: Falling prices, rising VIX. Favor bearish strategies or cash.
3. **High Vol Range-Bound**: Elevated VIX, price oscillating. Premium selling paradise.
4. **Low Vol Trending**: Steadily rising prices, compressed VIX. Buy cheap options for breakout.
5. **Volatility Expansion**: VIX spiking, uncertainty high. Reduce position size, widen stops.
6. **Mean Reversion**: After a sharp move, price returning to equilibrium. Contrarian setups.

### Regime Detection Signals
- VIX level and term structure (contango vs backwardation)
- 20-day vs 50-day moving average relationship
- Sector rotation patterns
- Earnings calendar proximity
- Macro event calendar (FOMC, CPI, etc.)

## CapMan Lexicon

### Key Terms (Must Use in Analysis)
- **Thesis**: The directional or volatility view driving the trade
- **Structure**: The specific options strategy (e.g., "bull put spread")
- **Risk Budget**: The maximum dollar amount allocated to this trade
- **IV Rank**: Current IV percentile relative to past 52 weeks
- **HV/IV Ratio**: Historical vol divided by implied vol — measures richness
- **Theta Rent**: Daily premium decay you collect (credit) or pay (debit)
- **Gamma Risk**: Exposure to rapid directional moves near expiration
- **Pin Risk**: Risk of underlying closing near a strike at expiration
- **Roll Trigger**: Predefined condition for rolling the position
- **Max Pain**: Strike price where most options expire worthless

### Analysis Template
Every trade analysis at CapMan must address:
1. What is my thesis and timeframe?
2. What is the IV environment (IV rank, HV/IV ratio)?
3. What structure best expresses this thesis in this IV regime?
4. What are my specific strikes and why?
5. What is my max loss and does it fit my risk budget?
6. What is my exit plan (profit target, stop loss, time stop)?
7. What macro events could impact this trade before expiration?
