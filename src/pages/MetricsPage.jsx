// src/pages/MetricsPage.jsx
import React, { useState } from 'react'
import { useMetricsSummary, useMetricsHistory, useQuota } from '../hooks/useData'
import PerformanceChart from '../charts/PerformanceChart'
import CalibrationChart from '../charts/CalibrationChart'

const SPORTS = ['soccer', 'basketball', 'tennis']
const SPORT_DOTS = {
  soccer:     'bg-brand-green',
  basketball: 'bg-yellow-500',
  tennis:     'bg-blue-500',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v, digits = 4) {
  if (v == null) return '—'
  return Number(v).toFixed(digits)
}

function pctFmt(v) {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

// ── Quota panel (Serper.dev) ──────────────────────────────────────────────────
function QuotaPanel({ quota, loading }) {
  if (loading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="h-2 bg-brand-midgray rounded w-24 mb-4" />
        <div className="h-3 bg-brand-midgray rounded w-full mb-2" />
        <div className="h-3 bg-brand-midgray rounded w-3/4" />
      </div>
    )
  }

  if (!quota) {
    return (
      <div className="card p-5">
        <p className="label mb-2">SEARCH QUOTA — SERPER.DEV</p>
        <p className="font-display text-xs text-gray-600">Quota data unavailable</p>
      </div>
    )
  }

  const pct       = Math.round((quota.used / quota.budget) * 100)
  const remaining = quota.remaining ?? (quota.budget - quota.used)
  const barColor  =
    pct >= 90 ? 'bg-brand-red' :
    pct >= 70 ? 'bg-yellow-500' :
    'bg-brand-green'
  const statusColor =
    pct >= 90 ? 'text-brand-redlight' :
    pct >= 70 ? 'text-yellow-400' :
    'text-brand-greenlight'
  const statusLabel =
    pct >= 90 ? '⚠ CRITICAL' :
    pct >= 70 ? '▲ MODERATE' :
    '✓ HEALTHY'

  const predsRemaining = Math.floor(remaining / 3)

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="label mb-0.5">SEARCH QUOTA — SERPER.DEV</p>
          <p className="font-body text-xs text-gray-600">
            2,400 searches/month (free plan) · resets {quota.month ? `end of ${quota.month}` : 'monthly'}
          </p>
        </div>
        <span className={`font-display text-xs px-2 py-1 rounded-sm border ${
          pct >= 90
            ? 'border-brand-red text-brand-redlight bg-brand-reddark'
            : pct >= 70
            ? 'border-yellow-700 text-yellow-400 bg-yellow-900/30'
            : 'border-brand-green text-brand-greenlight bg-brand-greendark'
        }`}>
          {statusLabel}
        </span>
      </div>

      {/* Main bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-xs text-gray-500">Usage</span>
          <span className={`font-display text-2xl tabular-nums ${statusColor}`}>
            {quota.used}
            <span className="text-sm text-gray-600">/{quota.budget}</span>
          </span>
        </div>
        <div className="h-3 bg-brand-darkgray rounded-full overflow-hidden border border-brand-midgray">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="font-display text-xs text-gray-700">0</span>
          <span className="font-display text-xs text-gray-700">{quota.budget.toLocaleString()}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-brand-darkgray border border-brand-midgray rounded-sm p-3 text-center">
          <p className="label mb-1">USED</p>
          <p className={`font-display text-lg tabular-nums ${statusColor}`}>{quota.used}</p>
          <p className="font-display text-xs text-gray-700 mt-0.5">{pct}% of budget</p>
        </div>
        <div className="bg-brand-darkgray border border-brand-midgray rounded-sm p-3 text-center">
          <p className="label mb-1">REMAINING</p>
          <p className={`font-display text-lg tabular-nums ${statusColor}`}>{remaining.toLocaleString()}</p>
          <p className="font-display text-xs text-gray-700 mt-0.5">searches left</p>
        </div>
        <div className="bg-brand-darkgray border border-brand-midgray rounded-sm p-3 text-center">
          <p className="label mb-1">PREDICTIONS</p>
          <p className={`font-display text-lg tabular-nums ${
            predsRemaining > 200 ? 'text-brand-greenlight' : predsRemaining > 50 ? 'text-yellow-400' : 'text-brand-redlight'
          }`}>
            ~{predsRemaining.toLocaleString()}
          </p>
          <p className="font-display text-xs text-gray-700 mt-0.5">remaining (3 calls ea)</p>
        </div>
      </div>

      {/* DuckDuckGo fallback note */}
      <div className="mt-4 rounded-sm p-3 border border-brand-midgray bg-brand-darkgray">
        <p className="font-display text-xs text-gray-600">
          DuckDuckGo fallback activates automatically when budget is exhausted — predictions
          continue with slightly reduced context quality.
        </p>
      </div>

      {pct >= 70 && (
        <div className={`mt-3 rounded-sm p-3 border ${
          pct >= 90
            ? 'bg-brand-reddark border-brand-red'
            : 'bg-yellow-900/20 border-yellow-800'
        }`}>
          <p className={`font-display text-xs ${pct >= 90 ? 'text-brand-redlight' : 'text-yellow-400'}`}>
            {pct >= 90
              ? 'Serper.dev budget nearly exhausted. DuckDuckGo fallback is now active for all searches.'
              : 'Budget running low. RapidAPI structured data will reduce search consumption automatically.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Summary stat block ────────────────────────────────────────────────────────
function StatBlock({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="card p-4">
      <p className="label mb-1">{label}</p>
      <p className={`font-display text-2xl tabular-nums ${color}`}>{value ?? '—'}</p>
      {sub && <p className="font-display text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Per-sport model table ─────────────────────────────────────────────────────
function SportModelTable({ summary }) {
  if (!summary) return null

  const mlWeights = summary.ml_weights         ?? {}
  const nSamples  = summary.n_training_samples ?? {}
  const isTrained = summary.is_trained         ?? {}
  const perSport  = summary.per_sport_metrics  ?? {}

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-brand-midgray">
        <p className="label">PER-SPORT MODEL STATUS</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-brand-midgray bg-brand-darkgray">
            <tr>
              {['SPORT', 'STATUS', 'SAMPLES', 'ML WEIGHT', 'ACCURACY', 'BRIER', 'LOG LOSS'].map(h => (
                <th key={h} className="text-left label px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SPORTS.map(sport => {
              const trained   = isTrained[sport] ?? false
              const weight    = mlWeights[sport]  ?? 0
              const samples   = nSamples[sport]   ?? 0
              const sm        = perSport[sport]   ?? {}
              const accuracy  = sm.accuracy
              const brier     = sm.brier_score
              const logLoss   = sm.log_loss

              return (
                <tr key={sport} className="border-b border-brand-midgray hover:bg-brand-gray transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${SPORT_DOTS[sport]}`} />
                      <span className="font-display text-xs text-white capitalize">{sport}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-display text-xs px-2 py-0.5 rounded-sm ${
                      trained
                        ? 'text-brand-greenlight bg-brand-greendark'
                        : 'text-yellow-400 bg-yellow-900/20'
                    }`}>
                      {trained ? 'ML ACTIVE' : 'PRIOR'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-display text-xs tabular-nums ${
                      samples >= 100 ? 'text-brand-greenlight'
                      : samples >= 30  ? 'text-yellow-400'
                      : 'text-gray-600'
                    }`}>
                      {samples.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-brand-darkgray rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            weight >= 0.6 ? 'bg-brand-green'
                            : weight >= 0.3 ? 'bg-yellow-500'
                            : 'bg-brand-midgray'
                          }`}
                          style={{ width: `${Math.min(weight * 100, 100)}%` }}
                        />
                      </div>
                      <span className="font-display text-xs text-gray-500 tabular-nums w-8">
                        {Math.round(weight * 100)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-display text-xs tabular-nums ${
                      accuracy == null ? 'text-gray-600'
                      : accuracy > 0.6  ? 'text-brand-greenlight'
                      : accuracy > 0.5  ? 'text-yellow-400'
                      : 'text-brand-redlight'
                    }`}>
                      {pctFmt(accuracy)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-display text-xs tabular-nums ${
                      brier == null  ? 'text-gray-600'
                      : brier < 0.20  ? 'text-brand-greenlight'
                      : brier < 0.25  ? 'text-yellow-400'
                      : 'text-brand-redlight'
                    }`}>
                      {fmt(brier)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-display text-xs text-gray-500 tabular-nums">
                      {fmt(logLoss)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Metrics history table ─────────────────────────────────────────────────────
function MetricsHistoryTable({ history }) {
  if (!history.length) {
    return (
      <div className="card p-6 text-center">
        <p className="font-display text-gray-600 text-sm">NO METRICS HISTORY YET</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-brand-midgray">
        <p className="label">METRICS HISTORY</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-brand-midgray bg-brand-darkgray">
            <tr>
              {['DATE', 'BRIER', 'LOG LOSS', 'ACCURACY', 'PREDICTIONS', 'RESOLVED'].map(h => (
                <th key={h} className="text-left label px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().slice(0, 30).map((row, i) => (
              <tr key={i} className="border-b border-brand-midgray hover:bg-brand-gray transition-colors">
                <td className="px-4 py-3 font-display text-xs text-gray-500">
                  {row.date ? new Date(row.date).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-display text-xs tabular-nums ${
                    row.brier_score == null ? 'text-gray-600'
                    : row.brier_score < 0.20 ? 'text-brand-greenlight'
                    : row.brier_score < 0.25 ? 'text-yellow-400'
                    : 'text-brand-redlight'
                  }`}>
                    {fmt(row.brier_score)}
                  </span>
                </td>
                <td className="px-4 py-3 font-display text-xs text-gray-400 tabular-nums">
                  {fmt(row.log_loss)}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-display text-xs tabular-nums ${
                    row.accuracy == null ? 'text-gray-600'
                    : row.accuracy > 0.6  ? 'text-brand-greenlight'
                    : row.accuracy > 0.5  ? 'text-yellow-400'
                    : 'text-brand-redlight'
                  }`}>
                    {pctFmt(row.accuracy)}
                  </span>
                </td>
                <td className="px-4 py-3 font-display text-xs text-gray-500 tabular-nums">
                  {row.total_predictions ?? '—'}
                </td>
                <td className="px-4 py-3 font-display text-xs text-gray-500 tabular-nums">
                  {row.resolved_count ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MetricsPage() {
  const { data: summary, loading: summaryLoading } = useMetricsSummary()
  const { data: history, loading: historyLoading } = useMetricsHistory(30)
  const { data: quota,   loading: quotaLoading }   = useQuota()

  const perf = summary?.performance_metrics ?? {}

  return (
    <div className="animate-fade-in space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-display text-xl text-white tracking-wide">MODEL METRICS</h1>
        <p className="font-body text-xs text-gray-600 mt-1">
          Calibration quality, prediction accuracy, and search budget
        </p>
      </div>

      {/* Top summary stats */}
      <section>
        <p className="label mb-3">OVERALL PERFORMANCE</p>
        {summaryLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-2 bg-brand-midgray rounded w-20 mb-3" />
                <div className="h-7 bg-brand-midgray rounded w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatBlock
              label="BRIER SCORE"
              value={fmt(perf.brier_score)}
              sub="lower = better (0–1)"
              color={
                perf.brier_score == null ? 'text-gray-600'
                : perf.brier_score < 0.20 ? 'text-brand-greenlight'
                : perf.brier_score < 0.25 ? 'text-yellow-400'
                : 'text-brand-redlight'
              }
            />
            <StatBlock
              label="LOG LOSS"
              value={fmt(perf.log_loss)}
              sub="lower = better"
              color="text-white"
            />
            <StatBlock
              label="ACCURACY"
              value={pctFmt(perf.accuracy)}
              sub="resolved predictions"
              color={
                perf.accuracy == null ? 'text-gray-600'
                : perf.accuracy > 0.6  ? 'text-brand-greenlight'
                : perf.accuracy > 0.5  ? 'text-yellow-400'
                : 'text-brand-redlight'
              }
            />
            <StatBlock
              label="CALIBRATION"
              value={fmt(perf.calibration_error)}
              sub="expected calibration error"
              color={
                perf.calibration_error == null ? 'text-gray-600'
                : perf.calibration_error < 0.05 ? 'text-brand-greenlight'
                : perf.calibration_error < 0.10 ? 'text-yellow-400'
                : 'text-brand-redlight'
              }
            />
          </div>
        )}
      </section>

      {/* Second row stats */}
      {!summaryLoading && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatBlock
            label="TOTAL PREDICTIONS"
            value={(summary?.total_predictions ?? 0).toLocaleString()}
            sub="all time"
          />
          <StatBlock
            label="RESOLVED"
            value={(summary?.total_resolved ?? 0).toLocaleString()}
            sub="results submitted"
          />
          <StatBlock
            label="MODEL VERSION"
            value={`v${summary?.model_version ?? '3.0.0'}`}
            sub="current engine"
          />
          <StatBlock
            label="ENGINE MODE"
            value={Object.values(summary?.is_trained ?? {}).some(Boolean) ? 'ML ACTIVE' : 'PRIOR MODE'}
            sub="training status"
            color={Object.values(summary?.is_trained ?? {}).some(Boolean) ? 'text-brand-greenlight' : 'text-yellow-400'}
          />
        </section>
      )}

      {/* Charts */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <PerformanceChart metricsHistory={history} />
        <CalibrationChart predictions={[]} resolvedPredictions={[]} />
      </section>

      {/* Per-sport model table */}
      <section>
        {summaryLoading ? (
          <div className="card p-6 animate-pulse">
            <div className="h-2 bg-brand-midgray rounded w-32 mb-4" />
            <div className="flex flex-col gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 bg-brand-midgray rounded" />
              ))}
            </div>
          </div>
        ) : (
          <SportModelTable summary={summary} />
        )}
      </section>

      {/* Search quota */}
      <section>
        <p className="label mb-3">SEARCH BUDGET</p>
        <QuotaPanel quota={quota} loading={quotaLoading} />
      </section>

      {/* Metrics history table */}
      <section>
        <p className="label mb-3">METRICS HISTORY</p>
        {historyLoading ? (
          <div className="card p-6 animate-pulse">
            <div className="h-2 bg-brand-midgray rounded w-32 mb-4" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-brand-midgray rounded mb-2" />
            ))}
          </div>
        ) : (
          <MetricsHistoryTable history={history} />
        )}
      </section>
    </div>
  )
}