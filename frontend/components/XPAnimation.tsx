'use client'

import { useEffect, useState, useMemo } from 'react'
import { Zap, Trophy } from 'lucide-react'

interface XPAnimationProps {
  amount: number
  onComplete?: () => void
  duration?: number
}

/* ─── Random confetti particle positions ─── */
function useConfetti(count: number) {
  return useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 0.8 + Math.random() * 1.2,
      size: 4 + Math.random() * 6,
      color: ['#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e', '#22d3ee'][Math.floor(Math.random() * 6)],
      rotation: Math.random() * 360,
    }))
  }, [count])
}

export function XPAnimation({
  amount,
  onComplete,
  duration = 3000,
}: XPAnimationProps) {
  const [isActive, setIsActive] = useState(true)
  const [displayAmount, setDisplayAmount] = useState(0)
  const [phase, setPhase] = useState<'burst' | 'count' | 'fade'>('burst')
  const confetti = useConfetti(20)

  // Count up animation
  useEffect(() => {
    const countDelay = setTimeout(() => {
      setPhase('count')
      let start = 0
      const step = Math.ceil(amount / 25)
      const timer = setInterval(() => {
        start += step
        if (start >= amount) {
          setDisplayAmount(amount)
          clearInterval(timer)
        } else {
          setDisplayAmount(start)
        }
      }, 30)
      return () => clearInterval(timer)
    }, 400)
    return () => clearTimeout(countDelay)
  }, [amount])

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase('fade'), duration - 500)
    const timer = setTimeout(() => {
      setIsActive(false)
      onComplete?.()
    }, duration)
    return () => {
      clearTimeout(timer)
      clearTimeout(fadeTimer)
    }
  }, [duration, onComplete])

  if (!isActive) return null

  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
      {/* Backdrop glow */}
      <div
        className="absolute inset-0 bg-emerald-500/[0.04]"
        style={{
          animation: 'fade-in 0.3s ease-out',
          opacity: phase === 'fade' ? 0 : 1,
          transition: 'opacity 0.5s ease-out',
        }}
      />

      {/* Confetti particles */}
      {confetti.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: '50%',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall ${p.duration}s ease-out ${p.delay}s forwards`,
            opacity: phase === 'fade' ? 0 : undefined,
            transition: 'opacity 0.3s',
          }}
        />
      ))}

      <div className="relative" style={{ opacity: phase === 'fade' ? 0 : 1, transition: 'opacity 0.5s ease-out' }}>
        {/* Expanding rings */}
        <div className="absolute inset-0 -m-10 rounded-full border-2 border-emerald-500/40" style={{ animation: 'level-burst 1s ease-out forwards' }} />
        <div className="absolute inset-0 -m-20 rounded-full border border-emerald-500/20" style={{ animation: 'level-burst 1.2s ease-out 0.2s forwards' }} />
        <div className="absolute inset-0 -m-32 rounded-full border border-emerald-500/10" style={{ animation: 'level-burst 1.4s ease-out 0.4s forwards' }} />

        {/* Center content */}
        <div className="flex flex-col items-center justify-center gap-4">
          <div
            className="flex items-center gap-4 bg-gray-900/95 backdrop-blur-xl px-10 py-5 rounded-2xl border border-emerald-500/30 shadow-2xl"
            style={{
              boxShadow: '0 0 60px rgba(16, 185, 129, 0.2), 0 25px 50px rgba(0, 0, 0, 0.5)',
              animation: 'scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Zap className="w-7 h-7 text-gray-950" />
            </div>
            <div>
              <span className="text-4xl font-black text-gradient tabular-nums">+{displayAmount}</span>
              <p className="text-xs text-emerald-400/70 font-bold uppercase tracking-widest">XP Earned</p>
            </div>
          </div>

          {/* Bonus label for big scores */}
          {amount >= 100 && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/20"
              style={{ animation: 'fade-in-up 0.5s ease-out 0.6s both' }}
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-amber-300">
                {amount >= 200 ? 'Outstanding!' : amount >= 150 ? 'Excellent!' : 'Great Job!'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
