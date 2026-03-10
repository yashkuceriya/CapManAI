'use client'

import { useMemo } from 'react'

export interface LoaderProps {
  variant?: 'candlestick' | 'pulse-ring' | 'data-stream' | 'orbit'
  size?: 'sm' | 'md' | 'lg'
  text?: string
  color?: string
}

const sizeMap = {
  sm: { px: 32, scale: 0.75 },
  md: { px: 48, scale: 1 },
  lg: { px: 64, scale: 1.35 },
}

const colorPalette = {
  primary: '#10b981',     // emerald
  secondary: '#06b6d4',   // cyan
  accent: '#8b5cf6',      // purple
  warning: '#f59e0b',     // amber
}

/**
 * Candlestick Variant — Animated stock chart bars
 * Green candles rising, red candles falling, staggered timing
 */
function CandlestickLoader({ size = 'md', color }: { size?: 'sm' | 'md' | 'lg'; color?: string }) {
  const { px, scale } = sizeMap[size]
  const barWidth = px * 0.15
  const spacing = px * 0.1
  const baseColor = color || colorPalette.primary

  const bars = [
    { delay: 0, min: 20, max: 80, color: '#ef4444' },   // red going down
    { delay: 0.2, min: 30, max: 90, color: '#10b981' }, // green going up
    { delay: 0.4, min: 25, max: 85, color: '#ef4444' }, // red going down
    { delay: 0.6, min: 35, max: 95, color: '#10b981' }, // green going up
  ]

  const styles = `
    @keyframes candlestick-rise {
      0%, 100% { height: ${bars[0].min}%; }
      50% { height: ${bars[0].max}%; }
    }
    @keyframes candlestick-rise-green {
      0%, 100% { height: ${bars[1].min}%; }
      50% { height: ${bars[1].max}%; }
    }
    @keyframes candlestick-fall {
      0%, 100% { height: ${bars[2].min}%; }
      50% { height: ${bars[2].max}%; }
    }
    @keyframes candlestick-rise-2 {
      0%, 100% { height: ${bars[3].min}%; }
      50% { height: ${bars[3].max}%; }
    }
  `

  return (
    <>
      <style>{styles}</style>
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto"
      >
        {/* Animated bars */}
        {bars.map((bar, idx) => {
          const x = (barWidth + spacing) * idx + spacing
          const animationName = [
            'candlestick-fall',
            'candlestick-rise-green',
            'candlestick-rise',
            'candlestick-rise-2',
          ][idx]

          return (
            <rect
              key={idx}
              x={x}
              y={px * 0.1}
              width={barWidth}
              height={px * 0.8}
              fill={bar.color}
              rx={barWidth * 0.2}
              opacity="0.85"
              style={{
                transformOrigin: `${x + barWidth / 2}px ${px * 0.9}px`,
                animation: `${animationName} 1.2s ease-in-out infinite`,
                animationDelay: `${bar.delay}s`,
              }}
            />
          )
        })}
      </svg>
    </>
  )
}

/**
 * Pulse Ring Variant — Expanding concentric rings with glowing center
 * Like a sonar/radar effect
 */
function PulseRingLoader({ size = 'md', color }: { size?: 'sm' | 'md' | 'lg'; color?: string }) {
  const { px } = sizeMap[size]
  const baseColor = color || colorPalette.primary

  const rings = [
    { delay: 0, duration: 1.5 },
    { delay: 0.4, duration: 1.5 },
    { delay: 0.8, duration: 1.5 },
  ]

  const styles = `
    @keyframes pulse-ring-expand {
      0% {
        r: ${px * 0.1};
        opacity: 0.8;
      }
      100% {
        r: ${px * 0.45};
        opacity: 0;
      }
    }
    @keyframes center-glow {
      0%, 100% {
        r: ${px * 0.06};
        opacity: 1;
      }
      50% {
        r: ${px * 0.09};
        opacity: 0.7;
      }
    }
  `

  return (
    <>
      <style>{styles}</style>
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto"
      >
        {/* Center glowing dot */}
        <circle
          cx={px / 2}
          cy={px / 2}
          fill={baseColor}
          opacity="1"
          style={{
            animation: 'center-glow 1.5s ease-out infinite',
          }}
        />

        {/* Expanding rings */}
        {rings.map((ring, idx) => (
          <circle
            key={idx}
            cx={px / 2}
            cy={px / 2}
            fill="none"
            stroke={baseColor}
            strokeWidth={2}
            style={{
              animation: `pulse-ring-expand ${ring.duration}s ease-out infinite`,
              animationDelay: `${ring.delay}s`,
            }}
          />
        ))}
      </svg>
    </>
  )
}

/**
 * Data Stream Variant — Vertical lines of streaming data (Matrix-style, subtle)
 * 5-6 columns of small dots/dashes flowing downward
 */
