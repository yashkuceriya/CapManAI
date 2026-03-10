'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { peerReview } from '@/lib/api'
import {
  MessageSquare,
  ArrowLeft,
} from 'lucide-react'
import { stripWatermarks } from '@/lib/sanitize'
import {
  RadarPulse,
  BrainCircuit,
  ScrollUnfurl
} from '@/components/AnimatedIcons'
import { ThemedLoader } from '@/components/ThemedLoader'

type PageState = 'browsing' | 'claiming' | 'reviewing' | 'submitting' | 'submitted'
// Animated Checkmark Component
function AnimatedCheckmark() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      className="mx-auto mb-4"
      style={{
        animation: 'checkmarkDraw 0.8s ease-out forwards'
      }}
    >
      <defs>
        <style>{`
          @keyframes checkmarkDraw {
            0% {
              stroke-dashoffset: 150;
              opacity: 0;
            }
            50% {
              opacity: 1;
            }
            100% {
              stroke-dashoffset: 0;
              opacity: 1;
            }
          }
        `}</style>
      </defs>
      <circle
        cx="40"
        cy="40"
        r="35"
        fill="none"
        stroke="rgb(34, 197, 94)"
        strokeWidth="3"
        opacity="0.3"
      />
      <path
        d="M 25 42 L 38 55 L 60 30"
        fill="none"
        stroke="rgb(34, 197, 94)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="150"
      />
    </svg>
  )
}

// Confetti Particles Component
function ConfettiParticles() {
  const particles = Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.2,
    duration: 2 + Math.random() * 1,
  }))

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0% {
            opacity: 1;
            transform: translateY(0) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translateY(200px) rotate(720deg);
          }
        }
      `}</style>
      {particles.map((particle) => (
        <div
          key={particle.id}
          style={{
            position: 'absolute',
            left: `${particle.left}%`,
            top: '50%',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: ['#10b981', '#a78bfa', '#f59e0b', '#ef4444'][
              particle.id % 4
            ],
            animation: `confettiFall ${particle.duration}s ease-out ${particle.delay}s forwards`,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  )
}

interface AvailableSession {
  session_id: string
  user_id: string
  username: string
  scenario_id: string
  overall_score: number
  difficulty: string
  market_regime: string
  context_preview: string
  initial_response: string
  learning_objectives: string[]
  completed_at: string
}

interface ReviewSession {
  session_id: string
  status: string
  session: {
    initial_response: string
    conversation: Array<{ role: string; content: string }>
    overall_score: number
    dimension_scores: { [key: string]: number }
    strengths: string[]
    areas_for_improvement: string[]
  }
  scenario: {
    context_prompt: string
    market_data: string
    difficulty: string
    market_regime: string
    learning_objectives: string[]
  }
}

// Animated Score Bar Component
interface AnimatedScoreBarProps {
  dimension: string
  score: number
  index: number
  getScoreBarColor: (score: number) => string
}

function AnimatedScoreBar({
  dimension,
  score,
  index,
  getScoreBarColor,
}: AnimatedScoreBarProps) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setWidth(((score / 100) * 100))
    }, index * 100)

    return () => clearTimeout(timer)
  }, [score, index])

  const getTickMarks = () => {
    return [0, 25, 50, 75, 100]
  }

  return (
    <div key={dimension} className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-28 capitalize font-bold">{dimension}</span>
      <div className="flex-1 relative">
        <div className="flex-1 h-2.5 bg-gray-700/50 rounded-full overflow-hidden border border-gray-600/30 relative">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${getScoreBarColor(score)}`}
            style={{ width: `${width}%` }}
          />
        </div>
        {/* Tick marks */}
        <div className="absolute inset-0 flex justify-between px-0.5">
          {getTickMarks().map((tick) => (
            <div
              key={tick}
              className="w-px h-3 bg-gray-600/30 absolute"
              style={{ left: `${tick}%`, top: '50%', transform: 'translateY(-50%)' }}
            />
          ))}
        </div>
      </div>
      <span className="text-xs font-bold text-gray-300 w-8 text-right">{score}</span>
    </div>
  )
}

