'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { users } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { TrophySparkle, LightningBolt, GemStone } from '@/components/AnimatedIcons'
import {
  Trophy,
  Zap,
  TrendingUp,
  Crown,
  Medal,
  Users,
  ChevronUp,
  Star,
  RefreshCw,
} from 'lucide-react'

interface LeaderboardEntry {
  rank: number
  username: string
  user_id: string
  value: number
  change?: number
  tier?: string
  level?: number
  prevRank?: number
}

type LeaderboardMode = 'xp' | 'volume' | 'mastery'

export default function LeaderboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<LeaderboardMode>('xp')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0)
  const [changedEntries, setChangedEntries] = useState<Set<string>>(new Set())
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const entriesRef = useRef<LeaderboardEntry[]>([])

  // Keep ref in sync so polling callback can read current entries without re-triggering effect
  useEffect(() => { entriesRef.current = entries }, [entries])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    const fetchLeaderboard = async (isInitial = false) => {
      if (isInitial) setLoading(true)
      setError('')
      try {
        const data = await users.getLeaderboard(mode)
        const prev = entriesRef.current
        const newEntries = (data.entries || []).map((entry: any) => {
          const oldEntry = prev.find((e) => e.user_id === entry.user_id)
          return {
            ...entry,
            prevRank: oldEntry?.rank,
          }
        })

        // Track which entries changed
        const changed = new Set<string>()
        newEntries.forEach((newEntry: LeaderboardEntry) => {
          const oldEntry = prev.find((e) => e.user_id === newEntry.user_id)
          if (oldEntry && (oldEntry.rank !== newEntry.rank || oldEntry.value !== newEntry.value)) {
            changed.add(newEntry.user_id)
          }
        })

        setEntries(newEntries)
        setChangedEntries(changed)
        setLastUpdated(new Date())
        setSecondsSinceUpdate(0)

        // Clear highlight after 2 seconds
        setTimeout(() => setChangedEntries(new Set()), 2000)
      } catch (err) {
        setError('Failed to load leaderboard.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchLeaderboard(true)

    // Set up polling interval (30 seconds)
    pollingIntervalRef.current = setInterval(() => {
      fetchLeaderboard(false)
    }, 30000)

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isAuthenticated, router])

  // Update "seconds since last update" display
  useEffect(() => {
    updateTimerRef.current = setInterval(() => {
      setSecondsSinceUpdate((prev) => prev + 1)
    }, 1000)

    return () => {
      if (updateTimerRef.current) clearInterval(updateTimerRef.current)
    }
  }, [])

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loader" />
      </div>
    )
  }

  const tabs = [
    { id: 'xp' as LeaderboardMode, label: 'XP', icon: LightningBolt, isAnimated: true },
    { id: 'volume' as LeaderboardMode, label: 'Volume', icon: TrendingUp },
    { id: 'mastery' as LeaderboardMode, label: 'Mastery', icon: TrophySparkle, isAnimated: true },
  ]

  // Get current user's rank and percentile
  const userEntry = entries.find((e) => e.user_id === user?.id)
  const userRank = userEntry?.rank || 0
  const percentile = entries.length > 0 && userRank > 0
    ? Math.round(((entries.length - userRank) / entries.length) * 100)
    : 0

  // Get top 3 and rest
  const topThree = entries.filter((e) => e.rank <= 3).sort((a, b) => a.rank - b.rank)
  const restEntries = entries.filter((e) => e.rank > 3)

  const getValueLabel = () => {
    switch (mode) {
      case 'xp':
        return 'XP'
      case 'volume':
        return 'Volume'
      case 'mastery':
        return 'Mastery Score'
      default:
        return 'Score'
    }
  }

  const formatValue = (value: number) => {
    if (mode === 'xp' || mode === 'volume') {
      return value.toLocaleString()
    }
    return value.toFixed(1)
  }

  const getAvatarInitial = (username: string) => {
    return username.charAt(0).toUpperCase()
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'from-amber-400 to-yellow-500'
    if (rank === 2) return 'from-gray-300 to-gray-400'
    if (rank === 3) return 'from-orange-400 to-amber-600'
    return 'from-emerald-500 to-emerald-600'
  }

  const getRankBorderColor = (rank: number) => {
    if (rank === 1) return 'border-amber-400'
    if (rank === 2) return 'border-gray-400'
    if (rank === 3) return 'border-orange-400'
    return 'border-emerald-500'
  }

  const getPodiumHeight = (rank: number) => {
    if (rank === 1) return 'h-48'
    if (rank === 2) return 'h-40'
    if (rank === 3) return 'h-32'
    return 'h-32'
  }

  const getPodiumPosition = (rank: number) => {
    if (rank === 1) return 'order-2'
    if (rank === 2) return 'order-1'
    if (rank === 3) return 'order-3'
    return ''
  }

  const getProgressPercentage = (index: number) => {
    const maxValue = entries.length > 0 ? entries[0].value : 1
    const entryValue = entries[index]?.value || 0
    return Math.min((entryValue / maxValue) * 100, 100)
  }

  const getRankGlow = (rank: number) => {
    if (rank <= 10) return `shadow-lg shadow-emerald-500/30`
    return ''
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header with game-inspired title */}
      <div className="mb-10 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <TrophySparkle size={40} color="#fbbf24" />
              <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-lg animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-white">Leaderboards</h1>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  <span className="text-xs font-bold text-emerald-400 uppercase">LIVE</span>
                </div>
              </div>
              <p className="text-gray-400">
                Compete with traders and climb the rankings
              </p>
            </div>
          </div>
          {lastUpdated && (
            <div className="text-right text-xs text-gray-500">
              <p>Last updated</p>
              <p className="font-mono font-semibold text-gray-400">
                {secondsSinceUpdate}s ago
              </p>
            </div>
          )}
        </div>

        {/* Stats Banner */}
        {user && entries.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* Your Rank */}
            <div className="card-stat group cursor-default">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                    <ChevronUp className="w-5 h-5 text-emerald-950" />
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase">Your Rank</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {userRank > 0 ? `#${userRank}` : 'Not Ranked'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {entries.length - userRank + 1} spots above you
              </p>
              <Star className="stat-icon-bg w-24 h-24 text-emerald-400" />
            </div>

            {/* Total Players */}
            <div className="card-stat group cursor-default">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
                    <Users className="w-5 h-5 text-cyan-950" />
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase">Players</span>
              </div>
              <p className="text-2xl font-bold text-white">{entries.length}</p>
              <p className="text-xs text-gray-500 mt-1">
                {mode === 'xp' ? 'Training' : mode === 'volume' ? 'Trading' : 'Mastery'} Active
              </p>
              <Users className="stat-icon-bg w-24 h-24 text-cyan-400" />
            </div>

            {/* Your Percentile */}
            <div className="card-stat group cursor-default">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                    <TrophySparkle size={20} color="#581c87" />
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase">Percentile</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {percentile > 0 ? `Top ${percentile}%` : 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {percentile >= 90 ? '🔥 Elite' : percentile >= 70 ? '⭐ Great' : 'Keep grinding'}
              </p>
              <TrophySparkle className="stat-icon-bg w-24 h-24 text-purple-400" size={96} />
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 card border-l-4 border-red-500 bg-red-500/5 animate-fade-in">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Game-style Tab Switcher */}
      <div className="mb-10 animate-fade-in-up">
        <div className="flex gap-3 p-1 bg-gray-800/30 rounded-xl w-fit border border-gray-700/50">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = mode === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 flex items-center gap-2 relative group ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/40'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {(tab as any).isAnimated ? (
                  <Icon size={16} color={isActive ? 'white' : 'currentColor'} />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {tab.label}
                {isActive && (
                  <>
                    <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-300 rounded-full" />
                    <div className="neon-line absolute -bottom-2 left-0 right-0" />
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="loader" />
            <p className="text-gray-400">Loading leaderboard...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && entries.length === 0 && (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400 state-enter">
          <div className="w-20 h-20 rounded-full bg-gray-800/60 flex items-center justify-center mb-5">
            <Trophy className="w-10 h-10 opacity-40" />
          </div>
          <p className="text-lg font-semibold text-white mb-1">No Rankings Yet</p>
          <p className="text-sm mb-5">Complete training sessions to appear on the leaderboard</p>
          <a href="/train" className="btn-primary text-sm">Start Training</a>
        </div>
      )}

      {/* Trophy Podium - Top 3 Players */}
      {!loading && topThree.length > 0 && (
        <div className="mb-12 animate-fade-in-up">
          <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-400" />
            Top Performers
          </h2>

          <div className="flex items-flex-end justify-center gap-6 h-80">
            {[2, 1, 3].map((rank) => {
              const entry = topThree.find((e) => e.rank === rank)
              if (!entry) return null

              const podiumHeight = getPodiumHeight(rank)
              const borderColor = getRankBorderColor(rank)
              const gradientColor = getRankColor(rank)

              return (
                <div
                  key={rank}
                  className={`${getPodiumPosition(
                    rank
                  )} flex flex-col items-center transform transition-all duration-500 hover:scale-105`}
                >
                  {/* Player Card */}
                  <div
                    className={`mb-4 animate-scale-in`}
                    style={{ animationDelay: `${rank * 100}ms` }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      {/* Crown or Medal */}
                      <div className="relative">
                        {rank === 1 && (
                          <Crown className="w-8 h-8 text-amber-400 animate-bounce" />
                        )}
                        {rank === 2 && (
                          <Medal className="w-8 h-8 text-gray-300" />
                        )}
                        {rank === 3 && (
                          <Medal className="w-8 h-8 text-orange-400" />
                        )}
                      </div>

                      {/* Avatar Initial */}
                      <div
                        className={`w-20 h-20 rounded-full bg-gradient-to-br ${gradientColor} flex items-center justify-center border-4 ${borderColor} shadow-lg ${getRankGlow(
                          rank
                        )} transform transition-all`}
                      >
                        <span className="text-2xl font-bold text-gray-950">
                          {getAvatarInitial(entry.username)}
                        </span>
                      </div>

                      {/* Player Name */}
                      <div className="text-center">
                        <p className="font-bold text-white text-sm max-w-32 truncate">
                          {entry.username}
                        </p>
                        <p
                          className={`text-xs font-semibold ${
                            rank === 1
                              ? 'text-amber-400'
                              : rank === 2
                              ? 'text-gray-300'
                              : 'text-orange-400'
                          }`}
                        >
                          #{rank}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Podium Block */}
                  <div
                    className={`${podiumHeight} w-32 bg-gradient-to-b ${gradientColor} rounded-t-lg border-4 ${borderColor} border-b-0 flex flex-col items-center justify-end pb-4 relative overflow-hidden transform origin-bottom transition-all duration-500 animate-scale-in podium-shine`}
                    style={{
                      animationDelay: `${rank * 100 + 100}ms`,
                      boxShadow: `inset 0 2px 8px rgba(0,0,0,0.3), 0 8px 24px ${
                        rank === 1
                          ? 'rgba(251,146,60,0.3)'
                          : rank === 2
                          ? 'rgba(200,200,200,0.2)'
                          : 'rgba(251,146,60,0.2)'
                      }`,
                    }}
                  >
                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-30 rounded-t-lg" />

                    {/* Value inside podium */}
                    <div className="relative z-10 text-center">
                      <p className="text-sm font-bold text-gray-950 mb-1">
                        {formatValue(entry.value)}
                      </p>
                      <p className="text-xs text-gray-900 font-semibold">
                        {getValueLabel()}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Rest of Leaderboard - Rank 4+ */}
      {!loading && restEntries.length > 0 && (
        <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            Rising Players
          </h2>

          <div className="space-y-2 stagger-children">
            {restEntries.map((entry, idx) => {
              const isCurrentUser = user?.id === entry.user_id
              const progress = getProgressPercentage(entries.indexOf(entry))
              const isTop10 = entry.rank <= 10

              return (
                <div
                  key={idx}
                  className={`card-glow group transition-all duration-300 ${
                    isCurrentUser ? 'ring-2 ring-emerald-500/50 animate-border-glow leaderboard-you' : ''
                  } ${changedEntries.has(entry.user_id) ? 'rank-changed' : ''}`}
                  style={{
                    animation: `fade-in-up 0.5s ease-out both`,
                    animationDelay: `${idx * 50}ms`,
                  }}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank Badge */}
                    <div className="relative min-w-max">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white relative ${
                          isTop10
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30'
                            : 'bg-gray-700'
                        } ${getRankGlow(entry.rank)}`}
                      >
                        <span className="badge-rank text-lg">#{entry.rank}</span>
                      </div>
                    </div>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-emerald-950">
                            {getAvatarInitial(entry.username)}
                          </span>
                        </div>

                        {/* Name and Status */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white truncate">
                              {entry.username}
                            </p>
                            {isCurrentUser && (
                              <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 whitespace-nowrap">
                                You
                              </span>
                            )}
                            {isTop10 && (
                              <Star className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            )}
                          </div>
                          {mode === 'xp' && entry.level && (
                            <p className="text-xs text-gray-400">Level {entry.level}</p>
                          )}
                          {mode === 'mastery' && entry.tier && (
                            <p className="text-xs text-purple-400">Tier {entry.tier}</p>
                          )}
                        </div>
                      </div>

                      {/* XP Progress Bar */}
                      <div className="xp-bar-track h-1.5 mb-1">
                        <div
                          className="xp-bar-fill h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Rank Change Indicator */}
                    {entry.prevRank !== undefined && entry.prevRank !== entry.rank && (
                      <div className="flex-shrink-0 pl-2">
                        <div
                          className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            entry.rank < entry.prevRank
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {entry.rank < entry.prevRank ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4 rotate-180" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Value */}
                    <div
                      className={`text-right flex-shrink-0 transition-all duration-300 ${
                        changedEntries.has(entry.user_id) ? 'animate-pulse' : ''
                      }`}
                      style={
                        changedEntries.has(entry.user_id)
                          ? {
                              backgroundColor: 'rgba(16,185,129,0.1)',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '0.5rem',
                              border: '1px solid rgba(16,185,129,0.2)',
                            }
                          : {}
                      }
                    >
                      <p className="text-lg font-bold text-emerald-400">
                        {formatValue(entry.value)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{getValueLabel()}</p>
                    </div>

                    {/* Change (Volume only) */}
                    {mode === 'volume' && entry.change !== undefined && (
                      <div className="text-right flex-shrink-0 pl-4">
                        <div
                          className={`flex items-center gap-1 font-semibold text-sm ${
                            entry.change >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {entry.change >= 0 ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4 rotate-180" />
                          )}
                          {Math.abs(entry.change).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="mt-12 card bg-gray-800/50 border-gray-700 animate-fade-in-up">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <TrophySparkle size={20} color="#fbbf24" />
          How Leaderboards Work
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
          <div className="space-y-2">
            <p className="font-semibold text-emerald-400">XP Leaderboard</p>
            <p>
              Earn XP for completing training sessions and achieving high scores.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-amber-400">Volume Leaderboard</p>
            <p>
              Track your trading volume and market participation.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-purple-400">Mastery Leaderboard</p>
            <p>
              Climb tiers (1-3) based on objective proficiency and deep learning.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
