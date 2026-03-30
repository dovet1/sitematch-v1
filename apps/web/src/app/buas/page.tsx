'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Info, MapPin, ChevronDown, Store, Settings } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { BUAMap } from '@/components/buas/BUAMap'
import { BUASearch } from '@/components/buas/BUASearch'
import { ResultsPanel } from '@/components/buas/ResultsPanel'
import { CompanySelector } from '@/components/buas/CompanySelector'
import { IncludeModal } from '@/components/buas/IncludeModal'
import { ExcludeModal } from '@/components/buas/ExcludeModal'
import { ProximityModal, type ProximityRule } from '@/components/buas/ProximityModal'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { BUA } from '@/lib/buas'
import type { Store as StoreType } from '@/lib/stores'

const MAX_POPULATION = 1500000 // 1.5 million
const MIN_POPULATION = 0

export default function BUAsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [center, setCenter] = useState<{ lat: number; lng: number } | undefined>()
  const [populationRange, setPopulationRange] = useState<[number, number]>([MIN_POPULATION, MAX_POPULATION])
  const [minPopInput, setMinPopInput] = useState<string>(MIN_POPULATION.toString())
  const [maxPopInput, setMaxPopInput] = useState<string>(MAX_POPULATION.toString())
  const [selectedBUA, setSelectedBUA] = useState<{ name: string; pop: number } | null>(null)
  const [filteredBUAs, setFilteredBUAs] = useState<BUA[]>([])
  const [totalBUAs, setTotalBUAs] = useState<number>(0)
  const [isLoadingBUAs, setIsLoadingBUAs] = useState(false)
  const [mapGssCodes, setMapGssCodes] = useState<string[]>([])  // All gsscodes for map filtering

  // Filter state for store inclusion/exclusion (fascia IDs and category IDs are strings/UUIDs)
  const [includeCompanies, setIncludeCompanies] = useState<string[]>([])
  const [includeCategories, setIncludeCategories] = useState<string[]>([])
  const [excludeCompanies, setExcludeCompanies] = useState<string[]>([])
  const [excludeCategories, setExcludeCategories] = useState<string[]>([])
  const [proximityExclude, setProximityExclude] = useState<ProximityRule[]>([])

  // Visibility state for store pins (Record<filterId, isVisible>)
  const [includeCompaniesVisibility, setIncludeCompaniesVisibility] = useState<Record<string, boolean>>({})
  const [includeCategoriesVisibility, setIncludeCategoriesVisibility] = useState<Record<string, boolean>>({})
  const [excludeCompaniesVisibility, setExcludeCompaniesVisibility] = useState<Record<string, boolean>>({})
  const [excludeCategoriesVisibility, setExcludeCategoriesVisibility] = useState<Record<string, boolean>>({})

  // Viewport-based store pins for Find Gaps mode
  const [includedStores, setIncludedStores] = useState<StoreType[]>([])
  const [excludedStores, setExcludedStores] = useState<StoreType[]>([])
  const [mapViewport, setMapViewport] = useState<{
    minLat: number
    minLon: number
    maxLat: number
    maxLon: number
  } | null>(null)

  // Filter modal states (three separate modals)
  const [includeModalOpen, setIncludeModalOpen] = useState(false)
  const [excludeModalOpen, setExcludeModalOpen] = useState(false)
  const [proximityModalOpen, setProximityModalOpen] = useState(false)

  // Assess Area mode state
  const [currentMode, setCurrentMode] = useState<'find-gaps' | 'assess-area'>('find-gaps')
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusMeters, setRadiusMeters] = useState(5000) // 5km default
  const [assessCompanies, setAssessCompanies] = useState<string[]>([])
  const [assessCategories, setAssessCategories] = useState<string[]>([])
  const [nearbyStores, setNearbyStores] = useState<StoreType[]>([])
  const [isLoadingStores, setIsLoadingStores] = useState(false)

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

  const handleViewportChange = useCallback((bounds: {
    minLat: number
    minLon: number
    maxLat: number
    maxLon: number
  }) => {
    setMapViewport(bounds)
  }, [])

  const handlePopulationRangeChange = (value: number[]) => {
    setPopulationRange([value[0], value[1]])
    setMinPopInput(value[0].toString())
    setMaxPopInput(value[1].toString())
  }

  const handleMinPopInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setMinPopInput(inputValue)

    // Allow empty string (user is clearing/typing)
    if (inputValue === '') {
      return
    }

    const value = Number(inputValue)
    if (!isNaN(value)) {
      // Clamp to valid range
      const clampedValue = Math.max(MIN_POPULATION, Math.min(value, maxPop))
      setPopulationRange([clampedValue, maxPop])
    }
  }

  const handleMinPopInputBlur = () => {
    if (minPopInput === '' || isNaN(Number(minPopInput))) {
      setMinPopInput(minPop.toString())
    }
  }

  const handleMaxPopInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setMaxPopInput(inputValue)

    // Allow empty string (user is clearing/typing)
    if (inputValue === '') {
      return
    }

    const value = Number(inputValue)
    if (!isNaN(value)) {
      // Clamp to valid range
      const clampedValue = Math.max(minPop, Math.min(value, MAX_POPULATION))
      setPopulationRange([minPop, clampedValue])
    }
  }

  const handleMaxPopInputBlur = () => {
    if (maxPopInput === '' || isNaN(Number(maxPopInput))) {
      setMaxPopInput(maxPop.toString())
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

  // Auto-initialize visibility when filters change (default to visible)
  useEffect(() => {
    setIncludeCompaniesVisibility(prev => {
      const updated = { ...prev }
      includeCompanies.forEach(id => {
        if (!(id in updated)) updated[id] = true // Default to visible
      })
      // Remove visibility for deselected filters
      Object.keys(updated).forEach(id => {
        if (!includeCompanies.includes(id)) delete updated[id]
      })
      return updated
    })
  }, [includeCompanies])

  useEffect(() => {
    setIncludeCategoriesVisibility(prev => {
      const updated = { ...prev }
      includeCategories.forEach(id => {
        if (!(id in updated)) updated[id] = true
      })
      Object.keys(updated).forEach(id => {
        if (!includeCategories.includes(id)) delete updated[id]
      })
      return updated
    })
  }, [includeCategories])

  useEffect(() => {
    setExcludeCompaniesVisibility(prev => {
      const updated = { ...prev }
      excludeCompanies.forEach(id => {
        if (!(id in updated)) updated[id] = true
      })
      Object.keys(updated).forEach(id => {
        if (!excludeCompanies.includes(id)) delete updated[id]
      })
      return updated
    })
  }, [excludeCompanies])

  useEffect(() => {
    setExcludeCategoriesVisibility(prev => {
      const updated = { ...prev }
      excludeCategories.forEach(id => {
        if (!(id in updated)) updated[id] = true
      })
      Object.keys(updated).forEach(id => {
        if (!excludeCategories.includes(id)) delete updated[id]
      })
      return updated
    })
  }, [excludeCategories])

  // Fetch viewport stores when viewport or filters change (with visibility filtering)
  useEffect(() => {
    if (!mapViewport) {
      return
    }

    // Filter by visibility before sending to API
    const visibleIncludeCompanies = includeCompanies.filter(
      id => includeCompaniesVisibility[id] !== false
    )
    const visibleIncludeCategories = includeCategories.filter(
      id => includeCategoriesVisibility[id] !== false
    )
    const visibleExcludeCompanies = excludeCompanies.filter(
      id => excludeCompaniesVisibility[id] !== false
    )
    const visibleExcludeCategories = excludeCategories.filter(
      id => excludeCategoriesVisibility[id] !== false
    )

    const hasVisibleFilters =
      visibleIncludeCompanies.length > 0 ||
      visibleIncludeCategories.length > 0 ||
      visibleExcludeCompanies.length > 0 ||
      visibleExcludeCategories.length > 0

    if (!hasVisibleFilters) {
      setIncludedStores([])
      setExcludedStores([])
      return
    }

    const fetchViewportStores = async () => {
      try {
        const params = new URLSearchParams()

        params.append('minLat', mapViewport.minLat.toString())
        params.append('minLon', mapViewport.minLon.toString())
        params.append('maxLat', mapViewport.maxLat.toString())
        params.append('maxLon', mapViewport.maxLon.toString())

        // Only include visible filters
        if (visibleIncludeCompanies.length > 0) {
          params.append('includeBrandIds', visibleIncludeCompanies.join(','))
        }
        if (visibleIncludeCategories.length > 0) {
          params.append('includeCategories', visibleIncludeCategories.join(','))
        }
        if (visibleExcludeCompanies.length > 0) {
          params.append('excludeBrandIds', visibleExcludeCompanies.join(','))
        }
        if (visibleExcludeCategories.length > 0) {
          params.append('excludeCategories', visibleExcludeCategories.join(','))
        }

        params.append('limit', '2000')

        const response = await fetch(`/api/public/stores/in-viewport?${params}`)
        const data = await response.json()

        setIncludedStores(data.includedStores || [])
        setExcludedStores(data.excludedStores || [])
      } catch (error) {
        console.error('Failed to fetch viewport stores:', error)
        setIncludedStores([])
        setExcludedStores([])
      }
    }

    // Debounce viewport changes
    const timeoutId = setTimeout(fetchViewportStores, 500)
    return () => clearTimeout(timeoutId)
  }, [
    mapViewport,
    includeCompanies,
    includeCategories,
    excludeCompanies,
    excludeCategories,
    includeCompaniesVisibility,
    includeCategoriesVisibility,
    excludeCompaniesVisibility,
    excludeCategoriesVisibility
  ])

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

        // Add proximity exclusion filters if any
        if (proximityExclude.length > 0) {
          filters.nearbyExclude = proximityExclude
        }

        console.log('🔍 Gap Analysis Filters:', JSON.stringify(filters, null, 2))

        // Call both endpoints in parallel:
        // 1. /api/public/gaps/find - Returns top 1,000 BUAs for the results panel
        // 2. /api/public/gaps/filter - Returns ALL matching gsscodes for the map
        const [findResponse, filterResponse] = await Promise.all([
          fetch('/api/public/gaps/find', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
          }),
          fetch('/api/public/gaps/filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
          })
        ])

        if (findResponse.ok) {
          const data = await findResponse.json()
          console.log('📊 Results Panel API Response:', {
            resultsCount: data.results?.length,
            total: data.total,
            showing: data.showing
          })
          setFilteredBUAs(data.results || [])
          setTotalBUAs(data.total || data.results?.length || 0)
        }

        if (filterResponse.ok) {
          const data = await filterResponse.json()
          console.log('🗺️ Map Filter API Response:', {
            gsscodesCount: data.gsscodes?.length,
            total: data.total
          })
          setMapGssCodes(data.gsscodes || [])
        }
      } catch (error) {
        console.error('Error fetching filtered BUAs:', error)
        setFilteredBUAs([])
        setMapGssCodes([])
      } finally {
        setIsLoadingBUAs(false)
      }
    }

    // Debounce the fetch to avoid too many API calls
    const debounceTimer = setTimeout(fetchFilteredBUAs, 500)
    return () => clearTimeout(debounceTimer)
  }, [minPop, maxPop, includeCompanies, includeCategories, excludeCompanies, excludeCategories, proximityExclude])

  // Fetch nearby stores when point is selected (Assess Area mode)
  useEffect(() => {
    if (!selectedPoint || currentMode !== 'assess-area') {
      setNearbyStores([])
      return
    }

    const fetchNearbyStores = async () => {
      setIsLoadingStores(true)
      try {
        const params = new URLSearchParams({
          lat: selectedPoint.lat.toString(),
          lon: selectedPoint.lng.toString(),
          radius: radiusMeters.toString()
        })

        if (assessCompanies.length > 0) {
          params.append('brandIds', assessCompanies.join(','))
        }
        if (assessCategories.length > 0) {
          params.append('categoryIds', assessCategories.join(','))
        }

        const response = await fetch(`/api/public/stores/nearby?${params.toString()}`)

        if (response.ok) {
          const data = await response.json()
          setNearbyStores(data.stores || [])
        }
      } catch (error) {
        console.error('Error fetching nearby stores:', error)
        setNearbyStores([])
      } finally {
        setIsLoadingStores(false)
      }
    }

    // Debounce the fetch
    const debounceTimer = setTimeout(fetchNearbyStores, 500)
    return () => clearTimeout(debounceTimer)
  }, [selectedPoint, radiusMeters, assessCompanies, assessCategories, currentMode])

  const handleBUAListItemClick = (bua: BUA) => {
    setCenter({ lat: bua.centroid_lat, lng: bua.centroid_lon })
    setSelectedBUA({ name: bua.name, pop: bua.pop })
  }

  return (
    <div className="h-screen bg-background overflow-hidden">
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
          <div className="w-[380px] border-r bg-gradient-to-b from-gray-50/50 to-background flex flex-col h-full">
            <Tabs
              defaultValue="find-gaps"
              className="flex-1 flex flex-col overflow-hidden"
              onValueChange={(value) => setCurrentMode(value as 'find-gaps' | 'assess-area')}
            >
              <TabsList className="grid w-full grid-cols-2 my-3">
                <TabsTrigger value="find-gaps">Find Gaps</TabsTrigger>
                <TabsTrigger value="assess-area">Assess Area</TabsTrigger>
              </TabsList>

              {/* Find Gaps Tab Content */}
              <TabsContent value="find-gaps" className="flex-1 overflow-y-auto p-6 space-y-6 mt-0 pt-1">
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
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-purple-50/30 rounded-lg transition-all duration-200">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-900">Population Range</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {minPop === MIN_POPULATION && maxPop === MAX_POPULATION ? 'All' : 'Filtered'}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-6 pt-4 space-y-3">
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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="min-pop-input" className="text-xs text-gray-600 mb-1 block">
                          Min Population
                        </Label>
                        <Input
                          id="min-pop-input"
                          type="number"
                          min={MIN_POPULATION}
                          max={maxPop}
                          value={minPopInput}
                          onChange={handleMinPopInputChange}
                          onBlur={handleMinPopInputBlur}
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
                          value={maxPopInput}
                          onChange={handleMaxPopInputChange}
                          onBlur={handleMaxPopInputBlur}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Include Filters */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Include Stores</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIncludeModalOpen(true)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  {(includeCompanies.length > 0 || includeCategories.length > 0) ? (
                    <div className="flex flex-wrap gap-1">
                      {includeCompanies.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {includeCompanies.length} fascia{includeCompanies.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {includeCategories.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {includeCategories.length} categor{includeCategories.length !== 1 ? 'ies' : 'y'}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 text-center py-2 border border-dashed border-gray-200 rounded">
                      No include filters
                    </div>
                  )}
                </div>

                {/* Exclude Filters */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Exclude Stores</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExcludeModalOpen(true)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  {(excludeCompanies.length > 0 || excludeCategories.length > 0) ? (
                    <div className="flex flex-wrap gap-1">
                      {excludeCompanies.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {excludeCompanies.length} fascia{excludeCompanies.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {excludeCategories.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {excludeCategories.length} categor{excludeCategories.length !== 1 ? 'ies' : 'y'}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 text-center py-2 border border-dashed border-gray-200 rounded">
                      No exclude filters
                    </div>
                  )}
                </div>

                {/* Proximity Exclusion */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Proximity Exclusion</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProximityModalOpen(true)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  {proximityExclude.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {proximityExclude.length} rule{proximityExclude.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 text-center py-2 border border-dashed border-gray-200 rounded">
                      No proximity rules
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Assess Area Tab Content */}
              <TabsContent value="assess-area" className="flex-1 overflow-y-auto p-6 space-y-6 mt-0 pt-1">
                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-900">
                      Click anywhere on the map to analyze stores within a radius of that point.
                    </p>
                  </div>
                </div>

                {/* Point Selection Status */}
                {selectedPoint ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-900">Point Selected</p>
                        <p className="text-xs text-green-700 font-mono">
                          {selectedPoint.lat.toFixed(4)}, {selectedPoint.lng.toFixed(4)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPoint(null)}
                        className="h-8"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm text-gray-600 mb-3">
                      Click on the map to select a location
                    </p>
                    <p className="text-xs text-gray-500">
                      You can analyze stores within a radius of any point
                    </p>
                  </div>
                )}

                {/* Radius Settings */}
                <Collapsible defaultOpen={true}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-purple-50/30 rounded-lg transition-all duration-200">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-900">Radius Settings</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {radiusMeters / 1000}km
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-6 pt-4 space-y-3">
                    <div>
                      <Label htmlFor="radius-slider" className="text-sm font-medium mb-2 block">
                        Search Radius: {(radiusMeters / 1000).toFixed(1)} km
                      </Label>
                      <Slider
                        id="radius-slider"
                        value={[radiusMeters]}
                        onValueChange={(value) => setRadiusMeters(value[0])}
                        min={500}
                        max={20000}
                        step={500}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0.5 km</span>
                        <span>20 km</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant={radiusMeters === 1000 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setRadiusMeters(1000)}
                        className="text-xs"
                      >
                        1 km
                      </Button>
                      <Button
                        variant={radiusMeters === 5000 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setRadiusMeters(5000)}
                        className="text-xs"
                      >
                        5 km
                      </Button>
                      <Button
                        variant={radiusMeters === 10000 ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setRadiusMeters(10000)}
                        className="text-xs"
                      >
                        10 km
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Store Filters */}
                <Collapsible defaultOpen={true}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-purple-50/30 rounded-lg transition-all duration-200">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-900">Store Filters</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {assessCompanies.length + assessCategories.length === 0
                        ? 'All'
                        : `${assessCompanies.length + assessCategories.length} selected`}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-6 pt-4">
                    <div className="text-xs text-gray-600 mb-3">
                      Filter which stores to show in results
                    </div>
                    <CompanySelector
                      selectedCompanies={assessCompanies}
                      selectedCategories={assessCategories}
                      onCompaniesChange={setAssessCompanies}
                      onCategoriesChange={setAssessCategories}
                      mode="include"
                    />
                  </CollapsibleContent>
                </Collapsible>
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
              mode={currentMode}
              selectedPoint={selectedPoint}
              onPointSelected={setSelectedPoint}
              radiusMeters={radiusMeters}
              stores={nearbyStores}
              filteredGssCodes={
                currentMode === 'find-gaps' &&
                (includeCompanies.length > 0 || includeCategories.length > 0 || excludeCompanies.length > 0 || excludeCategories.length > 0)
                  ? mapGssCodes
                  : undefined
              }
              includedStores={includedStores}
              excludedStores={excludedStores}
              onViewportChange={handleViewportChange}
            />
          </div>

          {/* Right Results Panel (360px) */}
          <ResultsPanel
            results={currentMode === 'find-gaps' ? filteredBUAs : nearbyStores}
            isLoading={currentMode === 'find-gaps' ? isLoadingBUAs : isLoadingStores}
            selectedBUA={selectedBUA}
            onItemClick={handleBUAListItemClick}
            mode={currentMode}
            total={currentMode === 'find-gaps' ? totalBUAs : undefined}
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
            includedStores={includedStores}
            excludedStores={excludedStores}
            onViewportChange={handleViewportChange}
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
                    value={minPopInput}
                    onChange={handleMinPopInputChange}
                    onBlur={handleMinPopInputBlur}
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
                    value={maxPopInput}
                    onChange={handleMaxPopInputChange}
                    onBlur={handleMaxPopInputBlur}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Filtered BUAs List (Mobile) */}
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Matching BUAs</Label>
                  <span className={totalBUAs > 1000 ? "text-xs font-bold text-amber-600" : "text-xs text-gray-500"}>
                    {(() => {
                      console.log('🎨 Render check - totalBUAs:', totalBUAs, 'filteredBUAs.length:', filteredBUAs.length)
                      if (isLoadingBUAs) return 'Loading...'
                      if (totalBUAs > 1000) return `Showing ${filteredBUAs.length.toLocaleString()} of ${totalBUAs.toLocaleString()}`
                      return `${filteredBUAs.length} result${filteredBUAs.length !== 1 ? 's' : ''}`
                    })()}
                  </span>
                </div>
                {!isLoadingBUAs && totalBUAs > 1000 && (
                  <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    Showing top 1,000 by population. Refine filters to see all {totalBUAs.toLocaleString()} results.
                  </div>
                )}
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

      {/* Include Modal */}
      <IncludeModal
        open={includeModalOpen}
        onOpenChange={setIncludeModalOpen}
        includeCompanies={includeCompanies}
        includeCategories={includeCategories}
        onIncludeCompaniesChange={setIncludeCompanies}
        onIncludeCategoriesChange={setIncludeCategories}
        companiesVisibility={includeCompaniesVisibility}
        categoriesVisibility={includeCategoriesVisibility}
        onCompaniesVisibilityChange={setIncludeCompaniesVisibility}
        onCategoriesVisibilityChange={setIncludeCategoriesVisibility}
      />

      {/* Exclude Modal */}
      <ExcludeModal
        open={excludeModalOpen}
        onOpenChange={setExcludeModalOpen}
        excludeCompanies={excludeCompanies}
        excludeCategories={excludeCategories}
        onExcludeCompaniesChange={setExcludeCompanies}
        onExcludeCategoriesChange={setExcludeCategories}
        companiesVisibility={excludeCompaniesVisibility}
        categoriesVisibility={excludeCategoriesVisibility}
        onCompaniesVisibilityChange={setExcludeCompaniesVisibility}
        onCategoriesVisibilityChange={setExcludeCategoriesVisibility}
      />

      {/* Proximity Modal */}
      <ProximityModal
        open={proximityModalOpen}
        onOpenChange={setProximityModalOpen}
        proximityExclude={proximityExclude}
        onProximityExcludeChange={setProximityExclude}
      />
    </div>
  )
}
