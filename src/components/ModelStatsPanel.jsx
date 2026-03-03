// src/components/ModelStatsPanel.jsx
import React from 'react'

function StatBlock({ label, value, sub, colorClass = 'text-white', wide = false }) {
  return (
    <div className={`p-4 border border-brand-midgray bg-brand-gray rounded-sm ${wide ? 'col-span-2' : ''}`}>
      <p className="label mb-1">{label}</p>
      <p className={`font-display text-xl tabular-nums ${colorClass}`}>
        {value ?? <span className="text-gray-700">—</span>}
      </p>
      {sub && <p className="font-display text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

// Mini bar for ML weight display
function WeightBar({ sport, weight, dot }) {
  const pct = Math.round((weight ?? 0) * 100)
  const barColor = pct >= 60 ? 'bg-brand-green' : pct >= 30 ? 'bg-yellow-500' : 'bg-brand-midgray'
  const textColor = pct >= 60 ? 'text-brand-greenlight' : pct >= 30 ? 'text-yellow-400' : 'text-gray-600'
  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="font-display text-xs text-gray-500 w-20 capitalize">{sport}</span>
      <div className="flex-1 h-1.5 bg-brand-darkgray rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`font-display text-xs tabular-nums w-10 text-right ${textColor}`}>{pct}%</span>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="h-2 bg-brand-midgray rounded w-16 mb-3" />
          <div className="h-6 bg-brand-midgray rounded w-20" />
        </div>
      ))}
    </div>
  )
}

function fmt4dp(v) { return v != null ? v.toFixed(4) : null }
function fmtPct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : null }

const SPORT_DOTS = {
  soccer: 'bg-brand-green',
  basketball: 'bg-yellow-500',
  tennis: 'bg-blue-500',
}

export default function ModelStatsPanel({ summary, loading }) {
  if (loading) return <Skeleton />

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

  const m          = summary.performance_metrics || {}
  const mlWeights  = summary.ml_weights || {}
  const nSamples   = summary.n_training_samples || {}
  const hasMlData  = Object.keys(mlWeights).length > 0
  const totalSamples = Object.values(nSamples).reduce((s, v) => s + (v || 0), 0)

  const brierColor =
    m.brier_score == null      ? 'text-gray-500'
    : m.brier_score < 0.20    ? 'text-brand-greenlight'
    : m.brier_score < 0.25    ? 'text-yellow-500'
    : 'text-brand-redlight'

  const llColor =
    m.log_loss == null         ? 'text-gray-500'
    : m.log_loss < 0.55       ? 'text-brand-greenlight'
    : m.log_loss < 0.70       ? 'text-yellow-500'
    : 'text-brand-redlight'

  const accColor =
    m.accuracy == null         ? 'text-gray-500'
    : m.accuracy > 0.60       ? 'text-brand-greenlight'
    : m.accuracy > 0.50       ? 'text-yellow-500'
    : 'text-brand-redlight'

  const trainedSports = Object.entries(summary.is_trained || {})
    .filter(([, v]) => v).map(([k]) => k)
  const engineLabel = trainedSports.length > 0
    ? `ML: ${trainedSports.join(', ')}`
    : 'Prior model'

  // Overall ML weight = average across trained sports
  const avgMlWeight = hasMlData
    ? Object.values(mlWeights).reduce((s, v) => s + (v || 0), 0) / Object.values(mlWeights).length
    : null

  return (
    <div className="space-y-3">
      {/* Primary metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatBlock
          label="BRIER SCORE"
          value={fmt4dp(m.brier_score)}
          sub="↓ Better (0=perfect)"
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
          sub="Expected calib."
          colorClass={
            m.calibration_error != null && m.calibration_error < 0.05
              ? 'text-brand-greenlight' : 'text-gray-400'
          }
        />
        <StatBlock
          label="ACCURACY"
          value={fmtPct(m.accuracy)}
          sub="Binary classification"
          colorClass={accColor}
        />
        <StatBlock
          label="PREDICTIONS"
          value={(summary.total_predictions ?? 0).toLocaleString()}
          sub="All time"
        />
        <StatBlock
          label="RESOLVED"
          value={(summary.total_resolved ?? 0).toLocaleString()}
          sub={`v${summary.model_version || '3.0.0'}`}
          colorClass={trainedSports.length > 0 ? 'text-brand-greenlight' : 'text-yellow-500'}
        />
        <StatBlock
          label="ML WEIGHT"
          value={avgMlWeight != null ? fmtPct(avgMlWeight) : '—'}
          sub="Avg ML vs prior trust"
          colorClass={
            avgMlWeight == null      ? 'text-gray-500'
            : avgMlWeight > 0.5     ? 'text-brand-greenlight'
            : avgMlWeight > 0.2     ? 'text-yellow-500'
            : 'text-gray-500'
          }
        />
        <StatBlock
          label="TRAINING DATA"
          value={totalSamples > 0 ? totalSamples.toLocaleString() : '—'}
          sub={engineLabel}
          colorClass={totalSamples >= 30 ? 'text-brand-greenlight' : 'text-yellow-500'}
        />
      </div>

      {/* Per-sport ML weight breakdown */}
      {hasMlData && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="label">ML ENSEMBLE WEIGHT PER SPORT</p>
            <p className="font-display text-xs text-gray-600">
              higher = more ML, less prior
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(mlWeights).map(([sport, weight]) => (
              <div key={sport}>
                <WeightBar
                  sport={sport}
                  weight={weight}
                  dot={SPORT_DOTS[sport] || 'bg-gray-500'}
                />
                <div className="flex justify-between mt-1 px-5">
                  <span className="font-display text-xs text-gray-700">
                    {nSamples[sport] ?? 0} training samples
                  </span>
                  <span className="font-display text-xs text-gray-700">
                    {nSamples[sport] >= 100 ? 'isotonic' : nSamples[sport] >= 30 ? 'sigmoid' : 'prior'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {totalSamples < 30 && (
            <div className="mt-3 pt-3 border-t border-brand-midgray">
              <p className="font-display text-xs text-yellow-500">
                ⚠ Need at least 30 resolved predictions per sport to activate ML model.
                Currently in statistical prior mode.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}