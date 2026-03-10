'use client'

interface IconProps {
  size?: number
  className?: string
  color?: string
}

/* ─── 1. PULSING SWORD ─── */
export function PulsingSword({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      style={{ color }}
    >
      <defs>
        <linearGradient id="sword-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <filter id="sword-glow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow ring */}
      <circle
        cx="12"
        cy="12"
        r="11"
        fill="none"
        stroke="url(#sword-grad)"
        strokeWidth="0.8"
        opacity="0.3"
        style={{ animation: 'sword-ring-rotate 8s linear infinite' }}
      />

      {/* Sword blade */}
      <path
        d="M12 2L11.5 10L8 20C7.8 20.5 8.2 21.2 9 21.2C9.8 21.2 10.2 20.5 10.5 20L12 15L13.5 20C13.8 20.5 14.2 21.2 15 21.2C15.8 21.2 16.2 20.5 16 20L12.5 10L12 2Z"
        fill="url(#sword-grad)"
        filter="url(#sword-glow)"
        style={{ animation: 'sword-pulse 2.2s ease-in-out infinite' }}
      />

      {/* Sword hilt */}
      <rect x="10.5" y="14.5" width="3" height="2.5" fill="url(#sword-grad)" rx="0.5" />
      <circle cx="12" cy="17.5" r="1.2" fill="#10b981" />

      <style>{`
        @keyframes sword-pulse {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.4)); }
          50% { opacity: 0.7; filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.8)); }
        }
        @keyframes sword-ring-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  )
}

/* ─── 2. RADAR PULSE ─── */
export function RadarPulse({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      style={{ color }}
    >
      <defs>
        <filter id="radar-glow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer ring 1 */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="rgba(16,185,129,0.3)"
        strokeWidth="0.8"
        style={{ animation: 'radar-expand1 2s ease-out infinite' }}
        opacity="0.8"
      />

      {/* Outer ring 2 */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="rgba(16,185,129,0.2)"
        strokeWidth="0.8"
        style={{ animation: 'radar-expand1 2s ease-out infinite 0.6s' }}
        opacity="0.6"
      />

      {/* Outer ring 3 */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="rgba(16,185,129,0.1)"
        strokeWidth="0.8"
        style={{ animation: 'radar-expand1 2s ease-out infinite 1.2s' }}
        opacity="0.4"
      />

      {/* Static inner rings */}
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="0.6" />
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="0.6" />

      {/* Center dot with glow */}
      <circle
        cx="12"
        cy="12"
        r="1.5"
        fill="#10b981"
        filter="url(#radar-glow)"
        style={{ animation: 'radar-dot-glow 1.8s ease-in-out infinite' }}
      />

      <style>{`
        @keyframes radar-expand1 {
          0% { r: 2; opacity: 0.8; }
          100% { r: 10.5; opacity: 0; }
        }
        @keyframes radar-dot-glow {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.5)); }
          50% { filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.9)); }
        }
      `}</style>
    </svg>
  )
}

/* ─── 3. BRAIN CIRCUIT ─── */
export function BrainCircuit({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      style={{ color }}
    >
      <defs>
        <linearGradient id="brain-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* Brain outline */}
      <path
        d="M8 6C6 6 5 8 5 10C5 11 5.5 12.5 6 13C6.5 13 7 14 7 15C7 16 7.5 17 8 17C8.5 17 9 16.5 9 16C9 16.5 10 17 11 17L13 17C14 17 15 16.5 15 16C15 16.5 15.5 17 16 17C16.5 17 17 16 17 15C17 14 17.5 13 18 13C18.5 12.5 19 11 19 10C19 8 18 6 16 6C15 6 14.5 6.5 14 7C13.5 6.5 12.5 6 12 6C11.5 6 10.5 6.5 10 7C9.5 6.5 9 6 8 6Z"
        stroke="url(#brain-grad)"
        strokeWidth="1.2"
        fill="none"
      />

      {/* Circuit connections - animated sequence */}
      <circle cx="7.5" cy="10" r="0.8" fill="#a78bfa" style={{ animation: 'brain-pulse 2s ease-in-out infinite 0s' }} />
      <line x1="7.5" y1="10" x2="9" y2="12" stroke="url(#brain-grad)" strokeWidth="0.8" style={{ animation: 'brain-line1 2s ease-in-out infinite 0s' }} strokeDasharray="2" strokeDashoffset="0" opacity="0.5" />

      <circle cx="9" cy="12" r="0.8" fill="#a78bfa" style={{ animation: 'brain-pulse 2s ease-in-out infinite 0.4s' }} />
      <line x1="9" y1="12" x2="12" y2="14" stroke="url(#brain-grad)" strokeWidth="0.8" style={{ animation: 'brain-line2 2s ease-in-out infinite 0.4s' }} strokeDasharray="2" strokeDashoffset="0" opacity="0.5" />

      <circle cx="12" cy="14" r="0.8" fill="#a78bfa" style={{ animation: 'brain-pulse 2s ease-in-out infinite 0.8s' }} />
      <line x1="12" y1="14" x2="15" y2="12" stroke="url(#brain-grad)" strokeWidth="0.8" style={{ animation: 'brain-line3 2s ease-in-out infinite 0.8s' }} strokeDasharray="2" strokeDashoffset="0" opacity="0.5" />

      <circle cx="15" cy="12" r="0.8" fill="#a78bfa" style={{ animation: 'brain-pulse 2s ease-in-out infinite 1.2s' }} />
      <line x1="15" y1="12" x2="16.5" y2="10" stroke="url(#brain-grad)" strokeWidth="0.8" style={{ animation: 'brain-line4 2s ease-in-out infinite 1.2s' }} strokeDasharray="2" strokeDashoffset="0" opacity="0.5" />

      <circle cx="16.5" cy="10" r="0.8" fill="#a78bfa" style={{ animation: 'brain-pulse 2s ease-in-out infinite 1.6s' }} />

      <style>{`
        @keyframes brain-pulse {
          0%, 100% { r: 0.8; opacity: 0.6; }
          50% { r: 1.2; opacity: 1; }
        }
        @keyframes brain-line1 {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes brain-line2 {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes brain-line3 {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes brain-line4 {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </svg>
  )
}

/* ─── 4. SHIELD CHECK ─── */
export function ShieldCheck({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      style={{ color }}
    >
      <defs>
        <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <filter id="shield-glow">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Shield background */}
      <path
        d="M12 2L3 6V12C3 17.5 12 22 12 22C12 22 21 17.5 21 12V6L12 2Z"
        fill="none"
        stroke="url(#shield-grad)"
        strokeWidth="1.2"
        filter="url(#shield-glow)"
        style={{ animation: 'shield-glow-anim 2.5s ease-in-out infinite' }}
      />

      {/* Checkmark path - draws itself */}
      <path
        d="M8.5 13L11 15.5L16 9"
        stroke="url(#shield-grad)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{
          animation: 'check-draw 2s ease-in-out infinite',
          strokeDasharray: '10',
          strokeDashoffset: '10',
        }}
      />

      <style>{`
        @keyframes shield-glow-anim {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(16, 185, 129, 0.4)); }
          50% { filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.7)); }
        }
        @keyframes check-draw {
          0% { stroke-dashoffset: 10; opacity: 0; }
          50% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>
    </svg>
  )
}

/* ─── 5. FIRE STREAK ─── */
export function FireStreak({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      style={{ color }}
    >
      <defs>
        <linearGradient id="fire-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id="fire-blur">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Flame 1 - main */}
      <path
        d="M12 2C12 2 8 8 8 12C8 15 9.5 17 12 17C14.5 17 16 15 16 12C16 8 12 2 12 2Z"
        fill="url(#fire-grad)"
        filter="url(#fire-blur)"
        style={{ animation: 'flame-flicker1 1.5s ease-in-out infinite' }}
      />

      {/* Flame 2 - left flicker */}
      <path
        d="M9.5 5C9.5 5 7 9 7 11.5C7 13 8 14 9.5 14C10.5 14 11 13 11 12C11 9 9.5 5 9.5 5Z"
        fill="url(#fire-grad)"
        filter="url(#fire-blur)"
        opacity="0.7"
        style={{ animation: 'flame-flicker2 1.8s ease-in-out infinite 0.2s' }}
      />

      {/* Flame 3 - right flicker */}
      <path
        d="M14.5 5C14.5 5 17 9 17 11.5C17 13 16 14 14.5 14C13.5 14 13 13 13 12C13 9 14.5 5 14.5 5Z"
        fill="url(#fire-grad)"
        filter="url(#fire-blur)"
        opacity="0.7"
        style={{ animation: 'flame-flicker3 1.7s ease-in-out infinite 0.1s' }}
      />

      {/* Glow effect */}
      <circle
        cx="12"
        cy="12"
        r="7"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="0.5"
        opacity="0.4"
        style={{ animation: 'fire-glow 1.5s ease-in-out infinite' }}
      />

      <style>{`
        @keyframes flame-flicker1 {
          0%, 100% { opacity: 1; }
          25% { opacity: 0.8; }
          50% { opacity: 1; }
          75% { opacity: 0.85; }
        }
        @keyframes flame-flicker2 {
          0%, 100% { opacity: 0.7; }
          30% { opacity: 0.4; }
          60% { opacity: 0.7; }
        }
        @keyframes flame-flicker3 {
          0%, 100% { opacity: 0.7; }
          35% { opacity: 0.5; }
          65% { opacity: 0.7; }
        }
        @keyframes fire-glow {
          0%, 100% { r: 7; opacity: 0.3; }
          50% { r: 8; opacity: 0.6; }
        }
      `}</style>
    </svg>
  )
}

/* ─── 6. LIGHTNING BOLT ─── */
export function LightningBolt({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      style={{ color }}
    >
      <defs>
        <linearGradient id="bolt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <filter id="bolt-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        fill="url(#bolt-grad)"
        filter="url(#bolt-glow)"
        style={{ animation: 'bolt-flicker 2s ease-in-out infinite' }}
      />

      {/* Secondary glow effect */}
      <path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="0.5"
        opacity="0.4"
        style={{ animation: 'bolt-ring 2.2s ease-in-out infinite' }}
      />

      <style>{`
        @keyframes bolt-flicker {
          0%, 100% { opacity: 1; filter: brightness(1); }
          25% { opacity: 0.9; filter: brightness(1.2); }
          50% { opacity: 0.85; filter: brightness(1.3); }
          75% { opacity: 0.95; filter: brightness(1.15); }
        }
        @keyframes bolt-ring {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </svg>
  )
}

/* ─── 7. TARGET LOCK ─── */
export function TargetLock({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      style={{ color }}
    >
      <defs>
        <linearGradient id="target-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
      </defs>

      {/* Outer rotating ring */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="url(#target-grad)"
        strokeWidth="0.8"
        style={{ animation: 'target-rotate 4s linear infinite' }}
      />

      {/* Middle static ring */}
      <circle cx="12" cy="12" r="7" fill="none" stroke="rgba(6,182,212,0.4)" strokeWidth="0.6" />

      {/* Inner static ring */}
      <circle cx="12" cy="12" r="4" fill="none" stroke="rgba(6,182,212,0.3)" strokeWidth="0.6" />

      {/* Center dot - pulsing */}
      <circle
        cx="12"
        cy="12"
        r="1.5"
        fill="url(#target-grad)"
        style={{ animation: 'target-pulse 1.5s ease-in-out infinite' }}
      />

      {/* Crosshair lines */}
      <line x1="12" y1="6" x2="12" y2="7" stroke="url(#target-grad)" strokeWidth="0.8" />
      <line x1="12" y1="17" x2="12" y2="18" stroke="url(#target-grad)" strokeWidth="0.8" />
      <line x1="6" y1="12" x2="7" y2="12" stroke="url(--target-grad)" strokeWidth="0.8" />
      <line x1="17" y1="12" x2="18" y2="12" stroke="url(#target-grad)" strokeWidth="0.8" />

      <style>{`
        @keyframes target-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes target-pulse {
          0%, 100% { r: 1.5; opacity: 1; }
          50% { r: 2; opacity: 0.7; }
        }
      `}</style>
    </svg>
  )
}

/* ─── 8. TROPHY SPARKLE ─── */
export function TrophySparkle({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      style={{ color }}
    >
      <defs>
        <linearGradient id="trophy-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* Trophy cup */}
      <path
        d="M7 4H17C17.5 4 18 4.5 18 5V7C18 10 15 11 15 11H9C9 11 6 10 6 7V5C6 4.5 6.5 4 7 4Z"
        fill="url(#trophy-grad)"
        opacity="0.9"
      />

      {/* Trophy handles */}
      <path d="M6 7C4 7 3 8.5 3 10C3 11 4 12 6 12" fill="none" stroke="url(#trophy-grad)" strokeWidth="1" />
      <path d="M18 7C20 7 21 8.5 21 10C21 11 20 12 18 12" fill="none" stroke="url(#trophy-grad)" strokeWidth="1" />

      {/* Trophy base */}
      <rect x="10" y="12" width="4" height="1" fill="url(#trophy-grad)" />
      <path d="M9 13H15V15C15 15.5 14.5 16 14 16H10C9.5 16 9 15.5 9 15V13Z" fill="url(#trophy-grad)" opacity="0.8" />

      {/* Sparkles - floating around */}
      <circle
        cx="5"
        cy="3"
        r="0.8"
        fill="#fbbf24"
        style={{ animation: 'sparkle-float 2s ease-in-out infinite' }}
      />
      <circle
        cx="19"
        cy="5"
        r="0.8"
        fill="#fbbf24"
        style={{ animation: 'sparkle-float 2s ease-in-out infinite 0.4s' }}
      />
      <circle
        cx="4"
        cy="11"
        r="0.8"
        fill="#fbbf24"
        style={{ animation: 'sparkle-float 2s ease-in-out infinite 0.8s' }}
      />
      <circle
        cx="20"
        cy="10"
        r="0.8"
        fill="#fbbf24"
        style={{ animation: 'sparkle-float 2s ease-in-out infinite 1.2s' }}
      />

      <style>{`
        @keyframes sparkle-float {
          0%, 100% { opacity: 0.3; transform: translate(0, 0); }
          50% { opacity: 1; transform: translate(2px, -3px); }
        }
      `}</style>
    </svg>
  )
}

/* ─── 9. SCROLL UNFURL ─── */
export function ScrollUnfurl({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      style={{ color }}
    >
      <defs>
        <linearGradient id="scroll-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>

      {/* Scroll roll - left */}
      <circle cx="4" cy="6" r="1.5" fill="url(#scroll-grad)" opacity="0.8" />

      {/* Scroll paper body */}
      <rect x="6" y="3" width="12" height="18" rx="1" fill="none" stroke="url(#scroll-grad)" strokeWidth="1.2" style={{ animation: 'scroll-unfurl 2.5s ease-in-out infinite' }} />

      {/* Scroll lines - animated appearance */}
      <line x1="8" y1="8" x2="16" y2="8" stroke="url(#scroll-grad)" strokeWidth="0.8" opacity="0.6" style={{ animation: 'line-appear 2.5s ease-in-out infinite 0s' }} />
      <line x1="8" y1="11" x2="16" y2="11" stroke="url(#scroll-grad)" strokeWidth="0.8" opacity="0.6" style={{ animation: 'line-appear 2.5s ease-in-out infinite 0.3s' }} />
      <line x1="8" y1="14" x2="14" y2="14" stroke="url(#scroll-grad)" strokeWidth="0.8" opacity="0.6" style={{ animation: 'line-appear 2.5s ease-in-out infinite 0.6s' }} />

      {/* Scroll roll - right */}
      <circle cx="20" cy="6" r="1.5" fill="url(#scroll-grad)" opacity="0.8" />

      <style>{`
        @keyframes scroll-unfurl {
          0%, 100% { transform: scaleX(0.9); }
          50% { transform: scaleX(1.05); }
        }
        @keyframes line-appear {
          0% { opacity: 0; }
          30% { opacity: 0.6; }
          70% { opacity: 0.6; }
          100% { opacity: 0; }
        }
      `}</style>
    </svg>
  )
}

/* ─── 10. GEMSTONE ─── */
export function GemStone({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      style={{ color }}
    >
      <defs>
        <linearGradient id="gem-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="gem-grad2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <filter id="gem-shine">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Gem top facet */}
      <path d="M12 2L16 8H8L12 2Z" fill="url(#gem-grad1)" filter="url(#gem-shine)" style={{ animation: 'gem-rotate 3s linear infinite' }} />

      {/* Gem middle facets */}
      <path d="M8 8L6 14H10L8 8Z" fill="url(#gem-grad2)" style={{ animation: 'gem-rotate 3s linear infinite' }} opacity="0.85" />
      <path d="M16 8L18 14H14L16 8Z" fill="url(#gem-grad1)" style={{ animation: 'gem-rotate 3s linear infinite' }} opacity="0.85" />

      {/* Gem bottom facet */}
      <path d="M10 14H14L12 22L10 14Z" fill="url(#gem-grad2)" style={{ animation: 'gem-rotate 3s linear infinite' }} opacity="0.9" />

      {/* Left facet */}
      <path d="M6 14L10 14L8 20L6 14Z" fill="url(#gem-grad1)" style={{ animation: 'gem-rotate 3s linear infinite' }} opacity="0.8" />

      {/* Right facet */}
      <path d="M18 14L14 14L16 20L18 14Z" fill="url(#gem-grad2)" style={{ animation: 'gem-rotate 3s linear infinite' }} opacity="0.8" />

      {/* Shine effect */}
      <path
        d="M12 2L14 8L12 6L10 8L12 2Z"
        fill="rgba(255,255,255,0.4)"
        style={{ animation: 'gem-shine-pulse 2s ease-in-out infinite' }}
      />

      <style>{`
        @keyframes gem-rotate {
          0% { transform: rotateX(0deg) rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }
        @keyframes gem-shine-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </svg>
  )
}
