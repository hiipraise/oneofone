// src/charts/CalibrationChart.jsx
import React, { useMemo } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  ScatterController, Title, Tooltip, Legend,
} from 'chart.js'
import { Scatter } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ScatterController, Title, Tooltip, Legend)

function buildCalibrationBins(predictions) {
  const bins = Array.from({ length: 10 }, (_, i) => ({
    low: i * 0.1,
    high: (i + 1) * 0.1,
    predicted: [],
    actuals: [],
  }))

  for (const pred of predictions) {
    const p = pred.home_win_probability
    const a = pred.actual_outcome === 'home_win' ? 1 : 0
    if (p === undefined || p === null) continue
    const binIdx = Math.min(Math.floor(p * 10), 9)
    bins[binIdx].predicted.push(p)
    bins[binIdx].actuals.push(a)
  }

  return bins
    .filter(b => b.predicted.length > 0)
    .map(b => ({
      x: b.predicted.reduce((s, v) => s + v, 0) / b.predicted.length,
      y: b.actuals.reduce((s, v) => s + v, 0) / b.actuals.length,
      count: b.predicted.length,
    }))
}

export default function CalibrationChart({ predictions = [], resolvedPredictions = [] }) {
  const combined = useMemo(() => {
    const map = {}
    for (const p of predictions) map[p.match_id] = { ...p }
    for (const r of resolvedPredictions) {
      if (map[r.match_id]) {
        map[r.match_id].actual_outcome = r.actual_outcome
      }
    }
    return Object.values(map).filter(p => p.actual_outcome !== undefined)
  }, [predictions, resolvedPredictions])

  const calibrationPoints = useMemo(() => buildCalibrationBins(combined), [combined])

  if (!calibrationPoints.length) {
    return (
      <div className="card p-6 flex items-center justify-center" style={{ height: 260 }}>
        <p className="font-display text-gray-600 text-sm">NO RESOLVED PREDICTIONS FOR CALIBRATION</p>
      </div>
    )
  }

  const perfectLine = [{ x: 0, y: 0 }, { x: 1, y: 1 }]

  const data = {
    datasets: [
      {
        label: 'Perfect Calibration',
        data: perfectLine,
        type: 'line',
        borderColor: '#2a2a2a',
        borderDash: [6, 3],
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Model Calibration',
        data: calibrationPoints,
        backgroundColor: calibrationPoints.map(p => {
          const err = Math.abs(p.x - p.y)
          return err < 0.05 ? 'rgba(22,163,74,0.8)' : err < 0.1 ? 'rgba(234,179,8,0.8)' : 'rgba(220,38,38,0.8)'
        }),
        borderColor: 'transparent',
        pointRadius: calibrationPoints.map(p => Math.min(Math.max(p.count * 2, 6), 20)),
        pointHoverRadius: 8,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#6b7280', font: { family: '"DM Mono"', size: 10 }, boxWidth: 12 },
      },
      tooltip: {
        backgroundColor: '#1a1a1a',
        borderColor: '#2a2a2a',
        borderWidth: 1,
        titleColor: '#9ca3af',
        bodyColor: '#ffffff',
        titleFont: { family: '"DM Mono"', size: 10 },
        bodyFont: { family: '"DM Mono"', size: 11 },
        callbacks: {
          label: (ctx) => {
            if (ctx.datasetIndex === 1) {
              return `Predicted: ${(ctx.parsed.x * 100).toFixed(1)}% | Actual: ${(ctx.parsed.y * 100).toFixed(1)}%`
            }
            return ''
          },
        },
      },
    },
    scales: {
      x: {
        min: 0,
        max: 1,
        title: { display: true, text: 'Predicted Probability', color: '#6b7280', font: { family: '"DM Mono"', size: 10 } },
        ticks: { color: '#4b5563', font: { family: '"DM Mono"', size: 10 }, callback: v => `${(v * 100).toFixed(0)}%` },
        grid: { color: '#1a1a1a' },
        border: { color: '#2a2a2a' },
      },
      y: {
        min: 0,
        max: 1,
        title: { display: true, text: 'Actual Frequency', color: '#6b7280', font: { family: '"DM Mono"', size: 10 } },
        ticks: { color: '#4b5563', font: { family: '"DM Mono"', size: 10 }, callback: v => `${(v * 100).toFixed(0)}%` },
        grid: { color: '#1a1a1a' },
        border: { color: '#2a2a2a' },
      },
    },
  }

  return (
    <div className="card p-4">
      <p className="label mb-4">CALIBRATION CHART — PREDICTED vs ACTUAL FREQUENCY</p>
      <div style={{ height: 220 }}>
        <Scatter data={data} options={options} />
      </div>
    </div>
  )
}
