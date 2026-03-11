'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Zap,
  TrendingUp,
  Flame,
  Crown,
  BookOpen,
  BarChart3,
  Users,
  Target,
  ClipboardCheck,
  ChevronRight,
  Activity,
  Award,
  ArrowUpRight,
  Trophy,
  Sparkles,
} from 'lucide-react'
import { users } from '@/lib/api'
import { FlashCards } from '@/components/FlashCards'
import { TickerTape } from '@/components/TickerTape'

/* ─── Animated counter (rAF + ease-out) ─── */
function useCountUp(target: number, dur = 1200) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) return
    let start: number | null = null
    let raf: number
    const ease = (t: number) => 1 - Math.pow(1 - t, 3) // ease-out cubic
    const tick = (ts: number) => {
      if (start === null) start = ts
      const progress = Math.min((ts - start) / dur, 1)
      setVal(Math.round(ease(progress) * target))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, dur])
  return val
}

/* ─── Tiny sparkline SVG ─── */
function Sparkline({ data, color = '#10b981', width = 80, height = 28 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data) || 1
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  const areaPoints = `0,${height} ${points} ${width},${height}`

  return (
    <svg width={width} height={height} className="sparkline">
      <polyline points={areaPoints} className="sparkline-area" fill={color} />
      <polyline points={points} className="sparkline-line" stroke={color} />
    </svg>
  )
}

