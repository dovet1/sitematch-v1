'use client'

import { Search, Download, ChevronDown } from 'lucide-react'

export function UChrome() {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-sm-border bg-sm-surface px-4">
      {/* Logo / wordmark */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sm-violet text-sm font-semibold text-white">
          S
        </div>
        <span className="text-base font-semibold text-sm-ink">SiteMatcher</span>
      </div>

      {/* Location search (wired to geocoding in a later phase) */}
      <div className="mx-auto flex h-[42px] w-full max-w-[460px] items-center gap-2 rounded-lg bg-sm-bg px-3 text-sm-ink3">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search a town, postcode or address…"
          className="w-full bg-transparent text-sm text-sm-ink placeholder:text-sm-ink3 focus:outline-none"
        />
        <span className="font-mono text-[11px] text-sm-ink4">⌘K</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-sm-violet px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sm-violet-deep"
        >
          <Download size={15} />
          Export
        </button>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-1 text-sm-ink2"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sm-violet text-sm font-semibold text-white">
            N
          </span>
          <ChevronDown size={16} />
        </button>
      </div>
    </header>
  )
}
