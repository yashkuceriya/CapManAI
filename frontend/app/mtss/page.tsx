'use client'

import { useState, useEffect } from 'react'
import { mtss } from '@/lib/api'
import { AlertCircle, Users, X, Shield } from 'lucide-react'
import { MTSSHeatmap } from '@/components/MTSSHeatmap'

export default function MTSSPage() {
  const [overview, setOverview] = useState<any>(null)
  const [heatmapData, setHeatmapData] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewData, objectivesData, alertsData] = await Promise.all([
          mtss.getOverview(),
          mtss.getObjectives(),
          mtss.getAlerts(),
        ])
        setOverview(overviewData)
        setHeatmapData(objectivesData.heatmap || [])
        setAlerts(alertsData.alerts || [])
      } catch (err) {
        setError('Failed to load MTSS data.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSelectStudent = async (userId: string) => {
    try {
      const detail = await mtss.getStudent(userId)
      setSelectedStudent(detail)
    } catch (err) {
      console.error('Failed to load student:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="loader" />
      </div>
    )
  }

  const tierConfigs = [
    { key: 'tier1', label: 'Tier 1 — On Track', borderColor: 'border-emerald-500', textColor: 'text-emerald-400', icon: '🟢' },
    { key: 'tier2', label: 'Tier 2 — Targeted Support', borderColor: 'border-amber-500', textColor: 'text-amber-400', icon: '🟡' },
    { key: 'tier3', label: 'Tier 3 — Intensive Support', borderColor: 'border-red-500', textColor: 'text-red-400', icon: '🔴' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-blue-400" />
        <div>
          <h1 className="text-3xl font-bold text-white">MTSS Dashboard</h1>
          <p className="text-gray-400 text-sm">
            Multi-Tiered System of Supports — {overview?.total_students || 0} students
          </p>
        </div>
      </div>

      {error && (
        <div className="card border-l-4 border-red-500 bg-red-500/5">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Tier Overview */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tierConfigs.map(({ key, label, borderColor, textColor, icon }) => {
            const tierData = overview[key] || { students: [], count: 0 }
            return (
              <div key={key} className={`card border-l-4 ${borderColor}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{icon} {label}</p>
                    <h3 className="text-3xl font-bold text-white">{tierData.count}</h3>
                    <p className="text-xs text-gray-500">students</p>
                  </div>
                  <Users className="w-6 h-6 text-gray-600" />
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {tierData.students.map((s: any) => (
                    <button
                      key={s.user_id}
                      onClick={() => handleSelectStudent(s.user_id)}
                      className="w-full text-left px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 transition-colors text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 font-medium">{s.username}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{s.scenarios_completed} sess</span>
                          <span className={`font-bold ${textColor}`}>{s.overall_mastery}%</span>
                        </div>
                      </div>
                      {s.weakest_objective && (
                        <p className="text-gray-500 mt-0.5">Weak: {s.weakest_objective.replace(/_/g, ' ')}</p>
                      )}
                    </button>
                  ))}
                  {tierData.students.length === 0 && (
                    <p className="text-xs text-gray-600 px-2 py-1">No students in this tier</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            Tier Transition Alerts
          </h2>
          <div className="space-y-2">
            {alerts.slice(0, 10).map((alert, i) => (
              <div key={i} className="card-compact border-l-4 border-amber-500 bg-amber-500/5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-white font-semibold">
                      {alert.details?.username || alert.user_id}
                    </p>
                    <p className="text-xs text-gray-300 mt-1">
                      {alert.details?.old_tier} → {alert.details?.new_tier}
                      {alert.details?.reason && ` — ${alert.details.reason}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{alert.timestamp}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    alert.details?.severity === 'critical' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {alert.details?.severity || 'info'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      {heatmapData.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Objectives Mastery Heatmap</h2>
          <MTSSHeatmap data={heatmapData} />
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="card max-w-2xl w-full my-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedStudent.user?.username}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    selectedStudent.classification?.tier === 'tier1' ? 'bg-emerald-500/20 text-emerald-300' :
                    selectedStudent.classification?.tier === 'tier2' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-red-500/20 text-red-300'
                  }`}>
                    {selectedStudent.classification?.tier_label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {selectedStudent.user?.scenarios_completed} sessions
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                <p className="text-xs text-gray-400 mb-1">Level</p>
                <p className="text-xl font-bold text-white">{selectedStudent.user?.level}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                <p className="text-xs text-gray-400 mb-1">XP</p>
                <p className="text-xl font-bold text-emerald-400">{selectedStudent.user?.xp?.toLocaleString()}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 text-center">
                <p className="text-xs text-gray-400 mb-1">Streak</p>
                <p className="text-xl font-bold text-amber-400">{selectedStudent.user?.streak_days}d</p>
              </div>
            </div>

            {selectedStudent.classification?.reason && (
              <div className="card-compact border-l-4 border-blue-500 bg-blue-500/5 mb-4">
                <p className="text-xs text-gray-400 mb-1">Classification Reason</p>
                <p className="text-sm text-gray-300">{selectedStudent.classification.reason}</p>
              </div>
            )}

            {selectedStudent.recommended_objectives?.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-white mb-2 text-sm">Recommended Focus</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedStudent.recommended_objectives.map((obj: string, i: number) => (
                    <span key={i} className="px-2 py-1 rounded text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {obj.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedStudent.objective_progress?.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-white mb-3 text-sm">Objective Mastery</h4>
                <div className="space-y-2">
                  {selectedStudent.objective_progress.map((p: any) => (
                    <div key={p.objective_id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-300">{p.objective_id.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${p.trend === 'improving' ? 'text-green-400' : p.trend === 'declining' ? 'text-red-400' : 'text-gray-500'}`}>
                            {p.trend === 'improving' ? '↑' : p.trend === 'declining' ? '↓' : '→'}
                          </span>
                          <span className="text-xs font-bold text-white">{p.mastery_score?.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div
                          className={`h-full rounded-full ${p.mastery_score >= 80 ? 'bg-emerald-500' : p.mastery_score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(p.mastery_score || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedStudent.recent_sessions?.length > 0 && (
              <div>
                <h4 className="font-semibold text-white mb-2 text-sm">Recent Sessions</h4>
                <div className="space-y-1">
                  {selectedStudent.recent_sessions.slice(0, 5).map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-800 text-xs">
                      <span className="text-gray-400">{s.created_at?.substring(0, 10)}</span>
                      <span className={`font-bold ${(s.overall_score || 0) >= 80 ? 'text-emerald-400' : (s.overall_score || 0) >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                        {s.overall_score?.toFixed(0) || 'N/A'}
                      </span>
                      <span className="text-gray-500">+{s.xp_earned || 0} XP</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
