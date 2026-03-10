# CapMan Volatility Trading Data Framework

This is CapMan's comprehensive reference for all data categories relevant to volatility trading. Scenario analysis should reference these metrics when assessing market conditions and constructing trades.

## 1. Implied Volatility (IV) Metrics

- **IV Rank**: Percentage of time IV has been below current level over 1 year. Core metric for structure selection — high IV Rank (>50) favors premium selling, low IV Rank (<30) favors premium buying.
- **IV Percentile**: Current IV relative to the range of IV over the last year.
- **IV Surface/Skew**: Difference in IV between OTM puts and calls. Steep skew = market pricing downside risk heavily.
- **Term Structure**: IV differences across different expiration dates (Contango/Backwardation). Contango = normal, backwardation = fear.
- **IV vs. HV Gap**: The spread between implied and realized volatility. Wide gap = options are expensive relative to actual movement.
- **IV Mean Reversion Speed**: Historical rate at which IV returns to its average. Faster reversion = more aggressive premium selling.
- **ATM Straddle Price**: The cost of buying an at-the-money put and call. Represents the market's expected move.
- **IV of IV (VVIX)**: The volatility of the implied volatility itself. High VVIX = unstable vol environment.
- **IV Smile Curvature**: The rate of change of IV as strikes move away from ATM. Steep smile = expensive wings.
- **Fixed Strike IV**: Tracking IV at a specific price level over time. Useful for monitoring vol trends independent of price movement.

## 2. Realized (Historical) Volatility (RV/HV)

- **Standard Deviation (Close-to-Close)**: Traditional measure of price dispersion.
- **Parkinson Volatility**: Uses High/Low range to estimate volatility. More efficient than close-to-close.
- **Garman-Klass Volatility**: Includes Open/High/Low/Close for better efficiency.
- **Rogers-Satchell Volatility**: Accounts for trends or 'drift' in price.
- **Yang-Zhang Volatility**: Combines overnight and intraday volatility. Best single estimator.
- **Realized Kernel**: High-frequency measure of volatility.
- **Volatility Clusters**: Identification of 'hot' periods of price movement. Vol begets vol.
- **Intraday Volatility Profile**: Average volatility by hour of the trading day. First and last 30 minutes are highest vol.
- **Realized Correlation**: How stocks in an index move together. Low correlation = dispersion opportunity.
- **RV Decay Rate**: How fast past price shocks lose influence on current RV.

## 3. Options Greeks (Aggregate & Individual)

### Core Greeks
- **Delta Exposure (Net)**: Directional risk across the entire portfolio.
- **Gamma Exposure (GEX)**: Sensitivity of Delta to price changes; marker for 'pins'. High GEX = market makers hedging creates support/resistance.
- **Theta Burn**: Daily time decay across all positions. CapMan targets positive theta in premium-selling regimes.
- **Vega (Aggregate)**: Portfolio sensitivity to a 1% change in IV.

### Higher-Order Greeks (Advanced)
- **Vanna**: Sensitivity of Delta to changes in IV. Important near expiration with volatility shifts.
- **Charm**: Sensitivity of Delta to the passage of time. Causes delta drift as expiration approaches.
- **Vomma (Volga)**: Sensitivity of Vega to changes in IV. Matters for large vol moves.
- **Color**: Sensitivity of Gamma to the passage of time.
- **Speed**: Sensitivity of Gamma to price changes (3rd order).
- **Zomma**: Sensitivity of Gamma to changes in IV.

## 4. Order Flow & Liquidity Metrics

- **Bid-Ask Spread (Options)**: The cost of entry/exit for specific strikes. Wider = less liquid.
- **Open Interest (OI) Change**: Daily shifts in total outstanding contracts. Rising OI + rising price = new money bullish.
- **Volume-to-OI Ratio**: Identifying high-activity speculative strikes. Ratio > 1 = unusual activity.
- **Dark Pool Prints**: Large off-exchange trades that may precede volatility.
- **Order Book Depth**: Availability of contracts at various price levels.
- **Trade Size Distribution**: Retail vs. Institutional sizing. Large blocks = smart money signal.
- **Put/Call Ratio (Volume)**: Tactical sentiment indicator. Extreme readings are contrarian signals.
- **Sweep Volume**: Orders filled across multiple exchanges simultaneously. Sign of urgency.
- **Market Maker Hedging Pressure**: Estimation of when MMs must buy/sell delta. Drives gamma-related moves.

