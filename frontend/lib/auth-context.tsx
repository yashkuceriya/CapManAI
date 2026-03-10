'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth, users } from './api'

interface User {
  id: string
  username: string
  email: string
  role: string
  xp: number
  level: number
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user')
      const token = localStorage.getItem('token')
      if (storedUser && storedUser !== 'undefined' && storedUser !== 'null' && token) {
        try {
          const parsed = JSON.parse(storedUser)
          if (parsed && parsed.id) {
            setUser(parsed)
          } else {
            localStorage.removeItem('user')
            localStorage.removeItem('token')
          }
        } catch {
          localStorage.removeItem('user')
          localStorage.removeItem('token')
        }
      }
      setIsLoading(false)
    }
  }, [])

  // Listen for auth expiration event
  useEffect(() => {
    const handleExpired = () => {
      setUser(null)
      // Show a brief toast before redirect (api.ts handles the redirect)
      if (typeof document !== 'undefined') {
        const toast = document.createElement('div')
        toast.textContent = 'Session expired — please log in again.'
        toast.style.cssText =
          'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:9999;' +
          'padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;' +
          'background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);' +
          'backdrop-filter:blur(8px);animation:fadeIn .3s ease'
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 4000)
      }
    }
    window.addEventListener('capman:auth-expired', handleExpired)
    return () => window.removeEventListener('capman:auth-expired', handleExpired)
  }, [])

  const handleLogin = async (username: string, password: string) => {
    const response = await auth.login(username, password)
    if (response.user) {
      setUser(response.user)
    }
  }

  const handleRegister = async (username: string, email: string, password: string) => {
    const response = await auth.register(username, email, password)
    if (response.user) {
      setUser(response.user)
    }
  }

  const handleLogout = async () => {
    try {
      // Call backend logout (for audit logging / future token blacklist)
      const token = localStorage.getItem('token')
      if (token) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }).catch(() => {}) // ignore errors — we're logging out anyway
      }
    } finally {
      auth.logout()
      setUser(null)
    }
  }

  const handleRefreshUser = async () => {
    try {
      const data = await users.getProfile()
      const updated = { ...user, ...data }
      setUser(updated)
      localStorage.setItem('user', JSON.stringify(updated))
    } catch (err) {
      console.error('[CapMan] Failed to refresh user:', err)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        isAuthenticated: !!user,
        refreshUser: handleRefreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
