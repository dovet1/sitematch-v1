'use client'

import { BarChart3 } from 'lucide-react'
import { clsx } from 'clsx'

export function LeftRail() {
  // For now, Results is always active (no other tools)
  const isActive = true

  return (
    <aside className="w-14 border-r border-sm-border bg-sm-surface flex flex-col items-center py-4 shrink-0">
      <button
        className={clsx(
          'w-10 h-10 flex items-center justify-center rounded-md transition-all',
          'hover:bg-sm-surface-hover',
          isActive && 'bg-sm-violet text-white'
        )}
        title="Results"
        disabled={isActive}
      >
        <BarChart3 className="w-5 h-5" />
      </button>
    </aside>
  )
}