## 5. Event-Driven Volatility

- **Earnings Implied Move**: Market's expected price swing for earnings. Compare to historical actual moves.
- **Earnings Volatility Crush**: Average IV drop post-announcement. Typically 30-60% of pre-earnings IV.
- **Economic Calendar Impact**: Expected moves for CPI, FOMC, and NFP. FOMC days have unique vol patterns.
- **Dividend Risk**: Impact of upcoming dividends on call premiums. Early assignment risk for short calls.
- **FDA Decision Dates**: Binary risk events for biotech stocks. Size positions at 50% normal.
- **Index Rebalancing Dates**: Predictable flow-driven volatility.
- **Political Risk Index**: Volatility spikes tied to election cycles.
- **Corporate Buyback Windows**: Periods of reduced downside volatility.

## 6. Macroeconomic Indicators

- **Yield Curve Slope (2s10s)**: Predictor of recessionary volatility. Inversion = risk-off.
- **Inflation (CPI/PCE)**: Driver of interest rate volatility.
- **Central Bank Balance Sheets**: Liquidity levels in the global system. QE = low vol, QT = high vol.
- **US Dollar Index (DXY)**: Inverse correlation with equity volatility.
- **Credit Spreads (HYG/JNK)**: Risk appetite in the debt markets. Widening = risk-off signal.
- **Oil Prices (WTI/Brent)**: Input costs for broader market vol.
- **Global Manufacturing PMI**: Leading indicator for economic expansion.
- **Geopolitical Stress Index**: Tracking conflicts and trade wars.

## 7. Sentiment & Behavioral Data

- **AAII Investor Sentiment**: Retail bull/bear survey results. Extreme readings are contrarian.
- **Fear & Greed Index**: Composite of momentum and volatility.
- **Put/Call Ratio**: Tactical sentiment — extreme put buying = potential bottom.
- **Margin Debt Levels**: Systemic leverage indicators. High margin = fragile market.
- **Fund Flow Data**: Inflows/outflows from equity vs. bond ETFs.
- **Insider Trading Activity**: Buying/selling by corporate executives. Cluster buying = bullish signal.
- **Retail Option Buying (Gamma)**: Aggressive call buying by small traders. Can amplify moves.

## 8. Correlation & Relative Value

- **Stock-to-Index Correlation**: How much an individual stock follows SPY. Low correlation = stock-specific risk dominates.
- **Sector Rotation Strength**: Velocity of capital moving between sectors.
- **Volatility Arbitrage Spreads**: IV of stock vs. IV of index. Dispersion trades.
- **Dispersion Index**: Measures the cost of index options vs. component options.
- **Safe Haven Flows**: Movement into Gold or Treasury bonds.

## 9. Technical Analysis / Price Action

- **RSI**: Overbought/Oversold conditions. >70 overbought, <30 oversold.
- **MACD**: Momentum shifts and crossover signals.
- **Bollinger Band Width**: Direct measure of price squeeze. Narrow bands = breakout imminent.
- **ATR (Average True Range)**: Volatility-adjusted price movement. Use for stop loss sizing.
- **Volume Profile**: Areas of high-volume price 'agreement'. Key support/resistance.
- **Gap Analysis**: Frequency and size of overnight price gaps.

## 10. Tail Risk & Extremes

- **Skew Index (CBOE)**: Market's expectation of a 'black swan'. Rising skew = increasing tail fear.
- **Kurtosis**: Measure of 'fat tails' in the return distribution.
- **VaR (Value at Risk)**: Potential loss in a worst-case scenario.
- **CVaR (Expected Shortfall)**: Average loss beyond the VaR threshold. More conservative than VaR.
- **Stress Test Results**: Simulated performance in 2008 or 2020 conditions.
- **VIX/VXV Ratio**: Short-term vs. medium-term fear comparison. >1.0 = panic.

## 11. Exotic & Structural Data

- **Gamma Squeeze Probability**: Likelihood of forced buyer liquidations. Watch high-GEX strikes.
- **0DTE Volume**: Impact of same-day expiration options on intraday vol. Increasingly dominant force.
- **Pinning Risk**: Probability of a stock closing exactly at a strike. Max pain analysis.
- **Binary Option Probabilities**: Market-implied odds of specific price hits.

## 12. Portfolio Management Metrics

