'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { scenarios } from '@/lib/api'
import { stripWatermarks } from '@/lib/sanitize'
import { Clock, ChevronDown, ChevronUp, ArrowLeft, Zap, Target, TrendingUp } from 'lucide-react'
import { ThemedLoader } from '@/components/ThemedLoader'
import { ScrollUnfurl, BrainCircuit, ShieldCheck } from '@/components/AnimatedIcons'

interface SessionSummary {
  session_id: string
  status: string
  difficulty: string
  market_regime: string
  asset_class: string
  learning_objectives: string[]
  is_replay: boolean
  replay_event_id: string | null
  overall_score: number | null
  dimension_scores: Record<string, number> | null
  strengths: string[]
  areas_for_improvement: string[]
  xp_earned: number
  curveball_injected: boolean
  adaptability_score: number | null
  peer_review_score: number | null
  peer_review_feedback: string | null
  created_at: string
  completed_at: string | null
}

interface SessionDetail {
  session_id: string
  status: string
  scenario: {
    context_prompt: string
    market_data: Record<string, unknown>
    difficulty: string
    market_regime: string
    learning_objectives: string[]
    is_replay: boolean
    replay_event_id: string | null
  }
  initial_response: string
  conversation: Array<{ role: string; content: string }>
  overall_score: number | null
  dimension_scores: Record<string, number> | null
  strengths: string[]
  areas_for_improvement: string[]
  xp_earned: number
  curveball_injected: boolean
  curveball_data: Record<string, unknown> | null
  curveball_response: string | null
  adaptability_score: number | null
  peer_review_score: number | null
  peer_review_feedback: string | null
  created_at: string
  completed_at: string | null
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-32 capitalize font-medium">{label.replace(/_/g, ' ')}</span>
      <div className="flex-1 h-2 bg-gray-700/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-300 w-8 text-right">{score}</span>
    </div>
  )
}

