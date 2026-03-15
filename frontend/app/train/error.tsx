'use client'
import PageError from '@/components/PageError'
export default function TrainError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError error={error} reset={reset} pageName="Training" />
}
