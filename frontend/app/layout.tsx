import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { AchievementProvider } from '@/lib/achievement-context'
import { Navbar } from '@/components/Navbar'
import { ParticleField } from '@/components/ParticleField'
import { PageTransition } from '@/components/PageTransition'
import { AchievementLayer } from '@/components/AchievementLayer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CapMan AI — Options Trading Training Platform',
  description:
    'Gamified AI-powered options trading training with real market data, Socratic probing, and MTSS reporting',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Particle field — subtle animated ambient effect */}
        <ParticleField density={40} speed={0.5} />
        {/* Ambient background particles — floating glow orbs */}
        <div className="ambient-particles" />
        <AuthProvider>
          <AchievementProvider>
            <Navbar />
            <main className="min-h-screen bg-gray-950 relative">
              {/* Subtle grid background */}
              <div className="fixed inset-0 grid-bg opacity-20 pointer-events-none" />
              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <PageTransition>{children}</PageTransition>
              </div>
            </main>
            <AchievementLayer />
          </AchievementProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