// Session Card Component with 3D tilt
interface SessionCardItemProps {
  session: AvailableSession
  index: number
  onClaim: (sessionId: string) => void
  getDifficultyColor: (difficulty: string) => string
}

function SessionCardItem({
  session,
  index,
  onClaim,
  getDifficultyColor,
}: SessionCardItemProps) {
  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg)')
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const xPercent = x / rect.width
    const yPercent = y / rect.height

    const rotateY = (xPercent - 0.5) * 20
    const rotateX = -(yPercent - 0.5) * 20

    setTransform(
      `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
    )
  }

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg)')
    setIsHovered(false)
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={() => setIsHovered(true)}
      style={{
        transform,
        transition: 'transform 0.2s ease-out',
        transformStyle: 'preserve-3d',
        animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
      }}
      className="card-glow group hover:border-violet-400/50 transition-all"
    >
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-bold text-white text-lg group-hover:text-violet-300 transition-colors">
            {session.username}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(session.completed_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-bold px-3 py-1 rounded-full ${getDifficultyColor(
              session.difficulty
            )}`}
          >
            {session.difficulty}
          </span>
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-lg bg-violet-500/20 border border-violet-500/30 transition-all duration-300 ${
              isHovered ? 'animate-pulse shadow-lg shadow-violet-500/30' : ''
            }`}
          >
            <span className="font-bold text-lg text-violet-300">
              {session.overall_score}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <span className="inline-block px-3 py-1 text-xs rounded-full bg-gray-700/50 text-gray-300 font-medium">
          {session.market_regime}
        </span>
      </div>

      <p className="text-sm text-gray-400 line-clamp-2 mb-5">
        {session.context_preview}
      </p>

      <button
        onClick={() => onClaim(session.session_id)}
        className="btn-primary text-sm w-full transition-all group-hover:shadow-lg group-hover:shadow-emerald-500/20"
      >
        Review
      </button>
    </div>
  )
}

export default function PeerReviewPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const dimensionBarsRef = useRef<HTMLDivElement>(null)

  // State management
  const [pageState, setPageState] = useState<PageState>('browsing')
  const [error, setError] = useState<string | null>(null)
  const [scoreAnimated, setScoreAnimated] = useState(false)

  // Available sessions
  const [availableSessions, setAvailableSessions] = useState<AvailableSession[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)

  // Current review session
  const [currentSession, setCurrentSession] = useState<ReviewSession | null>(null)
  const [reviewScore, setReviewScore] = useState(0)
  const [reviewFeedback, setReviewFeedback] = useState('')


  // Auth check — wait for auth loading before redirecting
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
    // Students should use the /feedback page instead
    if (!authLoading && isAuthenticated && user?.role === 'student') {
      router.push('/feedback')
    }
  }, [authLoading, isAuthenticated, user, router])

  // Fetch available sessions
  const fetchAvailable = async () => {
    try {
      setLoadingAvailable(true)
      setError(null)
      const data = await peerReview.listAvailable()
      setAvailableSessions(data.sessions || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load available sessions'
      setError(message)
      console.error('Error fetching available sessions:', err)
    } finally {
      setLoadingAvailable(false)
    }
  }

  // Load initial data — wait for auth to fully resolve
  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    if (user?.role === 'student') return // about to redirect
    if (pageState === 'browsing') {
      fetchAvailable()
    }
  }, [authLoading, isAuthenticated, user, pageState])

  // Claim session for review
  const handleClaimSession = async (sessionId: string) => {
    try {
      setPageState('claiming')
      setError(null)
      setScoreAnimated(false)
      const data = await peerReview.claim(sessionId)
      setCurrentSession(data as ReviewSession)
      setReviewScore(0)
      setReviewFeedback('')
      setPageState('reviewing')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim session'
      setError(message)
      setPageState('browsing')
      console.error('Error claiming session:', err)
    }
  }

  // Submit review
  const handleSubmitReview = async () => {
    if (!currentSession || reviewScore === 0 || !reviewFeedback.trim()) {
      setError('Please provide both a score and feedback')
      return
    }

    try {
      setPageState('submitting')
      setError(null)
      await peerReview.submit(
        currentSession.session_id,
        reviewScore,
        reviewFeedback
      )
      setPageState('submitted')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit review'
      setError(message)
      setPageState('reviewing')
      console.error('Error submitting review:', err)
    }
  }

  // Return to browsing
  const handleBackToBrowsing = () => {
    setCurrentSession(null)
    setReviewScore(0)
    setReviewFeedback('')
    setPageState('browsing')
  }

  // Review another session
  const handleReviewAnother = () => {
    setCurrentSession(null)
    setReviewScore(0)
    setReviewFeedback('')
    setPageState('browsing')
    fetchAvailable()
  }

  // Show loader while auth is resolving
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ThemedLoader variant="orbit" text="Loading..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  // Helper functions
  const getDifficultyColor = (difficulty: string) => {
    const lower = difficulty.toLowerCase()
    if (lower.includes('beginner') || lower.includes('easy')) return 'bg-emerald-500/20 text-emerald-300'
    if (lower.includes('intermediate') || lower.includes('medium')) return 'bg-amber-500/20 text-amber-300'
    return 'bg-red-500/20 text-red-300'
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400'
    if (score >= 60) return 'text-amber-400'
    return 'text-red-400'
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500'
    if (score >= 60) return 'bg-amber-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getReviewScoreGradient = (score: number) => {
    if (score >= 80) return 'bg-emerald-500'
    if (score >= 60) return 'bg-amber-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getScoreSliderColor = (score: number) => {
    if (score >= 80) return 'rgb(16, 185, 129)'
    if (score >= 60) return 'rgb(217, 119, 6)'
    if (score >= 40) return 'rgb(234, 88, 12)'
    return 'rgb(239, 68, 68)'
  }

  const getScoreSliderGradient = (score: number) => {
    if (score >= 80) return 'linear-gradient(to right, rgb(16, 185, 129), rgb(34, 197, 94))'
    if (score >= 60) return 'linear-gradient(to right, rgb(217, 119, 6), rgb(251, 191, 36))'
    if (score >= 40) return 'linear-gradient(to right, rgb(234, 88, 12), rgb(253, 124, 20))'
    return 'linear-gradient(to right, rgb(239, 68, 68), rgb(248, 113, 113))'
  }

  // Render browsing state - Available tab
  const renderAvailableTab = () => (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Sessions Available to Review</h3>
        <button
          onClick={fetchAvailable}
          disabled={loadingAvailable}
          className="px-4 py-2 text-sm rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 transition-colors disabled:opacity-50 font-semibold border border-violet-500/30"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="card border-l-4 border-red-500 bg-red-500/5 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-red-400 mt-1">
              <MessageSquare size={20} />
            </div>
            <div>
              <p className="font-medium text-red-300">Error</p>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {loadingAvailable ? (
        <div className="flex items-center justify-center py-12">
          <ThemedLoader variant="orbit" text="Loading sessions..." />
        </div>
      ) : availableSessions.length === 0 ? (
        <div className="card text-center py-12">
          <div className="mx-auto mb-4 w-10 h-10 text-gray-600">
            <ScrollUnfurl />
          </div>
          <p className="text-gray-400 mb-4">
            No sessions available for review yet. Complete more training to generate reviewable content!
          </p>
          <button
            onClick={async () => {
              try {
                const res = await peerReview.seedTestData()
                if (res.status === 'seeded' || res.status === 'already_seeded') {
                  // Refresh the available list
                  const data = await peerReview.listAvailable()
                  setAvailableSessions(data.sessions || [])
                }
              } catch (err) {
                console.error('Failed to seed test data:', err)
              }
            }}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
            style={{
              background: 'rgba(139,92,246,0.15)',
              color: '#a78bfa',
              border: '1px solid rgba(139,92,246,0.3)',
            }}
          >
            Seed Demo Peer Reviews
          </button>
        </div>
      ) : (
        <div className="space-y-4 stagger-children">
          {availableSessions.map((session, idx) => (
            <SessionCardItem
              key={session.session_id}
              session={session}
              index={idx}
              onClaim={handleClaimSession}
              getDifficultyColor={getDifficultyColor}
            />
          ))}
        </div>
      )}
    </div>
  )

  // Render claiming state
  const renderClaiming = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <ThemedLoader variant="pulse-ring" text="Claiming session..." />
    </div>
  )

  // Render reviewing state
  const renderReviewing = () => (
    <div className="animate-fade-in">
      <button
        onClick={handleBackToBrowsing}
        className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Sessions
      </button>

      {error && (
        <div className="card border-l-4 border-red-500 bg-red-500/5 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-red-400 mt-1">
              <MessageSquare size={20} />
            </div>
            <div>
              <p className="font-medium text-red-300">Error</p>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {currentSession && (
        <div className="space-y-6 stagger-children">
          {/* Scenario Context */}
          <div className="card-stat">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-700/50">
              <div className="w-6 h-6 text-violet-400">
                <ScrollUnfurl />
              </div>
              <h3 className="font-bold text-white text-lg uppercase tracking-wide">Scenario Context</h3>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {currentSession.scenario?.market_regime && (
                <span className="inline-block px-3 py-1 text-xs rounded-full bg-cyan-500/20 text-cyan-300 font-medium">
                  {currentSession.scenario.market_regime}
                </span>
              )}
              {currentSession.scenario?.difficulty && (
                <span className={`inline-block px-3 py-1 text-xs rounded-full font-bold ${getDifficultyColor(currentSession.scenario.difficulty)}`}>
                  {currentSession.scenario.difficulty}
                </span>
              )}
            </div>
            <div className="bg-gray-950/50 rounded-lg p-4 max-h-60 overflow-y-auto border border-gray-800/50">
              <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                {stripWatermarks(currentSession.scenario?.context_prompt || '')}
              </p>
            </div>
          </div>

          {/* Student Response */}
          <div className="card-stat">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-700/50">
              <MessageSquare size={22} className="text-violet-400" />
              <h3 className="font-bold text-white text-lg uppercase tracking-wide">Student Response</h3>
            </div>
            <div className="bg-gray-950/70 rounded-lg p-4 border border-gray-800/50 font-mono text-sm text-gray-300 max-h-64 overflow-y-auto">
              {currentSession.session.initial_response}
            </div>
          </div>

          {/* AI Grade Reference */}
          <div className="card-glow border-2 border-violet-500/30">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-violet-500/20">
              <div className="w-6 h-6 text-violet-400">
                <BrainCircuit />
              </div>
              <h3 className="font-bold text-white text-lg uppercase tracking-wide">AI Grade Reference</h3>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/40 to-violet-600/20 rounded-xl blur-lg"></div>
                <div className="relative bg-violet-500/10 rounded-xl p-4 border border-violet-500/30">
                  <span className="text-4xl font-black text-gradient-purple">
                    {currentSession.session.overall_score}
                  </span>
                  <span className="text-gray-400 text-sm block">/100</span>
                </div>
              </div>
            </div>
            <div className="space-y-3" ref={dimensionBarsRef}>
              {currentSession.session.dimension_scores && Object.entries(currentSession.session.dimension_scores).map(([dimension, score], idx) => (
                <AnimatedScoreBar
                  key={dimension}
                  dimension={dimension}
                  score={score as number}
                  index={idx}
                  getScoreBarColor={getScoreBarColor}
                />
              ))}
            </div>
          </div>

          {/* Review Form */}
          <div className="card-glow border-2 border-violet-500/40 bg-violet-500/5">
            <h3 className="font-bold text-white mb-8 text-xl uppercase tracking-wider">Your Review</h3>

            {/* Score Slider */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-bold text-gray-300 uppercase tracking-wide">Score</label>
                <div className="relative">
                  <div className="absolute inset-0 rounded-lg blur-md" style={{
                    background: getScoreSliderGradient(reviewScore),
                    opacity: 0.3
                  }}></div>
                  <span
                    className={`relative inline-block text-3xl font-black px-4 py-2 rounded-lg transition-all duration-300 transform ${getReviewScoreGradient(reviewScore)} ${scoreAnimated ? 'scale-100' : 'scale-95'}`}
                    style={{
                      animation: scoreAnimated ? 'scorePopIn 0.3s ease-out' : 'none'
                    }}
                  >
                    {reviewScore}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={reviewScore}
                onChange={(e) => {
                  setReviewScore(Number(e.target.value))
                  setScoreAnimated(true)
                  setTimeout(() => setScoreAnimated(false), 300)
                }}
                className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                style={{
                  background: `linear-gradient(to right, ${getScoreSliderColor(reviewScore)} 0%, ${getScoreSliderColor(reviewScore)} ${reviewScore}%, rgb(55, 65, 81) ${reviewScore}%, rgb(55, 65, 81) 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-3 font-medium">
                <span>Poor</span>
                <span>Fair</span>
                <span>Good</span>
                <span>Great</span>
                <span>Excellent</span>
              </div>
              <style>{`
                @keyframes scorePopIn {
                  0% {
                    transform: scale(0.8);
                  }
                  50% {
                    transform: scale(1.1);
                  }
                  100% {
                    transform: scale(1);
                  }
                }
              `}</style>
            </div>

            {/* Feedback Textarea */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-300 mb-3 uppercase tracking-wide">
                Feedback
              </label>
              <textarea
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value.slice(0, 500))}
                placeholder="Provide constructive feedback on their analysis..."
                rows={5}
                maxLength={500}
                className="textarea-field w-full bg-gray-800/50 border-gray-700 focus:border-emerald-500 focus:bg-gray-800"
              />
              <div className="text-xs text-gray-400 mt-2 text-right font-medium">
                {reviewFeedback.length} / 500
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitReview}
              disabled={reviewScore === 0 || !reviewFeedback.trim()}
              className="btn-primary w-full font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-emerald-500/30"
            >
              Submit Review
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // Render submitting state
  const renderSubmitting = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <ThemedLoader variant="data-stream" text="Submitting review..." />
    </div>
  )

  // Render submitted state
  const renderSubmitted = () => (
    <div className="animate-fade-in">
      <div className="hero-mesh border-2 border-emerald-500/50 text-center py-12 mb-8 relative overflow-hidden">
        <AnimatedCheckmark />
        <h2 className="text-4xl font-black text-gradient mb-3">Review Submitted!</h2>
        <p className="text-gray-300 text-lg">Your feedback has been recorded.</p>
        <ConfettiParticles />
      </div>

      <button
        onClick={handleReviewAnother}
        className="btn-primary w-full"
      >
        Review Another
      </button>
    </div>
  )

  // Main render
  return (
    <div className="min-h-screen bg-gray-900/95">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="hero-mesh rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 text-violet-400">
              <RadarPulse />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">Session Reviews</h1>
              <p className="text-gray-300 text-sm mt-1">Review student trading analyses and provide feedback</p>
            </div>
          </div>
        </div>

        {/* Content */}
        {pageState === 'browsing' && renderAvailableTab()}
        {pageState === 'claiming' && renderClaiming()}
        {pageState === 'reviewing' && renderReviewing()}
        {pageState === 'submitting' && renderSubmitting()}
        {pageState === 'submitted' && renderSubmitted()}
      </div>
    </div>
  )
}
