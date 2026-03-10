'use client'

import { AlertCircle } from 'lucide-react'

interface HeatmapEntry {
  objective_id: string
  avg_mastery: number
  min_mastery: number
  max_mastery: number
  student_count: number
  at_risk_count: number
}

interface MTSSHeatmapProps {
  data: HeatmapEntry[]
}

export function MTSSHeatmap({ data }: MTSSHeatmapProps) {
  if (data.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-12 text-gray-400">
        <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No objective data available yet</p>
      </div>
    )
  }

  const getMasteryColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500'
    if (score >= 60) return 'bg-emerald-500/60'
    if (score >= 40) return 'bg-amber-500'
    if (score >= 20) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getMasteryTextColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400'
    if (score >= 60) return 'text-emerald-300'
    if (score >= 40) return 'text-amber-400'
    return 'text-red-400'
  }

  // Sort by avg_mastery ascending so worst objectives are at top
  const sorted = [...data].sort((a, b) => a.avg_mastery - b.avg_mastery)

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-800">
            <th className="py-2 text-left font-medium">Objective</th>
            <th className="py-2 text-right font-medium">Avg Mastery</th>
            <th className="py-2 text-center font-medium">Range</th>
            <th className="py-2 text-center font-medium">Students</th>
            <th className="py-2 text-center font-medium">At Risk</th>
            <th className="py-2 text-left font-medium w-32">Distribution</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((obj) => (
            <tr key={obj.objective_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-3 text-gray-300 font-medium">
                {obj.objective_id.replace(/_/g, ' ')}
              </td>
              <td className="py-3 text-right">
                <span className={`font-bold ${getMasteryTextColor(obj.avg_mastery)}`}>
                  {obj.avg_mastery.toFixed(1)}%
                </span>
              </td>
              <td className="py-3 text-center text-xs text-gray-500">
                {obj.min_mastery.toFixed(0)} – {obj.max_mastery.toFixed(0)}
              </td>
              <td className="py-3 text-center text-gray-400">{obj.student_count}</td>
              <td className="py-3 text-center">
                <span className={obj.at_risk_count > 0 ? 'text-red-400 font-bold' : 'text-gray-600'}>
                  {obj.at_risk_count}
                </span>
              </td>
              <td className="py-3">
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getMasteryColor(obj.avg_mastery)}`}
                    style={{ width: `${Math.min(obj.avg_mastery, 100)}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
