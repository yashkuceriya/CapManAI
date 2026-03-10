'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LogOut, Menu, X, Zap, Flame } from 'lucide-react'
import { LightningBolt, FireStreak, GemStone } from '@/components/AnimatedIcons'
import { useState } from 'react'

const navLinks = [
  { href: '/train', label: 'Train', hoverColor: 'hover:text-emerald-400' },
  { href: '/replay', label: 'Replay', hoverColor: 'hover:text-amber-400' },
  { href: '/leaderboard', label: 'Leaderboard', hoverColor: 'hover:text-purple-400' },
  { href: '/h2h', label: 'H2H', hoverColor: 'hover:text-cyan-400' },
]

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const handleLogout = () => {
    logout()
    setIsMenuOpen(false)
  }

  return (
    <nav className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/40">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center group-hover:shadow-lg group-hover:shadow-emerald-500/30 transition-all duration-300 group-hover:scale-105 group-hover:rotate-12">
              <LightningBolt size={20} color="#050a18" />
            </div>
            <span className="font-bold text-lg text-white hidden sm:inline tracking-tight">
              Cap<span className="text-gradient">Man</span><span className="text-emerald-400 font-black"> AI</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'text-white bg-gray-800/60'
                        : `text-gray-400 ${link.hoverColor} hover:bg-gray-800/30`
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full overflow-hidden">
                        <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 bg-[length:200%_100%]" style={{ animation: 'gradient-x 2s linear infinite' }} />
                      </span>
                    )}
                  </Link>
                )
              })}
              {(user?.role === 'educator' || user?.role === 'admin') && (
                <Link
                  href="/peer-review"
                  className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    pathname === '/peer-review'
                      ? 'text-white bg-gray-800/60'
                      : 'text-gray-400 hover:text-violet-400 hover:bg-gray-800/30'
                  }`}
                >
                  Session Reviews
                  {pathname === '/peer-review' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full overflow-hidden">
                      <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 bg-[length:200%_100%]" style={{ animation: 'gradient-x 2s linear infinite' }} />
                    </span>
                  )}
                </Link>
              )}
              {(user?.role === 'educator' || user?.role === 'admin') && (
                <Link
                  href="/mtss"
                  className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    pathname === '/mtss'
                      ? 'text-white bg-gray-800/60'
                      : 'text-gray-400 hover:text-amber-400 hover:bg-gray-800/30'
                  }`}
                >
                  MTSS
                  {pathname === '/mtss' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full overflow-hidden">
                      <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 bg-[length:200%_100%]" style={{ animation: 'gradient-x 2s linear infinite' }} />
                    </span>
                  )}
                </Link>
              )}
              {user?.role === 'student' && (
                <Link
                  href="/feedback"
                  className={`relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    pathname === '/feedback'
                      ? 'text-white bg-gray-800/60'
                      : 'text-gray-400 hover:text-violet-400 hover:bg-gray-800/30'
                  }`}
                >
                  Feedback
                  {pathname === '/feedback' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full overflow-hidden">
                      <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 bg-[length:200%_100%]" style={{ animation: 'gradient-x 2s linear infinite' }} />
                    </span>
                  )}
                </Link>
              )}
            </div>
          )}

          {/* Right side — gamified XP badge */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user && (
              <div className="hidden sm:flex items-center gap-2">
                {/* Streak indicator with enhanced visibility */}
                {(user as any).streak_days > 0 && (
                  <div className="group relative flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 transition-all duration-200" title={`${(user as any).streak_days}-day streak!`}>
                    <FireStreak size={14} color="#fb923c" />
                    <span className="text-[10px] font-bold text-orange-400 tabular-nums">{(user as any).streak_days || 0}</span>
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-gray-900 border border-gray-700 text-[10px] font-bold text-orange-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                      {(user as any).streak_days}-day streak!
                    </div>
                  </div>
                )}
                {/* XP/Level badge */}
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-gray-800/60 border border-gray-700/40 badge-rank">
                  <div className="flex items-center gap-1.5">
                    <GemStone size={18} color="#8b5cf6" />
                    <span className="text-xs font-bold text-gray-300">{(user as any).level_name || ''}</span>
                  </div>
                  <div className="w-px h-4 bg-gray-700/60" />
                  <div className="flex items-center gap-1">
                    <LightningBolt size={14} color="#fbbf24" />
                    <span key={user.xp} className="text-xs text-amber-400/90 font-bold tabular-nums animate-count-pop">
                      {(user.xp || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-800/60 transition-colors duration-200"
            >
              {isMenuOpen ? (
                <X className="w-5 h-5 text-gray-300" />
              ) : (
                <Menu className="w-5 h-5 text-gray-300" />
              )}
            </button>

            {/* Logout */}
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-red-500/10 transition-colors duration-200 group"
                title="Logout"
              >
                <LogOut className="w-4 h-4 text-gray-500 group-hover:text-red-400 transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && isAuthenticated && (
          <div className="md:hidden pb-4 border-t border-gray-800/40 animate-menu-slide-down">
            <div className="pt-3 space-y-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'text-white bg-gray-800/60'
                        : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
              {(user?.role === 'educator' || user?.role === 'admin') && (
                <Link
                  href="/peer-review"
                  onClick={() => setIsMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
                    pathname === '/peer-review'
                      ? 'text-white bg-gray-800/60'
                      : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200'
                  }`}
                >
                  Session Reviews
                </Link>
              )}
              {(user?.role === 'educator' || user?.role === 'admin') && (
                <Link
                  href="/mtss"
                  onClick={() => setIsMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
                    pathname === '/mtss'
                      ? 'text-white bg-gray-800/60'
                      : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200'
                  }`}
                >
                  MTSS Dashboard
                </Link>
              )}
              {user?.role === 'student' && (
                <Link
                  href="/feedback"
                  onClick={() => setIsMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
                    pathname === '/feedback'
                      ? 'text-white bg-gray-800/60'
                      : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200'
                  }`}
                >
                  Feedback
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
