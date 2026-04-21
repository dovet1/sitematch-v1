'use client'

import { MapPin, Store as StoreIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
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
}

export function ResultsPanel({
  results,
  isLoading,
  selectedBUA,
  onItemClick,
  mode = 'find-gaps',
  total
}: ResultsPanelProps) {
  const isFindGapsMode = mode === 'find-gaps'
  const actualTotal = total || results.length

  return (
    <div className="w-[360px] border-l bg-background flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-4 border-b border-gray-200">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold text-gray-900">
              {isFindGapsMode ? 'Matching Locations' : 'Nearby Stores'}
            </Label>
            <span className="text-xs text-gray-600 font-medium">
              {isLoading
                ? 'Loading...'
                : actualTotal > 1000
                  ? `${results.length.toLocaleString()} of ${actualTotal.toLocaleString()}`
                  : `${results.length} result${results.length !== 1 ? 's' : ''}`
              }
            </span>
          </div>
          {!isLoading && actualTotal > 1000 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-md border border-amber-200">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Showing top 1,000 by population</span>
            </div>
          )}
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto pt-2 px-1">
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