function DataStreamLoader({ size = 'md', color }: { size?: 'sm' | 'md' | 'lg'; color?: string }) {
  const { px } = sizeMap[size]
  const baseColor = color || colorPalette.secondary

  const columns = 5
  const dotRadius = px * 0.03
  const columnWidth = px / columns

  const styles = `
    @keyframes data-flow {
      0% {
        opacity: 0;
        transform: translateY(${-px * 0.2}px);
      }
      10% {
        opacity: 1;
      }
      90% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translateY(${px * 1.1}px);
      }
    }
  `

  return (
    <>
      <style>{styles}</style>
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto"
      >
        {/* Data columns */}
        {Array.from({ length: columns }).map((_, colIdx) => {
          const dotsPerColumn = 6
          const duration = 1.2 + Math.random() * 0.3

          return Array.from({ length: dotsPerColumn }).map((_, dotIdx) => (
            <circle
              key={`${colIdx}-${dotIdx}`}
              cx={(colIdx + 0.5) * columnWidth}
              cy={px / 2}
              r={dotRadius}
              fill={baseColor}
              opacity="0.6"
              style={{
                animation: `data-flow ${duration}s linear infinite`,
                animationDelay: `${dotIdx * 0.15}s`,
              }}
            />
          ))
        })}
      </svg>
    </>
  )
}

/**
 * Orbit Variant — Electrons orbiting around center nucleus
 * 3 orbital paths at different speeds and radii
 */
function OrbitLoader({ size = 'md', color }: { size?: 'sm' | 'md' | 'lg'; color?: string }) {
  const { px } = sizeMap[size]
  const baseColor = color || colorPalette.accent

  const orbits = [
    { radius: px * 0.15, duration: 1.8, color: colorPalette.primary, delay: 0 },
    { radius: px * 0.25, duration: 2.4, color: colorPalette.secondary, delay: -0.5 },
    { radius: px * 0.35, duration: 3.2, color: colorPalette.warning, delay: -1 },
  ]

  const styles = `
    @keyframes orbit-spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
  `

  return (
    <>
      <style>{styles}</style>
      <svg
        width={px}
        height={px}
        viewBox={`0 0 ${px} ${px}`}
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto"
      >
        <g style={{ transformOrigin: `${px / 2}px ${px / 2}px` }}>
          {/* Orbital paths and dots */}
          {orbits.map((orbit, idx) => (
            <g
              key={idx}
              style={{
                animation: `orbit-spin ${orbit.duration}s linear infinite`,
                animationDelay: `${orbit.delay}s`,
                transformOrigin: `${px / 2}px ${px / 2}px`,
              }}
            >
              {/* Orbital ring (faint) */}
              <circle
                cx={px / 2}
                cy={px / 2}
                r={orbit.radius}
                fill="none"
                stroke={orbit.color}
                strokeWidth={1}
                opacity="0.2"
              />

              {/* Orbiting dot */}
              <circle
                cx={px / 2 + orbit.radius}
                cy={px / 2}
                r={px * 0.05}
                fill={orbit.color}
                opacity="0.9"
              />
            </g>
          ))}

          {/* Center nucleus */}
          <circle
            cx={px / 2}
            cy={px / 2}
            r={px * 0.08}
            fill={baseColor}
            opacity="0.95"
          />
        </g>
      </svg>
    </>
  )
}

/**
 * Main ThemedLoader Component
 * Exports all variants with optional text label and custom color
 */
export function ThemedLoader({
  variant = 'candlestick',
  size = 'md',
  text,
  color,
}: LoaderProps) {
  const LoaderComponent = useMemo(() => {
    switch (variant) {
      case 'pulse-ring':
        return <PulseRingLoader size={size} color={color} />
      case 'data-stream':
        return <DataStreamLoader size={size} color={color} />
      case 'orbit':
        return <OrbitLoader size={size} color={color} />
      case 'candlestick':
      default:
        return <CandlestickLoader size={size} color={color} />
    }
  }, [variant, size, color])

  return (
    <div className="flex flex-col items-center gap-4">
      {LoaderComponent}
      {text && <p className="text-sm text-gray-400 mt-2">{text}</p>}
    </div>
  )
}

// Export variants for convenience
export function CandlestickLoaderStandalone(props: Omit<LoaderProps, 'variant'>) {
  return <ThemedLoader {...props} variant="candlestick" />
}

export function PulseRingLoaderStandalone(props: Omit<LoaderProps, 'variant'>) {
  return <ThemedLoader {...props} variant="pulse-ring" />
}

export function DataStreamLoaderStandalone(props: Omit<LoaderProps, 'variant'>) {
  return <ThemedLoader {...props} variant="data-stream" />
}

export function OrbitLoaderStandalone(props: Omit<LoaderProps, 'variant'>) {
  return <ThemedLoader {...props} variant="orbit" />
}
