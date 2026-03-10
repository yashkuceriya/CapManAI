'use client'

import { useState, useEffect } from 'react'
import { scenarios } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { useAchievements } from '@/lib/achievement-context'
import Link from 'next/link'
import {
  AlertTriangle,
  ChevronRight,
  Loader,
  ArrowLeft,
  CheckCircle,
  Circle,
  Crown,
  Zap,
  Trophy,
  Sparkles,
} from 'lucide-react'
import { stripWatermarks } from '@/lib/sanitize'
import { ScenarioCard } from '@/components/ScenarioCard'
import { SkeletonCard } from '@/components/Skeleton'
import { ResponseInput } from '@/components/ResponseInput'
import { ProbeChat } from '@/components/ProbeChat'
import { GradeDisplay } from '@/components/GradeDisplay'
import { XPAnimation } from '@/components/XPAnimation'
import { FlashCards } from '@/components/FlashCards'
import { ThemedLoader } from '@/components/ThemedLoader'
import {
  PulsingSword,
  ScrollUnfurl,
  BrainCircuit,
  ShieldCheck,
  RadarPulse,
  LightningBolt,
  TargetLock,
} from '@/components/AnimatedIcons'

/* ─── Level Up Celebration Modal ─── */
function LevelUpModal({
  level,
  levelName,
  onClose,
}: {
  level: number
  levelName: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      {/* Modal */}
      <div className="relative animate-scale-in text-center px-8 py-10 max-w-sm w-full mx-4">
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-3xl" style={{
          background: 'radial-gradient(circle at center, rgba(139,92,246,0.15), transparent 70%)',
        }} />
        <div className="relative">
          {/* Crown icon with glow */}
          <div className="mx-auto w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mb-4 animate-glow-pulse">
            <Crown className="w-10 h-10 text-purple-400" />
          </div>
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.25em] mb-2">Level Up!</p>
          <p className="text-5xl font-black text-white mb-1">{level}</p>
          <p className="text-lg font-bold text-gradient-gold mb-6">{levelName}</p>
          <button
            onClick={onClose}
            className="btn-primary px-8 py-3 text-base font-bold"
          >
            <Sparkles className="w-4 h-4 inline mr-2" />
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

type TrainState =
  | 'idle'
  | 'generating'
  | 'scenario_ready'
  | 'submitting'
  | 'probing'
  | 'curveball_injecting'
  | 'curveball_active'
  | 'grading'
  | 'graded'

interface ProbeMessage {
  role: 'ai' | 'student'
  content: string
}

/* ─── Step progress indicator ─── */
const steps = [
  { key: 'scenario', label: 'Mission Brief', icon: ScrollUnfurl },
  { key: 'analyze', label: 'Analyze', icon: BrainCircuit },
  { key: 'probe', label: 'Probe', icon: LightningBolt },
  { key: 'grade', label: 'Debrief', icon: ShieldCheck },
]

function getActiveStep(state: TrainState): number {
  if (state === 'idle' || state === 'generating') return 0
  if (state === 'scenario_ready' || state === 'submitting') return 1
  if (state === 'probing' || state === 'curveball_injecting' || state === 'curveball_active') return 2
  if (state === 'grading' || state === 'graded') return 3
  return 0
}

