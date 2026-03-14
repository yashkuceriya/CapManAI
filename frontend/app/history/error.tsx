'use client'
import PageError from '@/components/PageError'
export default function HistoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError error={error} reset={reset} pageName="History" />
}
