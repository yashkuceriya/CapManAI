'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, TrendingUp, Award, Zap, AlertTriangle, Target, Brain, BookOpen, Sparkles, Crown } from 'lucide-react'
import { renderInlineMarkdown } from '@/lib/sanitize'

/* ─── Animated Number Counter ─── */
function AnimatedNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplayed(Math.round(value * eased))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, duration])
  return <>{displayed}</>
}

/* ─── Animated Radar Chart ─── */
function RadarChart({ dimensions }: { dimensions: Array<{ dimension: string; score: number; feedback?: string }> }) {
  const n = dimensions.length
  if (n < 3) return null

  // Generous sizing: large chart area with padding for labels
  const chartRadius = 120
  const labelPadding = 80  // space outside chart for labels
  const svgSize = (chartRadius + labelPadding) * 2
  const center = svgSize / 2

  // Determine color based on average score
  const avgScore = dimensions.reduce((sum, d) => sum + (d.score || 0), 0) / dimensions.length
  const scoreColor = avgScore >= 80 ? '#10b981' : avgScore >= 60 ? '#f59e0b' : '#ef4444'
  const polygonFill = avgScore >= 80 ? 'rgba(16,185,129,0.15)' : avgScore >= 60 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'

  // Human-readable labels: "trade_model" → "Trade Model"
  const formatLabel = (s: string) =>
    s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  // Calculate polygon points for a given set of scores
  const getPoints = (scores: number[]) =>
    scores.map((score, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      const r = (Math.min(score, 100) / 100) * chartRadius
      return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) }
    })

  // Animate from 0 to actual scores
  const [animatedScores, setAnimatedScores] = useState(dimensions.map(() => 0))
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScores(dimensions.map(d => d.score || 0))
    }, 100)
    return () => clearTimeout(timer)
  }, [dimensions])

  const points = getPoints(animatedScores)
  const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')} Z`

  // Label positions outside the chart
  const labelDistance = chartRadius + 24
  const labelAnchors = dimensions.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const angleDeg = (angle * 180) / Math.PI
    return {
      x: center + labelDistance * Math.cos(angle),
      y: center + labelDistance * Math.sin(angle),
      angleDeg,
    }
  })

  return (
    <div className="flex justify-center w-full">
      <svg
        width="100%"
        height="auto"
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        style={{ maxWidth: 420, aspectRatio: '1 / 1' }}
        className="radar-chart overflow-visible"
      >
        <defs>
          <filter id="radar-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid rings at 20, 40, 60, 80, 100 */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((pct) => (
          <polygon
            key={`ring-${pct}`}
            points={Array.from({ length: n }, (_, i) => {
              const angle = (Math.PI * 2 * i) / n - Math.PI / 2
              const r = chartRadius * pct
              return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`
            }).join(' ')}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="0.75"
          />
        ))}

        {/* Axis lines from center to each vertex */}
        {labelAnchors.map((_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2
          return (
            <line
              key={`axis-${i}`}
              x1={center}
              y1={center}
              x2={center + chartRadius * Math.cos(angle)}
              y2={center + chartRadius * Math.sin(angle)}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.75"
            />
          )
        })}

        {/* Data polygon */}
        <path
          d={pathD}
          fill={polygonFill}
          stroke={scoreColor}
          strokeWidth="2"
          strokeLinejoin="round"
          filter="url(#radar-glow)"
          style={{ transition: 'd 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />

        {/* Vertex dots with score badges */}
        {points.map((p, i) => (
          <g key={`dot-${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill={scoreColor}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="1"
              style={{ transition: 'cx 1.5s ease, cy 1.5s ease' }}
            />
            {/* Score number near each vertex — offset outward slightly */}
            {animatedScores[i] > 0 && (() => {
              const angle = (Math.PI * 2 * i) / n - Math.PI / 2
              const nudge = 16
              return (
                <text
                  x={p.x + nudge * Math.cos(angle)}
                  y={p.y + nudge * Math.sin(angle)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={scoreColor}
                  fontSize="11"
                  fontWeight="800"
                  style={{ transition: 'x 1.5s ease, y 1.5s ease' }}
                >
                  {animatedScores[i].toFixed(0)}
                </text>
              )
            })()}
          </g>
        ))}

        {/* Dimension labels — positioned outside chart, properly anchored */}
        {labelAnchors.map((lp, i) => {
          const dim = dimensions[i]
          // Determine text-anchor based on position relative to center
          const eps = 5
          let anchor: 'start' | 'middle' | 'end' = 'middle'
          let dx = 0
          if (lp.x > center + eps) { anchor = 'start'; dx = 6 }
          else if (lp.x < center - eps) { anchor = 'end'; dx = -6 }

          // Vertical offset: if label is near top, push it up; near bottom, push down
          let dy = 0
          if (lp.y < center - chartRadius * 0.5) dy = -6
          else if (lp.y > center + chartRadius * 0.5) dy = 8

          return (
            <text
              key={`label-${i}`}
              x={lp.x}
              y={lp.y}
              textAnchor={anchor}
              dominantBaseline="central"
              dx={dx}
              dy={dy}
              fill="#94a3b8"
              fontSize="11"
              fontWeight="600"
              letterSpacing="0.02em"
            >
              {formatLabel(dim.dimension)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

/* ─── Animated Radial Score Ring ─── */
function ScoreRing({ score, size = 160, strokeWidth = 12 }: { score: number; size?: number; strokeWidth?: number }) {
  const safeScore = typeof score === 'number' ? score : 0
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(safeScore, 100) / 100
  const targetOffset = circumference * (1 - pct)

  const [animatedOffset, setAnimatedOffset] = useState(circumference)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedOffset(targetOffset), 100)
    return () => clearTimeout(timer)
  }, [targetOffset])

  const strokeColor = safeScore >= 80 ? '#10b981' : safeScore >= 60 ? '#f59e0b' : '#ef4444'
  const glowColor = safeScore >= 80 ? 'rgba(16,185,129,0.25)' : safeScore >= 60 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'
  const textColor = safeScore >= 80 ? 'text-emerald-400' : safeScore >= 60 ? 'text-amber-400' : 'text-red-400'
  const label = safeScore >= 90 ? 'ELITE' : safeScore >= 80 ? 'STRONG' : safeScore >= 70 ? 'SOLID' : safeScore >= 60 ? 'FAIR' : 'NEEDS WORK'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="score-ring">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={strokeColor} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          style={{
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: `drop-shadow(0 0 12px ${glowColor})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-black ${textColor} tabular-nums tracking-tight`}><AnimatedNumber value={safeScore} duration={1500} /></span>
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{label}</span>
      </div>
    </div>
  )
}

/* ─── Animated Bar with glow ─── */
function AnimatedBar({ value, color, glowColor }: { value: number; color: string; glowColor?: string }) {
  const safeValue = typeof value === 'number' ? value : 0
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => setWidth(Math.min(safeValue, 100)), 100)
    return () => clearTimeout(timer)
  }, [safeValue])

  return (
    <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: `${width}%`,
          background: color,
          boxShadow: glowColor ? `0 0 8px ${glowColor}` : undefined,
        }}
      />
    </div>
  )
}

