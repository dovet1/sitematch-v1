'use client'

import { MapPin, Store as StoreIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { BUA } from '@/lib/buas'

interface ResultsPanelProps {
  results: BUA[] | any[] // BUA[] for Find Gaps mode, Store[] for Assess Area mode
  isLoading: boolean
  selectedBUA: { name: string; pop: number } | null
  onItemClick: (item: any) => void
  mode?: 'find-gaps' | 'assess-area'
}

export function ResultsPanel({
  results,
  isLoading,
  selectedBUA,
  onItemClick,
  mode = 'find-gaps'
}: ResultsPanelProps) {
  const isFindGapsMode = mode === 'find-gaps'

  return (
    <div className="w-[360px] border-l bg-background flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-gray-900">
            {isFindGapsMode ? 'Matching BUAs' : 'Nearby Stores'}
          </Label>
          <span className="text-xs text-gray-600 font-medium">
            {isLoading ? 'Loading...' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto pt-2 px-1">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {isFindGapsMode ? 'Loading BUAs...' : 'Loading stores...'}
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {isFindGapsMode
              ? 'No BUAs match the current filters'
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
                      Pop: {bua.pop.toLocaleString()}
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
