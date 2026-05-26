'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, MapPin, ChevronDown, Search } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { BUAMap, StoreUpdateSource } from '@/components/gapfinder/BUAMap'
import { BUASearch } from '@/components/gapfinder/BUASearch'
import { ResultsPanel } from '@/components/gapfinder/ResultsPanel'
import { FilterBuilder } from '@/components/gapfinder/FilterBuilder'
import { RequirementCompanySelector } from '@/components/gapfinder/RequirementCompanySelector'
import { UnifiedCategorySelector } from '@/components/gapfinder/UnifiedCategorySelector'
import { AreaAccordion } from '@/components/gapfinder/AreaAccordion'
import { ComparisonModal } from '@/components/gapfinder/ComparisonModal'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Toaster } from 'sonner'
import type { BUA } from '@/lib/buas'
import type { Store as StoreType, ViewportStore } from '@/lib/stores'
import type { FilterSet } from '@/types/filters'
import { convertFilterSetToViewportParams, generateTargetBadgeMapping, hasActiveFilters, expandTargetsToFascias, type TargetWithMetadata } from '@/lib/filter-utils'
import { exportBUAsToCSV } from '@/lib/buas/export-utils'
import { exportNearbyStoresToCSV } from '@/lib/export-utils'
import { type CategoryNode } from '@/lib/category-tree-utils'
import type { TravelTimeData } from '@/types/travel-time'

const MAX_POPULATION = 1200000 // 1.2 million
const MIN_POPULATION = 5001 // Changed from 0
type AssessArea = 'area-a' | 'area-b'

const TRAFFIC_THRESHOLDS = [
  0, 1000, 2000, 5000, 10000, 20000, 30000, 50000,
  75000, 100000, 150000, 200000, 250000
] // 13 steps with finer granularity at lower values

const getTravelTimeCacheKey = (storeId: string, area: AssessArea) => {
  return `${storeId}:${area}`
}

const removeTravelTimeAreaEntries = <T,>(entries: Record<string, T>, area: AssessArea) => {
  const next: Record<string, T> = {}
  const areaSuffix = `:${area}`
  const legacyAreaSuffix = area === 'area-a' ? ':a' : ':b'

  for (const [key, value] of Object.entries(entries)) {
    const isAreaEntry =
      key.endsWith(areaSuffix) ||
      key.endsWith(legacyAreaSuffix) ||
      (area === 'area-a' && !key.includes(':'))

    if (!isAreaEntry) {
      next[key] = value
    }
  }

  return next
}

const moveTravelTimeAreaEntries = <T,>(
  entries: Record<string, T>,
  fromArea: AssessArea,
  toArea: AssessArea
) => {
  const next: Record<string, T> = {}
  const fromSuffix = `:${fromArea}`
  const toSuffix = `:${toArea}`

  for (const [key, value] of Object.entries(entries)) {
    if (key.endsWith(fromSuffix)) {
      next[`${key.slice(0, -fromSuffix.length)}${toSuffix}`] = value
    } else if (!key.endsWith(toSuffix)) {
      next[key] = value
    }
  }

  return next
}

const formatTrafficValue = (aadt: number): string => {
  if (aadt === 0) return '0'
  if (aadt >= 1000) return `${(aadt / 1000).toFixed(0)}k`
  return aadt.toLocaleString()
}

