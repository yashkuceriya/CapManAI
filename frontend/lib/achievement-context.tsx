'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface AchievementPayload {
  id: string
  title: string
  description: string
  icon?: 'trophy' | 'star' | 'sparkles'
  xp?: number
}

interface AchievementContextType {
  toasts: AchievementPayload[]
  showAchievement: (toast: Omit<AchievementPayload, 'id'>) => void
  dismissToast: (id: string) => void
}

const AchievementContext = createContext<AchievementContextType>({
  toasts: [],
  showAchievement: () => {},
  dismissToast: () => {},
})

export function useAchievements() {
  return useContext(AchievementContext)
}

let _toastId = 0

export function AchievementProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<AchievementPayload[]>([])

  const showAchievement = useCallback((toast: Omit<AchievementPayload, 'id'>) => {
    const id = `ach-${++_toastId}-${Date.now()}`
    setToasts(prev => [...prev, { ...toast, id }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <AchievementContext.Provider value={{ toasts, showAchievement, dismissToast }}>
      {children}
    </AchievementContext.Provider>
  )
}
