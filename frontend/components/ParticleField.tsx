'use client'

import { useEffect, useRef, useCallback } from 'react'

export interface ParticleFieldProps {
  density?: number
  speed?: number
  color?: string
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  opacity: number
  size: number
  color: string
  age: number
}

const colorPalette = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#8b5cf6', // purple
]

/**
 * ParticleField Component
 * Renders subtle animated particles on canvas that drift upward with ambient motion
 * - 30-50 particles with slow upward drift
 * - Random horizontal movement
 * - Fade in at bottom, fade out at top
 * - Very low opacity (0.03-0.08) for ambient effect
 * - Respects reduced-motion preferences
 * - Auto-resizes on window resize
 */
export function ParticleField({
  density = 40,
  speed = 0.5,
  color,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(Date.now())
  const prefersReducedMotionRef = useRef(false)

  // Initialize particles
  const initializeParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = []

    for (let i = 0; i < density; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * speed * 0.3, // horizontal drift
        vy: -speed * (0.3 + Math.random() * 0.4), // upward motion
        opacity: 0.03 + Math.random() * 0.05,
        size: 1 + Math.random() * 2,
        color: color || colorPalette[Math.floor(Math.random() * colorPalette.length)],
        age: Math.random() * 100,
      })
    }

    particlesRef.current = particles
  }, [density, speed, color])

  // Animation loop
  const animate = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const now = Date.now()
    const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.016) // cap at 60fps
    lastTimeRef.current = now

    // Clear canvas
    ctx.fillStyle = 'rgba(5, 10, 24, 0)' // transparent
    ctx.clearRect(0, 0, width, height)

    // Update and draw particles
    for (const particle of particlesRef.current) {
      // Update position
      particle.x += particle.vx
      particle.y += particle.vy
      particle.age += deltaTime

      // Fade in at bottom (first 20% of height)
      let fadeIn = 1
      if (particle.y > height * 0.8) {
        fadeIn = 1 - (particle.y - height * 0.8) / (height * 0.2)
      }

      // Fade out at top (last 20% of height)
      let fadeOut = 1
      if (particle.y < height * 0.2) {
        fadeOut = particle.y / (height * 0.2)
      }

      // Calculate opacity with fade in/out
      const opacity = particle.opacity * fadeIn * fadeOut

      // Reset particle if it goes off-screen at top
      if (particle.y < -particle.size) {
        particle.y = height + particle.size
        particle.x = Math.random() * width
      }

      // Reset if it goes too far horizontally
      if (particle.x < -particle.size * 2) {
        particle.x = width + particle.size * 2
      } else if (particle.x > width + particle.size * 2) {
        particle.x = -particle.size * 2
      }

      // Draw particle with glow
      ctx.fillStyle = particle.color
      ctx.globalAlpha = opacity * 0.6
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      ctx.fill()

      // Add subtle glow
      ctx.fillStyle = particle.color
      ctx.globalAlpha = opacity * 0.2
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1
  }, [])

  // Main animation function
  const animationLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { width, height } = canvas
    animate(width, height)
    animationRef.current = requestAnimationFrame(animationLoop)
  }, [animate])

  // Setup and cleanup
  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    prefersReducedMotionRef.current = prefersReducedMotion

    if (prefersReducedMotion) {
      // Don't animate if reduced motion is preferred
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    // Set canvas size to match window
    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      // Reinitialize particles on resize
      initializeParticles(canvas.width, canvas.height)
    }

    updateCanvasSize()

    // Initial particle setup
    initializeParticles(canvas.width, canvas.height)

    // Start animation
    animationRef.current = requestAnimationFrame(animationLoop)

    // Handle window resize
    const handleResize = () => {
      updateCanvasSize()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [initializeParticles, animationLoop])

  // If reduced motion is preferred, don't render
  if (prefersReducedMotionRef.current) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        background: 'transparent',
      }}
    />
  )
}
