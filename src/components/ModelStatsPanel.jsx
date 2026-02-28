// src/components/ModelStatsPanel.jsx
import React from 'react'

function StatBlock({ label, value, sub, colorClass = 'text-white' }) {
  return (
    <div className="p-4 border border-brand-midgray bg-brand-gray rounded-sm">
      <p className="label mb-1">{label}</p>
      <p className={`font-display text-xl tabular-nums ${colorClass}`}>
        {value ?? <span className="text-gray-700">—</span>}
      </p>
      {sub && <p className="font-display text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

function skeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="h-2 bg-brand-midgray rounded w-16 mb-3" />
          <div className="h-6 bg-brand-midgray rounded w-20" />
        </div>
      ))}
    </div>
  )
}

/**
 * Formats a 0-1 metric value as a readable string.
 * e.g. brier_score=0.1834 → "0.1834"  (lower is better, keep 4dp)
 *      accuracy=0.623     → "62.3%"
 *      calibration=0.042  → "4.2%"
 */
function fmt4dp(v) {
  return v != null ? v.toFixed(4) : null
}
function fmtPct(v) {
  return v != null ? `${(v * 100).toFixed(1)}%` : null
}

export default function ModelStatsPanel({ summary, loading }) {
  if (loading) return skeleton()

  if (!summary) {
    return (
      <div className="card p-6 text-center">
        <p className="font-display text-gray-600 text-sm">NO METRICS AVAILABLE YET</p>
        <p className="font-body text-xs text-gray-700 mt-2">
          Submit actual results to begin model evaluation
        </p>
      </div>
    )
  }

  const m = summary.performance_metrics || {}

  // Brier score: 0 = perfect, 0.25 = baseline (random), lower is better
  const brierColor =
    m.brier_score == null ? 'text-gray-500'
    : m.brier_score < 0.20 ? 'text-brand-greenlight'
    : m.brier_score < 0.25 ? 'text-yellow-500'
    : 'text-brand-redlight'

  // Log loss: lower is better; Brier range is [0, 1] but log_loss can be [0, ∞)
  const llColor =
    m.log_loss == null ? 'text-gray-500'
    : m.log_loss < 0.55 ? 'text-brand-greenlight'
    : m.log_loss < 0.70 ? 'text-yellow-500'
    : 'text-brand-redlight'

  const accColor =
    m.accuracy == null ? 'text-gray-500'
    : m.accuracy > 0.60 ? 'text-brand-greenlight'
    : m.accuracy > 0.50 ? 'text-yellow-500'
    : 'text-brand-redlight'

  const resolvedCount = summary.total_resolved ?? 0
  const trainedColor = summary.is_trained ? 'text-brand-greenlight' : 'text-yellow-500'
  const trainedLabel = summary.is_trained ? 'ML model' : 'Prior model'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <StatBlock
        label="BRIER SCORE"
        value={fmt4dp(m.brier_score)}
        sub="↓ Better (0 = perfect)"
        colorClass={brierColor}
      />
      <StatBlock
        label="LOG LOSS"
        value={fmt4dp(m.log_loss)}
        sub="↓ Better"
        colorClass={llColor}
      />
      <StatBlock
        label="CALIB. ERROR"
        value={fmtPct(m.calibration_error)}
        sub="Expected calibration"
        colorClass={m.calibration_error != null && m.calibration_error < 0.05 ? 'text-brand-greenlight' : 'text-gray-400'}
      />
      <StatBlock
        label="ACCURACY"
        value={fmtPct(m.accuracy)}
        sub="Binary classification"
        colorClass={accColor}
      />
      <StatBlock
        label="PREDICTIONS"
        value={summary.total_predictions ?? 0}
        sub="All time"
      />
      <StatBlock
        label="RESOLVED"
        value={resolvedCount}
        sub={`${trainedLabel} · v${summary.model_version || '1.0.0'}`}
        colorClass={trainedColor}
      />
    </div>
  )
}