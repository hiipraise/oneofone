// src/pages/MetricsPage.jsx
import React from 'react'
import { useMetricsSummary, useMetricsHistory } from '../hooks/useData'
import ModelStatsPanel from '../components/ModelStatsPanel'
import PerformanceChart from '../charts/PerformanceChart'
import CalibrationChart from '../charts/CalibrationChart'
import { usePredictions, useResults } from '../hooks/useData'
import { triggerLearning } from '../services/api'
import { useState } from 'react'

export default function MetricsPage() {
  const { data: summary, loading: summaryLoading, refetch } = useMetricsSummary()
  const { data: history } = useMetricsHistory(60)
  const { data: predictions } = usePredictions(null, 200)
  const { data: results } = useResults(200)
  const [triggering, setTriggering] = useState(false)
  const [trigMsg, setTrigMsg] = useState(null)

  const handleTriggerLearning = async () => {
    setTriggering(true)
    setTrigMsg(null)
    try {
      await triggerLearning()
      setTrigMsg({ type: 'success', text: 'Learning update triggered successfully' })
      refetch()
    } catch (e) {
      setTrigMsg({ type: 'error', text: e.response?.data?.detail || 'Failed to trigger learning' })
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl text-white tracking-wide">MODEL METRICS</h1>
          <p className="font-body text-xs text-gray-600 mt-1">
            Brier Score, Log Loss, Calibration Error, Accuracy — all computed from resolved predictions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleTriggerLearning} disabled={triggering} className="btn-ghost">
            {triggering ? 'UPDATING...' : 'TRIGGER LEARNING'}
          </button>
        </div>
      </div>

      {trigMsg && (
        <div className={`mb-4 font-display text-xs px-4 py-3 rounded-sm ${trigMsg.type === 'success' ? 'text-brand-greenlight bg-brand-greendark border border-brand-green' : 'text-brand-redlight bg-brand-reddark border border-brand-red'}`}>
          {trigMsg.text}
        </div>
      )}

      <section className="mb-6">
        <p className="label mb-3">CURRENT PERFORMANCE</p>
        <ModelStatsPanel summary={summary} loading={summaryLoading} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
        <PerformanceChart metricsHistory={history} />
        <CalibrationChart predictions={predictions} resolvedPredictions={results} />
      </section>

      {/* Metrics history table */}
      <section>
        <p className="label mb-3">METRICS HISTORY</p>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-brand-midgray bg-brand-darkgray">
                <tr>
                  {['DATE', 'MODEL VERSION', 'BRIER SCORE', 'LOG LOSS', 'CALIB ERROR', 'ACCURACY', 'SAMPLES'].map(col => (
                    <th key={col} className="text-left label px-4 py-3">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!history.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center font-display text-gray-600 text-xs">
                      NO METRICS RECORDED YET — SUBMIT ACTUAL RESULTS TO BEGIN EVALUATION
                    </td>
                  </tr>
                ) : history.map((m, i) => {
                  const bColor = m.brier_score < 0.2 ? 'text-brand-greenlight' : m.brier_score < 0.25 ? 'text-yellow-500' : 'text-brand-redlight'
                  const aColor = m.accuracy > 0.6 ? 'text-brand-greenlight' : m.accuracy > 0.5 ? 'text-yellow-500' : 'text-brand-redlight'
                  return (
                    <tr key={i} className="border-b border-brand-midgray hover:bg-brand-gray transition-colors">
                      <td className="px-4 py-3 font-display text-xs text-gray-500">{new Date(m.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-display text-xs text-gray-400">v{m.model_version}</td>
                      <td className={`px-4 py-3 font-display text-xs ${bColor}`}>{m.brier_score?.toFixed(4)}</td>
                      <td className="px-4 py-3 font-display text-xs text-gray-400">{m.log_loss?.toFixed(4)}</td>
                      <td className="px-4 py-3 font-display text-xs text-gray-400">{m.calibration_error ? (m.calibration_error * 100).toFixed(2) + '%' : '-'}</td>
                      <td className={`px-4 py-3 font-display text-xs ${aColor}`}>{m.accuracy ? (m.accuracy * 100).toFixed(1) + '%' : '-'}</td>
                      <td className="px-4 py-3 font-display text-xs text-gray-600">{m.total_predictions || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
