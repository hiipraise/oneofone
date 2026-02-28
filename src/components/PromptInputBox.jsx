// src/components/PromptInputBox.jsx
import React, { useState } from 'react'

export default function PromptInputBox({ onSubmit, loading, placeholder = 'Enter a prediction prompt...' }) {
  const [value, setValue] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!value.trim() || loading) return
    onSubmit(value.trim())
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1 relative">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          className="w-full bg-brand-gray border border-brand-midgray focus:border-brand-red outline-none text-white font-body text-sm px-4 py-2.5 rounded-sm placeholder-gray-700 transition-colors duration-200 disabled:opacity-50"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border border-brand-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <button type="submit" disabled={!value.trim() || loading} className="btn-primary whitespace-nowrap">
        {loading ? 'PROCESSING' : 'SUBMIT'}
      </button>
    </form>
  )
}
