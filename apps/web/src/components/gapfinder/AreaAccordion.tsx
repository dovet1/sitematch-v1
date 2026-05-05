'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { MapPin } from 'lucide-react'
import { useState } from 'react'

interface AreaPoint {
  lat: number
  lng: number
}

interface AreaAccordionProps {
  pointA: AreaPoint
  pointB: AreaPoint
  radiusA: number
  radiusB: number
  onRadiusAChange: (radius: number) => void
  onRadiusBChange: (radius: number) => void
  onClearA: () => void
  onClearB: () => void
  storeCountA?: number
  storeCountB?: number
  value?: 'area-a' | 'area-b' | null
  onValueChange?: (value: string) => void
}

const MIN_RADIUS = 1000
const MAX_RADIUS = 20000

export function AreaAccordion({
  pointA,
  pointB,
  radiusA,
  radiusB,
  onRadiusAChange,
  onRadiusBChange,
  onClearA,
  onClearB,
  storeCountA = 0,
  storeCountB = 0,
  value,
  onValueChange
}: AreaAccordionProps) {

  const formatRadius = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)}km`
    }
    return `${meters}m`
  }

  const quickRadiiOptions = [
    { label: '1km', value: 1000 },
    { label: '3km', value: 3000 },
    { label: '5km', value: 5000 },
    { label: '10km', value: 10000 }
  ]

  return (
    <Accordion type="single" value={value ?? undefined} onValueChange={onValueChange} collapsible className="space-y-2">
      {/* Area A */}
      <AccordionItem value="area-a" className="border rounded-xl overflow-hidden bg-gradient-to-br from-violet-50 to-purple-50/50 border-violet-200/60">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-violet-100/30 transition-colors">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-violet-500 ring-2 ring-violet-300/50"></div>
              <span className="font-semibold text-gray-900">Area A</span>
            </div>
            <Badge variant="secondary" className="text-xs font-medium bg-violet-100 text-violet-700 border-violet-200">
              {formatRadius(radiusA)}
            </Badge>
            {storeCountA > 0 && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {storeCountA} stores
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-violet-600" />
                <p className="text-xs text-gray-700 font-mono">
                  {pointA.lat.toFixed(4)}, {pointA.lng.toFixed(4)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearA}
                className="h-7 text-xs text-violet-700 hover:bg-violet-100/80 hover:text-violet-800"
              >
                Clear
              </Button>
            </div>

            {/* Radius slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Radius</label>
                <span className="text-sm font-semibold text-violet-700">{formatRadius(radiusA)}</span>
              </div>
              <Slider
                value={[radiusA]}
                onValueChange={([value]) => onRadiusAChange(value)}
                min={MIN_RADIUS}
                max={MAX_RADIUS}
                step={100}
                className="w-full"
              />
              <div className="flex gap-2 flex-wrap">
                {quickRadiiOptions.map(option => (
                  <Button
                    key={option.value}
                    variant={radiusA === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onRadiusAChange(option.value)}
                    className="h-7 text-xs"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Area B */}
      <AccordionItem value="area-b" className="border rounded-xl overflow-hidden bg-gradient-to-br from-teal-50 to-cyan-50/50 border-teal-200/60">
        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-teal-100/30 transition-colors">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-teal-500 ring-2 ring-teal-300/50"></div>
              <span className="font-semibold text-gray-900">Area B</span>
            </div>
            <Badge variant="secondary" className="text-xs font-medium bg-teal-100 text-teal-700 border-teal-200">
              {formatRadius(radiusB)}
            </Badge>
            {storeCountB > 0 && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {storeCountB} stores
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-teal-600" />
                <p className="text-xs text-gray-700 font-mono">
                  {pointB.lat.toFixed(4)}, {pointB.lng.toFixed(4)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearB}
                className="h-7 text-xs text-teal-700 hover:bg-teal-100/80 hover:text-teal-800"
              >
                Clear
              </Button>
            </div>

            {/* Radius slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Radius</label>
                <span className="text-sm font-semibold text-teal-700">{formatRadius(radiusB)}</span>
              </div>
              <Slider
                value={[radiusB]}
                onValueChange={([value]) => onRadiusBChange(value)}
                min={MIN_RADIUS}
                max={MAX_RADIUS}
                step={100}
                className="w-full"
              />
              <div className="flex gap-2 flex-wrap">
                {quickRadiiOptions.map(option => (
                  <Button
                    key={option.value}
                    variant={radiusB === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onRadiusBChange(option.value)}
                    className="h-7 text-xs"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
