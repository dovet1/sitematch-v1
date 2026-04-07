'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DistanceSelector } from './DistanceSelector'

interface OperatorSelectorProps {
  value: 'has' | 'has_not' | 'has_within' | 'has_not_within'
  onChange: (value: string) => void
  distance?: number
  onDistanceChange: (distance: number) => void
}

export function OperatorSelector({
  value,
  onChange,
  distance,
  onDistanceChange
}: OperatorSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Each BUA must:
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
    </div>
  )
}