export default function GapFinderClient() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [center, setCenter] = useState<{ lat: number; lng: number } | undefined>()
  const [populationRange, setPopulationRange] = useState<[number, number]>([MIN_POPULATION, MAX_POPULATION])
  const [minPopInput, setMinPopInput] = useState<string>(MIN_POPULATION.toString())
  const [maxPopInput, setMaxPopInput] = useState<string>(MAX_POPULATION.toString())
  const [showSubFiveK, setShowSubFiveK] = useState<boolean>(false)
  const [minPopError, setMinPopError] = useState<string>('')
  const [selectedBUA, setSelectedBUA] = useState<{ name: string; pop: number } | null>(null)
  const [selectedBUAGsscode, setSelectedBUAGsscode] = useState<string | null>(null)
  const [filteredBUAs, setFilteredBUAs] = useState<BUA[]>([])
  const [totalBUAs, setTotalBUAs] = useState<number>(0)
  const [isLoadingBUAs, setIsLoadingBUAs] = useState(false)
  const [isExportingBUAs, setIsExportingBUAs] = useState(false)
  const [isExportingNearbyStores, setIsExportingNearbyStores] = useState(false)
  const [mapGssCodes, setMapGssCodes] = useState<string[]>([])  // All gsscodes for map filtering
  const [sidebarSelectionNonce, setSidebarSelectionNonce] = useState(0)
  const [centerFlyToZoom, setCenterFlyToZoom] = useState(12)

  // NEW: Advanced filter state using FilterSet
  const [filterSet, setFilterSet] = useState<FilterSet>({ rules: [] })

  // Target names mapping (fascia/category ID -> name) for filter display
  const [targetNames, setTargetNames] = useState<Record<string, string>>({})

  // Category tree for expanding categories to fascias
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([])

  // Visibility tracking for fascias and categories (sparse: only store false for hidden)
  const [companiesVisibility, setCompaniesVisibility] = useState<Record<string, boolean>>({})
  const [categoriesVisibility, setCategoriesVisibility] = useState<Record<string, boolean>>({})

  // Clean up visibility state when targets are removed from filters
  useEffect(() => {
    // Separate sets for fascias and categories to avoid type mixing
    const selectedFasciaIds = new Set<string>()
    const selectedCategoryIds = new Set<string>()

    filterSet.rules.forEach(rule => {
      rule.targetIds.forEach(id => {
        if (rule.targetType === 'fascia') {
          selectedFasciaIds.add(id)
        } else {
          selectedCategoryIds.add(id)
        }
      })
    })

    // Clean up fascia visibility records
    setCompaniesVisibility(prev => {
      const cleaned: Record<string, boolean> = {}
      Object.keys(prev).forEach(id => {
        if (selectedFasciaIds.has(id)) cleaned[id] = prev[id]
      })
      return Object.keys(cleaned).length !== Object.keys(prev).length ? cleaned : prev
    })

    // Clean up category visibility records
    setCategoriesVisibility(prev => {
      const cleaned: Record<string, boolean> = {}
      Object.keys(prev).forEach(id => {
        if (selectedCategoryIds.has(id)) cleaned[id] = prev[id]
      })
      return Object.keys(cleaned).length !== Object.keys(prev).length ? cleaned : prev
    })
  }, [filterSet])

  // Viewport-based store pins for Find Gaps mode
  const [includedStores, setIncludedStores] = useState<ViewportStore[]>([])
  const [excludedStores, setExcludedStores] = useState<ViewportStore[]>([])
  const [proximityIncludedStores, setProximityIncludedStores] = useState<ViewportStore[]>([])
  const [proximityExcludedStores, setProximityExcludedStores] = useState<ViewportStore[]>([])
  const [mapViewport, setMapViewport] = useState<{
    minLat: number
    minLon: number
    maxLat: number
    maxLon: number
  } | null>(null)
  const viewportFetchAbortRef = useRef<AbortController | null>(null)

  // Requirement locations overlay state
  const [showRequirementLocations, setShowRequirementLocations] = useState<boolean>(false)
  const [requirementBrandScope, setRequirementBrandScope] = useState<'all' | 'selected'>('all')
  const [selectedRequirementBrands, setSelectedRequirementBrands] = useState<string[]>([])  // Brand names for UI
  const [selectedRequirementListingIds, setSelectedRequirementListingIds] = useState<string[]>([])  // Listing IDs for API

  // Traffic heatmap overlay state
  const [showTrafficHeatmap, setShowTrafficHeatmap] = useState<boolean>(false)
  const [trafficRange, setTrafficRange] = useState<[number, number]>([0, 250000])

  // Population filter collapsible state
  const [isPopulationFilterOpen, setIsPopulationFilterOpen] = useState<boolean>(false)
  // Brand filters collapsible state
  const [isBrandFiltersOpen, setIsBrandFiltersOpen] = useState<boolean>(false)
  const [requirementLocations, setRequirementLocations] = useState<Array<{
    id: string
    listingId: string
    companyName: string
    title: string
    listingType: string
    placeName: string
    formattedAddress: string
    coordinates: { lat: number; lng: number }
  }>>([])
  const requirementFetchAbortRef = useRef<AbortController | null>(null)

  // Badge mapping for linking sidebar to map pins
  const [targetBadgeMapping, setTargetBadgeMapping] = useState<TargetWithMetadata[]>([])

  // NEW: Track why store markers changed (for auto-fit control)
  const [storeUpdateSource, setStoreUpdateSource] = useState<StoreUpdateSource>(StoreUpdateSource.INITIAL_LOAD)

  // Assess Area mode state
  const [currentMode, setCurrentMode] = useState<'find-gaps' | 'assess-area'>('find-gaps')
  const [selectedPoint, setSelectedPoint] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusMeters, setRadiusMeters] = useState(5000) // 5km default
  const [assessFascias, setAssessFascias] = useState<string[]>([])
  const [assessCategories, setAssessCategories] = useState<string[]>([])
  const [nearbyStores, setNearbyStores] = useState<StoreType[]>([])
  const [isLoadingStores, setIsLoadingStores] = useState(false)

  // Missing fascias state (assess area mode)
  const [missingFascias, setMissingFascias] = useState<import('@/lib/stores').MissingFasciaInfo[]>([])
  const [isLoadingMissingFascias, setIsLoadingMissingFascias] = useState(false)
  const [missingFasciasError, setMissingFasciasError] = useState<string | null>(null)

  // Comparison mode state
  const [comparisonMode, setComparisonMode] = useState<'single' | 'selecting-second' | 'comparing'>('single')
  const [selectedPointB, setSelectedPointB] = useState<{ lat: number; lng: number } | null>(null)
  const [radiusMetersB, setRadiusMetersB] = useState(5000)
  const [nearbyStoresB, setNearbyStoresB] = useState<StoreType[]>([])
  const [isLoadingStoresB, setIsLoadingStoresB] = useState(false)
  const [missingFasciasB, setMissingFasciasB] = useState<import('@/lib/stores').MissingFasciaInfo[]>([])
  const [isLoadingMissingFasciasB, setIsLoadingMissingFasciasB] = useState(false)
  const [missingFasciasBError, setMissingFasciasBError] = useState<string | null>(null)
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false)
  const [activeArea, setActiveArea] = useState<'area-a' | 'area-b' | null>('area-a')

  // Travel time state (assess area mode)
  const [travelTimes, setTravelTimes] = useState<Record<string, TravelTimeData>>({})
  const [travelTimeLoading, setTravelTimeLoading] = useState<Record<string, boolean>>({})
  const [travelTimeErrors, setTravelTimeErrors] = useState<Record<string, string>>({})

  const selectedPointRef = useRef(selectedPoint)
  const selectedPointBRef = useRef(selectedPointB)
  const fetchMissingFasciasAbortRef = useRef<AbortController | null>(null)

  // Derived values for map filtering
  const minPop = populationRange[0]
  const maxPop = populationRange[1]

  // Badge lookup for Assess Area mode (distance-based sequential numbering)
  const assessBadgeByStoreId = useMemo<Record<string, number>>(() => {
    if (currentMode !== 'assess-area' || nearbyStores.length === 0) {
      return {}
    }
    const lookup: Record<string, number> = {}
    nearbyStores.forEach((store, index) => {
      lookup[store.id] = index + 1  // Sequential from 1 (nearbyStores already sorted by distance)
    })
    return lookup
  }, [currentMode, nearbyStores])

  // Badge lookup for Area B
  const assessBadgeByStoreIdB = useMemo<Record<string, number>>(() => {
    if (currentMode !== 'assess-area' || nearbyStoresB.length === 0) {
      return {}
    }
    const lookup: Record<string, number> = {}
    nearbyStoresB.forEach((store, index) => {
      lookup[store.id] = index + 1
    })
    return lookup
  }, [currentMode, nearbyStoresB])

  // Comparison data (when comparing two areas)
  const comparisonData = useMemo<import('@/lib/stores').ComparisonData>(() => {
    if (comparisonMode !== 'comparing') {
      return { missingInAOnly: [], missingInBOnly: [], missingInBoth: [] }
    }

    // Sets of fascia IDs that ARE present as stores in each area
    const fasciaIdsInA = new Set(nearbyStores.map(s => s.fascia_id))
    const fasciaIdsInB = new Set(nearbyStoresB.map(s => s.fascia_id))

    // Missing in A: Fascias present in B but NOT in A
    // Filter missingFascias to only include those that ARE in B
    const missingInAOnly = missingFascias.filter(f => fasciaIdsInB.has(f.fasciaId))

    // Missing in B: Fascias present in A but NOT in B
    // Filter missingFasciasB to only include those that ARE in A
    const missingInBOnly = missingFasciasB.filter(f => fasciaIdsInA.has(f.fasciaId))

    // Missing in Both: Fascias NOT present in either area
    const missingInBoth = missingFascias.filter(f =>
      missingFasciasB.some(fb => fb.fasciaId === f.fasciaId)
    )

    return {
      missingInAOnly,
      missingInBOnly,
      missingInBoth
    }
  }, [comparisonMode, nearbyStores, nearbyStoresB, missingFascias, missingFasciasB])

  // Auto open/close population filter based on whether it's filtered
  useEffect(() => {
    const isFiltered = minPop !== MIN_POPULATION || maxPop !== MAX_POPULATION || showSubFiveK
    setIsPopulationFilterOpen(isFiltered)
  }, [minPop, maxPop, showSubFiveK])

  // Auto open/close brand filters when rules are added/removed
  useEffect(() => {
    const isFiltered = filterSet.rules.length > 0
    setIsBrandFiltersOpen(isFiltered)
  }, [filterSet.rules.length])

  useEffect(() => {
    selectedPointRef.current = selectedPoint
  }, [selectedPoint])

  useEffect(() => {
    selectedPointBRef.current = selectedPointB
  }, [selectedPointB])

  const clearTravelTimesForArea = useCallback((area: AssessArea) => {
    setTravelTimes(prev => removeTravelTimeAreaEntries(prev, area))
    setTravelTimeLoading(prev => removeTravelTimeAreaEntries(prev, area))
    setTravelTimeErrors(prev => removeTravelTimeAreaEntries(prev, area))
  }, [])

  const moveTravelTimesBetweenAreas = useCallback((fromArea: AssessArea, toArea: AssessArea) => {
    setTravelTimes(prev => moveTravelTimeAreaEntries(prev, fromArea, toArea))
    setTravelTimeLoading(prev =>
      removeTravelTimeAreaEntries(removeTravelTimeAreaEntries(prev, fromArea), toArea)
    )
    setTravelTimeErrors(prev => moveTravelTimeAreaEntries(prev, fromArea, toArea))
  }, [])

  // Auto-open Area A when entering comparison mode
  useEffect(() => {
    if (comparisonMode === 'comparing' && activeArea === null) {
      setActiveArea('area-a')
    }
  }, [comparisonMode, activeArea])

  const handleBUASelect = (bua: {
    name: string
    coordinates: { lat: number; lng: number }
    gsscode: string
    pop: number
  }) => {
    setCenterFlyToZoom(12)
    setCenter(bua.coordinates)
    setSelectedBUAGsscode(bua.gsscode)
    setSelectedBUA({ name: bua.name, pop: bua.pop })
  }

  const handleAssessAreaBUASelect = (bua: {
    name: string
    coordinates: { lat: number; lng: number }
    gsscode: string
    pop: number
  }) => {
    setCenterFlyToZoom(12)
    setCenter(bua.coordinates)
    setSelectedBUAGsscode(bua.gsscode)
    setSelectedBUA({ name: bua.name, pop: bua.pop })
  }

  const handleViewportChange = useCallback((bounds: {
    minLat: number
    minLon: number
    maxLat: number
    maxLon: number
  }) => {
    // User panned/zoomed the map - next store update should NOT auto-fit
    setStoreUpdateSource(StoreUpdateSource.USER_PAN)
    setMapViewport(bounds)
  }, [])

  const handleFasciaVisibilityToggle = useCallback((fasciaId: string) => {
    setCompaniesVisibility(prev => {
      const currentVisibility = prev[fasciaId]
      if (currentVisibility === false) {
        // Currently hidden, make visible (remove from sparse map)
        const { [fasciaId]: _, ...rest } = prev
        return rest
      } else {
        // Currently visible, hide it
        return { ...prev, [fasciaId]: false }
      }
    })
  }, [])

  // Comparison mode handlers
  const handleAddSecondArea = () => {
    setComparisonMode('selecting-second')
  }

  const handleClearPointA = () => {
    if (comparisonMode === 'comparing') {
      // Promote B to A
      setSelectedPoint(selectedPointB)
      setRadiusMeters(radiusMetersB)
      setNearbyStores(nearbyStoresB)
      setMissingFascias(missingFasciasB)
      moveTravelTimesBetweenAreas('area-b', 'area-a')

      // Clear B
      setSelectedPointB(null)
      setRadiusMetersB(5000)
      setNearbyStoresB([])
      setMissingFasciasB([])

      setComparisonMode('single')
      setActiveArea('area-a')
    } else {
      // Simple clear
      clearTravelTimesForArea('area-a')
      setSelectedPoint(null)
      setNearbyStores([])
      setMissingFascias([])
      setActiveArea('area-a')
    }
  }

  const handleClearPointB = () => {
    clearTravelTimesForArea('area-b')
    setSelectedPointB(null)
    setRadiusMetersB(5000)
    setNearbyStoresB([])
    setMissingFasciasB([])
    setComparisonMode('single')
    setActiveArea('area-a')
  }

  const handlePointSelected = (point: { lat: number; lng: number }) => {
    if (comparisonMode === 'selecting-second') {
      clearTravelTimesForArea('area-b')
      setSelectedPointB(point)
      setComparisonMode('comparing')
    } else {
      clearTravelTimesForArea('area-a')
      setSelectedPoint(point)
    }
  }

  const handlePopulationRangeChange = (value: number[]) => {
    setPopulationRange([value[0], value[1]])
    setMinPopInput(value[0].toString())
    setMaxPopInput(value[1].toString())
  }

  const handleMinPopInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setMinPopInput(inputValue)

    // Clear error as user types
    setMinPopError('')

    // Allow empty string (user is clearing/typing)
    if (inputValue === '') {
      return
    }

    const value = Number(inputValue)
    if (!isNaN(value) && value >= MIN_POPULATION) {
      // Only update if valid - clamp to valid range
      const clampedValue = Math.max(MIN_POPULATION, Math.min(value, maxPop))
      setPopulationRange([clampedValue, maxPop])
    }
  }

  const handleMinPopInputBlur = () => {
    const value = Number(minPopInput)

    if (minPopInput === '' || isNaN(value)) {
      setMinPopInput(MIN_POPULATION.toString())
      setPopulationRange([MIN_POPULATION, maxPop])
      setMinPopError('')
      return
    }

    // Validate on blur
    if (value < MIN_POPULATION) {
      setMinPopError(`Minimum population must be at least ${MIN_POPULATION.toLocaleString()}`)
      setMinPopInput(MIN_POPULATION.toString())
      setPopulationRange([MIN_POPULATION, maxPop])
    } else {
      setMinPopError('')
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

  // Fetch categories and fascias to build targetNames mapping for filter display
  useEffect(() => {
    const fetchTargetNames = async () => {
      try {
        // Fetch all reference data in a single optimized request
        // This replaces ~101 individual requests with 1 request
        const response = await fetch('/api/public/gapfinder-reference-data')
        if (!response.ok) {
          setTargetNames({})
          return
        }

        const data = await response.json()
        const names: Record<string, string> = {}

        // Map category IDs to names
        const categories = data.categories || []
        categories.forEach((cat: any) => {
          names[cat.id] = cat.name
        })

        // Map fascia IDs to names (brands already include nested fascias)
        const brands = data.brands || []
        brands.forEach((brand: any) => {
          const fascias = brand.fascias || []
          fascias.forEach((fascia: any) => {
            names[fascia.id] = fascia.name
          })
        })

        setTargetNames(names)
      } catch {
        setTargetNames({})
      }
    }

    fetchTargetNames()
  }, []) // Only run once on mount

  // Fetch viewport stores with new filterSet format (Find Gaps mode only)
  useEffect(() => {
    if (filterSet.rules.length === 0) {
      setTargetBadgeMapping([])
      return
    }

    // Expand categories to fascias before generating badge mapping
    const expandedFilterSet = expandTargetsToFascias(filterSet, categoryTree)
    setTargetBadgeMapping(generateTargetBadgeMapping(expandedFilterSet, targetNames))
  }, [filterSet, targetNames, categoryTree])

  useEffect(() => {
    if (!mapViewport || currentMode !== 'find-gaps' || filterSet.rules.length === 0) {
      viewportFetchAbortRef.current?.abort()
      setIncludedStores([])
      setExcludedStores([])
      setProximityIncludedStores([])
      setProximityExcludedStores([])
      return
    }

    const fetchViewportStores = async () => {
      const params = convertFilterSetToViewportParams(filterSet)

      // This endpoint groups targets by operator/type, so per-rule distance and
      // matching logic are approximated in map markers rather than preserved exactly.
      if (!hasActiveFilters(params)) {
        setIncludedStores([])
        setExcludedStores([])
        setProximityIncludedStores([])
        setProximityExcludedStores([])
        return
      }

      viewportFetchAbortRef.current?.abort()
      const abortController = new AbortController()
      viewportFetchAbortRef.current = abortController

      try {
        // Build query string
        const queryParams = new URLSearchParams({
          minLat: mapViewport.minLat.toString(),
          minLon: mapViewport.minLon.toString(),
          maxLat: mapViewport.maxLat.toString(),
          maxLon: mapViewport.maxLon.toString(),
          limit: '2000'
        })

        if (params.includeBrandIds.length > 0) {
          queryParams.append('includeBrandIds', params.includeBrandIds.join(','))
        }
        if (params.includeCategories.length > 0) {
          queryParams.append('includeCategories', params.includeCategories.join(','))
        }
        if (params.excludeBrandIds.length > 0) {
          queryParams.append('excludeBrandIds', params.excludeBrandIds.join(','))
        }
        if (params.excludeCategories.length > 0) {
          queryParams.append('excludeCategories', params.excludeCategories.join(','))
        }
        if (params.proximityIncludeBrandIds.length > 0) {
          queryParams.append('proximityIncludeBrandIds', params.proximityIncludeBrandIds.join(','))
        }
        if (params.proximityIncludeCategories.length > 0) {
          queryParams.append('proximityIncludeCategories', params.proximityIncludeCategories.join(','))
        }
        if (params.proximityExcludeBrandIds.length > 0) {
          queryParams.append('proximityExcludeBrandIds', params.proximityExcludeBrandIds.join(','))
        }
        if (params.proximityExcludeCategories.length > 0) {
          queryParams.append('proximityExcludeCategories', params.proximityExcludeCategories.join(','))
        }

        const response = await fetch(`/api/public/stores/in-viewport?${queryParams.toString()}`, {
          signal: abortController.signal
        })

        if (response.ok) {
          const data = await response.json()
          setIncludedStores(data.includedStores || [])
          setExcludedStores(data.excludedStores || [])
          setProximityIncludedStores(data.proximityIncludedStores || [])
          setProximityExcludedStores(data.proximityExcludedStores || [])
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        setIncludedStores([])
        setExcludedStores([])
        setProximityIncludedStores([])
        setProximityExcludedStores([])
      } finally {
        if (viewportFetchAbortRef.current === abortController) {
          viewportFetchAbortRef.current = null
        }
      }
    }

    // Debounce the fetch to avoid excessive API calls during map pan/zoom
    const debounceTimer = setTimeout(fetchViewportStores, 750)
    return () => {
      clearTimeout(debounceTimer)
      viewportFetchAbortRef.current?.abort()
    }
  }, [mapViewport, filterSet, currentMode, targetNames])

  // Fetch requirement locations when overlay is enabled
  useEffect(() => {
    if (
      !showRequirementLocations ||
      !mapViewport ||
      (requirementBrandScope === 'selected' && selectedRequirementListingIds.length === 0)
    ) {
      requirementFetchAbortRef.current?.abort()
      setRequirementLocations([])
      return
    }

    const fetchRequirementLocations = async () => {
      requirementFetchAbortRef.current?.abort()
      const abortController = new AbortController()
      requirementFetchAbortRef.current = abortController

      try {
        const params = new URLSearchParams({
          minLat: mapViewport.minLat.toString(),
          minLon: mapViewport.minLon.toString(),
          maxLat: mapViewport.maxLat.toString(),
          maxLon: mapViewport.maxLon.toString()
        })

        // Add listing IDs filter if in 'selected' mode
        if (requirementBrandScope === 'selected' && selectedRequirementListingIds.length > 0) {
          params.set('listingIds', selectedRequirementListingIds.join(','))
        }

        const response = await fetch(`/api/public/gapfinder/requirement-locations?${params.toString()}`, {
          signal: abortController.signal
        })

        if (response.ok) {
          const data = await response.json()
          setRequirementLocations(data.results || [])
          if (process.env.NODE_ENV === 'development') {
            console.log('[DEBUG] Gapfinder requirement location count', {
              total: data.total,
              results: data.results?.length || 0,
              apiDebug: data.debug
            })
          }
        } else {
          setRequirementLocations([])
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        console.error('Failed to fetch requirement locations:', error)
        setRequirementLocations([])
      } finally {
        if (requirementFetchAbortRef.current === abortController) {
          requirementFetchAbortRef.current = null
        }
      }
    }

    // Debounce the fetch to avoid excessive API calls during map pan/zoom
    const debounceTimer = setTimeout(fetchRequirementLocations, 750)
    return () => {
      clearTimeout(debounceTimer)
      requirementFetchAbortRef.current?.abort()
    }
  }, [showRequirementLocations, mapViewport, requirementBrandScope, selectedRequirementListingIds])

  // Fetch filtered BUAs when filters change (NEW: Using FilterSet)
  useEffect(() => {
    const fetchFilteredBUAs = async () => {
      setIsLoadingBUAs(true)
      // Filter changed - next store update SHOULD auto-fit
      setStoreUpdateSource(StoreUpdateSource.FILTER_CHANGE)

      try {
        // Use effectiveMinPop: if checkbox is checked, use 0, otherwise use slider value
        const effectiveMinPop = showSubFiveK ? 0 : minPop

        // Build filter payload with NEW filterSet format
        const filters: any = {
          minPop: effectiveMinPop,
          maxPop,
          filterSet // NEW: Pass the filterSet directly
        }

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
          setFilteredBUAs(data.results || [])
          setTotalBUAs(data.total || data.results?.length || 0)
        }

        if (filterResponse.ok) {
          const data = await filterResponse.json()
          setMapGssCodes(data.gsscodes || [])
        }
      } catch {
        setFilteredBUAs([])
        setMapGssCodes([])
      } finally {
        setIsLoadingBUAs(false)
      }
    }

    // Debounce the fetch to avoid too many API calls
    const debounceTimer = setTimeout(fetchFilteredBUAs, 500)
    return () => clearTimeout(debounceTimer)
  }, [minPop, maxPop, filterSet, showSubFiveK]) // Add showSubFiveK to dependencies

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

        if (assessFascias.length > 0) {
          params.append('fasciaIds', assessFascias.join(','))
        }
        if (assessCategories.length > 0) {
          params.append('categoryIds', assessCategories.join(','))
        }

        const response = await fetch(`/api/public/stores/nearby?${params.toString()}`)

        if (response.ok) {
          const data = await response.json()
          setNearbyStores(data.stores || [])
        }
      } catch {
        setNearbyStores([])
      } finally {
        setIsLoadingStores(false)
      }
    }

    // Debounce the fetch
    const debounceTimer = setTimeout(fetchNearbyStores, 500)
    return () => clearTimeout(debounceTimer)
  }, [selectedPoint, radiusMeters, assessFascias, assessCategories, currentMode])

  // Fetch missing fascias when point is selected (Assess Area mode)
  useEffect(() => {
    if (!selectedPoint || currentMode !== 'assess-area') {
      setMissingFascias([])
      setMissingFasciasError(null)
      return
    }

    const fetchMissingFascias = async () => {
      // Cancel previous request
      fetchMissingFasciasAbortRef.current?.abort()
      const controller = new AbortController()
      fetchMissingFasciasAbortRef.current = controller

      setIsLoadingMissingFascias(true)
      setMissingFasciasError(null)

      try {
        const params = new URLSearchParams({
          lat: selectedPoint.lat.toString(),
          lon: selectedPoint.lng.toString(),
          radius: radiusMeters.toString()
        })

        if (assessFascias.length > 0) {
          params.append('fasciaIds', assessFascias.join(','))
        }
        if (assessCategories.length > 0) {
          params.append('categoryIds', assessCategories.join(','))
        }

        const response = await fetch(`/api/public/stores/missing-fascias?${params.toString()}`, {
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error('Failed to fetch missing fascias')
        }

        const data = await response.json()
        setMissingFascias(data.missingFascias || [])
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          setMissingFasciasError('Unable to load missing fascias')
          setMissingFascias([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingMissingFascias(false)
        }
      }
    }

    // Debounce the fetch
    const debounceTimer = setTimeout(fetchMissingFascias, 500)
    return () => {
      clearTimeout(debounceTimer)
      fetchMissingFasciasAbortRef.current?.abort()
    }
  }, [selectedPoint, radiusMeters, assessFascias, assessCategories, currentMode])

  // Fetch nearby stores for Area B
  useEffect(() => {
    if (!selectedPointB || currentMode !== 'assess-area' || comparisonMode !== 'comparing') {
      setNearbyStoresB([])
      return
    }

    const fetchNearbyStoresB = async () => {
      setIsLoadingStoresB(true)
      try {
        const params = new URLSearchParams({
          lat: selectedPointB.lat.toString(),
          lon: selectedPointB.lng.toString(),
          radius: radiusMetersB.toString()
        })

        if (assessFascias.length > 0) {
          params.append('fasciaIds', assessFascias.join(','))
        }
        if (assessCategories.length > 0) {
          params.append('categoryIds', assessCategories.join(','))
        }

        const response = await fetch(`/api/public/stores/nearby?${params.toString()}`)

        if (response.ok) {
          const data = await response.json()
          setNearbyStoresB(data.stores || [])
        }
      } catch {
        setNearbyStoresB([])
      } finally {
        setIsLoadingStoresB(false)
      }
    }

    // Debounce the fetch
    const debounceTimer = setTimeout(fetchNearbyStoresB, 500)
    return () => clearTimeout(debounceTimer)
  }, [selectedPointB, radiusMetersB, assessFascias, assessCategories, currentMode, comparisonMode])

  // Fetch missing fascias for Area B
  useEffect(() => {
    if (!selectedPointB || currentMode !== 'assess-area' || comparisonMode !== 'comparing') {
      setMissingFasciasB([])
      setMissingFasciasBError(null)
      return
    }

    const fetchMissingFasciasB = async () => {
      setIsLoadingMissingFasciasB(true)
      setMissingFasciasBError(null)

      try {
        const params = new URLSearchParams({
          lat: selectedPointB.lat.toString(),
          lon: selectedPointB.lng.toString(),
          radius: radiusMetersB.toString()
        })

        if (assessFascias.length > 0) {
          params.append('fasciaIds', assessFascias.join(','))
        }
        if (assessCategories.length > 0) {
          params.append('categoryIds', assessCategories.join(','))
        }

        const response = await fetch(`/api/public/stores/missing-fascias?${params.toString()}`)

        if (!response.ok) {
          throw new Error('Failed to fetch missing fascias')
        }

        const data = await response.json()
        setMissingFasciasB(data.missingFascias || [])
      } catch (error: any) {
        setMissingFasciasBError('Unable to load missing fascias')
        setMissingFasciasB([])
      } finally {
        setIsLoadingMissingFasciasB(false)
      }
    }

    // Debounce the fetch
    const debounceTimer = setTimeout(fetchMissingFasciasB, 500)
    return () => clearTimeout(debounceTimer)
  }, [selectedPointB, radiusMetersB, assessFascias, assessCategories, currentMode, comparisonMode])

  const handleBUAListItemClick = (bua: BUA) => {
    // Sidebar click - map will fly to BUA, next store update should NOT auto-fit
    setStoreUpdateSource(StoreUpdateSource.SIDEBAR_CLICK)
    setCenterFlyToZoom(12)
    setCenter({ lat: bua.centroid_lat, lng: bua.centroid_lon })
    setSelectedBUAGsscode(bua.gsscode)
    setSelectedBUA({ name: bua.name, pop: bua.pop })
    setSidebarSelectionNonce(current => current + 1)
  }

  const handleStoreListItemClick = (store: StoreType) => {
    if (!Number.isFinite(store.lat) || !Number.isFinite(store.lon)) return

    setCenterFlyToZoom(15)
    setCenter({ lat: store.lat, lng: store.lon })
    setSelectedBUAGsscode(null)
    setSelectedBUA(null)
  }

  const handleGetTravelTime = async (store: StoreType) => {
    const requestArea: AssessArea =
      comparisonMode === 'comparing' && activeArea === 'area-b' ? 'area-b' : 'area-a'
    const originPoint = requestArea === 'area-b' ? selectedPointB : selectedPoint

    if (!originPoint || !store.id) return

    const cacheKey = getTravelTimeCacheKey(store.id, requestArea)

    if (travelTimeLoading[cacheKey]) return

    setTravelTimeLoading(prev => ({ ...prev, [cacheKey]: true }))
    setTravelTimeErrors(prev => {
      const { [cacheKey]: _, ...rest } = prev
      return rest
    })

    try {
      const params = new URLSearchParams({
        originLat: originPoint.lat.toString(),
        originLng: originPoint.lng.toString(),
        destLat: store.lat.toString(),
        destLng: store.lon.toString(),
        storeId: store.id
      })

      const response = await fetch(`/api/public/stores/travel-time?${params}`)
      const data = await response.json()

      const currentOriginPoint =
        requestArea === 'area-b' ? selectedPointBRef.current : selectedPointRef.current

      if (!currentOriginPoint ||
          currentOriginPoint.lat !== originPoint.lat ||
          currentOriginPoint.lng !== originPoint.lng) {
        return
      }

      if (!response.ok) {
        setTravelTimeErrors(prev => ({
          ...prev,
          [cacheKey]: data.error || 'Unable to calculate'
        }))
        return
      }

      if (data.success) {
        setTravelTimes(prev => ({
          ...prev,
          [cacheKey]: { walking: data.walking, driving: data.driving }
        }))
      }
    } catch (error) {
      const currentOriginPoint =
        requestArea === 'area-b' ? selectedPointBRef.current : selectedPointRef.current

      if (currentOriginPoint &&
          currentOriginPoint.lat === originPoint.lat &&
          currentOriginPoint.lng === originPoint.lng) {
        setTravelTimeErrors(prev => ({
          ...prev,
          [cacheKey]: 'Network error'
        }))
      }
    } finally {
      setTravelTimeLoading(prev => ({ ...prev, [cacheKey]: false }))
    }
  }

  const handleExportBUAs = async () => {
    setIsExportingBUAs(true)
    try {
      const effectiveMinPop = showSubFiveK ? 0 : populationRange[0]
      await exportBUAsToCSV(
        {
          minPop: effectiveMinPop,
          maxPop: populationRange[1],
          filterSet
        },
        targetNames
      )
    } catch (error) {
      console.error('Export failed:', error)
      // Error is silent - browser download failure will be obvious to user
    } finally {
      setIsExportingBUAs(false)
    }
  }

  const handleExportNearbyStores = useCallback(() => {
    // Determine which area's data to export
    const pointToExport = comparisonMode === 'comparing'
      ? (activeArea === 'area-b' ? selectedPointB :
         activeArea === 'area-a' ? selectedPoint : null)
      : selectedPoint

    const storesToExport = comparisonMode === 'comparing'
      ? (activeArea === 'area-b' ? nearbyStoresB :
         activeArea === 'area-a' ? nearbyStores : [])
      : nearbyStores

    const radiusToExport = comparisonMode === 'comparing'
      ? (activeArea === 'area-b' ? radiusMetersB : radiusMeters)
      : radiusMeters

    if (!pointToExport || storesToExport.length === 0 || isExportingNearbyStores) return

    setIsExportingNearbyStores(true)
    try {
      const brandNames = assessFascias
        .map(id => targetNames[id] || id)
        .join(', ')
      const categoryNames = assessCategories
        .map(id => targetNames[id] || id)
        .join(', ')

      let filterSummary = 'None'
      if (brandNames && categoryNames) {
        filterSummary = `Brands: ${brandNames} AND Categories: ${categoryNames}`
      } else if (brandNames) {
        filterSummary = `Brands: ${brandNames}`
      } else if (categoryNames) {
        filterSummary = `Categories: ${categoryNames}`
      }

      exportNearbyStoresToCSV({
        stores: storesToExport,
        selectedPoint: pointToExport,
        radiusMeters: radiusToExport,
        filterSummary,
        travelTimes,
        activeAssessArea: comparisonMode === 'comparing' ? activeArea : 'area-a'
      })
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExportingNearbyStores(false)
    }
  }, [
    assessCategories,
    assessFascias,
    isExportingNearbyStores,
    nearbyStores,
    nearbyStoresB,
    radiusMeters,
    radiusMetersB,
    selectedPoint,
    selectedPointB,
    activeArea,
    comparisonMode,
    targetNames,
    travelTimes
  ])

  const renderRequirementLocationsControl = () => (
    <Collapsible open={showRequirementLocations} onOpenChange={setShowRequirementLocations}>
      <div className="flex items-center justify-between w-full p-4 hover:bg-sm-violet-tint-soft rounded-sm-btn transition-all duration-200">
        <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
          <ChevronDown
            className={`h-4 w-4 text-sm-ink3 transition-transform duration-200 ${
              showRequirementLocations ? 'rotate-0' : '-rotate-90'
            }`}
          />
          <span className="font-semibold text-sm-ink">Requirement Locations</span>
        </CollapsibleTrigger>
        <button
          type="button"
          role="switch"
          aria-checked={showRequirementLocations}
          onClick={() => setShowRequirementLocations((enabled) => !enabled)}
          className={`h-7 rounded-full px-3 text-xs font-semibold tracking-tight transition-colors ${
            showRequirementLocations
              ? 'bg-sm-violet text-white shadow-sm hover:bg-sm-violet-deep'
              : 'bg-sm-border text-sm-ink2 hover:bg-sm-border-soft'
          }`}
        >
          {showRequirementLocations ? 'On' : 'Off'}
        </button>
      </div>
      <CollapsibleContent className="px-3 pb-6 pt-4 space-y-3">
        {showRequirementLocations && (
          <>
            <div className="px-2 space-y-2">
              <Label className="text-xs text-sm-ink2">Show</Label>
              <div className="grid grid-cols-2 rounded-sm-compact border border-sm-border bg-sm-bg p-1">
                <button
                  type="button"
                  onClick={() => setRequirementBrandScope('all')}
                  className={`h-8 rounded-sm-compact text-xs font-semibold tracking-tight transition-colors ${
                    requirementBrandScope === 'all'
                      ? 'bg-sm-surface text-sm-violet shadow-sm'
                      : 'text-sm-ink2 hover:text-sm-ink'
                  }`}
                >
                  All brands
                </button>
                <button
                  type="button"
                  onClick={() => setRequirementBrandScope('selected')}
                  className={`h-8 rounded-sm-compact text-xs font-semibold tracking-tight transition-colors ${
                    requirementBrandScope === 'selected'
                      ? 'bg-sm-surface text-sm-violet shadow-sm'
                      : 'text-sm-ink2 hover:text-sm-ink'
                  }`}
                >
                  Selected brands
                </button>
              </div>
            </div>

            {requirementBrandScope === 'selected' && (
              <>
                <RequirementCompanySelector
                  selectedBrands={selectedRequirementBrands}
                  onSelectionChange={(listingIds, brandNames) => {
                    setSelectedRequirementListingIds(listingIds)
                    setSelectedRequirementBrands(brandNames)
                  }}
                />
                {selectedRequirementListingIds.length === 0 && (
                  <p className="px-2 text-xs text-gray-500">
                    Choose at least one brand to show requirement locations.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  )

  const renderTrafficHeatmapControl = () => {
    const minTraffic = trafficRange[0]
    const maxTraffic = trafficRange[1]

    return (
      <Collapsible open={showTrafficHeatmap} onOpenChange={setShowTrafficHeatmap}>
        <div className="flex items-center justify-between w-full p-4 hover:bg-sm-violet-tint-soft rounded-sm-btn transition-all duration-200">
          <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
            <ChevronDown
              className={`h-4 w-4 text-sm-ink3 transition-transform duration-200 ${
                showTrafficHeatmap ? 'rotate-0' : '-rotate-90'
              }`}
            />
            <span className="font-semibold text-sm-ink">Traffic</span>
          </CollapsibleTrigger>
          <button
            type="button"
            role="switch"
            aria-checked={showTrafficHeatmap}
            onClick={() => setShowTrafficHeatmap((enabled) => !enabled)}
            className={`h-7 rounded-full px-3 text-xs font-semibold tracking-tight transition-colors ${
              showTrafficHeatmap
                ? 'bg-sm-violet text-white shadow-sm hover:bg-sm-violet-deep'
                : 'bg-sm-border text-sm-ink2 hover:bg-sm-border-soft'
            }`}
          >
            {showTrafficHeatmap ? 'On' : 'Off'}
          </button>
        </div>

        <CollapsibleContent className="px-3 pb-6 pt-4 space-y-3">
          <div className="px-2">
            <Slider
              value={trafficRange}
              onValueChange={(value) => setTrafficRange(value as [number, number])}
              min={0}
              max={250000}
              step={1000}
              minStepsBetweenThumbs={1}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Min (vehicles/day)</Label>
              <div className="text-sm font-semibold text-sm-violet">
                {formatTrafficValue(minTraffic)}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Max (vehicles/day)</Label>
              <div className="text-sm font-semibold text-sm-violet">
                {formatTrafficValue(maxTraffic)}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div className="h-screen bg-background overflow-hidden">
      <div className="flex flex-col h-full">
        <header className="relative z-40 px-8 py-4 border-b border-sm-border-soft bg-sm-surface">
          <div className="relative flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
                className="h-8 w-8 rounded-sm-btn hover:bg-sm-violet-tint-soft hover:text-sm-violet transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-sm-violet rounded-full" />
                <h1 className="text-lg font-semibold text-sm-ink tracking-tight">
                  GapFinder
                </h1>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-[380px] border-r border-sm-border-soft bg-sm-surface flex flex-col h-full">
            <Tabs
              defaultValue="find-gaps"
              className="flex-1 flex flex-col overflow-hidden"
              onValueChange={(value) => setCurrentMode(value as 'find-gaps' | 'assess-area')}
            >
              <div className="px-6 pt-5 pb-4 border-b border-sm-border-soft bg-sm-surface">
                <TabsList className="grid h-12 w-full grid-cols-2 rounded-sm-card border border-sm-border bg-sm-surface p-1.5 shadow-sm">
                  <TabsTrigger
                    value="find-gaps"
                    className="h-9 gap-2.5 rounded-sm-btn px-4 text-sm font-semibold tracking-tight text-sm-ink2 transition-all duration-200 hover:bg-sm-violet-tint-soft hover:text-sm-violet data-[state=active]:bg-sm-violet data-[state=active]:text-white data-[state=active]:shadow-sm"
                  >
                    <Search className="h-4 w-4" />
                    Find Gaps
                  </TabsTrigger>
                  <TabsTrigger
                    value="assess-area"
                    className="h-9 gap-2.5 rounded-sm-btn px-4 text-sm font-semibold tracking-tight text-sm-ink2 transition-all duration-200 hover:bg-sm-violet-tint-soft hover:text-sm-violet data-[state=active]:bg-sm-violet data-[state=active]:text-white data-[state=active]:shadow-sm"
                  >
                    <MapPin className="h-4 w-4" />
                    Assess Area
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Find Gaps Tab Content */}
              <TabsContent value="find-gaps" className="flex-1 overflow-y-auto p-6 space-y-6 mt-0 pt-1">
                {/* 1. Search - Always Visible */}
                <div className="space-y-2">
                  <Label htmlFor="bua-search" className="text-sm font-medium">
                    Search by Location Name
                  </Label>
                  <BUASearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onBUASelect={handleBUASelect}
                  />
                </div>

                {/* 2. Collapsible: Requirement Locations */}
                {renderRequirementLocationsControl()}

                {/* 3. Traffic Heatmap */}
                {renderTrafficHeatmapControl()}

                {/* 4. "Filters" Header/Divider */}
                <div className="pt-2 pb-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="h-px flex-1 bg-sm-border-soft" />
                    <span className="text-xs font-semibold text-sm-ink2 uppercase tracking-wider">Filters</span>
                    <div className="h-px flex-1 bg-sm-border-soft" />
                  </div>
                </div>

                {/* 4. Collapsible: Population Range */}
                <Collapsible open={isPopulationFilterOpen} onOpenChange={setIsPopulationFilterOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-sm-violet-tint-soft rounded-sm-btn transition-all duration-200">
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 text-sm-ink3 transition-transform duration-200 ${
                          isPopulationFilterOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                      <span className="font-semibold text-sm-ink">Population</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {minPop === MIN_POPULATION && maxPop === MAX_POPULATION && !showSubFiveK ? 'All' : 'Filtered'}
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
                          className={`h-9 text-sm ${minPopError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                          aria-invalid={!!minPopError}
                          aria-describedby={minPopError ? 'min-pop-error' : undefined}
                        />
                        {minPopError && (
                          <p id="min-pop-error" className="text-xs text-red-600 mt-1" role="alert">
                            {minPopError}
                          </p>
                        )}
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

                    {/* NEW: Checkbox for sub-5k BUAs - placed AFTER inputs for better UX */}
                    <div className="flex items-center space-x-2 px-2 pt-1">
                      <Checkbox
                        id="show-sub-5k"
                        checked={showSubFiveK}
                        onCheckedChange={(checked) => setShowSubFiveK(checked === true)}
                      />
                      <Label
                        htmlFor="show-sub-5k"
                        className="text-xs text-gray-600 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Show locations with a population of less than 5k
                      </Label>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* 5. Collapsible: Brand Filters */}
                <Collapsible open={isBrandFiltersOpen} onOpenChange={setIsBrandFiltersOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-sm-violet-tint-soft rounded-sm-btn transition-all duration-200">
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 text-sm-ink3 transition-transform duration-200 ${
                          isBrandFiltersOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                      <span className="font-semibold text-sm-ink">Brands</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {filterSet.rules.length === 0 ? 'All' : 'Filtered'}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-6 pt-4">
                    <FilterBuilder
                      hideHeader={true}
                      filterSet={filterSet}
                      onChange={setFilterSet}
                      targetNames={targetNames}
                      targetBadgeMapping={targetBadgeMapping}
                      companiesVisibility={companiesVisibility}
                      categoriesVisibility={categoriesVisibility}
                      onCompaniesVisibilityChange={setCompaniesVisibility}
                      onCategoriesVisibilityChange={setCategoriesVisibility}
                      onCategoryTreeLoaded={setCategoryTree}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>

              {/* Assess Area Tab Content */}
              <TabsContent value="assess-area" className="flex-1 overflow-y-auto p-6 space-y-6 mt-0 pt-1">
                {/* 1. Search - Always Visible */}
                <div className="space-y-2">
                  <Label htmlFor="assess-area-bua-search" className="text-sm font-medium">
                    Search by Location Name
                  </Label>
                  <BUASearch
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onBUASelect={handleAssessAreaBUASelect}
                  />
                </div>

                {/* Point Selection Status */}
                {comparisonMode === 'comparing' && selectedPoint && selectedPointB ? (
                  <>
                    <AreaAccordion
                      pointA={selectedPoint}
                      pointB={selectedPointB}
                      radiusA={radiusMeters}
                      radiusB={radiusMetersB}
                      onRadiusAChange={setRadiusMeters}
                      onRadiusBChange={setRadiusMetersB}
                      onClearA={handleClearPointA}
                      onClearB={handleClearPointB}
                      storeCountA={nearbyStores.length}
                      storeCountB={nearbyStoresB.length}
                      value={activeArea}
                      onValueChange={(next) =>
                        setActiveArea(next === 'area-a' || next === 'area-b' ? next : null)
                      }
                    />
                    <Button
                      onClick={() => setComparisonModalOpen(true)}
                      className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-sm"
                    >
                      Compare Areas
                    </Button>
                  </>
                ) : comparisonMode === 'selecting-second' ? (
                  <div className="relative rounded-sm-card border-2 border-dashed border-sm-border bg-sm-violet-tint-soft p-8 text-center">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-sm-violet-tint flex items-center justify-center">
                      <MapPin className="h-8 w-8 text-sm-violet" />
                    </div>
                    <h4 className="text-base font-semibold tracking-tight text-sm-ink mb-2">
                      Select Area B
                    </h4>
                    <p className="text-sm text-sm-ink2">
                      Click on the map to choose the second point
                    </p>
                  </div>
                ) : selectedPoint ? (
                  <>
                    <div className="relative bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200/60 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <MapPin className="h-5 w-5 text-emerald-600" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-emerald-900 mb-0.5">Point Selected</p>
                            <p className="text-xs text-emerald-700 font-mono">
                              {selectedPoint.lat.toFixed(4)}, {selectedPoint.lng.toFixed(4)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearPointA}
                          className="h-8 flex-shrink-0 text-emerald-700 hover:bg-emerald-100/80 hover:text-emerald-800"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <button
                      onClick={handleAddSecondArea}
                      className="relative rounded-sm-card border-2 border-dashed border-sm-border bg-sm-surface p-6 text-center hover:border-sm-violet hover:bg-sm-violet-tint-soft transition-all w-full"
                    >
                      <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-sm-bg flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-sm-ink3" />
                      </div>
                      <p className="text-sm font-semibold text-sm-ink">
                        Add another area to compare
                      </p>
                      <p className="text-xs text-sm-ink3 mt-1">
                        Compare stores between two locations
                      </p>
                    </button>
                  </>
                ) : (
                  <div className="relative rounded-sm-card border-2 border-dashed border-sm-border bg-sm-surface p-8 text-center">
                    <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-sm-violet-tint flex items-center justify-center">
                      <MapPin className="h-8 w-8 text-sm-violet" />
                    </div>
                    <h4 className="text-base font-semibold tracking-tight text-sm-ink mb-2">
                      Select a location
                    </h4>
                    <p className="text-sm text-sm-ink2 mb-1">
                      Click on the map to choose a point
                    </p>
                    <p className="text-xs text-sm-ink3">
                      Analyse stores within a custom radius
                    </p>
                  </div>
                )}

                {/* Radius Settings - Hidden in comparison mode */}
                {comparisonMode !== 'comparing' && (
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="group flex items-center justify-between w-full p-4 hover:bg-sm-violet-tint-soft rounded-sm-card transition-all duration-200 border border-transparent hover:border-sm-border">
                    <div className="flex items-center gap-2.5">
                      <ChevronDown className="h-4 w-4 text-sm-ink3 transition-transform duration-200 group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90" />
                      <span className="font-semibold text-sm-ink">Radius</span>
                    </div>
                    <Badge variant="secondary" className="text-xs font-semibold bg-sm-violet-tint-soft text-sm-violet border-sm-border">
                      {radiusMeters / 1000}km
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-6 pt-4 space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="radius-slider" className="text-sm font-semibold text-sm-ink">
                          Search Radius
                        </Label>
                        <span className="text-sm font-semibold text-sm-violet">
                          {(radiusMeters / 1000).toFixed(1)} km
                        </span>
                      </div>
                      <Slider
                        id="radius-slider"
                        value={[radiusMeters]}
                        onValueChange={(value) => setRadiusMeters(value[0])}
                        min={500}
                        max={20000}
                        step={500}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-sm-ink3 px-0.5">
                        <span>0.5 km</span>
                        <span>20 km</span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <Label className="text-xs font-semibold text-sm-ink2 mb-2 block">Quick Select</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          variant={radiusMeters === 1000 ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRadiusMeters(1000)}
                          className={`text-xs font-semibold tracking-tight transition-all ${
                            radiusMeters === 1000
                              ? 'bg-sm-violet hover:bg-sm-violet-deep shadow-sm'
                              : 'hover:bg-sm-violet-tint-soft hover:border-sm-violet hover:text-sm-violet'
                          }`}
                        >
                          1 km
                        </Button>
                        <Button
                          variant={radiusMeters === 5000 ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRadiusMeters(5000)}
                          className={`text-xs font-semibold tracking-tight transition-all ${
                            radiusMeters === 5000
                              ? 'bg-sm-violet hover:bg-sm-violet-deep shadow-sm'
                              : 'hover:bg-sm-violet-tint-soft hover:border-sm-violet hover:text-sm-violet'
                          }`}
                        >
                          5 km
                        </Button>
                        <Button
                          variant={radiusMeters === 10000 ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRadiusMeters(10000)}
                          className={`text-xs font-semibold tracking-tight transition-all ${
                            radiusMeters === 10000
                              ? 'bg-sm-violet hover:bg-sm-violet-deep shadow-sm'
                              : 'hover:bg-sm-violet-tint-soft hover:border-sm-violet hover:text-sm-violet'
                          }`}
                        >
                          10 km
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                )}

                {/* Store Filters */}
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="group flex items-center justify-between w-full p-4 hover:bg-sm-violet-tint-soft rounded-sm-card transition-all duration-200 border border-transparent hover:border-sm-border">
                    <div className="flex items-center gap-2.5">
                      <ChevronDown className="h-4 w-4 text-sm-ink3 transition-transform duration-200 group-data-[state=open]:rotate-0 group-data-[state=closed]:-rotate-90" />
                      <span className="font-semibold text-sm-ink">Brands</span>
                    </div>
                    <Badge variant="secondary" className={`text-xs font-semibold ${
                      assessFascias.length + assessCategories.length === 0
                        ? 'bg-sm-border text-sm-ink2 border-sm-border'
                        : 'bg-sm-violet-tint-soft text-sm-violet border-sm-border'
                    }`}>
                      {assessFascias.length + assessCategories.length === 0
                        ? 'All'
                        : `${assessFascias.length + assessCategories.length} selected`}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-6 pt-4">
                    <div className="text-xs text-sm-ink2 mb-3 font-medium">
                      Filter which stores to show in results
                    </div>
                    <UnifiedCategorySelector
                      selectedCompanies={assessFascias}
                      selectedCategories={assessCategories}
                      onCompaniesChange={setAssessFascias}
                      onCategoriesChange={setAssessCategories}
                      mode="include"
                    />
                  </CollapsibleContent>
                </Collapsible>

                {/* Requirement Locations */}
                {renderRequirementLocationsControl()}

                {/* Traffic Heatmap */}
                {renderTrafficHeatmapControl()}
              </TabsContent>
            </Tabs>
          </div>

          {/* Map (flex-1) */}
          <div className="flex-1 relative min-w-0">
            <BUAMap
              center={center}
              minPopulation={showSubFiveK ? 0 : minPop}
              maxPopulation={maxPop}
              onBUAClick={(gsscode, name, pop) => {
                setSelectedBUAGsscode(gsscode)
                setSelectedBUA({ name, pop })
              }}
              className="w-full h-full"
              mode={currentMode}
              selectedPoint={selectedPoint}
              onPointSelected={handlePointSelected}
              radiusMeters={radiusMeters}
              stores={currentMode === 'assess-area' && comparisonMode === 'comparing'
                ? (activeArea === 'area-b' ? nearbyStoresB : nearbyStores)
                : nearbyStores
              }
              selectedPointB={selectedPointB}
              radiusMetersB={radiusMetersB}
              comparisonMode={comparisonMode}
              selectedBUAGsscode={selectedBUAGsscode}
              sidebarSelectionNonce={sidebarSelectionNonce}
              filteredGssCodes={
                currentMode === 'find-gaps' && filterSet.rules.length > 0 && mapGssCodes.length > 0
                  ? mapGssCodes
                  : undefined
              }
              includedStores={includedStores}
              excludedStores={excludedStores}
              proximityIncludedStores={proximityIncludedStores}
              proximityExcludedStores={proximityExcludedStores}
              centerFlyToZoom={centerFlyToZoom}
              targetBadgeMapping={targetBadgeMapping}
              onViewportChange={handleViewportChange}
              storeUpdateSource={storeUpdateSource}
              companiesVisibility={currentMode === 'find-gaps' ? companiesVisibility : {}}
              categoriesVisibility={currentMode === 'find-gaps' ? categoriesVisibility : {}}
              requirementLocations={requirementLocations}
              onFasciaVisibilityToggle={handleFasciaVisibilityToggle}
              assessBadgeByStoreId={
                currentMode === 'assess-area' && comparisonMode === 'comparing'
                  ? (activeArea === 'area-b' ? assessBadgeByStoreIdB : assessBadgeByStoreId)
                  : assessBadgeByStoreId
              }
              showTrafficHeatmap={showTrafficHeatmap}
              trafficMinAadt={trafficRange[0]}
              trafficMaxAadt={trafficRange[1]}
            />
          </div>

          {/* Right Results Panel (360px) */}
          {/* Context-aware props based on active accordion section */}
          {useMemo(() => {
            const contextAwareStores = currentMode !== 'assess-area' || comparisonMode !== 'comparing'
              ? nearbyStores
              : activeArea === 'area-b' ? nearbyStoresB :
                activeArea === 'area-a' ? nearbyStores : []

            const contextAwareSelectedPoint = currentMode !== 'assess-area' || comparisonMode !== 'comparing'
              ? selectedPoint
              : activeArea === 'area-b' ? selectedPointB :
                activeArea === 'area-a' ? selectedPoint : null

            const contextAwareBadgeMapping = currentMode !== 'assess-area' || comparisonMode !== 'comparing'
              ? assessBadgeByStoreId
              : activeArea === 'area-b' ? assessBadgeByStoreIdB :
                activeArea === 'area-a' ? assessBadgeByStoreId : {}

            const contextAwareMissingFascias = currentMode !== 'assess-area' || comparisonMode !== 'comparing'
              ? missingFascias
              : activeArea === 'area-b' ? missingFasciasB :
                activeArea === 'area-a' ? missingFascias : []

            const contextAwareMissingFasciasLoading = currentMode !== 'assess-area' || comparisonMode !== 'comparing'
              ? isLoadingMissingFascias
              : activeArea === 'area-b' ? isLoadingMissingFasciasB :
                activeArea === 'area-a' ? isLoadingMissingFascias : false

            const contextAwareMissingFasciasError = currentMode !== 'assess-area' || comparisonMode !== 'comparing'
              ? missingFasciasError
              : activeArea === 'area-b' ? missingFasciasBError :
                activeArea === 'area-a' ? missingFasciasError : null

            const contextAwareIsLoadingStores = currentMode !== 'assess-area' || comparisonMode !== 'comparing'
              ? isLoadingStores
              : activeArea === 'area-b' ? isLoadingStoresB :
                activeArea === 'area-a' ? isLoadingStores : false

            return (
              <ResultsPanel
                results={currentMode === 'find-gaps' ? filteredBUAs : contextAwareStores}
                isLoading={currentMode === 'find-gaps' ? isLoadingBUAs : contextAwareIsLoadingStores}
                selectedBUA={selectedBUA}
                onItemClick={currentMode === 'find-gaps' ? handleBUAListItemClick : handleStoreListItemClick}
                mode={currentMode}
                total={currentMode === 'find-gaps' ? totalBUAs : undefined}
                onExport={currentMode === 'find-gaps' ? handleExportBUAs : handleExportNearbyStores}
                isExporting={currentMode === 'find-gaps' ? isExportingBUAs : isExportingNearbyStores}
                canExport={
                  currentMode === 'find-gaps'
                    ? filteredBUAs.length > 0
                    : contextAwareSelectedPoint !== null &&
                      contextAwareStores.length > 0 &&
                      !contextAwareIsLoadingStores &&
                      !isExportingNearbyStores
                }
                selectedPoint={currentMode === 'assess-area' ? contextAwareSelectedPoint : null}
                travelTimes={travelTimes}
                travelTimeLoading={travelTimeLoading}
                travelTimeErrors={travelTimeErrors}
                onGetTravelTime={handleGetTravelTime}
                canUseTravelTimes
                assessBadgeByStoreId={contextAwareBadgeMapping}
                missingFascias={contextAwareMissingFascias}
                isLoadingMissingFascias={contextAwareMissingFasciasLoading}
                missingFasciasError={contextAwareMissingFasciasError}
                activeAssessArea={
                  currentMode === 'assess-area' && comparisonMode === 'comparing'
                    ? activeArea
                    : null
                }
              />
            )
          }, [currentMode, comparisonMode, activeArea, nearbyStores, nearbyStoresB, selectedPoint, selectedPointB,
              assessBadgeByStoreId, assessBadgeByStoreIdB, missingFascias, missingFasciasB,
              isLoadingMissingFascias, isLoadingMissingFasciasB, missingFasciasError, missingFasciasBError,
              isLoadingStores, isLoadingStoresB, filteredBUAs, isLoadingBUAs, selectedBUA, totalBUAs,
              isExportingBUAs, isExportingNearbyStores, travelTimes, travelTimeLoading, travelTimeErrors])}
        </div>
      </div>
      <Toaster position="top-right" />

      {/* Comparison Modal */}
      <ComparisonModal
        open={comparisonModalOpen}
        onOpenChange={setComparisonModalOpen}
        comparisonData={comparisonData}
      />
    </div>
  )
}
