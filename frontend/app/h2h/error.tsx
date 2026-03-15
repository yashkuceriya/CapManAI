'use client'
import PageError from '@/components/PageError'
export default function H2HError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError error={error} reset={reset} pageName="H2H Arena" />
}
