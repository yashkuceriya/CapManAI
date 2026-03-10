'use client'

import { useAchievements } from '@/lib/achievement-context'
import AchievementToast from '@/components/AchievementToast'

export function AchievementLayer() {
  const { toasts, dismissToast } = useAchievements()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-auto">
      {toasts.map((toast) => (
        <AchievementToast
          key={toast.id}
          title={toast.title}
          description={toast.description}
          icon={toast.icon}
          xp={toast.xp}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  )
}
