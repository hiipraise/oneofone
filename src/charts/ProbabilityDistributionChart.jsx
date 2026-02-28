// src/charts/ProbabilityDistributionChart.jsx
import React, { useMemo } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function ProbabilityDistributionChart({ predictions = [] }) {
  const { labels, homePcts, awayPcts, drawPcts } = useMemo(() => {
    const recent = predictions.slice(0, 10).reverse()
    return {
      labels: recent.map(p => `${p.home_team?.split(' ').slice(-1)[0]} v ${p.away_team?.split(' ').slice(-1)[0]}`),
      homePcts: recent.map(p => Math.round((p.home_win_probability || 0) * 100)),
      awayPcts: recent.map(p => Math.round((p.away_win_probability || 0) * 100)),
      drawPcts: recent.map(p => Math.round((p.draw_probability || 0) * 100)),
    }
  }, [predictions])

  if (!predictions.length) {
    return (
      <div className="card p-6 flex items-center justify-center" style={{ height: 260 }}>
        <p className="font-display text-gray-600 text-sm">NO PREDICTIONS TO DISPLAY</p>
      </div>
    )
  }

  const data = {
    labels,
    datasets: [
      {
        label: 'Home Win %',
        data: homePcts,
        backgroundColor: 'rgba(22,163,74,0.75)',
        borderColor: '#16a34a',
        borderWidth: 1,
        borderRadius: 2,
      },
      {
        label: 'Draw %',
        data: drawPcts,
        backgroundColor: 'rgba(234,179,8,0.5)',
        borderColor: '#ca8a04',
        borderWidth: 1,
        borderRadius: 2,
      },
      {
        label: 'Away Win %',
        data: awayPcts,
        backgroundColor: 'rgba(220,38,38,0.75)',
        borderColor: '#dc2626',
        borderWidth: 1,
        borderRadius: 2,
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
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%`,
        },
      },
    },
    scales: {
      x: {
        stacked: false,
        ticks: { color: '#4b5563', font: { family: '"DM Mono"', size: 9 }, maxRotation: 30 },
        grid: { color: '#1a1a1a' },
        border: { color: '#2a2a2a' },
      },
      y: {
        min: 0,
        max: 100,
        ticks: { color: '#4b5563', font: { family: '"DM Mono"', size: 10 }, callback: v => `${v}%` },
        grid: { color: '#1a1a1a' },
        border: { color: '#2a2a2a' },
      },
    },
  }

  return (
    <div className="card p-4">
      <p className="label mb-4">PROBABILITY DISTRIBUTION — RECENT PREDICTIONS</p>
      <div style={{ height: 220 }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  )
}
