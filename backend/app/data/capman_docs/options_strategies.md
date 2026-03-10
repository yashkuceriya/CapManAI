# CapMan Options Strategies Reference

## Defined-Risk Strategies (CapMan Preferred)

### Bull Put Spread (Credit)
- **When to use**: Bullish thesis, IV rank > 30
- **Construction**: Sell higher strike put, buy lower strike put (same expiration)
- **Max Gain**: Net premium received
- **Max Loss**: Spread width minus premium received
- **Breakeven**: Short strike minus premium received
- **CapMan Notes**: Our bread-and-butter strategy in trending bull regimes. Target 20-30 delta for the short strike. Width = 3-5 strikes standard.

### Bear Call Spread (Credit)
- **When to use**: Bearish thesis, IV rank > 30
- **Construction**: Sell lower strike call, buy higher strike call (same expiration)
- **Max Gain**: Net premium received
- **Max Loss**: Spread width minus premium received
- **CapMan Notes**: Mirror of bull put. Use in trending bear or at resistance levels. Same delta and width guidelines.

### Iron Condor
- **When to use**: Neutral thesis, high IV rank (>50), expecting range-bound price action
- **Construction**: Bull put spread + bear call spread on same underlying, same expiration
- **Max Gain**: Combined premiums received
- **Max Loss**: Wider spread width minus total premium (occurs if price breaks through either side)
- **CapMan Notes**: Best in high vol range-bound regimes. Keep short strikes at 15-20 delta for wider margin of safety. Manage at 50% of max profit or 21 DTE, whichever comes first.

### Call Debit Spread (Long)
- **When to use**: Bullish thesis, IV rank < 30 (premiums cheap)
- **Construction**: Buy lower strike call, sell higher strike call
- **Max Gain**: Spread width minus premium paid
- **Max Loss**: Premium paid
- **CapMan Notes**: Use when IV is low and you want defined-risk bullish exposure. Target ATM/1-strike-OTM for the long leg.

### Put Debit Spread (Long)
- **When to use**: Bearish thesis, IV rank < 30
- **Construction**: Buy higher strike put, sell lower strike put
- **CapMan Notes**: Same logic as call debit spread, inverted. Use for defined-risk bearish plays when premiums are cheap.

## Calendar Spreads
- **When to use**: Expecting IV expansion, neutral short-term thesis
- **Construction**: Sell near-term option, buy same-strike longer-term option
- **CapMan Notes**: Benefits from time decay differential AND volatility expansion. Best deployed when IV rank is low (below 20) and you expect a catalyst to increase IV.

## Protective Strategies

### Protective Put (Portfolio Hedge)
- **When**: Portfolio is significantly long and you want tail risk protection
- **CapMan Notes**: Buy 5-10% OTM puts, 60-90 DTE. Accept the theta cost as insurance. Roll before 30 DTE.

### Collar
- **When**: You own stock and want to lock in gains while reducing cost of protection
- **Construction**: Own stock + buy OTM put + sell OTM call
- **CapMan Notes**: The sold call finances the put. Use when you want to hold a position through uncertainty but cap both upside and downside.

## Greeks Quick Reference

### Delta
- Measures directional exposure ($1 move in underlying → delta × 100 = P&L)
- Calls: 0 to +1.0 | Puts: 0 to -1.0
- ATM ≈ 0.50 | Deep ITM → 1.0 | Deep OTM → 0.0

### Gamma
- Rate of change of delta. Highest near ATM and near expiration.
- **CapMan Warning**: High gamma near expiration = high risk of rapid P&L swings. This is "gamma risk."

### Theta
- Time decay per day. Negative for long options, positive for short options.
- Accelerates in the final 30 days. Steepest in last 7 days.
- **CapMan Rule**: Never be net long theta unless you have a strong directional thesis.

### Vega
- Sensitivity to implied volatility changes. 1-point IV change → vega × 100 = P&L.
- Long options = long vega (benefit from IV increase). Short options = short vega.
- **CapMan Note**: In high IV environments, you want to be short vega (selling premium). In low IV, long vega (buying premium).

## Earnings Trade Framework

### Pre-Earnings
- IV typically expands into earnings. Strategies:
  - Sell premium (iron condors, strangles) if IV is exceptionally high
  - Buy premium (straddles, debit spreads) if IV hasn't fully priced in the expected move

### Post-Earnings
- IV crush is the dominant factor. Strategies sold pre-earnings benefit from this collapse.
- **CapMan Rule**: Size earnings trades at 50% of normal position size. Binary outcomes = higher uncertainty.

### Expected Move Calculation
- Expected move ≈ ATM straddle price × 0.85
- If you think the actual move will be LARGER than expected: buy premium
- If you think the actual move will be SMALLER: sell premium
