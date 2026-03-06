'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Info, MapPin, ChevronDown, Store } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { BUAMap } from '@/components/buas/BUAMap'
import { BUASearch } from '@/components/buas/BUASearch'
import { ResultsPanel } from '@/components/buas/ResultsPanel'
import { CompanySelector } from '@/components/buas/CompanySelector'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { BUA } from '@/lib/buas'

const MAX_POPULATION = 1500000 // 1.5 million
const MIN_POPULATION = 0

export default function BUAsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [center, setCenter] = useState<{ lat: number; lng: number } | undefined>()
  const [populationRange, setPopulationRange] = useState<[number, number]>([MIN_POPULATION, MAX_POPULATION])
  const [selectedBUA, setSelectedBUA] = useState<{ name: string; pop: number } | null>(null)
  const [filteredBUAs, setFilteredBUAs] = useState<BUA[]>([])
  const [isLoadingBUAs, setIsLoadingBUAs] = useState(false)

  // Filter state for store inclusion/exclusion
  const [includeCompanies, setIncludeCompanies] = useState<number[]>([])
  const [includeCategories, setIncludeCategories] = useState<number[]>([])
  const [excludeCompanies, setExcludeCompanies] = useState<number[]>([])
  const [excludeCategories, setExcludeCategories] = useState<number[]>([])

  // Derived values for map filtering
  const minPop = populationRange[0]
  const maxPop = populationRange[1]

  const handleBUASelect = (bua: {
    name: string
    coordinates: { lat: number; lng: number }
    gsscode: string
    pop: number
  }) => {
    setCenter(bua.coordinates)
    setSelectedBUA({ name: bua.name, pop: bua.pop })
  }

  const handlePopulationRangeChange = (value: number[]) => {
    setPopulationRange([value[0], value[1]])
  }

  const handleMinPopInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    if (!isNaN(value) && value >= MIN_POPULATION && value <= maxPop) {
      setPopulationRange([value, maxPop])
    }
  }

  const handleMaxPopInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    if (!isNaN(value) && value >= minPop && value <= MAX_POPULATION) {
      setPopulationRange([minPop, value])
    }
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

  // Fetch filtered BUAs when filters change
  useEffect(() => {
    const fetchFilteredBUAs = async () => {
      setIsLoadingBUAs(true)
      try {
        // Build filter payload
        const filters: any = {
          minPop,
          maxPop
        }

        // Add include filters if any
        if (includeCompanies.length > 0) {
          filters.includeBrands = includeCompanies
        }
        if (includeCategories.length > 0) {
          filters.includeCategories = includeCategories
        }

        // Add exclude filters if any
        if (excludeCompanies.length > 0) {
          filters.excludeBrands = excludeCompanies
        }
        if (excludeCategories.length > 0) {
          filters.excludeCategories = excludeCategories
        }

        const response = await fetch('/api/public/gaps/find', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(filters)
        })

        if (response.ok) {
          const data = await response.json()
          setFilteredBUAs(data.results || [])
        }
      } catch (error) {
        console.error('Error fetching filtered BUAs:', error)
        setFilteredBUAs([])
      } finally {
        setIsLoadingBUAs(false)
      }
    }

    // Debounce the fetch to avoid too many API calls
    const debounceTimer = setTimeout(fetchFilteredBUAs, 500)
    return () => clearTimeout(debounceTimer)
  }, [minPop, maxPop, includeCompanies, includeCategories, excludeCompanies, excludeCategories])

  const handleBUAListItemClick = (bua: BUA) => {
    setCenter({ lat: bua.centroid_lat, lng: bua.centroid_lon })
    setSelectedBUA({ name: bua.name, pop: bua.pop })
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

        {/* Main Content - Three Panel Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar (380px) */}
          <div className="w-[380px] border-r bg-background flex flex-col">
            <Tabs defaultValue="find-gaps" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 m-2">
                <TabsTrigger value="find-gaps">Find Gaps</TabsTrigger>
                <TabsTrigger value="assess-area" disabled>Assess Area</TabsTrigger>
              </TabsList>

              {/* Find Gaps Tab Content */}
              <TabsContent value="find-gaps" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
                {/* Search - Always Visible */}
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

                {/* Collapsible: Population Range */}
                <Collapsible defaultOpen={true}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-900">Population Range</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {minPop === MIN_POPULATION && maxPop === MAX_POPULATION ? 'All' : 'Filtered'}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 pt-3 space-y-3">
                    <div className="px-2">
                      <Slider
                        value={populationRange}
                        onValueChange={handlePopulationRangeChange}
                        min={MIN_POPULATION}
                        max={MAX_POPULATION}
                        step={1000}
                        minStepsBetweenThumbs={1}
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="min-pop-input" className="text-xs text-gray-600 mb-1 block">
                          Min Population
                        </Label>
                        <Input
                          id="min-pop-input"
                          type="number"
                          min={MIN_POPULATION}
                          max={maxPop}
                          value={minPop}
                          onChange={handleMinPopInputChange}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="max-pop-input" className="text-xs text-gray-600 mb-1 block">
                          Max Population
                        </Label>
                        <Input
                          id="max-pop-input"
                          type="number"
                          min={minPop}
                          max={MAX_POPULATION}
                          value={maxPop}
                          onChange={handleMaxPopInputChange}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Collapsible: Include Stores */}
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-900">Include Stores</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {includeCompanies.length + includeCategories.length} selected
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 pt-3">
                    <div className="text-xs text-gray-600 mb-3">
                      Show only BUAs that have these stores
                    </div>
                    <CompanySelector
                      selectedCompanies={includeCompanies}
                      selectedCategories={includeCategories}
                      onCompaniesChange={setIncludeCompanies}
                      onCategoriesChange={setIncludeCategories}
                      mode="include"
                    />
                  </CollapsibleContent>
                </Collapsible>

                {/* Collapsible: Exclude Stores */}
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-900">Exclude Stores</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {excludeCompanies.length + excludeCategories.length} selected
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 pt-3">
                    <div className="text-xs text-gray-600 mb-3">
                      Hide BUAs that have these stores
                    </div>
                    <CompanySelector
                      selectedCompanies={excludeCompanies}
                      selectedCategories={excludeCategories}
                      onCompaniesChange={setExcludeCompanies}
                      onCategoriesChange={setExcludeCategories}
                      mode="exclude"
                    />
                  </CollapsibleContent>
                </Collapsible>

                {/* Collapsible: Proximity Exclusion (Placeholder) */}
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-900">Proximity Exclusion</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">None</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 pt-3">
                    <div className="text-sm text-gray-500 text-center py-4">
                      <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p>Exclude BUAs near specific stores</p>
                      <p className="text-xs mt-1">Coming soon...</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>

              {/* Assess Area Tab Content (Placeholder) */}
              <TabsContent value="assess-area" className="flex-1 overflow-y-auto p-4">
                <div className="text-sm text-gray-500">
                  Assess Area mode coming soon...
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Map (flex-1) */}
          <div className="flex-1 relative overflow-hidden min-w-[500px]">
            <BUAMap
              center={center}
              minPopulation={minPop}
              maxPopulation={maxPop}
              onBUAClick={(gsscode, name, pop) => setSelectedBUA({ name, pop })}
              className="w-full h-full"
            />
          </div>

          {/* Right Results Panel (360px) */}
          <ResultsPanel
            results={filteredBUAs}
            isLoading={isLoadingBUAs}
            selectedBUA={selectedBUA}
            onItemClick={handleBUAListItemClick}
          />
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

              <div className="px-2">
                <Slider
                  value={populationRange}
                  onValueChange={handlePopulationRangeChange}
                  min={MIN_POPULATION}
                  max={MAX_POPULATION}
                  step={1000}
                  minStepsBetweenThumbs={1}
                  className="w-full"
                />
              </div>

              {/* Numerical Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="mobile-min-pop-input" className="text-xs text-gray-600 mb-1 block">
                    Min Population
                  </Label>
                  <Input
                    id="mobile-min-pop-input"
                    type="number"
                    min={MIN_POPULATION}
                    max={maxPop}
                    value={minPop}
                    onChange={handleMinPopInputChange}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="mobile-max-pop-input" className="text-xs text-gray-600 mb-1 block">
                    Max Population
                  </Label>
                  <Input
                    id="mobile-max-pop-input"
                    type="number"
                    min={minPop}
                    max={MAX_POPULATION}
                    value={maxPop}
                    onChange={handleMaxPopInputChange}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Filtered BUAs List (Mobile) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Matching BUAs</Label>
                <span className="text-xs text-gray-500">
                  {isLoadingBUAs ? 'Loading...' : `Top ${filteredBUAs.length}`}
                </span>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {isLoadingBUAs ? (
                  <div className="p-3 text-center text-sm text-gray-500">
                    Loading...
                  </div>
                ) : filteredBUAs.length === 0 ? (
                  <div className="p-3 text-center text-sm text-gray-500">
                    No matches
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    {filteredBUAs.slice(0, 50).map((bua) => (
                      <button
                        key={bua.gsscode}
                        onClick={() => handleBUAListItemClick(bua)}
                        className={cn(
                          "w-full px-3 py-2 text-left hover:bg-violet-50 transition-colors border-b border-gray-100 last:border-b-0",
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
          </div>
        </div>
      </div>
    </div>
  )
}