function StepProgress({ state }: { state: TrainState }) {
  const active = getActiveStep(state)

  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((step, idx) => {
        const isCompleted = idx < active
        const isCurrent = idx === active
        const Icon = isCompleted ? CheckCircle : isCurrent ? step.icon : Circle

        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 ${
              isCompleted ? 'text-emerald-400' :
              isCurrent ? 'text-white bg-gray-800/60' :
              'text-gray-600'
            }`}>
              <Icon className={`w-4 h-4 ${isCurrent ? 'text-emerald-400' : ''}`} />
              <span className="text-xs font-medium hidden sm:inline">{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className="step-connector mx-1" data-filled={isCompleted ? 'true' : 'false'}>
                <div className="step-connector-fill" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── AI Thinking Steps (animated progress during wait) ─── */

const gradingSteps = [
  'Reading your trade thesis and directional bias...',
  'Evaluating strike selection and spread structure...',
  'Analyzing risk management framework...',
  'Assessing market regime awareness...',
  'Checking reasoning quality and logic flow...',
  'Scoring CapMan methodology alignment...',
  'Running multi-dimensional rubric scoring...',
  'Computing XP rewards and level progress...',
  'Generating personalized feedback...',
  'Updating MTSS classification...',
]

/* Progress event from backend SSE */
interface ProgressEvent {
  step: string
  detail?: string
  symbol?: string
  company_name?: string
  regime?: string
  regime_display?: string
  objectives?: string[]
}

/* Map backend progress steps to user-facing labels */
function progressStepLabel(evt: ProgressEvent): string {
  switch (evt.step) {
    case 'symbol_selected':
      return `Selected ${evt.detail} — ${evt.regime_display} regime`
    case 'objectives_selected':
      return `Learning focus: ${evt.objectives?.join(', ')}`
    case 'fetching_data':
      return evt.detail || 'Fetching live market data...'
    case 'data_received':
      return `Market data received: ${evt.detail}`
    case 'generating_scenario':
      return evt.detail || 'AI crafting your scenario...'
    default:
      return evt.detail || 'Processing...'
  }
}

function LiveThinkingSteps({ events }: { events: ProgressEvent[] }) {
  return (
    <div className="w-full max-w-md mt-6 space-y-2">
      {events.map((evt, idx) => {
        const isLatest = idx === events.length - 1
        return (
          <div
            key={idx}
            className="flex items-center gap-3 text-sm animate-fade-in"
          >
            {!isLatest ? (
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              </div>
            )}
            <span className={`${
              !isLatest ? 'text-gray-600 line-through' : 'text-emerald-300 font-medium'
            } transition-colors duration-300`}>
              {progressStepLabel(evt)}
            </span>
          </div>
        )
      })}
      {events.length === 0 && (
        <div className="flex items-center gap-3 text-sm animate-fade-in">
          <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
          </div>
          <span className="text-emerald-300 font-medium">Initializing scenario engine...</span>
        </div>
      )}
    </div>
  )
}

/* Timer-based ThinkingSteps (still used for grading where we don't have progress events) */
function ThinkingSteps({ steps: thinkSteps, intervalMs = 2800 }: { steps: string[]; intervalMs?: number }) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    setCompletedSteps([])
    setCurrentStep(0)
  }, [thinkSteps])

  useEffect(() => {
    if (currentStep >= thinkSteps.length) return

    const timer = setTimeout(() => {
      setCompletedSteps(prev => [...prev, currentStep])
      setCurrentStep(prev => prev + 1)
    }, intervalMs)

    return () => clearTimeout(timer)
  }, [currentStep, thinkSteps.length, intervalMs])

  return (
    <div className="w-full max-w-sm mt-6 space-y-2">
      {thinkSteps.map((step, idx) => {
        const isCompleted = completedSteps.includes(idx)
        const isCurrent = idx === currentStep
        const isUpcoming = idx > currentStep

        if (isUpcoming && idx > currentStep + 1) return null

        return (
          <div
            key={idx}
            className={`flex items-center gap-3 text-sm transition-all duration-500 ${
              isUpcoming ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            }`}
            style={{ animationFillMode: 'both' }}
          >
            {isCompleted && (
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            )}
            {isCurrent && (
              <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              </div>
            )}
            <span className={`${
              isCompleted ? 'text-gray-600 line-through' :
              isCurrent ? 'text-emerald-300 font-medium' :
              'text-gray-600'
            } transition-colors duration-300`}>
              {step}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function TrainPage() {
  const { refreshUser } = useAuth()
  const { showAchievement } = useAchievements()
  const [state, setState] = useState<TrainState>('idle')
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [scenarioData, setScenarioData] = useState<any>(null)
  const [streamingText, setStreamingText] = useState('')
  const [probeMessages, setProbeMessages] = useState<ProbeMessage[]>([])
  const [curveballEligible, setCurveballEligible] = useState(false)
  const [curveballData, setCurveballData] = useState<any>(null)
  const [gradeData, setGradeData] = useState<any>(null)
  const [showXPAnimation, setShowXPAnimation] = useState(false)
  const [error, setError] = useState('')
  const [isErrorExiting, setIsErrorExiting] = useState(false)
  const [leveledUp, setLeveledUp] = useState(false)
  const [prevLevel, setPrevLevel] = useState<number | null>(null)
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([])

  const sessionId = scenarioData?.session_id

  const handleGenerateScenario = async () => {
    setError('')
    setStreamingText('')
    setProgressEvents([])
    setState('generating')

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const response = await fetch(`${apiBase}/api/scenarios/generate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ difficulty, market_regime: null, target_objectives: null }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let lineBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuffer += decoder.decode(value, { stream: true })

        // Process complete SSE lines
        const lines = lineBuffer.split('\n')
        lineBuffer = lines.pop() ?? ''   // keep last (possibly incomplete) line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') break

          try {
            const event = JSON.parse(payload)
            if (event.type === 'progress') {
              setProgressEvents(prev => [...prev, event as ProgressEvent])
            } else if (event.type === 'text_delta') {
              setStreamingText(prev => prev + event.text)
            } else if (event.type === 'scenario_complete') {
              setScenarioData(event.scenario)
              setState('scenario_ready')
            } else if (event.type === 'error') {
              setError(event.detail || 'Failed to generate scenario.')
              setState('idle')
            }
          } catch (parseErr) {
            console.warn('[CapMan] SSE JSON parse failed for line:', payload, parseErr)
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate scenario.')
      setState('idle')
    }
  }

  const handleSubmitResponse = async (responseText: string) => {
    if (!sessionId) {
      console.error('[CapMan] handleSubmitResponse: sessionId is null/undefined', { scenarioData })
      setError('Session not found. Please generate a new scenario.')
      return
    }
    setError('')
    setState('submitting')
    try {
      const data = await scenarios.submitResponse(sessionId, responseText)
      setCurveballEligible(data.curveball_eligible ?? false)
      if (data.probe?.probe_question) {
        setProbeMessages([
          { role: 'student', content: responseText },
          { role: 'ai', content: data.probe.probe_question },
        ])
        setState('probing')
      } else {
        await doGrade()
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to submit response.'
      console.error('[CapMan] Submit response error:', { status: err?.response?.status, detail, err })
      setError(detail)
      setState('scenario_ready')
    }
  }

  const handleAnswerProbe = async (answerText: string) => {
    if (!sessionId) {
      console.error('[CapMan] handleAnswerProbe: sessionId is null/undefined')
      setError('Session not found. Please generate a new scenario.')
      return
    }
    setError('')
    setProbeMessages(prev => [...prev, { role: 'student', content: answerText }])
    setState('submitting')
    try {
      const data = await scenarios.answerProbe(sessionId, answerText)
      setCurveballEligible(data.curveball_eligible ?? false)
      if (data.probe?.probe_question) {
        setProbeMessages(prev => [...prev, { role: 'ai', content: data.probe.probe_question }])
        setState('probing')
      } else {
        await doGrade()
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to process answer.'
      console.error('[CapMan] Answer probe error:', { status: err?.response?.status, detail, err })
      setError(detail)
      setState('probing')
    }
  }

  const handleInjectCurveball = async () => {
    if (!sessionId) {
      console.error('[CapMan] handleInjectCurveball: sessionId is null/undefined')
      setError('Session not found. Please generate a new scenario.')
      return
    }
    setError('')
    setState('curveball_injecting')
    try {
      const data = await scenarios.injectCurveball(sessionId)
      setCurveballData(data.curveball)
      setCurveballEligible(false)
      setProbeMessages(prev => [
        ...prev,
        { role: 'ai', content: `BREAKING: ${data.curveball.headline}\n\n${data.curveball.context}` },
        { role: 'ai', content: data.prompt },
      ])
      setState('curveball_active')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to inject curveball.'
      console.error('[CapMan] Curveball injection error:', { status: err?.response?.status, detail, err })
      setError(detail)
      setState('probing')
    }
  }

  const handleSubmitAdaptation = async (adaptationText: string) => {
    if (!sessionId) {
      console.error('[CapMan] handleSubmitAdaptation: sessionId is null/undefined')
      setError('Session not found. Please generate a new scenario.')
      return
    }
    setError('')
    setProbeMessages(prev => [...prev, { role: 'student', content: adaptationText }])
    setState('grading')
    try {
      await scenarios.submitAdaptation(sessionId, adaptationText)
      await doGrade()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to submit adaptation.'
      console.error('[CapMan] Submit adaptation error:', { status: err?.response?.status, detail, err })
      setError(detail)
      setState('curveball_active')
    }
  }

  const doGrade = async () => {
    if (!sessionId) {
      console.error('[CapMan] doGrade: sessionId is null/undefined')
      setError('Session not found. Please generate a new scenario.')
      return
    }
    setState('grading')
    try {
      const data = await scenarios.gradeSession(sessionId)
      console.log('[CapMan] Grade response:', JSON.stringify(data, null, 2))
      if (!data || !data.grade) {
        setError('Grading returned empty results. Please try again.')
        setState('idle')
        return
      }

      // Detect level up
      const didLevelUp = prevLevel !== null && data.level_info?.level > prevLevel
      if (didLevelUp) {
        setLeveledUp(true)
      }
      setPrevLevel(data.level_info?.level || prevLevel)

      setGradeData(data)
      setShowXPAnimation(true)
      setState('graded')

      // Fire achievement toasts after a short delay (let XP animation play first)
      setTimeout(() => {
        // Perfect score toast
        const totalScore = data.grade?.overall_score ?? data.grade?.total_score ?? 0
        if (totalScore >= 95) {
          showAchievement({
            title: 'Perfect Execution!',
            description: `Scored ${totalScore}% — flawless analysis`,
            icon: 'star',
            xp: data.xp_earned?.total,
          })
        }
        // Level up toast + modal
        if (didLevelUp) {
          setShowLevelUpModal(true)
          showAchievement({
            title: 'Level Up!',
            description: `Promoted to Level ${data.level_info.level} — ${data.level_info.level_name}`,
            icon: 'trophy',
          })
        }
      }, 1800)

      // Refresh user data to update navbar XP
      await refreshUser().catch(() => {})
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Unknown error'
      console.error('[CapMan] Grading error:', { status: err?.response?.status, detail, err })
      setError(`Failed to grade session: ${detail}`)
      setState('probing')
    }
  }

  const dismissError = () => {
    if (!error) return
    setIsErrorExiting(true)
    setTimeout(() => {
      setError('')
      setIsErrorExiting(false)
    }, 300)
  }

  // Auto-dismiss error after 8 seconds
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(dismissError, 15000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  const handleReset = () => {
    setState('idle')
    setScenarioData(null)
    setStreamingText('')
    setProgressEvents([])
    setProbeMessages([])
    setCurveballEligible(false)
    setCurveballData(null)
    setGradeData(null)
    setShowXPAnimation(false)
    setShowLevelUpModal(false)
    setLeveledUp(false)
    setError('')
    setIsErrorExiting(false)
  }

  const difficultyConfig = {
    beginner: { label: 'Beginner', desc: 'Single-leg strategies, basic Greeks', accent: '#10b981', bgAccent: 'rgba(16,185,129,0.06)', borderAccent: 'rgba(16,185,129,0.25)' },
    intermediate: { label: 'Intermediate', desc: 'Multi-leg spreads, vol analysis', accent: '#f59e0b', bgAccent: 'rgba(245,158,11,0.06)', borderAccent: 'rgba(245,158,11,0.25)' },
    advanced: { label: 'Advanced', desc: 'Complex structures, regime detection', accent: '#ef4444', bgAccent: 'rgba(239,68,68,0.06)', borderAccent: 'rgba(239,68,68,0.25)' },
  }

  return (
    <div className="max-w-4xl mx-auto">
      {showXPAnimation && gradeData?.xp_earned?.total && (
        <XPAnimation
          amount={gradeData.xp_earned.total}
          onComplete={() => setShowXPAnimation(false)}
        />
      )}

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
            <PulsingSword className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Training Mission</h1>
            <p className="text-gray-500 text-sm">
              {state === 'idle' && 'Select difficulty and begin your mission'}
              {state === 'generating' && 'Preparing your mission brief...'}
              {state === 'scenario_ready' && 'Analyze the market and form your thesis'}
              {state === 'submitting' && 'Processing your analysis...'}
              {state === 'probing' && 'Defend your thesis under questioning'}
              {state === 'curveball_injecting' && 'Breaking event incoming...'}
              {state === 'curveball_active' && 'Adapt your strategy to new intel!'}
              {state === 'grading' && 'Evaluating your performance...'}
              {state === 'graded' && 'Mission complete — review your debrief'}
            </p>
          </div>
        </div>
        {state !== 'idle' && state !== 'generating' && (
          <button onClick={handleReset} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            New
          </button>
        )}
      </div>

      {/* ─── Step Progress ─── */}
      {state !== 'idle' && (
        <div className="mb-6 animate-fade-in">
          <StepProgress state={state} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`mb-6 card border-red-500/20 bg-red-500/[0.03] flex items-start justify-between gap-3 ${
          isErrorExiting ? 'animate-error-exit' : 'animate-fade-in'
        }`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <button onClick={dismissError} className="text-red-400/60 hover:text-red-300 transition-colors flex-shrink-0">
            <span className="sr-only">Dismiss</span>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* ─── IDLE ─── */}
      {state === 'idle' && (
        <div className="space-y-6 stagger-children">
          <div className="card">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TargetLock className="w-3.5 h-3.5 text-emerald-400" />
              Select Difficulty
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {(['beginner', 'intermediate', 'advanced'] as const).map((level) => {
                const cfg = difficultyConfig[level]
                const selected = difficulty === level
                return (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className="card-stat cursor-pointer text-left transition-all duration-300"
                    style={{
                      borderColor: selected ? cfg.borderAccent : 'var(--cm-border)',
                      background: selected ? cfg.bgAccent : undefined,
                      boxShadow: selected ? `0 0 20px ${cfg.bgAccent}` : undefined,
                      transform: selected ? 'translateY(-2px)' : undefined,
                    }}
                  >
                    {/* Accent line */}
                    <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full transition-opacity duration-300"
                      style={{ background: cfg.accent, opacity: selected ? 0.5 : 0 }}
                    />
                    <h3 className={`font-black text-base mb-0.5 ${selected ? 'text-white' : 'text-gray-300'}`}>
                      {cfg.label}
                    </h3>
                    <p className="text-[11px] text-gray-500">{cfg.desc}</p>
                  </button>
                )
              })}
            </div>
            <button
              onClick={handleGenerateScenario}
              className="btn-primary btn-cta-pulse w-full flex items-center justify-center gap-2 text-base py-3.5"
            >
              <Zap className="w-5 h-5" />
              Generate Scenario
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Training flow info */}
          <div className="card bg-gray-900/50 border-gray-800/40">
            <h3 className="font-semibold text-gray-300 text-sm mb-3">How It Works</h3>
            <div className="space-y-2.5 text-sm text-gray-500">
              {[
                { n: '1', text: 'Receive a dynamic scenario with real market data', color: 'text-emerald-500' },
                { n: '2', text: 'Submit your analysis: thesis, strategy, risk management', color: 'text-emerald-500' },
                { n: '3', text: 'Answer Socratic probe questions from the AI', color: 'text-emerald-500' },
                { n: '4', text: 'Optionally face a mid-scenario curveball event', color: 'text-amber-500' },
                { n: '5', text: 'Get graded across 6+ dimensions with detailed feedback', color: 'text-emerald-500' },
              ].map((s) => (
                <div key={s.n} className="flex gap-3 items-start">
                  <span className={`${s.color} font-bold w-5 text-right flex-shrink-0 tabular-nums`}>{s.n}.</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Tips Flash Cards */}
          <FlashCards />
        </div>
      )}

      {/* ─── GENERATING ─── */}
      {state === 'generating' && (
        <div className="space-y-4 state-enter">
          {/* Live context banner — shows symbol/regime/objectives as they arrive */}
          {progressEvents.length > 0 && (() => {
            const symbolEvt = progressEvents.find(e => e.step === 'symbol_selected')
            const objEvt = progressEvents.find(e => e.step === 'objectives_selected')
            if (!symbolEvt) return null
            return (
              <div className="card card-live border-emerald-500/10 animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <div className="pulse-dot" />
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.15em]">
                    Live Scenario Generation
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 uppercase">Symbol</span>
                    <span className="text-sm font-bold text-white">{symbolEvt.symbol}</span>
                    <span className="text-xs text-gray-500">{symbolEvt.company_name}</span>
                  </div>
                  <span className="text-gray-700">|</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 uppercase">Regime</span>
                    <span className="text-sm font-bold text-cyan-400">{symbolEvt.regime_display}</span>
                  </div>
                </div>
                {objEvt && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {objEvt.objectives?.map((obj, i) => (
                      <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {obj}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Spinner + live thinking steps + skeleton preview while waiting for first tokens */}
          {!streamingText && (
            <>
              <div className="card flex flex-col items-center py-14">
                <div className="relative mb-5">
                  <ThemedLoader variant="candlestick" size="lg" />
                </div>
                <p className="text-lg font-semibold text-white mb-1">Preparing Mission Brief</p>
                <p className="text-gray-500 text-sm">
                  {progressEvents.length === 0
                    ? 'Initializing scenario engine...'
                    : 'Fetching live market intel and crafting your challenge'}
                </p>
                <LiveThinkingSteps events={progressEvents} />
              </div>
              <SkeletonCard />
            </>
          )}

          {/* Live streaming scenario text */}
          {streamingText && (
            <div className="card card-live animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Generating Mission Brief
                </span>
                {(() => {
                  const symbolEvt = progressEvents.find(e => e.step === 'symbol_selected')
                  return symbolEvt ? (
                    <span className="text-xs text-gray-500 ml-auto">
                      {symbolEvt.symbol} — {symbolEvt.regime_display}
                    </span>
                  ) : null
                })()}
              </div>
              <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                {streamingText}
                <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 align-middle" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── SCENARIO READY ─── */}
      {state === 'scenario_ready' && scenarioData && (
        <div className="space-y-6 state-enter">
          <ScenarioCard
            contextPrompt={scenarioData.context_prompt}
            marketData={scenarioData.market_data}
            difficulty={scenarioData.difficulty}
            objectives={scenarioData.learning_objectives}
            marketRegime={scenarioData.market_regime}
            companyName={scenarioData.company_name}
          />
          <ResponseInput
            onSubmit={handleSubmitResponse}
            placeholder="Analyze this scenario. What's your directional thesis? Which options strategy would you deploy? How would you size the position and manage risk?..."
            label="Your Analysis"
          />
        </div>
      )}

      {/* ─── SUBMITTING ─── */}
      {state === 'submitting' && (
        <div className="card flex flex-col items-center py-14 animate-scale-in">
          <div className="relative mb-5">
            <ThemedLoader variant="data-stream" size="md" />
          </div>
          <p className="text-lg font-semibold text-white mb-1">Processing Your Response</p>
          <p className="text-gray-500 text-sm">Preparing Socratic probe questions...</p>
          <ThinkingSteps steps={[
            'Parsing your trade thesis...',
            'Identifying knowledge gaps to probe...',
            'Generating Socratic follow-up questions...',
          ]} intervalMs={2000} />
        </div>
      )}

      {/* ─── PROBING / CURVEBALL ACTIVE ─── */}
      {(state === 'probing' || state === 'curveball_active') && scenarioData && (
        <div className="space-y-6 state-enter">
          <details className="card cursor-pointer group">
            <summary className="flex items-center justify-between text-white font-semibold text-sm">
              <span>Market Context (click to expand)</span>
              <ChevronRight className="w-4 h-4 text-gray-500 group-open:rotate-90 transition-transform" />
            </summary>
            <p className="text-gray-400 text-sm mt-3 whitespace-pre-line leading-relaxed">
              {stripWatermarks(scenarioData.context_prompt).substring(0, 600)}...
            </p>
          </details>

          {curveballData && (
            <div className="card border-red-500/20 bg-red-900/10 animate-fade-in curveball-flash relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-md bg-red-500/15 text-red-300 border border-red-500/20">
                      {curveballData.severity}
                    </span>
                    <span className="text-xs text-gray-500">{curveballData.type}</span>
                  </div>
                  <h3 className="font-bold text-red-300 text-base">{curveballData.headline}</h3>
                </div>
              </div>
            </div>
          )}

          <ProbeChat
            messages={probeMessages}
            onAnswer={state === 'curveball_active' ? handleSubmitAdaptation : handleAnswerProbe}
            currentQuestion={probeMessages[probeMessages.length - 1]?.role === 'ai' ? probeMessages[probeMessages.length - 1].content : ''}
          />

          {state === 'probing' && curveballEligible && (
            <button
              onClick={handleInjectCurveball}
              className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-amber-500/30 hover:border-amber-500/60 bg-amber-500/[0.03] hover:bg-amber-500/[0.06] text-amber-300 font-semibold flex items-center justify-center gap-2 transition-all duration-300"
            >
              <AlertTriangle className="w-5 h-5" />
              Inject Curveball (Optional — tests adaptability)
            </button>
          )}
        </div>
      )}

      {/* ─── CURVEBALL INJECTING ─── */}
      {state === 'curveball_injecting' && (
        <div className="card flex flex-col items-center justify-center py-16 border-amber-500/20 state-enter">
          <AlertTriangle className="w-12 h-12 text-amber-400 mb-4 animate-pulse" />
          <p className="text-white font-semibold text-lg">Breaking event incoming...</p>
          <div className="typing-indicator flex items-center gap-1 mt-3">
            <span /><span /><span />
          </div>
        </div>
      )}

      {/* ─── GRADING ─── */}
      {state === 'grading' && (
        <div className="card card-live flex flex-col items-center py-14 state-enter">
          <div className="relative mb-5">
            <ThemedLoader variant="pulse-ring" size="lg" />
          </div>
          <p className="text-lg font-semibold text-white mb-1">Compiling Your Debrief</p>
          <p className="text-gray-500 text-sm">AI is evaluating across 6+ dimensions using CapMan methodology</p>
          <ThinkingSteps steps={gradingSteps} intervalMs={2200} />
        </div>
      )}

      {/* ─── GRADED ─── */}
      {state === 'graded' && gradeData && (
        <div className="space-y-6 state-enter">
          {/* Level Up Modal */}
          {showLevelUpModal && gradeData?.level_info && (
            <LevelUpModal
              level={gradeData.level_info.level}
              levelName={gradeData.level_info.level_name}
              onClose={() => setShowLevelUpModal(false)}
            />
          )}

          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-emerald-400 animate-grow-in" />
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Mission Complete</p>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Debrief Report</h2>
          </div>

          <GradeDisplay
            grade={gradeData.grade}
            xpEarned={gradeData.xp_earned}
            levelInfo={gradeData.level_info}
            curveballResult={gradeData.curveball_result}
            replayReveal={gradeData.replay_reveal}
          />
          <div className="flex gap-3">
            <button onClick={handleReset} className="flex-1 btn-primary text-base py-3.5">
              Next Mission
            </button>
            <Link href="/replay" className="flex-1">
              <button className="w-full btn-secondary text-base py-3.5">Historical Replay</button>
            </Link>
            <Link href="/leaderboard" className="flex-1">
              <button className="w-full btn-secondary text-base py-3.5">Rankings</button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
