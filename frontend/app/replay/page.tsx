'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { scenarios } from '@/lib/api'
import {
  Calendar,
  ArrowLeft,
  Zap,
  Flame,
  AlertTriangle,
  Trophy,
  CheckCircle,
  Circle,
  ChevronRight,
} from 'lucide-react'
import { RadarPulse, ScrollUnfurl, BrainCircuit, LightningBolt, ShieldCheck } from '@/components/AnimatedIcons'
import { ThemedLoader } from '@/components/ThemedLoader'
import { SkeletonCard } from '@/components/Skeleton'
import { stripWatermarks } from '@/lib/sanitize'
import { ResponseInput } from '@/components/ResponseInput'
import { ProbeChat } from '@/components/ProbeChat'
import { GradeDisplay } from '@/components/GradeDisplay'
import { XPAnimation } from '@/components/XPAnimation'

type ReplayState =
  | 'event_select'
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

function getActiveStep(state: ReplayState): number {
  if (state === 'event_select' || state === 'generating') return 0
  if (state === 'scenario_ready' || state === 'submitting') return 1
  if (state === 'probing' || state === 'curveball_injecting' || state === 'curveball_active') return 2
  if (state === 'grading' || state === 'graded') return 3
  return 0
}

function StepProgress({ state }: { state: ReplayState }) {
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
              <Icon className={`w-4 h-4 ${isCurrent ? 'text-amber-400' : ''}`} />
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

/* ─── AI Thinking Steps (timer-based for non-SSE endpoints) ─── */
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
          >
            {isCompleted && (
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            )}
            {isCurrent && (
              <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              </div>
            )}
            <span className={`${
              isCompleted ? 'text-gray-600 line-through' :
              isCurrent ? 'text-amber-300 font-medium' :
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

const generatingSteps = [
  'Looking up historical event data...',
  'Pulling real price action from that period...',
  'Fetching options chain snapshots...',
  'Retrieving volatility surface data...',
  'Building scenario context without spoilers...',
  'AI crafting your mission brief...',
]

const gradingSteps = [
  'Reading your trade thesis and directional bias...',
  'Evaluating strike selection and spread structure...',
  'Analyzing risk management framework...',
  'Assessing market regime awareness...',
  'Checking reasoning quality and logic flow...',
  'Scoring CapMan methodology alignment...',
  'Running multi-dimensional rubric scoring...',
  'Computing XP rewards and level progress...',
  'Preparing the historical reveal...',
]

export default function ReplayPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, refreshUser } = useAuth()
  const [state, setState] = useState<ReplayState>('event_select')
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [difficulty, setDifficulty] = useState<'intermediate' | 'advanced'>('intermediate')
  const [scenarioData, setScenarioData] = useState<any>(null)
  const [probeMessages, setProbeMessages] = useState<ProbeMessage[]>([])
  const [curveballEligible, setCurveballEligible] = useState(false)
  const [curveballData, setCurveballData] = useState<any>(null)
  const [gradeData, setGradeData] = useState<any>(null)
  const [revealData, setRevealData] = useState<any>(null)
  const [showXPAnimation, setShowXPAnimation] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const sessionId = scenarioData?.session_id

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    const fetchEvents = async () => {
      try {
        const data = await scenarios.listReplayEvents()
        setAllEvents(data.events || [])
      } catch (err: any) {
        if (err?.response?.status === 401) return
        setError('Failed to load replay events.')
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [authLoading, isAuthenticated])

  const filteredEvents = useMemo(
    () => allEvents.filter((e) => e.difficulty === difficulty),
    [allEvents, difficulty]
  )

  const handleStartReplay = async (event: any) => {
    setError('')
    setSelectedEvent(event)
    setState('generating')
    try {
      const data = await scenarios.generateReplay(difficulty, event.event_id)
      setScenarioData(data)
      setState('scenario_ready')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to generate replay. Check that your API key is set and try again.')
      setState('event_select')
    }
  }

  const handleSubmitResponse = async (responseText: string) => {
    if (!sessionId) return
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
      setError(err?.response?.data?.detail || 'Failed to submit response.')
      setState('scenario_ready')
    }
  }

  const handleAnswerProbe = async (answerText: string) => {
    if (!sessionId) return
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
      setError(err?.response?.data?.detail || 'Failed to process answer.')
      setState('probing')
    }
  }

  const handleInjectCurveball = async () => {
    if (!sessionId) return
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
      setError(err?.response?.data?.detail || 'Failed to inject curveball.')
      setState('probing')
    }
  }

  const handleSubmitAdaptation = async (adaptationText: string) => {
    if (!sessionId) return
    setError('')
    setProbeMessages(prev => [...prev, { role: 'student', content: adaptationText }])
    setState('grading')
    try {
      await scenarios.submitAdaptation(sessionId, adaptationText)
      await doGrade()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to submit adaptation.')
      setState('curveball_active')
    }
  }

  const doGrade = async () => {
    if (!sessionId) return
    setState('grading')
    try {
      const gradeResult = await scenarios.gradeSession(sessionId)
      if (!gradeResult || !gradeResult.grade) {
        setError('Grading returned empty results. Please try again.')
        setState('probing')
        return
      }
      setGradeData(gradeResult)
      setShowXPAnimation(true)

      // Try to get reveal data
      try {
        const reveal = await scenarios.getReveal(sessionId)
        setRevealData(reveal)
      } catch {
        if (gradeResult.replay_reveal) {
          setRevealData(gradeResult.replay_reveal)
        }
      }

      setState('graded')
      await refreshUser().catch(() => {})
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to grade session.')
      setState('probing')
    }
  }

  const handleReset = () => {
    setState('event_select')
    setSelectedEvent(null)
    setScenarioData(null)
    setProbeMessages([])
    setCurveballEligible(false)
    setCurveballData(null)
    setGradeData(null)
    setRevealData(null)
    setShowXPAnimation(false)
    setError('')
  }

  const difficultyConfig = {
    intermediate: {
      label: 'Intermediate',
      desc: 'Major market events — vol spikes, crashes',
      icon: Zap,
      accent: '#f59e0b',
      bgAccent: 'rgba(245,158,11,0.06)',
      borderAccent: 'rgba(245,158,11,0.25)',
    },
    advanced: {
      label: 'Advanced',
      desc: 'Black swans — squeezes, systemic crises',
      icon: Flame,
      accent: '#ef4444',
      bgAccent: 'rgba(239,68,68,0.06)',
      borderAccent: 'rgba(239,68,68,0.25)',
    },
  }

  return (
    <div className="max-w-4xl mx-auto">
      {showXPAnimation && gradeData?.xp_earned?.total && (
        <XPAnimation amount={gradeData.xp_earned.total} onComplete={() => setShowXPAnimation(false)} />
      )}

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
            <RadarPulse size={22} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Historical Replay</h1>
            <p className="text-gray-500 text-sm">
              {state === 'event_select' && 'Trade real market events — discover the truth after grading'}
              {state === 'generating' && 'Reconstructing historical market conditions...'}
              {state === 'scenario_ready' && 'Analyze the scenario as if you were trading live'}
              {state === 'submitting' && 'Processing your analysis...'}
              {state === 'probing' && 'Defend your thesis under questioning'}
              {state === 'curveball_injecting' && 'Breaking event incoming...'}
              {state === 'curveball_active' && 'Adapt your strategy to new intel!'}
              {state === 'grading' && 'Evaluating your performance...'}
              {state === 'graded' && 'Replay complete — review your debrief'}
            </p>
          </div>
        </div>
        {state !== 'event_select' && state !== 'generating' && (
          <button onClick={handleReset} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
      </div>

      {/* ─── Step Progress ─── */}
      {state !== 'event_select' && (
        <div className="mb-6 animate-fade-in">
          <StepProgress state={state} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 card border-l-4 border-red-500 bg-red-500/5">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* ─── EVENT SELECT ─── */}
      {state === 'event_select' && (
        <div className="space-y-6">
          {loading ? (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <>
              {/* Difficulty selector */}
              <div className="card">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Select Difficulty</h2>
                <div className="grid grid-cols-2 gap-3">
                  {(['intermediate', 'advanced'] as const).map((lvl) => {
                    const cfg = difficultyConfig[lvl]
                    const selected = difficulty === lvl
                    const Icon = cfg.icon
                    const count = allEvents.filter((e) => e.difficulty === lvl).length
                    return (
                      <button
                        key={lvl}
                        onClick={() => setDifficulty(lvl)}
                        className="card-stat cursor-pointer text-left transition-all duration-300"
                        style={{
                          borderColor: selected ? cfg.borderAccent : 'var(--cm-border)',
                          background: selected ? cfg.bgAccent : undefined,
                          boxShadow: selected ? `0 0 20px ${cfg.bgAccent}` : undefined,
                          transform: selected ? 'translateY(-2px)' : undefined,
                        }}
                      >
                        <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full transition-opacity duration-300"
                          style={{ background: cfg.accent, opacity: selected ? 0.5 : 0 }}
                        />
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="w-4 h-4" style={{ color: cfg.accent }} />
                          <h3 className={`font-black text-base ${selected ? 'text-white' : 'text-gray-300'}`}>
                            {cfg.label}
                          </h3>
                        </div>
                        <p className="text-[11px] text-gray-500">{cfg.desc}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
                          style={{ background: `${cfg.accent}15`, color: cfg.accent }}>
                          {count} events
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                {filteredEvents.length} Historical Events
              </h2>

              {filteredEvents.length === 0 ? (
                <div className="card flex flex-col items-center py-12 text-gray-400 state-enter">
                  <div className="w-16 h-16 rounded-full bg-gray-800/60 flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="text-white font-semibold mb-1">No Events Available</p>
                  <p className="text-sm">Try switching to a different difficulty level</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-children">
                  {filteredEvents.map((event: any, idx: number) => (
                    <button
                      key={event.event_id}
                      onClick={() => handleStartReplay(event)}
                      className="card-glow group text-left"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-transparent to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />

                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-bold text-white group-hover:text-amber-300 transition-colors text-lg">
                            {event.name}
                          </h3>
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 group-hover:bg-amber-500/40 transition-colors flex-shrink-0 ml-2">
                            {event.symbol || event.primary_symbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="font-medium">{event.date}</span>
                          <span className="mx-1 text-gray-700">·</span>
                          <span className="capitalize" style={{ color: difficultyConfig[event.difficulty as keyof typeof difficultyConfig]?.accent || '#94a3b8' }}>
                            {event.difficulty}
                          </span>
                        </div>
                        {event.description && (
                          <p className="text-sm text-gray-400 line-clamp-2">{event.description}</p>
                        )}
                        {event.regime && (
                          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 font-bold uppercase tracking-wider">
                            {event.regime.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── GENERATING ─── */}
      {state === 'generating' && (
        <div className="card flex flex-col items-center justify-center py-14 state-enter">
          <div className="relative mb-5">
            <ThemedLoader variant="candlestick" size="lg" color="#fbbf24" />
          </div>
          <p className="text-lg font-semibold text-white mb-1">Reconstructing Historical Event</p>
          <p className="text-gray-500 text-sm">
            Pulling real market data for {selectedEvent?.name || 'this event'}
          </p>
          <ThinkingSteps steps={generatingSteps} intervalMs={2500} />
        </div>
      )}

      {/* ─── SCENARIO READY ─── */}
      {state === 'scenario_ready' && scenarioData && (
        <div className="space-y-6 state-enter">
          <div className="card-glow border-2 border-amber-500/40 bg-amber-500/5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Historical Replay</p>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">You don't know which event this is yet. Analyze the scenario and respond as if you were trading live.</p>
          </div>

          <div className="card-stat">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300">{scenarioData.market_regime?.replace(/_/g, ' ')}</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300">{scenarioData.difficulty}</span>
            </div>
            <p className="text-gray-200 whitespace-pre-line text-sm leading-relaxed">{stripWatermarks(scenarioData.context_prompt)}</p>
          </div>

          <ResponseInput
            onSubmit={handleSubmitResponse}
            placeholder="Analyze this historical scenario. What's your thesis, strategy, risk management plan?..."
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

      {/* ─── GRADED + REVEAL ─── */}
      {state === 'graded' && gradeData && (
        <div className="space-y-6 state-enter">
          <div className="text-center mb-2">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-amber-400 animate-grow-in" />
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">Replay Complete</p>
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Debrief Report</h2>
          </div>

          <GradeDisplay
            grade={gradeData.grade}
            xpEarned={gradeData.xp_earned}
            levelInfo={gradeData.level_info}
            curveballResult={gradeData.curveball_result}
            replayReveal={gradeData.replay_reveal || revealData}
          />

          <button onClick={handleReset} className="w-full btn-primary text-lg py-3">
            Try Another Event
          </button>
        </div>
      )}
    </div>
  )
}
