'use client'

import { MapPin } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { BUA } from '@/lib/buas'

interface ResultsPanelProps {
  results: BUA[]
  isLoading: boolean
  selectedBUA: { name: string; pop: number } | null
  onItemClick: (bua: BUA) => void
}

export function ResultsPanel({
  results,
  isLoading,
  selectedBUA,
  onItemClick
}: ResultsPanelProps) {
  return (
    <div className="w-[360px] border-l bg-background flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-gray-900">
            Matching BUAs
          </Label>
          <span className="text-xs text-gray-600 font-medium">
            {isLoading ? 'Loading...' : `Top ${results.length}`}
          </span>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Loading BUAs...
          </div>
        ) : results.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No BUAs match the current filters
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {results.map((bua) => (
              <button
                key={bua.gsscode}
                onClick={() => onItemClick(bua)}
                className={cn(
                  "w-full px-4 py-3 text-left hover:bg-violet-50 transition-colors",
                  selectedBUA?.name === bua.name && "bg-violet-50"
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
        )}
      </div>
    </div>
  )
}
