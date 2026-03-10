'use client'

import { useEffect } from 'react'

export default function FeedbackError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[CapMan] Feedback page error:', error)
  }, [error])

  return (
    <div className="max-w-4xl mx-auto py-20 text-center">
      <div className="card border-red-500/20 bg-red-500/[0.03] p-10">
        <h2 className="text-xl font-bold text-white mb-2">Feedback Error</h2>
        <p className="text-gray-400 text-sm mb-6">
          Something went wrong loading feedback. Please try again.
        </p>
        {error.digest && (
          <p className="text-gray-600 text-xs mb-4 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-lg text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-6 py-2.5 rounded-lg text-sm font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30 transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  )
}
