'use client'
import PageError from '@/components/PageError'
export default function ReplayError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError error={error} reset={reset} pageName="Replay" />
}
