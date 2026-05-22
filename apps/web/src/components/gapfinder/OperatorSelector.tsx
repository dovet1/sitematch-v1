'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HelpCircle } from 'lucide-react'
import { DistanceSelector } from './DistanceSelector'

interface OperatorSelectorProps {
  value: 'has' | 'has_not' | 'has_within' | 'has_not_within'
  onChange: (value: string) => void
  distance?: number
  onDistanceChange: (distance: number) => void
  matchingLogic?: 'any' | 'all'
  onMatchingLogicChange?: (logic: 'any' | 'all') => void
  targetCount?: number
}

export function OperatorSelector({
  value,
  onChange,
  distance,
  onDistanceChange,
  matchingLogic = 'any',
  onMatchingLogicChange,
  targetCount
}: OperatorSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Each location must:
        </Label>

        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="has">Contain</SelectItem>
            <SelectItem value="has_not">Not Contain</SelectItem>
            <SelectItem value="has_within">Be Within X Kilometres Of</SelectItem>
            <SelectItem value="has_not_within">Not Be Within X Kilometres Of</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Distance selector - only show for proximity operators */}
      {(value === 'has_within' || value === 'has_not_within') && (
        <DistanceSelector value={distance || 5000} onChange={onDistanceChange} />
      )}

      {/* Match toggle - only show when multiple targets are selected */}
      {targetCount !== undefined && targetCount > 1 && (
        <div className="space-y-1">
          <div className="flex justify-end">
            <div className="relative group">
              <div className="relative">
                <button
                  type="button"
                aria-label="Explain match options"
                className="flex h-4 w-4 items-center justify-center text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
              >
                <HelpCircle className="h-4 w-4 cursor-help" aria-hidden="true" />
              </button>
              <div className="absolute bottom-full right-0 z-50 hidden -translate-y-2 pointer-events-none group-hover:block group-focus-within:block">
                <div
                  role="tooltip"
                  className="w-max max-w-[min(18rem,calc(100vw-2rem))] whitespace-normal rounded bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
                >
                  <div className="space-y-1">
                    <div><strong>Any:</strong> Returned locations will contain at least one of the selected brands/categories</div>
                    <div><strong>All:</strong> Returned locations will contain every selected brand/category</div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => onMatchingLogicChange?.('any')}
              className={`h-8 rounded-md text-xs font-medium transition-colors ${
                matchingLogic === 'any'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Any
            </button>
            <button
              type="button"
              onClick={() => onMatchingLogicChange?.('all')}
              className={`h-8 rounded-md text-xs font-medium transition-colors ${
                matchingLogic === 'all'
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
