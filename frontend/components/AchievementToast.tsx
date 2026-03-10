'use client';

import { useState, useEffect } from 'react';
import { Trophy, Star, Sparkles, X } from 'lucide-react';

interface AchievementToastProps {
  title: string;
  description: string;
  icon?: 'trophy' | 'star' | 'sparkles';
  xp?: number;
  onDismiss?: () => void;
}

export default function AchievementToast({
  title,
  description,
  icon = 'trophy',
  xp,
  onDismiss,
}: AchievementToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onDismiss?.();
      }, 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getIcon = () => {
    switch (icon) {
      case 'star':
        return <Star size={32} className="text-amber-400" strokeWidth={2} />;
      case 'sparkles':
        return <Sparkles size={32} className="text-amber-400" strokeWidth={2} />;
      case 'trophy':
      default:
        return <Trophy size={32} className="text-amber-400" strokeWidth={2} />;
    }
  };

  return (
    <div
      className={`achievement-toast ${isExiting ? 'exiting' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <div className="achievement-toast-content flex-1">
        <div className="achievement-toast-title">{title}</div>
        <div className="achievement-toast-description">{description}</div>
      </div>
      {xp !== undefined && (
        <div className="achievement-toast-xp">+{xp} XP</div>
      )}
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => {
            onDismiss?.();
          }, 300);
        }}
        className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-200 transition-colors"
        aria-label="Dismiss achievement"
      >
        <X size={20} />
      </button>
    </div>
  );
}
