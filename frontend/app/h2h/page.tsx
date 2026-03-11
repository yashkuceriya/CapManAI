'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { h2h } from '@/lib/api'
import {
  Users,
  Clock,
  ChevronRight,
  RefreshCw,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { PulsingSword, TargetLock, TrophySparkle, LightningBolt, RadarPulse, ShieldCheck } from '@/components/AnimatedIcons'
import { ThemedLoader } from '@/components/ThemedLoader'
import { stripWatermarks } from '@/lib/sanitize'

type H2HState =
  | 'lobby'
  | 'creating'
  | 'waiting'
  | 'scenario_ready'
  | 'responding'
  | 'waiting_opponent'
  | 'grading'
  | 'results'

interface MatchData {
  match_id: string
  scenario: {
    id: string
    session_id: string
    market_regime: string
    asset_class: string
    difficulty: string
    context_prompt: string
    market_data: any
    learning_objectives: string[]
    is_replay: boolean
    created_at: string
  }
  status: string
  time_limit_seconds: number
}

interface MatchStatus {
  match_id: string
  status: string
  player_1: {
    user_id: string
    username: string
    score: number
    xp_earned: number
  }
  player_2: {
    user_id: string
    username: string
    score: number
    xp_earned: number
  } | null
  winner_id: string | null
  scenario: any
  created_at: string
  completed_at: string | null
}

interface GradeResult {
  match_id: string
  player_1: {
    username: string
    score: number
    xp_earned: number
    is_winner: boolean
  }
  player_2: {
    username: string
    score: number
    xp_earned: number
    is_winner: boolean
  }
  winner: {
    user_id: string
    username: string
    xp_earned: number
  }
  status: string
}

export default function H2HPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()
  const router = useRouter()

  const [state, setState] = useState<H2HState>('lobby')
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate')
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [openMatches, setOpenMatches] = useState<any[]>([])
  const [responseText, setResponseText] = useState('')
  const [timeLeft, setTimeLeft] = useState(300)
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null)
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const matchIdRef = useRef<string | null>(null)
  const [displayedScore1, setDisplayedScore1] = useState(0)
  const [displayedScore2, setDisplayedScore2] = useState(0)
  const [displayedXP1, setDisplayedXP1] = useState(0)
  const [displayedXP2, setDisplayedXP2] = useState(0)
  const [hasShown, setHasShown] = useState(false)

  // Auth check — wait for auth loading before redirecting
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Cleanup polls on unmount or state change
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [])

  // Fetch open matches in lobby
  useEffect(() => {
    if (state === 'lobby') {
      const fetchMatches = async () => {
        try {
          const data = await h2h.listOpenMatches()
          setOpenMatches(data.matches || [])
        } catch (err: any) {
          console.error('Failed to fetch open matches', err)
        }
      }

      fetchMatches()
      const interval = setInterval(fetchMatches, 5000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [state])

  // Poll match status when waiting
  useEffect(() => {
    if ((state === 'waiting' || state === 'waiting_opponent') && matchIdRef.current) {
      const pollStatus = async () => {
        try {
          const status = await h2h.getMatchStatus(matchIdRef.current!)
          setMatchStatus(status)

          if (state === 'waiting' && status.status === 'in_progress' && status.player_2) {
            setState('scenario_ready')
          } else if (state === 'waiting_opponent' && status.status === 'completed') {
            // Both players have responded, time to grade
            await doGrade(matchIdRef.current!)
          }
        } catch (err: any) {
          console.error('Failed to poll match status', err)
        }
      }

      pollStatus()
      pollIntervalRef.current = setInterval(pollStatus, 3000)
      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      }
    }
    return undefined
  }, [state])

  // Timer for responding state
  useEffect(() => {
    if (state === 'responding' && timeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      }
    }
    return undefined
  }, [state, timeLeft])

  const handleCreateChallenge = async () => {
    setError('')
    setState('creating')
    try {
      const data = await h2h.create(difficulty)
      setMatchData(data)
      setMatchId(data.match_id)
      matchIdRef.current = data.match_id
      setState('waiting')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create challenge.')
      setState('lobby')
    }
  }

  const handleJoinMatch = async (joinMatchId: string) => {
    setError('')
    setState('creating')
    try {
      const data = await h2h.join(joinMatchId)
      setMatchData(data)
      setMatchId(joinMatchId)
      matchIdRef.current = joinMatchId
      setState('scenario_ready')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to join match.')
      setState('lobby')
    }
  }

  const handleBeginAnalysis = () => {
    setState('responding')
    setTimeLeft(300)
  }

  const handleSubmitResponse = async () => {
    if (!matchIdRef.current || !responseText.trim()) return

    setError('')
    setIsLoading(true)
    try {
      await h2h.submitResponse(matchIdRef.current, responseText)
      setState('waiting_opponent')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to submit response.')
      setIsLoading(false)
    }
  }

  const doGrade = async (mId: string) => {
    setState('grading')
    try {
      const result = await h2h.grade(mId)
      setGradeResult(result)
      setState('results')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to grade match.')
      setState('waiting_opponent')
    }
  }

  const handleBackToLobby = () => {
    setState('lobby')
    setMatchData(null)
    setMatchId(null)
    matchIdRef.current = null
    setResponseText('')
    setTimeLeft(300)
    setMatchStatus(null)
    setGradeResult(null)
    setError('')
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Score animation effect
  useEffect(() => {
    if (state === 'results' && gradeResult && !hasShown) {
      setHasShown(true)
      setDisplayedScore1(0)
      setDisplayedScore2(0)
      setDisplayedXP1(0)
      setDisplayedXP2(0)

      // Animate scores
      const scoreInterval = setInterval(() => {
        setDisplayedScore1((prev) => {
          const target = gradeResult.player_1.score
          const increment = target / 30
          return prev + increment >= target ? target : prev + increment
        })
        setDisplayedScore2((prev) => {
          const target = gradeResult.player_2.score
          const increment = target / 30
          return prev + increment >= target ? target : prev + increment
        })
      }, 50)

      setTimeout(() => {
        clearInterval(scoreInterval)
        setDisplayedScore1(gradeResult.player_1.score)
        setDisplayedScore2(gradeResult.player_2.score)

        // Then animate XP
        const xpInterval = setInterval(() => {
          setDisplayedXP1((prev) => {
            const target = gradeResult.player_1.xp_earned
            const increment = Math.max(1, Math.floor(target / 20))
            return prev + increment >= target ? target : prev + increment
          })
          setDisplayedXP2((prev) => {
            const target = gradeResult.player_2.xp_earned
            const increment = Math.max(1, Math.floor(target / 20))
            return prev + increment >= target ? target : prev + increment
          })
        }, 80)

        setTimeout(() => {
          clearInterval(xpInterval)
          setDisplayedXP1(gradeResult.player_1.xp_earned)
          setDisplayedXP2(gradeResult.player_2.xp_earned)
        }, 1600)
      }, 1500)
    }
  }, [state, gradeResult, hasShown])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="hero-mesh rounded-2xl p-8 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <PulsingSword className="w-10 h-10" />
            <div>
              <h1 className="text-4xl font-black text-white flex items-center gap-2">
                <PulsingSword className="w-8 h-8" />
                H2H Arena
              </h1>
              <p className="text-gray-300 text-sm mt-1">
                {state === 'lobby' && 'Challenge another trader in real-time competition'}
                {state === 'creating' && 'Creating challenge...'}
                {state === 'waiting' && 'Waiting for an opponent to join'}
                {state === 'scenario_ready' && 'Opponent found — ready to analyze'}
                {state === 'responding' && 'Analyze and submit your response'}
                {state === 'waiting_opponent' && 'Response submitted — waiting for opponent'}
                {state === 'grading' && 'AI is grading both responses'}
                {state === 'results' && 'Match complete — review results'}
              </p>
            </div>
          </div>
          {(state === 'waiting' || state === 'scenario_ready' || state === 'responding' || state === 'waiting_opponent') && (
            <button onClick={handleBackToLobby} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Cancel
            </button>
          )}
          {state === 'results' && (
            <button onClick={handleBackToLobby} className="btn-primary flex items-center gap-2">
              Back to Lobby
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 card border-l-4 border-red-500 bg-red-500/5">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* LOBBY */}
      {state === 'lobby' && (
        <div className="space-y-6 animate-fade-in">
          {/* Difficulty Selector */}
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">Select Difficulty</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {(['beginner', 'intermediate', 'advanced'] as const).map((level) => {
                const icons = {
                  beginner: <ShieldCheck className="w-6 h-6" />,
                  intermediate: <RadarPulse className="w-6 h-6" />,
                  advanced: <PulsingSword className="w-6 h-6" />,
                }
                return (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={`card-stat cursor-pointer text-left transition-all duration-300 ${
                      difficulty === level
                        ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                        : ''
                    }`}
                    style={{
                      transform: difficulty === level ? 'translateY(-2px)' : undefined,
                    }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="text-cyan-400">{icons[level as keyof typeof icons]}</div>
                      <h3 className="font-semibold text-white capitalize">{level}</h3>
                    </div>
                    <p className="text-xs text-gray-400">
                      {level === 'beginner' && 'Simple scenarios, foundational concepts'}
                      {level === 'intermediate' && 'Multi-leg strategies, risk analysis'}
                      {level === 'advanced' && 'Complex structures, regime detection'}
                    </p>
                  </button>
                )
              })}
            </div>
            <button
              onClick={handleCreateChallenge}
              className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-3"
            >
              <TargetLock className="w-5 h-5" />
              Create Challenge
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Open Matches */}
          <div className="card">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-6 h-6 text-emerald-400" />
              <h2 className="text-2xl font-bold text-white">Open Matches</h2>
            </div>

            {openMatches.length === 0 ? (
              <div className="text-center py-12 text-gray-400 state-enter">
                <div className="w-16 h-16 rounded-full bg-gray-800/60 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 opacity-40" />
                </div>
                <p className="text-lg font-semibold text-white mb-1">No Open Challenges</p>
                <p className="text-sm mb-5">Be the first to throw down the gauntlet</p>
                <button onClick={handleCreateChallenge} className="btn-primary text-sm px-6 py-2">Create a Challenge</button>
              </div>
            ) : (
              <div className="space-y-3 stagger-children">
                {openMatches.map((match: any, idx: number) => (
                  <div
                    key={match.match_id}
                    className="card-glow flex items-center justify-between p-4 neon-line relative animate-fade-in"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white">{match.player_1_username}</span>
                        <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-500/30 text-emerald-300 animate-pulse">
                          LIVE
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300">
                          {match.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {new Date(match.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleJoinMatch(match.match_id)}
                      className="btn-primary flex items-center gap-2 animate-glow-pulse shadow-lg shadow-cyan-500/50"
                    >
                      Join
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATING */}
      {state === 'creating' && (
        <div className="card flex flex-col items-center justify-center py-16 animate-fade-in">
          <ThemedLoader variant="candlestick" text="Setting up arena..." />
        </div>
      )}

      {/* WAITING */}
      {state === 'waiting' && matchId && (
        <div className="space-y-6 state-enter">
          <div className="card flex flex-col items-center justify-center py-12">
            <div className="relative mb-6">
              <RadarPulse size={64} className="text-cyan-400" />
              <div className="absolute inset-0 rounded-full bg-cyan-400/10 animate-ping" style={{ animationDuration: '2s' }} />
            </div>
            <p className="text-lg font-semibold text-white mb-1">Waiting for Opponent</p>
            <p className="text-gray-500 text-sm mb-6">Your challenge is live — it will auto-start when someone joins</p>
            <div className="bg-gray-800/60 rounded-xl px-5 py-3 border border-gray-700/50">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Match ID</p>
              <p className="font-mono text-sm text-cyan-300">{matchId}</p>
            </div>
          </div>
        </div>
      )}

      {/* SCENARIO READY */}
      {state === 'scenario_ready' && matchData && matchStatus && (
        <div className="space-y-6 animate-fade-in">
          <div className="card-glow border-2 border-emerald-500/50 bg-emerald-500/10">
            <div className="flex items-center gap-3 mb-6">
              <TrophySparkle className="w-6 h-6" />
              <span className="text-xl font-bold text-gradient">Match Found!</span>
            </div>
            <div className="flex items-center justify-center gap-6 text-center py-4">
              <div className="animate-slide-in-left">
                <span className="font-semibold text-white text-lg">{matchStatus.player_1?.username || 'You'}</span>
              </div>
              <div className="relative">
                <span className="text-3xl font-black text-gradient-fire animate-neon-flicker">VS</span>
                <div className="absolute inset-0 text-3xl font-black text-yellow-300 blur-lg animate-pulse opacity-50">VS</div>
              </div>
              <div className="animate-slide-in-right">
                <span className="font-semibold text-white text-lg">{matchStatus.player_2?.username}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-cyan-500/20 text-cyan-300">
                {matchData.scenario.market_regime?.replace(/_/g, ' ')}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-700 text-gray-300">
                {matchData.scenario.difficulty}
              </span>
            </div>

            <h3 className="text-lg font-semibold text-white mb-3">Market Scenario</h3>
            <p className="text-gray-300 whitespace-pre-line text-sm leading-relaxed mb-6">
              {stripWatermarks(matchData.scenario.context_prompt)}
            </p>

            {matchData.scenario.market_data && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Market Data</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {matchData.scenario.market_data.symbol && (
                    <div>
                      <p className="text-xs text-gray-500">Symbol</p>
                      <p className="text-sm font-semibold text-white">
                        {matchData.scenario.market_data.symbol}
                      </p>
                    </div>
                  )}
                  {matchData.scenario.market_data.price && (
                    <div>
                      <p className="text-xs text-gray-500">Price</p>
                      <p className="text-sm font-semibold text-emerald-400">
                        ${matchData.scenario.market_data.price}
                      </p>
                    </div>
                  )}
                  {matchData.scenario.market_data.iv && (
                    <div>
                      <p className="text-xs text-gray-500">IV</p>
                      <p className="text-sm font-semibold text-white">
                        {(matchData.scenario.market_data.iv * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {matchData.scenario.learning_objectives && matchData.scenario.learning_objectives.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Learning Objectives</p>
                <div className="flex flex-wrap gap-2">
                  {matchData.scenario.learning_objectives.map((obj: string, idx: number) => (
                    <span key={idx} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                      {obj}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleBeginAnalysis}
            className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-3"
          >
            Begin Analysis
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* RESPONDING */}
      {state === 'responding' && matchData && (
        <div className="space-y-6 animate-fade-in">
          <div className={`card flex items-center justify-between p-6 border-2 transition-all duration-300 ${
            timeLeft < 30 ? 'border-red-500 bg-red-500/10' : 'border-emerald-500 bg-emerald-500/5'
          } ${timeLeft < 30 ? 'animate-pulse' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="score-ring" width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    stroke="rgba(107, 114, 128, 0.3)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    fill="none"
                    stroke={timeLeft < 30 ? '#ef4444' : '#34d399'}
                    strokeWidth="3"
                    strokeDasharray={`${Math.PI * 72 * (timeLeft / 300)} ${Math.PI * 72}`}
                    strokeLinecap="round"
                    style={{
                      transition: 'stroke-dasharray 1s linear, stroke 0.3s ease',
                    }}
                  />
                </svg>
                <span className={`absolute text-lg font-bold font-mono ${
                  timeLeft < 30 ? 'text-red-400 animate-pulse' : 'text-emerald-300'
                }`}>
                  {formatTime(timeLeft)}
                </span>
                {timeLeft < 30 && (
                  <div className="absolute inset-0 rounded-full border-2 border-red-500 opacity-50 animate-ping" />
                )}
              </div>
              <div>
                <span className="text-sm text-gray-300 block">Time Remaining</span>
                {timeLeft < 30 && <span className="text-xs text-red-400 font-semibold">HURRY!</span>}
              </div>
            </div>
            {timeLeft < 30 && <LightningBolt className="w-6 h-6 text-red-500 animate-pulse" />}
          </div>

          <details className="card cursor-pointer group">
            <summary className="flex items-center justify-between text-white font-semibold">
              <span>Market Context (click to expand)</span>
              <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
            </summary>
            <p className="text-gray-300 text-sm mt-3 whitespace-pre-line">
              {stripWatermarks(matchData.scenario.context_prompt).substring(0, 600)}...
            </p>
          </details>

          <div className="card">
            <label className="block text-sm font-semibold text-gray-300 mb-3">Your Analysis</label>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Analyze this scenario. What's your directional thesis? Which options strategy would you deploy? How would you size and manage risk?..."
              className="textarea-field mb-3"
              rows={10}
              disabled={isLoading}
            />
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-500">{responseText.length} characters</span>
            </div>
            <button
              onClick={handleSubmitResponse}
              disabled={!responseText.trim() || isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-transparent border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Response
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* WAITING OPPONENT */}
      {state === 'waiting_opponent' && (
        <div className="card flex flex-col items-center justify-center py-16 state-enter">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-5">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-lg font-semibold text-white mb-1">Response Submitted!</p>
          <p className="text-gray-500 text-sm mb-5">Waiting for your opponent to finish their analysis...</p>
          <div className="typing-indicator flex items-center gap-1">
            <span /><span /><span />
          </div>
        </div>
      )}

      {/* GRADING */}
      {state === 'grading' && (
        <div className="card flex flex-col items-center justify-center py-16 animate-fade-in">
          <ThemedLoader variant="data-stream" text="AI evaluating..." />
        </div>
      )}

      {/* RESULTS */}
      {state === 'results' && gradeResult && (
        <div className="space-y-6 animate-fade-in">
          {/* Winner Banner */}
          <div className={`hero-mesh border-2 p-10 flex flex-col items-center justify-center relative overflow-hidden ${
            gradeResult.winner.user_id === user?.id
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-red-500 bg-red-500/10'
          }`}>
            {gradeResult.winner.user_id === user?.id && (
              <>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent animate-pulse" />
                <div className="absolute top-2 left-1/4 w-2 h-2 bg-yellow-300 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="absolute top-3 right-1/4 w-2 h-2 bg-yellow-300 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                <div className="absolute bottom-2 left-1/3 w-2 h-2 bg-yellow-300 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
              </>
            )}
            <div className={`text-5xl font-black mb-3 animate-scale-bounce ${
              gradeResult.winner.user_id === user?.id ? 'text-gradient' : 'text-red-400'
            }`}>
              {gradeResult.winner.user_id === user?.id ? '🏆 VICTORY' : '⚔️ DEFEAT'}
            </div>
            <p className="text-gray-300 text-lg">
              <span className="font-bold text-white">{gradeResult.winner.username}</span> wins the match
            </p>
          </div>

          {/* Side-by-side Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Player 1 */}
            <div className={`card-glow border-2 relative overflow-hidden animate-fade-in ${
              gradeResult.player_1.is_winner
                ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/50'
                : 'border-gray-700'
            }`} style={{ animationDelay: '200ms' }}>
              {gradeResult.player_1.is_winner && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-yellow-400 to-transparent animate-pulse"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 animate-fade-in" style={{ animationDelay: '400ms' }}></div>
                </>
              )}
              {gradeResult.player_1.is_winner && (
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-emerald-500/20">
                  <TrophySparkle className="w-6 h-6 animate-bounce" />
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">Winner</span>
                </div>
              )}
              <h3 className="text-2xl font-bold text-white mb-6">{gradeResult.player_1.username}</h3>
              <div className="space-y-4">
                <div className="animate-fade-in" style={{ animationDelay: '600ms' }}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Score</p>
                  <p className="text-4xl font-black text-gradient">{Math.floor(displayedScore1)}</p>
                </div>
                <div className="pt-4 border-t border-gray-700/50 animate-fade-in" style={{ animationDelay: '1000ms' }}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">XP Earned</p>
                  <p className="text-2xl font-bold text-emerald-400">+{displayedXP1}</p>
                </div>
              </div>
            </div>

            {/* Player 2 */}
            <div className={`card-glow border-2 relative overflow-hidden animate-fade-in ${
              gradeResult.player_2.is_winner
                ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/50'
                : 'border-gray-700'
            }`} style={{ animationDelay: '300ms' }}>
              {gradeResult.player_2.is_winner && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-yellow-400 to-transparent animate-pulse"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 animate-fade-in" style={{ animationDelay: '400ms' }}></div>
                </>
              )}
              {gradeResult.player_2.is_winner && (
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-emerald-500/20">
                  <TrophySparkle className="w-6 h-6 animate-bounce" />
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">Winner</span>
                </div>
              )}
              <h3 className="text-2xl font-bold text-white mb-6">{gradeResult.player_2.username}</h3>
              <div className="space-y-4">
                <div className="animate-fade-in" style={{ animationDelay: '700ms' }}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">Score</p>
                  <p className="text-4xl font-black text-gradient">{Math.floor(displayedScore2)}</p>
                </div>
                <div className="pt-4 border-t border-gray-700/50 animate-fade-in" style={{ animationDelay: '1100ms' }}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">XP Earned</p>
                  <p className="text-2xl font-bold text-emerald-400">+{displayedXP2}</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleBackToLobby}
            className="btn-primary w-full flex items-center justify-center gap-2 text-lg py-3 animate-fade-in"
            style={{ animationDelay: '1500ms' }}
          >
            Back to Lobby
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
