'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface FlashCard {
  category: string
  title: string
  content: string
}

const HARDCODED_CARDS: FlashCard[] = [
  { category: 'Greeks', title: 'Delta Hedging', content: 'Delta measures rate of change in option price per $1 move in underlying. A delta of 0.50 means the option moves $0.50 for every $1 stock move.' },
  { category: 'Spreads', title: 'Iron Condor', content: 'Sell OTM put spread + OTM call spread. Profits from low volatility. Max profit = net credit received. Best when IV is high and expected to decline.' },
  { category: 'Vol', title: 'IV Crush', content: 'Implied volatility drops sharply after earnings or events. Selling options before high-IV events captures premium as vol normalizes post-event.' },
  { category: 'Risk', title: 'Position Sizing', content: 'Never risk more than 2-5% of portfolio on a single trade. Use kelly criterion or fixed fractional for optimal sizing.' },
  { category: 'Strategy', title: 'Wheel Strategy', content: 'Sell cash-secured puts → get assigned → sell covered calls. Generates income on stocks you want to own. Works best on high-quality underlyings.' },
  { category: 'Greeks', title: 'Theta Decay', content: 'Options lose time value exponentially as expiration approaches. Theta decay accelerates in the final 30 days. Sellers benefit, buyers beware.' },
  { category: 'Vol', title: 'Volatility Skew', content: 'OTM puts typically have higher IV than OTM calls (put skew). This reflects demand for downside protection. Skew steepens during market stress.' },
  { category: 'Spreads', title: 'Calendar Spread', content: 'Buy longer-dated option, sell shorter-dated same strike. Profits from time decay differential and rising IV in the back month.' },
  { category: 'Risk', title: 'Max Loss Rules', content: 'Define max loss BEFORE entering. Use stop-losses or define max risk via spread width. Never adjust to increase risk on a losing position.' },
  { category: 'Strategy', title: 'Straddle vs Strangle', content: 'Straddle: buy ATM call + put. Strangle: buy OTM call + put. Strangles are cheaper but need bigger moves. Both profit from high realized vol.' },
  { category: 'Greeks', title: 'Gamma Risk', content: 'Gamma is highest for ATM options near expiration. Short gamma = accelerating losses as the stock moves. Pin risk is a real danger on expiry day.' },
  { category: 'Vol', title: 'VIX Term Structure', content: 'Normal: contango (far months > near months). Inverted: backwardation signals fear. Track VIX futures curve for regime detection.' },
]

const CATEGORY_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  'Greeks': { accent: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.3)' },
  'Spreads': { accent: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.3)' },
  'Vol': { accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' },
  'Risk': { accent: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
  'Strategy': { accent: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)' },
}

export function FlashCards() {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null)

  const cards = HARDCODED_CARDS

  useEffect(() => {
    if (isPaused || cards.length === 0) return

    const timer = setInterval(() => {
      setDirection('next')
      setCurrentIdx((prev) => (prev + 1) % cards.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [isPaused, cards.length])

  const card = cards[currentIdx]
  const colors = CATEGORY_COLORS[card.category] || CATEGORY_COLORS['Strategy']

  const handleDotClick = (idx: number) => {
    if (idx > currentIdx) {
      setDirection('next')
    } else {
      setDirection('prev')
    }
    setCurrentIdx(idx)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wide">Quick Tips</h3>
        <span className="text-xs text-gray-500 tabular-nums">
          {currentIdx + 1} / {cards.length}
        </span>
      </div>

      {/* Card Container */}
      <div
        className="relative min-h-[220px] rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300"
        style={{
          background: `linear-gradient(145deg, var(--cm-surface-2), var(--cm-bg))`,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.bg,
        }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Animated gradient overlay */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${colors.accent}, transparent)`,
            pointerEvents: 'none',
          }}
        />

        {/* Corner accent - top left */}
        <div className="absolute top-4 left-5 z-10">
          <div
            className="w-10 h-10 rounded-lg backdrop-blur-sm flex items-center justify-center border"
            style={{
              borderColor: colors.border,
              backgroundColor: `${colors.accent}10`,
            }}
          >
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: colors.accent }}
            >
              {card.category[0]}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col justify-center h-full px-7 pt-20 pb-16">
          <h4
            className="text-base font-bold mb-2 transition-colors duration-300"
            style={{ color: colors.accent }}
          >
            {card.title}
          </h4>
          <p className="text-sm text-gray-300 leading-relaxed">
            {card.content}
          </p>
        </div>

        {/* Category tag bottom left */}
        <div className="absolute bottom-4 left-5">
          <span
            className="text-xs font-semibold px-2 py-1 rounded-full"
            style={{
              backgroundColor: colors.bg,
              color: colors.accent,
              border: `1px solid ${colors.border}`,
            }}
          >
            {card.category}
          </span>
        </div>

        {/* Pause indicator on hover */}
        {isPaused && (
          <div className="absolute top-4 right-5 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-800/50 border border-gray-700/50">
            <div className="flex gap-0.5">
              <div className="w-1 h-3 bg-gray-400 rounded-sm" />
              <div className="w-1 h-3 bg-gray-400 rounded-sm" />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">PAUSED</span>
          </div>
        )}

        {/* Smooth fade transition */}
        {direction && (
          <div
            className="absolute inset-0 bg-black opacity-0 pointer-events-none"
            style={{
              animation: `fadeOut 0.3s ease-in-out`,
            }}
          />
        )}
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pb-2">
        {cards.map((_, idx) => (
          <button
            key={idx}
            onClick={() => handleDotClick(idx)}
            className="rounded-full transition-all duration-300 hover:scale-110"
            style={{
              width: idx === currentIdx ? '24px' : '8px',
              height: '8px',
              backgroundColor: idx === currentIdx ? colors.accent : 'rgba(255,255,255,0.1)',
              border: idx === currentIdx ? `2px solid ${colors.accent}` : 'none',
              cursor: 'pointer',
            }}
            aria-label={`Go to card ${idx + 1}`}
          />
        ))}
      </div>

      {/* Indicator text */}
      <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
        <ChevronDown className="w-3 h-3" />
        <span>Auto-rotates every 5 seconds · Click dots to navigate</span>
      </div>

      <style jsx>{`
        @keyframes fadeOut {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