/* ─── Safe number helper ─── */
function safeNum(val: any, fallback = 0): number {
  return typeof val === 'number' ? val : fallback
}

interface GradeDisplayProps {
  grade: {
    overall_score: number
    dimension_scores: Array<{ dimension: string; score: number; feedback: string }>
    strengths: string[]
    areas_for_improvement: string[]
    reasoning_quality: number
    capman_lexicon_usage: number
    confidence: number
    adaptability_score?: number
  }
  xpEarned: {
    total: number
    base: number
    grade_bonus: number
    streak_bonus?: number
    curveball_bonus?: number
    perfect_bonus?: number
    perfect_score_bonus?: number
  }
  levelInfo?: {
    level: number
    level_name: string
    xp_for_next: number
    xp_progress: number
  }
  curveballResult?: {
    adaptability_score: number
    curveball_type: string
    message: string
  }
  replayReveal?: {
    event_name: string
    narrative: string
    what_happened: any
    date: string
    message: string
  }
}

export function GradeDisplay({
  grade,
  xpEarned,
  levelInfo,
  curveballResult,
  replayReveal,
}: GradeDisplayProps) {
  if (!grade) return null

  const overallScore = safeNum(grade.overall_score)
  const confidence = safeNum(grade.confidence)
  const reasoningQuality = safeNum(grade.reasoning_quality)
  const lexiconUsage = safeNum(grade.capman_lexicon_usage)
  const dimensionScores = grade.dimension_scores || []
  const strengths = grade.strengths || []
  const improvements = grade.areas_for_improvement || []
  const perfectBonus = xpEarned?.perfect_bonus || xpEarned?.perfect_score_bonus || 0

  const scoreColor = overallScore >= 80 ? '#10b981' : overallScore >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-4 animate-grow-in">
      {/* ════════════════════════════════════════
         REPLAY REVEAL — Dramatic reveal banner
         ════════════════════════════════════════ */}
      {replayReveal && (
        <div className="hero-mesh p-7 relative" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(139,92,246,0.1) 0%, transparent 50%), radial-gradient(ellipse at 70% 30%, rgba(168,85,247,0.06) 0%, transparent 50%), linear-gradient(160deg, var(--cm-surface), var(--cm-bg))' }}>
          <div className="neon-line absolute top-0 left-6 right-6" style={{ background: 'linear-gradient(90deg, transparent, #8b5cf6, #a855f7, transparent)', backgroundSize: '200% 100%' }} />
          <div className="absolute inset-0 grid-bg opacity-20 rounded-3xl" />
          <div className="relative text-center mb-4">
            <p className="text-purple-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Historical Replay Reveal</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{replayReveal.event_name}</h2>
            <p className="text-gray-500 text-sm mt-1.5 font-medium">{replayReveal.date}</p>
          </div>
          <p className="relative text-gray-300 text-sm leading-relaxed text-center max-w-xl mx-auto">{replayReveal.message}</p>
          {replayReveal.narrative && (
            <p className="relative text-gray-500 text-sm mt-4 border-t border-purple-500/15 pt-4 text-center max-w-xl mx-auto">
              {replayReveal.narrative}
            </p>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
         SCORE HERO — Gradient mesh with ring
         ════════════════════════════════════════ */}
      <div className="hero-mesh p-7 sm:p-9">
        <div className="neon-line absolute top-0 left-8 right-8" />
        <div className="absolute inset-0 grid-bg opacity-20 rounded-3xl" />

        <div className="relative flex flex-col sm:flex-row items-center gap-8">
          {/* Radial score ring */}
          <div className="flex-shrink-0 relative">
            <div className="absolute inset-0 -m-4 rounded-full" style={{ background: `radial-gradient(circle, ${scoreColor}10 0%, transparent 70%)` }} />
            <ScoreRing score={overallScore} />
          </div>

          {/* Score details */}
          <div className="flex-1 text-center sm:text-left space-y-4">
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight mb-0.5">Session Complete</h3>
              <p className="text-sm text-gray-500">
                Confidence: <span className="text-gray-300 font-bold tabular-nums">{(confidence * 100).toFixed(0)}%</span>
              </p>
            </div>

            {/* XP + Level badges */}
            <div className="flex flex-wrap gap-2.5">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl badge-rank" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-base font-black text-amber-300 tabular-nums">+{safeNum(xpEarned?.total)} XP</span>
              </div>
              {levelInfo && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl badge-rank" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
                  <Crown className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-purple-300">Lv.{levelInfo.level} {levelInfo.level_name}</span>
                </div>
              )}
            </div>

            {/* Level progress bar */}
            {levelInfo && (
              <div className="max-w-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-[11px] text-gray-500 font-medium">Level {levelInfo.level} Progress</span>
                  <span className="text-[11px] text-gray-500 tabular-nums">
                    <span className="text-purple-400 font-bold">{safeNum(levelInfo.xp_progress)}</span> / {safeNum(levelInfo.xp_for_next)}
                  </span>
                </div>
                <div className="xp-bar-track h-2">
                  <div
                    className="xp-bar-fill h-full"
                    style={{
                      width: `${levelInfo.xp_for_next > 0 ? (safeNum(levelInfo.xp_progress) / levelInfo.xp_for_next) * 100 : 100}%`,
                      background: 'linear-gradient(90deg, #8b5cf6, #a78bfa, #c4b5fd)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* XP Breakdown — stat pill row */}
        <div className="relative mt-6 pt-5 border-t border-white/[0.04] grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
          {[
            { label: 'Base', value: safeNum(xpEarned?.base), color: 'text-gray-300' },
            { label: 'Grade', value: safeNum(xpEarned?.grade_bonus), color: 'text-emerald-400' },
            ...(xpEarned?.streak_bonus ? [{ label: 'Streak', value: xpEarned.streak_bonus, color: 'text-orange-400' }] : []),
            ...(xpEarned?.curveball_bonus ? [{ label: 'Curveball', value: xpEarned.curveball_bonus, color: 'text-red-400' }] : []),
            ...(perfectBonus > 0 ? [{ label: 'Perfect!', value: perfectBonus, color: 'text-purple-400' }] : []),
          ].map((item) => (
            <div key={item.label} className="text-center px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mb-0.5">{item.label}</p>
              <p className={`text-sm font-black ${item.color} tabular-nums`}>+{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════
         CURVEBALL RESULT
         ════════════════════════════════════════ */}
      {curveballResult && (
        <div className="card-stat relative" style={{ borderColor: 'rgba(239,68,68,0.15)', background: 'linear-gradient(160deg, rgba(239,68,68,0.04), rgba(5,10,24,0.95))' }}>
          <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="font-black text-white text-sm">Curveball Performance</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{curveballResult.curveball_type}</p>
            </div>
          </div>
          <p className="text-3xl font-black text-white tabular-nums">{safeNum(curveballResult.adaptability_score).toFixed(1)}<span className="text-sm text-gray-500 font-medium"> / 100</span></p>
          <p className="text-xs text-gray-500 mt-1">{curveballResult.message}</p>
          <AlertTriangle className="stat-icon-bg w-24 h-24 text-red-400" />
        </div>
      )}

      {/* ════════════════════════════════════════
         PERFORMANCE RADAR — Animated spider chart
         ════════════════════════════════════════ */}
      {dimensionScores.length > 0 && (
        <div className="card flex flex-col items-center py-6">
          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Performance Radar
          </h4>
          <RadarChart dimensions={dimensionScores} />
        </div>
      )}

      {/* ════════════════════════════════════════
         DIMENSION BREAKDOWN
         ════════════════════════════════════════ */}
      {dimensionScores.length > 0 && (
        <div className="card">
          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            Dimension Breakdown
          </h4>
          <div className="space-y-4">
            {dimensionScores.map((dim, idx) => {
              const dimScore = safeNum(dim.score)
              const barHex = dimScore >= 80 ? '#10b981' : dimScore >= 60 ? '#f59e0b' : '#ef4444'
              const glowHex = dimScore >= 80 ? 'rgba(16,185,129,0.2)' : dimScore >= 60 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'
              const textColor = dimScore >= 80 ? 'text-emerald-400' : dimScore >= 60 ? 'text-amber-400' : 'text-red-400'
              return (
                <div key={idx} className="animate-fade-in" style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-300">{dim.dimension || 'Unknown'}</span>
                    <span className={`text-sm font-black ${textColor} tabular-nums`}>
                      <AnimatedNumber value={dimScore} duration={1500} />.{Math.round((dimScore % 1) * 10)}
                    </span>
                  </div>
                  <AnimatedBar value={dimScore} color={barHex} glowColor={glowHex} />
                  {dim.feedback && (
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{renderInlineMarkdown(dim.feedback)}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
         META SCORES — Stat cards with watermarks
         ════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-stat group text-center">
          <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.1)' }}>
            <Brain className="w-5 h-5 text-cyan-400" />
          </div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Reasoning Quality</p>
          <p className={`text-3xl font-black tabular-nums ${reasoningQuality >= 80 ? 'text-emerald-400' : reasoningQuality >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
            <AnimatedNumber value={reasoningQuality} duration={1500} />
          </p>
          <div className="mt-2">
            <AnimatedBar
              value={reasoningQuality}
              color={reasoningQuality >= 80 ? '#10b981' : reasoningQuality >= 60 ? '#f59e0b' : '#ef4444'}
              glowColor={reasoningQuality >= 80 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}
            />
          </div>
          <Brain className="stat-icon-bg w-24 h-24 text-cyan-400" />
        </div>
        <div className="card-stat group text-center">
          <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}>
            <BookOpen className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">CapMan Lexicon</p>
          <p className={`text-3xl font-black tabular-nums ${lexiconUsage >= 80 ? 'text-emerald-400' : lexiconUsage >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
            <AnimatedNumber value={lexiconUsage} duration={1500} />
          </p>
          <div className="mt-2">
            <AnimatedBar
              value={lexiconUsage}
              color={lexiconUsage >= 80 ? '#10b981' : lexiconUsage >= 60 ? '#f59e0b' : '#ef4444'}
              glowColor={lexiconUsage >= 80 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}
            />
          </div>
          <BookOpen className="stat-icon-bg w-24 h-24 text-purple-400" />
        </div>
      </div>

      {/* ════════════════════════════════════════
         STRENGTHS
         ════════════════════════════════════════ */}
      {strengths.length > 0 && (
        <div className="card relative overflow-hidden" style={{ borderColor: 'rgba(16,185,129,0.1)', background: 'linear-gradient(160deg, rgba(16,185,129,0.03), rgba(5,10,24,0.95))' }}>
          <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <h5 className="font-black text-white text-sm uppercase tracking-wider">Strengths</h5>
          </div>
          <div className="space-y-2.5">
            {strengths.map((s, i) => (
              <div key={i} className="flex gap-2.5 text-sm text-gray-300 animate-fade-in" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
                <span className="text-emerald-400 font-black mt-0.5 flex-shrink-0">+</span>
                <span className="leading-relaxed">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
         AREAS FOR IMPROVEMENT
         ════════════════════════════════════════ */}
      {improvements.length > 0 && (
        <div className="card relative overflow-hidden" style={{ borderColor: 'rgba(245,158,11,0.1)', background: 'linear-gradient(160deg, rgba(245,158,11,0.03), rgba(5,10,24,0.95))' }}>
          <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <h5 className="font-black text-white text-sm uppercase tracking-wider">Improve</h5>
          </div>
          <div className="space-y-2.5">
            {improvements.map((a, i) => (
              <div key={i} className="flex gap-2.5 text-sm text-gray-300 animate-fade-in" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
                <span className="text-amber-400 font-black mt-0.5 flex-shrink-0">-</span>
                <span className="leading-relaxed">{a}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