export default function HistoryPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  // Detail view
  const [selectedDetail, setSelectedDetail] = useState<SessionDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    const fetchSessions = async () => {
      try {
        setLoading(true)
        setError(null)
        const status = filter === 'all' ? undefined : filter
        const data = await scenarios.mySessions(status)
        setSessions(data.sessions || [])
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number } }
        if (axiosErr?.response?.status === 401) return
        setError(err instanceof Error ? err.message : 'Failed to load sessions')
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [authLoading, isAuthenticated, filter])

  const handleViewDetail = async (sessionId: string) => {
    try {
      setLoadingDetail(true)
      const data = await scenarios.mySessionDetail(sessionId)
      setSelectedDetail(data)
    } catch {
      setError('Failed to load session details')
    } finally {
      setLoadingDetail(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ThemedLoader variant="orbit" text="Loading..." />
      </div>
    )
  }

  if (!isAuthenticated) return null

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'graded': return 'bg-emerald-500/20 text-emerald-300'
      case 'probing': return 'bg-amber-500/20 text-amber-300'
      case 'in_progress': return 'bg-blue-500/20 text-blue-300'
      default: return 'bg-gray-500/20 text-gray-300'
    }
  }

  const getDifficultyColor = (d: string) => {
    const lower = (d || '').toLowerCase()
    if (lower.includes('beginner')) return 'bg-emerald-500/20 text-emerald-300'
    if (lower.includes('intermediate')) return 'bg-amber-500/20 text-amber-300'
    return 'bg-red-500/20 text-red-300'
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400'
    if (score >= 60) return 'text-amber-400'
    return 'text-red-400'
  }

  // ── Detail View ──
  if (selectedDetail) {
    return (
      <div className="min-h-screen bg-gray-900/95">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <button
            onClick={() => setSelectedDetail(null)}
            className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 mb-6 transition-colors"
          >
            <ArrowLeft size={16} /> Back to History
          </button>

          {/* Header */}
          <div className="card-glow mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getDifficultyColor(selectedDetail.scenario.difficulty)}`}>
                    {selectedDetail.scenario.difficulty}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-700/50 text-gray-300">
                    {selectedDetail.scenario.market_regime?.replace(/_/g, ' ')}
                  </span>
                  {selectedDetail.scenario.is_replay && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300">Replay</span>
                  )}
                  {selectedDetail.curveball_injected && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300">Curveball</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {selectedDetail.created_at ? new Date(selectedDetail.created_at).toLocaleString() : ''}
                </p>
              </div>
              {selectedDetail.overall_score != null && (
                <div className="bg-violet-500/10 rounded-xl p-3 border border-violet-500/30 text-center">
                  <span className={`text-3xl font-black ${getScoreColor(selectedDetail.overall_score)}`}>
                    {selectedDetail.overall_score}
                  </span>
                  <span className="text-gray-400 text-xs block">/100</span>
                </div>
              )}
            </div>
          </div>

          {/* Scenario */}
          <div className="card-stat mb-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/50">
              <div className="w-5 h-5 text-violet-400"><ScrollUnfurl /></div>
              <h3 className="font-bold text-white uppercase tracking-wide text-sm">Scenario</h3>
            </div>
            <div className="bg-gray-950/50 rounded-lg p-4 max-h-48 overflow-y-auto border border-gray-800/50">
              <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                {stripWatermarks(selectedDetail.scenario.context_prompt || '')}
              </p>
            </div>
          </div>

          {/* Your Response */}
          <div className="card-stat mb-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/50">
              <Target size={18} className="text-violet-400" />
              <h3 className="font-bold text-white uppercase tracking-wide text-sm">Your Response</h3>
            </div>
            <div className="bg-gray-950/70 rounded-lg p-4 border border-gray-800/50 font-mono text-sm text-gray-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
              {selectedDetail.initial_response || 'No response recorded'}
            </div>
          </div>

          {/* Conversation (probing) */}
          {selectedDetail.conversation && selectedDetail.conversation.length > 0 && (
            <div className="card-stat mb-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-700/50">
                <div className="w-5 h-5 text-violet-400"><BrainCircuit /></div>
                <h3 className="font-bold text-white uppercase tracking-wide text-sm">Probing Conversation</h3>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {selectedDetail.conversation.map((msg, i) => (
                  <div key={i} className={`p-3 rounded-lg text-sm ${
                    msg.role === 'assistant'
                      ? 'bg-violet-500/10 border border-violet-500/20 text-gray-200'
                      : 'bg-gray-800/50 border border-gray-700/30 text-gray-300'
                  }`}>
                    <span className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                      {msg.role === 'assistant' ? 'Instructor' : 'You'}
                    </span>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dimension Scores */}
          {selectedDetail.dimension_scores && Object.keys(selectedDetail.dimension_scores).length > 0 && (
            <div className="card-glow border-2 border-violet-500/30 mb-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-violet-500/20">
                <TrendingUp size={18} className="text-violet-400" />
                <h3 className="font-bold text-white uppercase tracking-wide text-sm">Dimension Scores</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(selectedDetail.dimension_scores).map(([dim, score]) => (
                  <ScoreBar key={dim} label={dim} score={score as number} />
                ))}
              </div>
            </div>
          )}

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {selectedDetail.strengths.length > 0 && (
              <div className="card-stat">
                <h4 className="text-sm font-bold text-emerald-400 mb-3">Strengths</h4>
                <ul className="space-y-1.5">
                  {selectedDetail.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-gray-300 flex gap-2">
                      <span className="text-emerald-500 mt-0.5">+</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedDetail.areas_for_improvement.length > 0 && (
              <div className="card-stat">
                <h4 className="text-sm font-bold text-amber-400 mb-3">Areas to Improve</h4>
                <ul className="space-y-1.5">
                  {selectedDetail.areas_for_improvement.map((s, i) => (
                    <li key={i} className="text-xs text-gray-300 flex gap-2">
                      <span className="text-amber-500 mt-0.5">-</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Educator Feedback */}
          {selectedDetail.peer_review_score != null && (
            <div className="card-glow border-2 border-cyan-500/30 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 text-cyan-400"><ShieldCheck /></div>
                <h3 className="font-bold text-white uppercase tracking-wide text-sm">Educator Feedback</h3>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <span className={`text-2xl font-black ${getScoreColor(selectedDetail.peer_review_score)}`}>
                  {selectedDetail.peer_review_score}
                </span>
                <span className="text-gray-400 text-sm">/ 100</span>
              </div>
              {selectedDetail.peer_review_feedback && (
                <p className="text-sm text-gray-300 bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3">
                  {selectedDetail.peer_review_feedback}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── List View ──
  return (
    <div className="min-h-screen bg-gray-900/95">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="hero-mesh rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-4">
            <Clock size={36} className="text-violet-400" />
            <div>
              <h1 className="text-4xl font-black text-white">Session History</h1>
              <p className="text-gray-300 text-sm mt-1">Review your past trading analyses and scores</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['all', 'graded', 'probing', 'in_progress'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs rounded-lg font-bold transition-all border ${
                filter === f
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                  : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:text-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="card border-l-4 border-red-500 bg-red-500/5 mb-6">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <ThemedLoader variant="orbit" text="Loading sessions..." />
          </div>
        ) : sessions.length === 0 ? (
          <div className="card text-center py-12">
            <div className="mx-auto mb-4 w-10 h-10 text-gray-600"><ScrollUnfurl /></div>
            <p className="text-gray-400 mb-2">No sessions found.</p>
            <p className="text-gray-500 text-sm">Start training to build your session history!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((sess, idx) => (
              <button
                key={sess.session_id}
                onClick={() => handleViewDetail(sess.session_id)}
                className="w-full text-left card-glow hover:border-violet-400/50 transition-all group"
                style={{ animation: `fadeInUp 0.4s ease-out ${idx * 0.05}s both` }}
              >
                <style>{`
                  @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getStatusBadge(sess.status)}`}>
                        {sess.status === 'in_progress' ? 'In Progress' : sess.status}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getDifficultyColor(sess.difficulty)}`}>
                        {sess.difficulty || 'N/A'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-400">
                        {(sess.market_regime || '').replace(/_/g, ' ')}
                      </span>
                      {sess.is_replay && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">Replay</span>
                      )}
                      {sess.curveball_injected && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Curveball</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{sess.created_at ? new Date(sess.created_at).toLocaleDateString() : '—'}</span>
                      {sess.xp_earned > 0 && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Zap size={12} /> +{sess.xp_earned} XP
                        </span>
                      )}
                      {sess.learning_objectives?.length > 0 && (
                        <span className="text-gray-500 hidden sm:inline">
                          {sess.learning_objectives.map(o => o.replace(/_/g, ' ')).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {sess.peer_review_score != null && (
                      <div className="text-center">
                        <span className="text-xs text-gray-500 block">Educator</span>
                        <span className={`text-sm font-bold ${getScoreColor(sess.peer_review_score)}`}>
                          {sess.peer_review_score}
                        </span>
                      </div>
                    )}
                    {sess.overall_score != null ? (
                      <div className="w-12 h-12 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center group-hover:bg-violet-500/20 transition-all">
                        <span className={`text-lg font-black ${getScoreColor(sess.overall_score)}`}>
                          {Math.round(sess.overall_score)}
                        </span>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-700/30 border border-gray-600/30 flex items-center justify-center">
                        <span className="text-xs text-gray-500">—</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {loadingDetail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <ThemedLoader variant="pulse-ring" text="Loading session..." />
          </div>
        )}
      </div>
    </div>
  )
}
