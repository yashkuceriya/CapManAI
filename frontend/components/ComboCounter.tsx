'use client';

import { useState, useEffect } from 'react';

interface ComboCounterProps {
  count: number;
  isActive: boolean;
}

export default function ComboCounter({ count, isActive }: ComboCounterProps) {
  const [displayCount, setDisplayCount] = useState(count);
  const [shouldBounce, setShouldBounce] = useState(false);

  useEffect(() => {
    if (count > displayCount) {
      setShouldBounce(true);
      setDisplayCount(count);
      const timer = setTimeout(() => {
        setShouldBounce(false);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [count, displayCount]);

  const getComboClass = () => {
    if (!isActive) return 'inactive';
    if (displayCount >= 10) return 'combo-10x';
    if (displayCount >= 7) return 'combo-7x';
    if (displayCount >= 5) return 'combo-5x';
    if (displayCount >= 3) return 'combo-3x';
    return '';
  };

  const getComboText = () => {
    if (displayCount <= 1) return '';
    return `${displayCount}x COMBO`;
  };

  const getMessageText = () => {
    if (displayCount > 10) return 'Perfect Series!';
    if (displayCount > 7) return 'On Fire!';
    if (displayCount > 5) return 'Great Trades!';
    return 'Building Streak...';
  };

  if (!isActive || displayCount <= 1) {
    return null;
  }

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center gap-3 pointer-events-none">
      {/* Combo counter with glow effect */}
      <div className="relative">
        {/* Glow background orbs */}
        <div className="absolute inset-0 -m-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{
          background: displayCount >= 10
            ? 'radial-gradient(circle, rgba(6,182,212,0.3) 0%, transparent 70%)'
            : displayCount >= 7
            ? 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 70%)'
            : displayCount >= 5
            ? 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)'
        }} />

        <div className={`combo-counter ${getComboClass()} ${shouldBounce ? 'animate-bounce' : ''}`}>
          {getComboText()}
        </div>
      </div>

      {/* Message text with emphasis */}
      <div className="text-xs uppercase tracking-widest font-bold" style={{
        color: displayCount >= 10
          ? '#06b6d4'
          : displayCount >= 7
          ? '#f59e0b'
          : displayCount >= 5
          ? '#8b5cf6'
          : '#06b6d4'
      }}>
        {getMessageText()}
      </div>
    </div>
  );
}
