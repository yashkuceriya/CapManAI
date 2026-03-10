'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { peerReview } from '@/lib/api'
import { MessageSquare } from 'lucide-react'
import { TrophySparkle } from '@/components/AnimatedIcons'
import { ThemedLoader } from '@/components/ThemedLoader'

interface ReceivedReview {
  session_id: string
  reviewer_id: string
  reviewer_username: string
  peer_review_score: number
  peer_review_feedback: string
  overall_score: number
  completed_at: string
}

export default function FeedbackPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  const [reviews, setReviews] = useState<ReceivedReview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
    // Educators should use the /peer-review page instead
    if (!authLoading && isAuthenticated && user?.role === 'educator') {
      router.push('/peer-review')
    }
  }, [authLoading, isAuthenticated, user, router])

  // Fetch received reviews
  useEffect(() => {
    if (!isAuthenticated) return

    const fetchReviews = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await peerReview.myReceived()
        setReviews(data.reviews || [])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load feedback'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchReviews()
  }, [isAuthenticated])

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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400'
    if (score >= 60) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <div className="min-h-screen bg-gray-900/95">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="hero-mesh rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 text-violet-400">
              <MessageSquare size={40} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">Feedback</h1>
              <p className="text-gray-300 text-sm mt-1">Educator feedback on your trading sessions</p>
            </div>
          </div>
        </div>

        {/* Error */}
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

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <ThemedLoader variant="pulse-ring" text="Loading feedback..." />
          </div>
        ) : reviews.length === 0 ? (
          <div className="card text-center py-12">
            <div className="mx-auto mb-4 w-10 h-10 text-gray-600">
              <TrophySparkle />
            </div>
            <p className="text-gray-400">No feedback received yet. Complete scenarios to get reviewed.</p>
          </div>
        ) : (
          <div className="space-y-4 stagger-children">
            {reviews.map((review, idx) => (
              <div
                key={review.session_id}
                className="card-glow border-2 border-violet-500/30 relative overflow-hidden"
                style={{
                  animation: `fadeInUp 0.5s ease-out ${idx * 0.1}s both`,
                }}
              >
                <style>{`
                  @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                `}</style>
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-sm text-gray-400">Reviewed by</p>
                    <p className="font-bold text-white text-lg mt-1">{review.reviewer_username}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(review.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-500/30">
                      <div className="text-center">
                        <div className={`text-2xl font-black ${getScoreColor(review.peer_review_score)}`}>
                          {review.peer_review_score}
                        </div>
                        <div className="text-xs text-gray-500">/ 100</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3 font-medium">AI: {review.overall_score}</p>
                  </div>
                </div>

                {review.peer_review_feedback && (
                  <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-300 leading-relaxed">{review.peer_review_feedback}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-violet-300 font-semibold">
                  <div className="w-4 h-4">
                    <TrophySparkle />
                  </div>
                  <span>Educator feedback</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
