'use client'

import { useState, useEffect, useMemo } from 'react'
import { scenarios } from '@/lib/api'
import { Calendar, ArrowLeft, Zap, Flame, AlertTriangle, Trophy } from 'lucide-react'
import { RadarPulse } from '@/components/AnimatedIcons'
import { ThemedLoader } from '@/components/ThemedLoader'
import { SkeletonCard } from '@/components/Skeleton'
import { stripWatermarks } from '@/lib/sanitize'
import { ResponseInput } from '@/components/ResponseInput'
import { GradeDisplay } from '@/components/GradeDisplay'
import { XPAnimation } from '@/components/XPAnimation'

type ReplayState = 'event_select' | 'generating' | 'scenario_ready' | 'submitting' | 'grading' | 'graded'

export default function ReplayPage() {
  const [state, setState] = useState<ReplayState>('event_select')
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [difficulty, setDifficulty] = useState<'intermediate' | 'advanced'>('intermediate')
  const [scenarioData, setScenarioData] = useState<any>(null)
  const [gradeData, setGradeData] = useState<any>(null)
  const [revealData, setRevealData] = useState<any>(null)
  const [showXPAnimation, setShowXPAnimation] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await scenarios.listReplayEvents()
        setAllEvents(data.events || [])
      } catch (err) {
        setError('Failed to load replay events.')
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [])

  // Filter events client-side by selected difficulty
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
    if (!scenarioData?.session_id) return
    setError('')
    setState('submitting')
    try {
      await scenarios.submitResponse(scenarioData.session_id, responseText)
      setState('grading')
      const gradeResult = await scenarios.gradeSession(scenarioData.session_id)
      setGradeData(gradeResult)
      setShowXPAnimation(true)

      // Try to get reveal data
      try {
        const reveal = await scenarios.getReveal(scenarioData.session_id)
        setRevealData(reveal)
      } catch {
        if (gradeResult.replay_reveal) {
          setRevealData(gradeResult.replay_reveal)
        }
      }

      setState('graded')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to process.')
      setState('scenario_ready')
    }
  }

  const handleReset = () => {
    setState('event_select')
    setSelectedEvent(null)
    setScenarioData(null)
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

      <div className="hero-mesh rounded-2xl p-8 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10">
              <RadarPulse size={40} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white">Historical Replay</h1>
              <p className="text-gray-300 text-sm mt-1">Trade real market events — discover the truth after grading</p>
            </div>
          </div>
          {state !== 'event_select' && (
            <button onClick={handleReset} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 card border-l-4 border-red-500 bg-red-500/5">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* EVENT SELECT */}
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

      {/* GENERATING */}
      {state === 'generating' && (
        <div className="card flex flex-col items-center justify-center py-16 state-enter">
          <ThemedLoader variant="candlestick" size="lg" color="#fbbf24" text="Generating replay scenario..." />
          <p className="text-gray-400 text-sm mt-4">Fetching historical data for {selectedEvent?.name || 'this event'}</p>
        </div>
      )}

      {/* SCENARIO READY */}
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

      {/* SUBMITTING / GRADING */}
      {(state === 'submitting' || state === 'grading') && (
        <div className="card flex flex-col items-center justify-center py-16 state-enter">
          <ThemedLoader
            variant="candlestick"
            size="lg"
            color="#fbbf24"
            text={state === 'submitting' ? 'Submitting response...' : 'AI is grading your session...'}
          />
        </div>
      )}

      {/* GRADED + REVEAL */}
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
