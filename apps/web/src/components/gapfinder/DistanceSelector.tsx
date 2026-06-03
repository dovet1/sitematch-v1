'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DistanceSelectorProps {
  value: number
  onChange: (distance: number) => void
}

export function DistanceSelector({ value, onChange }: DistanceSelectorProps) {
  const distances = [1000, 3000, 5000, 10000]

  return (
    <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">

      <Select
        value={value.toString()}
        onValueChange={(v) => onChange(Number(v))}
      >
        <SelectTrigger className="w-full bg-white">
          <SelectValue placeholder="Select distance" />
        </SelectTrigger>
        <SelectContent>
          {distances.map((distance) => (
            <SelectItem key={distance} value={distance.toString()}>
              {distance >= 1000 ? `${distance / 1000} km` : `${distance} m`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
