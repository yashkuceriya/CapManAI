'use client'

/**
 * Skeleton — shimmer-based loading placeholder.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />          // single line
 *   <SkeletonCard />                            // scenario card placeholder
 *   <SkeletonRows count={5} />                  // leaderboard table rows
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}

/** Scenario card skeleton shown during generation. */
export function SkeletonCard() {
  return (
    <div className="card space-y-4 animate-fade-in">
      {/* Difficulty pill + regime tag */}
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>

      {/* Title line */}
      <Skeleton className="h-5 w-3/4" />

      {/* Paragraph block */}
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>

      {/* Market data row */}
      <div className="flex gap-4 pt-2">
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  )
}

/** Leaderboard table skeleton rows. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr
          key={i}
          className="border-b border-gray-800"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* Rank */}
          <td className="px-6 py-4"><Skeleton className="h-4 w-8" /></td>
          {/* Player */}
          <td className="px-6 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </td>
          {/* Value */}
          <td className="px-6 py-4 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
        </tr>
      ))}
    </>
  )
}
