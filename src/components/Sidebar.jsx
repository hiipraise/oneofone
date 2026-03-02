import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getMetricsSummary } from '../services/api'

const NAV_ITEMS = [
  { path: '/',              label: 'Dashboard',    icon: '◈' },
  { path: '/predict',       label: 'New Prediction', icon: '⊕' },
  { path: '/history',       label: 'History',      icon: '≡' },
  { path: '/metrics',       label: 'Model Metrics', icon: '◎' },
  { path: '/chat',          label: 'AI Chat',      icon: '⌘' },
  { path: '/chat/history',  label: 'Chat History', icon: '◷' },
]

const SPORTS = [
  { key: 'soccer',     label: 'Football / Soccer', dot: 'bg-brand-green' },
  { key: 'basketball', label: 'Basketball',         dot: 'bg-yellow-500' },
  { key: 'tennis',     label: 'Tennis',             dot: 'bg-blue-500' },
]

function NavItem({ path, label, icon, isActive }) {
  return (
    <Link
      to={path}
      className={`flex items-center gap-3 px-3 py-2 rounded-sm transition-colors duration-150 group ${
        isActive
          ? 'bg-brand-midgray text-white'
          : 'text-gray-500 hover:text-white hover:bg-brand-gray'
      }`}
    >
      <span className={`text-sm shrink-0 transition-colors ${
        isActive ? 'text-brand-red' : 'text-gray-600 group-hover:text-brand-red'
      }`}>
        {icon}
      </span>
      <span className="font-body text-sm truncate">{label}</span>
    </Link>
  )
}

function SportLink({ sport, isActive }) {
  return (
    <Link
      to={`/history?sport=${sport.key}`}
      className={`flex items-center justify-between px-3 py-1.5 rounded-sm transition-colors duration-150 group ${
        isActive
          ? 'bg-brand-gray text-white'
          : 'text-gray-500 hover:text-white hover:bg-brand-gray'
      }`}
    >
      <span className="font-body text-xs truncate">{sport.label}</span>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sport.dot} opacity-60 group-hover:opacity-100 transition-opacity`} />
    </Link>
  )
}

export default function Sidebar({ isOpen = false, onClose }) {
  const location = useLocation()
  const [modelSummary, setModelSummary] = useState(null)

  useEffect(() => {
    getMetricsSummary()
      .then(r => setModelSummary(r.data))
      .catch(() => {})
  }, [])

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    if (path === '/chat') return location.pathname === '/chat'
    return location.pathname.startsWith(path)
  }

  const searchSport = new URLSearchParams(location.search).get('sport') || ''

  return (
    <aside className={`
      fixed top-[53px] left-0 z-50 w-56 h-[calc(100vh-53px)] overflow-y-auto
      border-r border-brand-midgray bg-brand-darkgray flex flex-col
      transform transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      md:translate-x-0 md:z-auto
    `}>

      {/* Mobile-only close header */}
      <div className="md:hidden flex items-center justify-between p-3 border-b border-brand-midgray">
        <span className="font-display font-medium text-white">Menu</span>
        <button
          onClick={onClose}
          className="text-3xl leading-none text-gray-400 hover:text-white transition-colors"
          aria-label="Close sidebar"
        >
          ×
        </button>
      </div>

      {/* Navigation */}
      <div className="p-3 border-b border-brand-midgray">
        <p className="label px-3 py-1.5 mb-1">NAVIGATION</p>
        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(item => (
            <NavItem
              key={item.path}
              {...item}
              isActive={isActive(item.path)}
            />
          ))}
        </nav>
      </div>

      {/* Sports quick-links */}
      <div className="p-3 border-b border-brand-midgray">
        <p className="label px-3 py-1.5 mb-1">SPORTS</p>
        <div className="flex flex-col gap-0.5">
          {SPORTS.map(sport => (
            <SportLink
              key={sport.key}
              sport={sport}
              isActive={location.pathname === '/history' && searchSport === sport.key}
            />
          ))}
        </div>
      </div>

      {/* Model status block – unchanged */}
      <div className="p-3 mt-auto">
        <div className="card p-3">
          <p className="label mb-2">MODEL STATUS</p>

          {modelSummary ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs text-gray-600">ENGINE</span>
                <span className={`font-display text-xs ${
                  modelSummary.is_trained ? 'text-brand-greenlight' : 'text-yellow-500'
                }`}>
                  {modelSummary.is_trained ? 'ML TRAINED' : 'PRIOR MODE'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-display text-xs text-gray-600">VERSION</span>
                <span className="font-display text-xs text-gray-400">
                  v{modelSummary.model_version || '1.0.0'}
                </span>
              </div>

              {modelSummary.performance_metrics?.accuracy != null && (
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs text-gray-600">ACCURACY</span>
                  <span className={`font-display text-xs tabular-nums ${
                    modelSummary.performance_metrics.accuracy > 0.6
                      ? 'text-brand-greenlight'
                      : modelSummary.performance_metrics.accuracy > 0.5
                      ? 'text-yellow-500'
                      : 'text-brand-redlight'
                  }`}>
                    {(modelSummary.performance_metrics.accuracy * 100).toFixed(1)}%
                  </span>
                </div>
              )}

              {modelSummary.total_predictions != null && (
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs text-gray-600">TOTAL PREDS</span>
                  <span className="font-display text-xs text-gray-400 tabular-nums">
                    {modelSummary.total_predictions.toLocaleString()}
                  </span>
                </div>
              )}

              {modelSummary.total_resolved != null && (
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs text-gray-600">RESOLVED</span>
                  <span className="font-display text-xs text-gray-400 tabular-nums">
                    {modelSummary.total_resolved.toLocaleString()}
                  </span>
                </div>
              )}

              {modelSummary.performance_metrics?.brier_score != null && (
                <div className="pt-1 border-t border-brand-midgray mt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xs text-gray-600">BRIER</span>
                    <span className={`font-display text-xs tabular-nums ${
                      modelSummary.performance_metrics.brier_score < 0.20
                        ? 'text-brand-greenlight'
                        : modelSummary.performance_metrics.brier_score < 0.25
                        ? 'text-yellow-500'
                        : 'text-brand-redlight'
                    }`}>
                      {modelSummary.performance_metrics.brier_score.toFixed(4)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs text-gray-600">ENGINE</span>
                <span className="font-display text-xs text-brand-greenlight">OPERATIONAL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-display text-xs text-gray-600">DATA</span>
                <span className="font-display text-xs text-gray-700">LOADING...</span>
              </div>
            </div>
          )}

          <div className="pt-2 mt-2 border-t border-brand-midgray">
            <p className="font-display text-xs text-gray-700 mb-1.5">SUPPORTED SPORTS</p>
            <div className="flex flex-wrap gap-1">
              {SPORTS.map(s => (
                <span key={s.key} className="font-display text-xs text-gray-600 bg-brand-midgray px-1.5 py-0.5 rounded-sm capitalize">
                  {s.key}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
