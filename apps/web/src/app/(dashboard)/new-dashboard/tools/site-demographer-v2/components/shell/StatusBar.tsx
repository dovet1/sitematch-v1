'use client'

import type { MeasurementMode } from '@/components/demographics/desktop/LocationInputPanel'

interface StatusBarProps {
  measurementMode: MeasurementMode
  measurementValue: number
  lsoaCount: number
}

export function StatusBar({ measurementMode, measurementValue, lsoaCount }: StatusBarProps) {
  const getModeLabel = () => {
    switch (measurementMode) {
      case 'distance':
        return `Distance: ${measurementValue} ${measurementValue === 1 ? 'mile' : 'miles'}`
      case 'drive_time':
        return `Drive time: ${measurementValue} ${measurementValue === 1 ? 'min' : 'mins'}`
      case 'walk_time':
        return `Walk time: ${measurementValue} ${measurementValue === 1 ? 'min' : 'mins'}`
    }
  }

  return (
    <footer className="h-8 border-t border-sm-border bg-sm-surface flex items-center justify-between px-4 text-xs text-sm-ink/60 shrink-0">
      {/* Left: Measurement info */}
      <div>{getModeLabel()}</div>

      {/* Center: LSOA count */}
      <div>
        {lsoaCount > 0 ? (
          <span>
            {lsoaCount} {lsoaCount === 1 ? 'area' : 'areas'} selected
          </span>
        ) : (
          <span>No areas selected</span>
        )}
      </div>

      {/* Right: Empty for now (no coords/zoom available from map) */}
      <div />
    </footer>
  )
}
