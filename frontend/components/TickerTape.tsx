'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { market } from '@/lib/api'

const FALLBACK_TICKERS = [
  'SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL',
  'META', 'JPM', 'V', 'AMD', 'NFLX', 'DIS', 'BA', 'GS',
]

interface TickerItem {
  symbol: string
  price: number
  change: number
}

// Poll interval: 60 seconds (avoid hammering the API)
const POLL_INTERVAL_MS = 60_000

export function TickerTape() {
  const [items, setItems] = useState<TickerItem[]>([])
  const [isLive, setIsLive] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchQuotes = useCallback(async () => {
    try {
      const data = await market.getQuotes()
      if (data.quotes && data.quotes.length > 0) {
        setItems(
          data.quotes.map((q: any) => ({
            symbol: q.symbol,
            price: q.price,
            change: q.change_percent,
          }))
        )
        setIsLive(data.data_source === 'live')
      }
    } catch {
      // On error, keep existing data (or generate fallback on first load)
      setItems((prev) => {
        if (prev.length > 0) return prev
        return FALLBACK_TICKERS.map((symbol) => {
          const base = 50 + Math.random() * 450
          const change = parseFloat(((Math.random() - 0.42) * 6).toFixed(2))
          return { symbol, price: parseFloat(base.toFixed(2)), change }
        })
      })
    }
  }, [])

  useEffect(() => {
    fetchQuotes()
    intervalRef.current = setInterval(fetchQuotes, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchQuotes])

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

      {items.length > 0 ? (
        <div className="ticker-tape">
          {/* Duplicate for seamless loop */}
          {renderItems('a')}
          {renderItems('b')}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-[11px] text-white/30 font-mono">
          Loading quotes...
        </div>
      )}
    </div>
  )
}