/* ─── Rank helpers ─── */
function getRankGradient(level: number) {
  if (level >= 7) return 'from-amber-400 to-yellow-500'
  if (level >= 5) return 'from-purple-400 to-violet-500'
  if (level >= 3) return 'from-cyan-400 to-blue-500'
  return 'from-emerald-400 to-green-500'
}

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.push('/login'); return }
    if (isAuthenticated && !authLoading) {
      users.getProfile().then(setProfile).catch(console.error).finally(() => setLoading(false))
    }
  }, [isAuthenticated, authLoading, router])

  const [dailyGoal, setDailyGoal] = useState<any>(null)
  const [activity, setActivity] = useState<{ xp: number[]; sessions: number[] }>({ xp: [], sessions: [] })

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      users.getDailyGoal().then(setDailyGoal).catch(() => {})
      users.getActivity(14).then((data: any) => {
        const timeline = data?.timeline || []
        setActivity({
          xp: timeline.map((d: any) => d.xp ?? 0),
          sessions: timeline.map((d: any) => d.sessions ?? 0),
        })
      }).catch(() => {})
    }
  }, [isAuthenticated, authLoading])

  const xpCount = useCountUp(profile?.xp || 0)
  const sessionsCount = useCountUp(profile?.scenarios_completed || 0, 800)

  const xpSparkline = activity.xp
  const sessionsSparkline = activity.sessions

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center animate-glow-pulse">
            <Zap className="w-7 h-7 text-gray-950" />
          </div>
          <div className="typing-indicator flex items-center gap-1"><span /><span /><span /></div>
        </div>
      </div>
    )
  }

  const li = profile?.level_info || {}
  const isEducator = profile?.role === 'educator' || profile?.role === 'admin'
  const levelPct = li.xp_for_next > 0 ? (li.xp_progress / li.xp_for_next) * 100 : 100
  const tierNum = profile?.current_tier?.replace('tier', '') || '1'
  const tierLabel = tierNum === '1' ? 'On Track' : tierNum === '2' ? 'Targeted' : 'Intensive'

  const features = [
    { href: '/train', icon: BookOpen, label: 'Train', desc: 'AI market scenarios', accent: '#10b981' },
    { href: '/replay', icon: BarChart3, label: 'Replay', desc: 'Historical events', accent: '#f59e0b' },
    { href: '/leaderboard', icon: Users, label: 'Rankings', desc: 'Global leaderboard', accent: '#8b5cf6' },
    { href: '/h2h', icon: Target, label: 'H2H Arena', desc: 'Head-to-head duels', accent: '#06b6d4' },
    { href: '/peer-review', icon: ClipboardCheck, label: 'Peer Review', desc: 'Review analyses', accent: '#ec4899' },
  ]

  return (
    <div className="relative">
      {/* Ambient orbs */}
      <div className="orb-emerald -top-60 -right-60 opacity-40" />
      <div className="orb-purple top-[500px] -left-60 opacity-30" />

      <div className="relative space-y-6 animate-fade-in">

        {/* ════════════════════════════════════════
           LIVE TICKER TAPE
           ════════════════════════════════════════ */}
        <TickerTape />

        {/* ════════════════════════════════════════
           HERO — Gradient mesh card
           ════════════════════════════════════════ */}
        <div className="hero-mesh p-7 sm:p-9">
          {/* Animated neon top edge */}
          <div className="neon-line absolute top-0 left-8 right-8" />
          <div className="absolute inset-0 grid-bg opacity-30 rounded-3xl" />

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 min-w-0">
              {/* Tier + Level row */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${getRankGradient(li.level || 1)} flex items-center justify-center shadow-lg`}>
                  <span className="text-sm font-black text-white">{li.level || 1}</span>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight text-gradient-animated">
                    {profile?.username || 'Trader'}
                  </h1>
                  <p className="text-sm text-gray-400">
                    <span className="text-gradient-gold font-bold">{li.level_name || 'Apprentice'}</span>
                    <span className="mx-2 text-gray-700">|</span>
                    <span className={`tier-badge-${tierNum} text-xs px-2 py-0.5 rounded-md font-bold badge-rank`}>
                      T{tierNum} {tierLabel}
                    </span>
                  </p>
                </div>
              </div>

              {/* XP Progress bar */}
              {li.xp_for_next > 0 && (
                <div className="max-w-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] text-gray-500 font-medium">Next level</span>
                    <span className="text-[11px] text-gray-500 tabular-nums">
                      <span className="text-emerald-400 font-bold">{li.xp_progress || 0}</span> / {li.xp_for_next}
                    </span>
                  </div>
                  <div className={`xp-bar-track h-2.5 ${levelPct >= 80 ? 'xp-bar-almost' : ''}`}>
                    <div
                      className="xp-bar-fill h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 animate-progress-fill"
                      style={{ width: `${levelPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <Link href="/train" className="flex-shrink-0">
              <button className="btn-primary btn-cta-pulse text-base px-7 py-3.5 flex items-center gap-2.5 group">
                <Sparkles className="w-5 h-5" />
                <span>Start Training</span>
                <ChevronRight className="w-4 h-4 opacity-60 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
              </button>
            </Link>
          </div>
        </div>

        {/* ════════════════════════════════════════
           STATS — Asymmetric grid with sparklines
           ════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
          {/* XP — bigger, featured */}
          <div className="card-stat group col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <Sparkline data={xpSparkline} color="#f59e0b" />
            </div>
            <p className="text-3xl font-black text-white tabular-nums tracking-tight stat-live">{xpCount.toLocaleString()}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5 uppercase tracking-wider">Total XP</p>
            <Zap className="stat-icon-bg text-amber-400" />
          </div>

          {/* Level */}
          <div className="card-stat group col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)' }}>
                <Crown className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider bg-purple-500/10 px-2 py-0.5 rounded-md">
                {li.level_name || 'Apprentice'}
              </span>
            </div>
            <p className="text-3xl font-black text-white stat-live">{li.level || 1}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5 uppercase tracking-wider">Level</p>
            <Crown className="stat-icon-bg text-purple-400" />
          </div>

          {/* Streak */}
          <div className="card-stat group col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.1)' }}>
                <Flame className="w-5 h-5 text-orange-400 animate-streak-fire" />
              </div>
              {(profile?.streak_days || 0) >= 3 && (
                <span className="text-[10px] font-black text-gradient-fire uppercase tracking-widest animate-neon-flicker">ON FIRE</span>
              )}
            </div>
            <p className="text-3xl font-black text-white stat-live">{profile?.streak_days || 0}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5 uppercase tracking-wider">Day Streak</p>
            <Flame className="stat-icon-bg text-orange-400" />
          </div>

          {/* Sessions */}
          <div className="card-stat group col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <Activity className="w-5 h-5 text-emerald-400" />
              </div>
              <Sparkline data={sessionsSparkline} color="#10b981" />
            </div>
            <p className="text-3xl font-black text-white tabular-nums stat-live">{sessionsCount}</p>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5 uppercase tracking-wider flex items-center gap-2">Sessions <span className="pulse-dot" /></p>
            <Activity className="stat-icon-bg text-emerald-400" />
          </div>
        </div>

        {/* ════════════════════════════════════════
           DAILY GOAL
           ════════════════════════════════════════ */}
        {dailyGoal && (
          <div className={`card flex items-center justify-between gap-4 ${dailyGoal.goal_met ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dailyGoal.goal_met ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                <Target className={`w-5 h-5 ${dailyGoal.goal_met ? 'text-emerald-400' : 'text-amber-400'}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {dailyGoal.goal_met ? 'Daily goal reached!' : `Complete ${dailyGoal.daily_target - dailyGoal.completed_today} more to keep your streak`}
                </p>
                <p className="text-[11px] text-gray-500">
                  {dailyGoal.completed_today}/{dailyGoal.daily_target} today
                  {dailyGoal.recommended_objectives?.length > 0 && (
                    <> &middot; Focus: <span className="text-gray-400">{dailyGoal.recommended_objectives.slice(0, 2).map((o: string) => o.replace(/_/g, ' ')).join(', ')}</span></>
                  )}
                </p>
              </div>
            </div>
            {!dailyGoal.goal_met && (
              <Link href="/train">
                <button className="btn-primary text-xs px-4 py-2 whitespace-nowrap">Train Now</button>
              </Link>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
           QUICK ACTIONS — Colored accent cards
           ════════════════════════════════════════ */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 stagger-children">
            {features.map((f) => (
              <Link key={f.href} href={f.href}>
                <div className="card-stat group cursor-pointer h-full">
                  {/* Color accent top line */}
                  <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-300" style={{ background: f.accent }} />
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110" style={{ background: `${f.accent}15` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.accent }} />
                  </div>
                  <h3 className="font-bold text-white text-sm mb-0.5">{f.label}</h3>
                  <p className="text-[11px] text-gray-500">{f.desc}</p>
                  <ChevronRight className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-gray-700 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ color: f.accent }} />
                </div>
              </Link>
            ))}
          </div>

          {isEducator && (
            <Link href="/mtss" className="inline-block mt-3">
              <div className="card-stat group cursor-pointer inline-flex items-center gap-3 pr-8">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <TrendingUp className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">MTSS Dashboard</h3>
                  <p className="text-[11px] text-gray-500">Monitor students</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          )}
        </div>

        {/* ════════════════════════════════════════
           FLASH CARDS
           ════════════════════════════════════════ */}
        <FlashCards />

        {/* ════════════════════════════════════════
           SKILL MASTERY
           ════════════════════════════════════════ */}
        {profile?.objective_progress && profile.objective_progress.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-emerald-400" />
                Skill Mastery
              </h3>
              <span className="text-[11px] text-gray-600">{profile.objective_progress.length} tracked</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {profile.objective_progress.slice(0, 6).map((p: any) => {
                const pct = Math.min(p.mastery_score || 0, 100)
                const barColor = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'
                const textColor = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400'
                return (
                  <div key={p.objective_id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400 capitalize font-medium">{p.objective_id.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] ${p.trend === 'improving' ? 'text-emerald-500' : p.trend === 'declining' ? 'text-red-500' : 'text-gray-600'}`}>
                          {p.trend === 'improving' ? '↑' : p.trend === 'declining' ? '↓' : ''}
                        </span>
                        <span className={`text-xs font-bold ${textColor} tabular-nums`}>{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div
                        className="h-full rounded-full animate-progress-fill"
                        style={{ width: `${pct}%`, background: barColor }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ─── Unlocks ─── */}
        {profile?.unlocks && Object.values(profile.unlocks).some(Boolean) && (
          <div className="card" style={{ borderColor: 'rgba(251,191,36,0.12)', background: 'linear-gradient(145deg, rgba(251,191,36,0.03), rgba(12,20,38,0.9))' }}>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <p className="text-xs font-bold text-yellow-300 uppercase tracking-wider">Mastery Unlocks</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(profile.unlocks)
                .filter(([_, unlocked]) => unlocked)
                .map(([key]) => (
                  <span key={key} className="px-3 py-1 rounded-lg text-[11px] font-bold capitalize" style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.12)' }}>
                    {key.replace(/_/g, ' ')}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
