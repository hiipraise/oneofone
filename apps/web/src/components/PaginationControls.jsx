import React from 'react'

export default function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'ITEMS',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)

  if (totalItems <= pageSize) {
    return (
      <div className="px-4 py-2 border-t border-brand-midgray flex items-center justify-between gap-2">
        <span className="font-display text-xs text-gray-700">{totalItems} {itemLabel}</span>
      </div>
    )
  }

  return (
    <div className="px-4 py-2 border-t border-brand-midgray flex items-center justify-between gap-3">
      <span className="font-display text-xs text-gray-700">
        {start}-{end} of {totalItems} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="font-display text-xs px-2 py-1 rounded-sm border border-brand-midgray text-gray-500 enabled:hover:text-white enabled:hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          PREV
        </button>
        <span className="font-display text-xs text-gray-600 tabular-nums min-w-[60px] text-center">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="font-display text-xs px-2 py-1 rounded-sm border border-brand-midgray text-gray-500 enabled:hover:text-white enabled:hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          NEXT
        </button>
      </div>
    </div>
  )
}
