'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { Mail, Lock, User, Sparkles, Eye, EyeOff, ChevronRight } from 'lucide-react'
import { LightningBolt, PulsingSword, TargetLock, TrophySparkle, ScrollUnfurl } from '@/components/AnimatedIcons'

export default function LoginPage() {
  const { login, register } = useAuth()
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([])
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  // Generate floating particles on mount
  useEffect(() => {
    const generateParticles = () => {
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
      }))
      setParticles(newParticles)
    }
    generateParticles()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        if (!formData.username || !formData.password) {
          setError('Please enter username and password')
          setLoading(false)
          return
        }
        await login(formData.username, formData.password)
      } else {
        if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
          setError('Please fill in all fields')
          setLoading(false)
          return
        }
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match')
          setLoading(false)
          return
        }
        if (formData.password.length < 8) {
          setError('Password must be at least 8 characters')
          setLoading(false)
          return
        }
        await register(formData.username, formData.email, formData.password)
      }

      setFormData({ username: '', email: '', password: '', confirmPassword: '' })
      router.push('/')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(', '))
      } else {
        setError('Authentication failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleAuthMode = () => {
    setIsLogin(!isLogin)
    setError('')
    setFormData({ username: '', email: '', password: '', confirmPassword: '' })
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  const features = [
    { icon: PulsingSword, label: 'AI Scenarios', color: 'from-emerald-500 to-emerald-600' },
    { icon: TargetLock, label: 'Live Data', color: 'from-purple-500 to-purple-600' },
    { icon: TrophySparkle, label: 'Compete', color: 'from-amber-500 to-amber-600' },
    { icon: ScrollUnfurl, label: 'Learn', color: 'from-cyan-500 to-cyan-600' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Hero mesh background */}
      <div className="hero-mesh absolute inset-0 opacity-40" />

      {/* Grid background overlay */}
      <div className="grid-bg absolute inset-0 opacity-20" />

      {/* Floating orbs */}
      <div className="orb-emerald top-20 right-20 opacity-30 animate-float" style={{ animationDuration: '20s' }} />
      <div className="orb-purple -bottom-20 -left-20 opacity-20 animate-float" style={{ animationDuration: '25s', animationDelay: '5s' }} />
      <div className="orb-amber bottom-40 right-1/4 opacity-15 animate-float" style={{ animationDuration: '30s', animationDelay: '10s' }} />

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

      {/* Floating particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-1 h-1 bg-emerald-500/40 rounded-full animate-pulse"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}

      {/* Main container */}
      <div className="w-full max-w-2xl relative z-10">
        {/* Title section with gradient text */}
        <div className="flex flex-col items-center mb-12 animate-fade-in">
          <div className="relative mb-6">
            {/* Glowing logo box */}
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 to-purple-500/30 rounded-3xl blur-2xl animate-glow-pulse" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/40 animate-float">
                <LightningBolt size={48} className="text-white" />
              </div>
            </div>
          </div>

          {/* Title with animation */}
          <h1 className="font-black text-5xl md:text-6xl text-white tracking-tighter text-center mb-2">
            Cap<span className="text-gradient bg-gradient-to-r from-emerald-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">Man</span> AI
          </h1>

          {/* Typewriter-style subtitle */}
          <div className="relative">
            <p className="text-xl md:text-2xl text-emerald-400 font-bold tracking-wider text-center h-8 overflow-hidden">
              <span className="inline-block animate-typewriter" style={{ width: '100%' }}>
                MASTER THE OPTIONS MARKET<span className="animate-blink ml-1">|</span>
              </span>
            </p>
          </div>
          <p className="text-gray-500 text-sm mt-2 text-center">Enter The Arena and Compete</p>
        </div>

        {/* Main gaming card container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Auth Panel - Left/Center on smaller screens */}
          <div className="lg:col-span-2">
            <div className="glass relative border border-emerald-500/30 rounded-2xl p-8 shadow-2xl shadow-emerald-500/20 overflow-hidden backdrop-blur-xl">
              {/* Glowing border effect */}
              <div className="absolute inset-0 rounded-2xl border border-gradient-to-r from-emerald-500/50 via-purple-500/20 to-emerald-500/50 opacity-0 animate-glow-pulse" />

              {/* Accent line at top */}
              <div className="neon-line absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

              <div className="relative z-10">
                {/* Card title */}
                <h2 className="text-2xl font-black text-transparent bg-gradient-to-r from-emerald-400 to-purple-400 bg-clip-text mb-1 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-emerald-400" />
                  {isLogin ? 'ENTER THE ARENA' : 'JOIN THE ARENA'}
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  {isLogin ? 'Return as a challenger' : 'Begin your trading journey'}
                </p>

                {/* Error alert */}
                {error && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/40 rounded-xl backdrop-blur-sm animate-fade-in">
                    <p className="text-sm text-red-400 font-medium">{error}</p>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Username field */}
                  <div className="group">
                    <label className="block text-xs font-bold text-gray-400 group-focus-within:text-emerald-400 mb-2 uppercase tracking-wider transition-colors">Player Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/60 group-focus-within:text-emerald-400 transition-colors" />
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="Enter your username"
                        className="input-field pl-11 w-full bg-gray-900/40 border border-gray-700/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 rounded-lg py-3 transition-all duration-200"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Email field (register only) */}
                  {!isLogin && (
                    <div className="group animate-fade-in">
                      <label className="block text-xs font-bold text-gray-400 group-focus-within:text-emerald-400 mb-2 uppercase tracking-wider transition-colors">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/60 group-focus-within:text-emerald-400 transition-colors" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="Enter your email"
                          className="input-field pl-11 w-full bg-gray-900/40 border border-gray-700/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 rounded-lg py-3 transition-all duration-200"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  )}

                  {/* Password field */}
                  <div className="group">
                    <label className="block text-xs font-bold text-gray-400 group-focus-within:text-emerald-400 mb-2 uppercase tracking-wider transition-colors">Power Code</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/60 group-focus-within:text-emerald-400 transition-colors" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter your password"
                        className="input-field pl-11 pr-11 w-full bg-gray-900/40 border border-gray-700/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 rounded-lg py-3 transition-all duration-200"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-emerald-400 transition-colors"
                        disabled={loading}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm password field (register only) */}
                  {!isLogin && (
                    <div className="group animate-fade-in">
                      <label className="block text-xs font-bold text-gray-400 group-focus-within:text-emerald-400 mb-2 uppercase tracking-wider transition-colors">Confirm Code</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/60 group-focus-within:text-emerald-400 transition-colors" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          placeholder="Confirm your password"
                          className="input-field pl-11 pr-11 w-full bg-gray-900/40 border border-gray-700/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 rounded-lg py-3 transition-all duration-200"
                          disabled={loading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-emerald-400 transition-colors"
                          disabled={loading}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submit button with power-up charge animation */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-4 font-bold text-lg flex items-center justify-center gap-2 rounded-lg mt-6 relative group overflow-hidden transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                  >
                    {/* Energy bar fills left to right on hover */}
                    <div className="absolute inset-0 h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

                    <div className="relative flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <div className="w-5 h-5 rounded-full border-2 border-transparent border-t-emerald-300 border-r-emerald-300 animate-spin" />
                          <span>{isLogin ? 'ENTERING...' : 'REGISTERING...'}</span>
                        </>
                      ) : (
                        <>
                          <span>{isLogin ? 'ENTER ARENA' : 'CREATE ACCOUNT'}</span>
                          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </div>
                  </button>
                </form>

                {/* Mode toggle - smooth expand/collapse transition */}
                <div className="mt-6 pt-6 border-t border-gray-700/40 text-center animate-fade-in">
                  <p className="text-xs text-gray-500 mb-3 uppercase tracking-widest">
                    {isLogin ? 'NEW CHALLENGER?' : 'RETURNING PLAYER?'}
                  </p>
                  <button
                    onClick={toggleAuthMode}
                    disabled={loading}
                    className="relative group text-emerald-400 hover:text-emerald-300 font-bold text-sm transition-all disabled:opacity-50"
                  >
                    <span className="relative inline-block transform transition-all duration-300">
                      {isLogin ? 'CREATE ACCOUNT' : 'SIGN IN'}
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-emerald-400 to-purple-400 group-hover:w-full transition-all duration-300" />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Features showcase - Right column */}
          <div className="hidden lg:flex flex-col gap-4">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.label}
                  className="card-stat group relative overflow-hidden border border-gray-700/40 rounded-xl p-5 hover:border-emerald-500/40 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/20 cursor-pointer"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10 flex flex-col items-center text-center gap-3">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg shadow-opacity-50 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">
                      {feature.label}
                    </span>
                  </div>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-5`} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Mobile features grid */}
        <div className="lg:hidden grid grid-cols-4 gap-3 mt-8 animate-fade-in">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.label}
                className="card-stat group relative overflow-hidden border border-gray-700/40 rounded-lg p-3 hover:border-emerald-500/40 transition-all"
              >
                <div className={`w-10 h-10 rounded-md bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg mx-auto mb-2`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-bold text-gray-400 text-center block group-hover:text-emerald-400 transition-colors">
                  {feature.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes typewriter {
          0% {
            width: 0;
          }
          100% {
            width: 100%;
          }
        }

        @keyframes blink {
          0%, 49% {
            opacity: 1;
          }
          50%, 100% {
            opacity: 0;
          }
        }

        .animate-typewriter {
          animation: typewriter 3.5s steps(35, end) forwards;
        }

        .animate-blink {
          animation: blink 0.8s infinite;
        }
      `}</style>
    </div>
  )
}
