'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

const TICKERS = [
  'SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL',
  'META', 'JPM', 'V', 'AMD', 'NFLX', 'DIS', 'BA', 'GS',
]

interface TickerItem {
  symbol: string
  price: number
  change: number
}

export function TickerTape() {
  const items: TickerItem[] = useMemo(
    () =>
      TICKERS.map((symbol) => {
        const base = 50 + Math.random() * 450
        const change = parseFloat(((Math.random() - 0.42) * 6).toFixed(2))
        return { symbol, price: parseFloat(base.toFixed(2)), change }
      }),
    [],
  )

  const renderItems = (key: string) =>
    items.map((t) => {
      const up = t.change >= 0
      return (
        <span
          key={`${key}-${t.symbol}`}
          className="inline-flex items-center gap-1.5 px-4 py-1 text-[11px] font-mono whitespace-nowrap"
        >
          <span className="font-bold text-white/80">{t.symbol}</span>
          <span className="text-white/40">${t.price.toFixed(2)}</span>
          <span className={`flex items-center gap-0.5 font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {up ? '+' : ''}
            {t.change.toFixed(2)}%
          </span>
        </span>
      )
    })

  return (
    <div className="relative overflow-hidden rounded-xl mb-3" style={{ height: 34, background: 'rgba(13,22,41,0.6)', borderBottom: '1px solid var(--cm-border)' }}>
      {/* Left/right fade masks */}
      <div className="absolute inset-y-0 left-0 w-12 z-10" style={{ background: 'linear-gradient(to right, var(--cm-bg), transparent)' }} />
      <div className="absolute inset-y-0 right-0 w-12 z-10" style={{ background: 'linear-gradient(to left, var(--cm-bg), transparent)' }} />

      <div className="ticker-tape">
        {/* Duplicate for seamless loop */}
        {renderItems('a')}
        {renderItems('b')}
      </div>
    </div>
  )
}
