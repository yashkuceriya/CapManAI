'use client'
import PageError from '@/components/PageError'
export default function MTSSError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError error={error} reset={reset} pageName="MTSS" />
}
