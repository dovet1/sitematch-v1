'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Info } from 'lucide-react'
import { BUAMap } from '@/components/buas/BUAMap'
import { BUASearch } from '@/components/buas/BUASearch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const MAX_POPULATION = 9787426 // London (largest BUA)
const MIN_POPULATION = 0

export default function BUAsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [center, setCenter] = useState<{ lat: number; lng: number } | undefined>()
  const [minPopInput, setMinPopInput] = useState(MIN_POPULATION.toString())
  const [maxPopInput, setMaxPopInput] = useState(MAX_POPULATION.toString())
  const [minPopError, setMinPopError] = useState<string | null>(null)
  const [maxPopError, setMaxPopError] = useState<string | null>(null)
  const [selectedBUA, setSelectedBUA] = useState<{ name: string; pop: number } | null>(null)

  // Derived numeric values for map filtering
  const minPop = useMemo(() => {
    const num = Number(minPopInput)
    return isNaN(num) || num < MIN_POPULATION ? MIN_POPULATION : Math.min(num, MAX_POPULATION)
  }, [minPopInput])

  const maxPop = useMemo(() => {
    const num = Number(maxPopInput)
    return isNaN(num) || num > MAX_POPULATION ? MAX_POPULATION : Math.max(num, MIN_POPULATION)
  }, [maxPopInput])

  const handleBUASelect = (bua: {
    name: string
    coordinates: { lat: number; lng: number }
    gsscode: string
    pop: number
  }) => {
    setCenter(bua.coordinates)
    setSelectedBUA({ name: bua.name, pop: bua.pop })
  }

  const handleMinPopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMinPopInput(value)
    // Clear error while typing
    if (minPopError) setMinPopError(null)
  }

  const handleMaxPopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setMaxPopInput(value)
    // Clear error while typing
    if (maxPopError) setMaxPopError(null)
  }

  const handleMinPopBlur = () => {
    const num = Number(minPopInput)
    const maxNum = Number(maxPopInput)

    // If empty, default to MIN_POPULATION
    if (minPopInput.trim() === '') {
      setMinPopInput(MIN_POPULATION.toString())
      return
    }

    // Validate numeric
    if (isNaN(num)) {
      setMinPopError('Please enter a valid number')
      setMinPopInput(MIN_POPULATION.toString())
      return
    }

    // Validate range
    if (num < MIN_POPULATION) {
      setMinPopError(`Minimum is ${MIN_POPULATION.toLocaleString()}`)
      setMinPopInput(MIN_POPULATION.toString())
      return
    }

    if (num > MAX_POPULATION) {
      setMinPopError(`Maximum is ${MAX_POPULATION.toLocaleString()}`)
      setMinPopInput(MAX_POPULATION.toString())
      return
    }

    // Validate min <= max
    if (!isNaN(maxNum) && num > maxNum) {
      setMinPopError('Minimum must be less than maximum')
      return
    }

    setMinPopError(null)
  }

  const handleMaxPopBlur = () => {
    const num = Number(maxPopInput)
    const minNum = Number(minPopInput)

    // If empty, default to MAX_POPULATION
    if (maxPopInput.trim() === '') {
      setMaxPopInput(MAX_POPULATION.toString())
      return
    }

    // Validate numeric
    if (isNaN(num)) {
      setMaxPopError('Please enter a valid number')
      setMaxPopInput(MAX_POPULATION.toString())
      return
    }

    // Validate range
    if (num < MIN_POPULATION) {
      setMaxPopError(`Minimum is ${MIN_POPULATION.toLocaleString()}`)
      setMaxPopInput(MIN_POPULATION.toString())
      return
    }

    if (num > MAX_POPULATION) {
      setMaxPopError(`Maximum is ${MAX_POPULATION.toLocaleString()}`)
      setMaxPopInput(MAX_POPULATION.toString())
      return
    }

    // Validate max >= min
    if (!isNaN(minNum) && num < minNum) {
      setMaxPopError('Maximum must be greater than minimum')
      return
    }

    setMaxPopError(null)
  }

  const formatPopulation = (value: number): string => {
    if (value === 0) return '0'
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
    return value.toString()
  }

  const getFilteredCount = () => {
    // More accurate estimates based on both min and max population
    // These are approximate counts based on 2021/2022 Census data distribution

    // Very narrow ranges
    if (maxPop < 1000) {
      if (minPop === 0) return '~1,000'
      return '~500'
    }

    if (maxPop < 5000) {
      if (minPop >= 1000) return '~2,000'
      return '~3,000'
    }

    if (maxPop < 10000) {
      if (minPop >= 5000) return '~1,500'
      if (minPop >= 1000) return '~3,500'
      return '~4,500'
    }

    if (maxPop < 50000) {
      if (minPop >= 10000) return '~2,300'
      if (minPop >= 5000) return '~3,800'
      return '~6,800'
    }

    if (maxPop < 100000) {
      if (minPop >= 50000) return '~500'
      if (minPop >= 10000) return '~2,800'
      return '~7,300'
    }

    if (maxPop < 250000) {
      if (minPop >= 100000) return '~350'
      if (minPop >= 50000) return '~850'
      return '~8,200'
    }

    if (maxPop < 1000000) {
      if (minPop >= 250000) return '~50'
      if (minPop >= 100000) return '~400'
      return '~8,550'
    }

    // Full range
    if (minPop >= 1000000) return '~10'
    if (minPop >= 250000) return '~60'
    if (minPop >= 100000) return '~435'
    if (minPop >= 50000) return '~885'

    return '8,585'
  }

  return (
    <div className="h-screen bg-background">
      {/* Desktop Layout */}
      <div className="hidden md:flex md:flex-col md:h-full">
        {/* Premium Header - Match SiteSketcher */}
        <header className="relative z-40 px-8 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-50/30 via-transparent to-purple-50/30 pointer-events-none" />
          <div className="relative flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
                className="h-8 w-8 rounded-lg hover:bg-violet-50 hover:text-violet-700 transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-gradient-to-b from-violet-500 to-purple-600 rounded-full" />
                <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
                  Gap Analysis
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 border-r bg-background flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="bua-search" className="text-sm font-medium">
                  Search by BUA Name
                </Label>
                <BUASearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onBUASelect={handleBUASelect}
                />
              </div>

              {/* Population Filter */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Population Range</Label>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="min-pop" className="text-xs text-gray-600 mb-1 block">
                      Minimum
                    </label>
                    <Input
                      id="min-pop"
                      type="number"
                      min={MIN_POPULATION}
                      max={MAX_POPULATION}
                      value={minPopInput}
                      onChange={handleMinPopChange}
                      onBlur={handleMinPopBlur}
                      className={cn(
                        "w-full",
                        minPopError && "border-red-500 focus-visible:ring-red-500"
                      )}
                    />
                    {minPopError && (
                      <p className="text-xs text-red-600 mt-1">{minPopError}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="max-pop" className="text-xs text-gray-600 mb-1 block">
                      Maximum
                    </label>
                    <Input
                      id="max-pop"
                      type="number"
                      min={MIN_POPULATION}
                      max={MAX_POPULATION}
                      value={maxPopInput}
                      onChange={handleMaxPopChange}
                      onBlur={handleMaxPopBlur}
                      className={cn(
                        "w-full",
                        maxPopError && "border-red-500 focus-visible:ring-red-500"
                      )}
                    />
                    {maxPopError && (
                      <p className="text-xs text-red-600 mt-1">{maxPopError}</p>
                    )}
                  </div>
                </div>

                <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">Active range:</span>
                    <span>{formatPopulation(minPop)} - {formatPopulation(maxPop)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Showing approx:</span>
                    <span>{getFilteredCount()} BUAs</span>
                  </div>
                </div>
              </div>

              {/* Selected BUA Info */}
              {selectedBUA && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                  <div className="text-xs font-medium text-violet-900 mb-1">
                    Selected
                  </div>
                  <div className="text-sm font-semibold text-violet-700">
                    {selectedBUA.name}
                  </div>
                  <div className="text-xs text-violet-600 mt-1">
                    Population: {selectedBUA.pop.toLocaleString()}
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Population Legend</Label>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eff6ff' }}></div>
                    <span className="text-gray-600">&lt; 1,000</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dbeafe' }}></div>
                    <span className="text-gray-600">1K - 5K</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#bfdbfe' }}></div>
                    <span className="text-gray-600">5K - 10K</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#93c5fd' }}></div>
                    <span className="text-gray-600">10K - 50K</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#60a5fa' }}></div>
                    <span className="text-gray-600">50K - 100K</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                    <span className="text-gray-600">100K - 500K</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#2563eb' }}></div>
                    <span className="text-gray-600">500K - 1M</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#1d4ed8' }}></div>
                    <span className="text-gray-600">&gt; 1M</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative overflow-hidden">
            <BUAMap
              center={center}
              minPopulation={minPop}
              maxPopulation={maxPop}
              onBUAClick={(gsscode, name, pop) => setSelectedBUA({ name, pop })}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden h-full flex flex-col">
        {/* Fixed top navigation */}
        <div className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center justify-center w-10 h-10 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Link>
          <div className="bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-gray-200 px-4 py-2">
            <h1 className="text-sm font-semibold text-gray-900">Gap Analysis</h1>
          </div>
        </div>

        {/* Full screen map */}
        <div className="flex-1">
          <BUAMap
            center={center}
            minPopulation={minPop}
            maxPopulation={maxPop}
            onBUAClick={(gsscode, name, pop) => setSelectedBUA({ name, pop })}
            className="w-full h-full"
          />
        </div>

        {/* Bottom sheet with controls */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl rounded-t-2xl z-40 max-h-[60vh] overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Drag handle */}
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto"></div>

            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="mobile-bua-search" className="text-sm font-medium">
                Search by BUA Name
              </Label>
              <BUASearch
                value={searchQuery}
                onChange={setSearchQuery}
                onBUASelect={handleBUASelect}
              />
            </div>

            {/* Population Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Population Range</Label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mobile-min-pop" className="text-xs text-gray-600 mb-1 block">
                    Min
                  </label>
                  <Input
                    id="mobile-min-pop"
                    type="number"
                    min={MIN_POPULATION}
                    max={MAX_POPULATION}
                    value={minPopInput}
                    onChange={handleMinPopChange}
                    onBlur={handleMinPopBlur}
                    className={cn(
                      "w-full",
                      minPopError && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  {minPopError && (
                    <p className="text-xs text-red-600 mt-1">{minPopError}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="mobile-max-pop" className="text-xs text-gray-600 mb-1 block">
                    Max
                  </label>
                  <Input
                    id="mobile-max-pop"
                    type="number"
                    min={MIN_POPULATION}
                    max={MAX_POPULATION}
                    value={maxPopInput}
                    onChange={handleMaxPopChange}
                    onBlur={handleMaxPopBlur}
                    className={cn(
                      "w-full",
                      maxPopError && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  {maxPopError && (
                    <p className="text-xs text-red-600 mt-1">{maxPopError}</p>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                <div className="flex justify-between">
                  <span>Range:</span>
                  <span className="font-medium">{formatPopulation(minPop)} - {formatPopulation(maxPop)}</span>
                </div>
              </div>
            </div>

            {/* Selected BUA */}
            {selectedBUA && (
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                <div className="text-xs font-medium text-violet-900 mb-1">
                  Selected
                </div>
                <div className="text-sm font-semibold text-violet-700">
                  {selectedBUA.name}
                </div>
                <div className="text-xs text-violet-600 mt-1">
                  Population: {selectedBUA.pop.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