- **Sharpe Ratio**: Risk-adjusted return performance. Target > 1.5.
- **Sortino Ratio**: Focus on downside risk adjusted return. Better than Sharpe for options portfolios.
- **Kelly Criterion**: Sizing of bets based on edge/probability. Half-Kelly is CapMan standard.
- **Max Drawdown**: Largest peak-to-decline. Cap at 15% for the portfolio.
- **Profit Factor**: Ratio of gross wins to gross losses. Target > 2.0.
- **Concentration Risk**: Percent of capital in a single position. CapMan max 10%.

## 13. Interest Rate & Fixed Income Data

- **MOVE Index**: The VIX equivalent for the bond market. Spikes correlate with equity vol.
- **Fed Funds Futures**: Market pricing of next interest rate hike/cut. Drives equity risk premium.
- **TIPS Breakeven**: Market-based inflation expectations. Rising breakevens = hawkish Fed risk.
- **Corporate Bond CDS Spreads**: Cost to insure against default. Widening = credit stress.
- **Term Premium**: The extra yield for holding long-term debt. Negative term premium = curve inversion risk.
- **Reverse Repo Usage**: Excess cash in the banking system. High usage = ample liquidity.

## 14. Seasonality & Time-Based Data

- **Monthly Return Seasonality**: Historical performance by month. "Sell in May" and year-end rally patterns.
- **Quarterly OpEx (Witching)**: High volume on expiration Fridays. Gamma unwind creates volatility.
- **Tax-Loss Harvesting Windows**: Year-end selling pressure in November/December.
- **Intraday Mean Reversion**: Tendency for prices to return to VWAP. Strongest in first/last hour.
- **VIX Expiration**: Specific dynamics of VIX settlement. AM settlement creates unique hedging flows.

## 15. Fundamental Equity Data

- **Price-to-Earnings (P/E) Ratio**: Valuation-based volatility floor. High P/E stocks are more vol-sensitive.
- **Short Interest %**: Potential for short-covering rallies. >20% SI is elevated squeeze risk.
- **Earnings Quality Score**: Reliability of reported profits. Low quality = higher event vol.
- **Free Cash Flow Yield**: Ability to withstand market downturns. High FCF = lower bankruptcy vol.
- **Revenue Growth Rate**: Forward-looking valuation driver. Decelerating growth = vol expansion.

## 16. Commodity & Energy Data

- **Gold/Silver Ratio**: Indicator of industrial vs. monetary demand. Rising ratio = risk-off.
- **Copper Prices (Dr. Copper)**: Indicator of global economic health.
- **Oil Prices (WTI/Brent)**: Energy input costs. Oil spikes drive inflation vol.
- **Shipping Freight Rates (BDI)**: Cost of global trade. Collapse = recession signal.
- **Natural Gas Storage Reports**: High-volatility weekly data releases.

## 17. Crypto & Digital Asset Data

- **Bitcoin Dominance**: Risk-on/risk-off sentiment in crypto markets.
- **Crypto-Specific IV**: BTC/ETH implied vol differences from equities. Generally 2-3x equity vol.
- **Stablecoin Inflows**: Sidelined capital ready for deployment. Rising = dry powder.
- **Funding Rates**: Cost of leverage in perpetual futures. Extreme rates = overextension.
- **Exchange Reserves**: Amount of crypto held on exchanges. Declining = accumulation.

## 18. Market Microstructure

- **Dark Pool Ratio**: Percent of volume hidden from public books. Rising = institutional repositioning.
- **Effective vs. Quoted Spread**: Realized execution costs. Widening = liquidity deterioration.
- **Flash Crash Indicators**: Sudden drops in liquidity depth. Monitor order book thinning.
- **Auction Imbalance**: Buy/sell pressure at market open/close. Large imbalances = directional signal.
- **0DTE Impact**: Same-day expiration options volume. Increasingly drives intraday vol dynamics.

## 19. Geopolitical & Alternative Data

- **Geopolitical Stress Index**: Tracking conflicts, sanctions, and trade wars.
- **Election Poll Fluctuations**: Anticipating policy shifts. Uncertainty = vol premium.
- **Satellite Imagery**: Tracking retail parking lots, oil tanker movements. Alternative data edge.
- **Credit Card Transaction Data**: Real-time consumer spending trends.
- **Job Posting Trends**: Corporate expansion or contraction signals.
- **ESG Scores**: Environmental, Social, Governance ratings. Low ESG = regulatory vol risk.
