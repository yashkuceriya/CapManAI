'use client'

import { Trophy, TrendingUp, User } from 'lucide-react'
import { SkeletonRows } from '@/components/Skeleton'

interface LeaderboardEntry {
  rank: number
  username: string
  user_id: string
  value: number
  change?: number
  tier?: string
  level?: number
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
  mode: 'xp' | 'volume' | 'mastery'
  currentUserId?: string
  isLoading?: boolean
}

export function LeaderboardTable({
  entries,
  mode,
  currentUserId,
  isLoading = false,
}: LeaderboardTableProps) {
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

  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇'
      case 2:
        return '🥈'
      case 3:
        return '🥉'
      default:
        return null
    }
  }

  const formatValue = (value: number) => {
    if (mode === 'xp' || mode === 'volume') {
      return value.toLocaleString()
    }
    return value.toFixed(1)
  }

  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Player</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">{getValueLabel()}</th>
              </tr>
            </thead>
            <tbody>
              <SkeletonRows count={6} />
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-12 text-gray-400">
        <Trophy className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No leaderboard data available</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-800/50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Player
              </th>
              {mode === 'mastery' && (
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Tier
                </th>
              )}
              {mode === 'xp' && (
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Level
                </th>
              )}
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {getValueLabel()}
              </th>
              {mode === 'volume' && (
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Change
                </th>
              )}
            </tr>
          </thead>
          <tbody className="stagger-children">
            {entries.map((entry, idx) => {
              const medal = getMedalIcon(entry.rank)
              const isCurrentUser = currentUserId === entry.user_id
              return (
                <tr
                  key={idx}
                  className={`border-b border-gray-800 transition-colors duration-200 ${
                    isCurrentUser
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                    <div className="flex items-center gap-2">
                      {medal && <span className="text-lg">{medal}</span>}
                      <span
                        className={
                          medal ? 'hidden' : 'text-gray-400 font-semibold'
                        }
                      >
                        #{entry.rank}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-950" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {entry.username}
                        </p>
                        {isCurrentUser && (
                          <span className="text-xs text-emerald-400">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {mode === 'mastery' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="badge badge-primary">
                        Tier {entry.tier}
                      </span>
                    </td>
                  )}
                  {mode === 'xp' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-300">
                        Lvl {entry.level}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <p className="text-sm font-bold text-emerald-400">
                      {formatValue(entry.value)}
                    </p>
                  </td>
                  {mode === 'volume' && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <TrendingUp
                          className={`w-4 h-4 ${
                            entry.change && entry.change >= 0
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        />
                        <span
                          className={`text-sm font-semibold ${
                            entry.change && entry.change >= 0
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {entry.change && entry.change >= 0 ? '+' : ''}
                          {entry.change?.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
