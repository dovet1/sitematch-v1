'use client'

import { MapPin, Store as StoreIcon, Download, Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BUA } from '@/lib/buas'
import { formatPopulation } from '@/lib/format-population'

interface ResultsPanelProps {
  results: BUA[] | any[] // BUA[] for Find Gaps mode, Store[] for Assess Area mode
  isLoading: boolean
  selectedBUA: { name: string; pop: number } | null
  onItemClick: (item: any) => void
  mode?: 'find-gaps' | 'assess-area'
  total?: number // Total count (may be higher than results.length due to limit)
  onExport?: () => void // Callback to trigger export
  isExporting?: boolean // Loading state during export
  canExport?: boolean // Whether export is available
}

export function ResultsPanel({
  results,
  isLoading,
  selectedBUA,
  onItemClick,
  mode = 'find-gaps',
  total,
  onExport,
  isExporting = false,
  canExport = false
}: ResultsPanelProps) {
  const isFindGapsMode = mode === 'find-gaps'
  const actualTotal = total || results.length

  return (
    <div
      className="w-[280px] border-l bg-background flex flex-col"
      role="region"
      aria-label={`${isFindGapsMode ? 'Matching Locations' : 'Nearby Stores'} Panel`}
    >
      {/* Header */}
      <header className="bg-gradient-to-r from-violet-100 to-purple-100 px-4 py-4 border-b border-violet-200">
        <div className="space-y-3">
          {/* Title + Export Button Row */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900" id="results-panel-title">
              {isFindGapsMode ? 'Matching Locations' : 'Nearby Stores'}
            </h2>
            {isFindGapsMode && onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                disabled={!canExport || isExporting}
                className="h-8 w-8 p-0 border-violet-200 hover:bg-violet-50 hover:border-violet-300"
                aria-label={`Export all ${actualTotal.toLocaleString()} matching locations to CSV`}
                aria-busy={isExporting}
                title="Export CSV"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>

          {/* Count/Status Row */}
          <div
            className="text-sm text-gray-700 font-medium"
            aria-live="polite"
            aria-atomic="true"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
                <span className="animate-pulse">Loading locations...</span>
              </div>
            ) : actualTotal > 1000 ? (
              <span>
                Showing {results.length.toLocaleString()} of {actualTotal.toLocaleString()} locations
              </span>
            ) : (
              <span>
                {results.length} location{results.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Results List */}
      <div
        className="flex-1 overflow-y-auto pt-2 px-1"
        role="list"
        aria-labelledby="results-panel-title"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {isFindGapsMode ? 'Loading locations...' : 'Loading stores...'}
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {isFindGapsMode
              ? 'No locations match the current filters'
              : 'No stores found in this area'}
          </div>
        ) : isFindGapsMode ? (
          <div className="divide-y divide-gray-50">
            {results.map((bua: BUA, index) => (
              <button
                key={bua.gsscode}
                onClick={() => onItemClick(bua)}
                className={cn(
                  "w-full px-4 py-4 text-left hover:bg-violet-50 hover:shadow-sm transition-all duration-150",
                  selectedBUA?.name === bua.name && "bg-violet-50",
                  index === 0 && "pt-2",
                  index === results.length - 1 && "pb-2"
                )}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {bua.name}
                    </div>
                    <div className="text-xs text-gray-600">
                      Pop: {formatPopulation(bua.pop_final)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {results.map((store: any, index) => (
              <button
                key={store.id}
                onClick={() => onItemClick(store)}
                className={cn(
                  "w-full px-4 py-4 text-left hover:bg-violet-50 hover:shadow-sm transition-all duration-150",
                  index === 0 && "pt-2",
                  index === results.length - 1 && "pb-2"
                )}
              >
                <div className="flex items-start gap-2">
                  <StoreIcon className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {store.name}
                    </div>
                    {store.town && (
                      <div className="text-xs text-gray-600 truncate">
                        {store.town}
                        {store.postcode && ` • ${store.postcode}`}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
