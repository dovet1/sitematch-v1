'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Info, MapPin, ChevronDown } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { BUAMap, StoreUpdateSource } from '@/components/gapfinder/BUAMap'
import { BUASearch } from '@/components/gapfinder/BUASearch'
import { ResultsPanel } from '@/components/gapfinder/ResultsPanel'
import { CompanySelector } from '@/components/gapfinder/CompanySelector'
import { FilterBuilder } from '@/components/gapfinder/FilterBuilder'
import { RequirementCompanySelector } from '@/components/gapfinder/RequirementCompanySelector'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { toast, Toaster } from 'sonner'
import type { BUA } from '@/lib/buas'
import type { Store as StoreType, ViewportStore } from '@/lib/stores'
import type { FilterSet } from '@/types/filters'
import { convertFilterSetToViewportParams, generateTargetBadgeMapping, hasActiveFilters, expandTargetsToFascias, type TargetWithMetadata } from '@/lib/filter-utils'
import { exportBUAsToCSV } from '@/lib/buas/export-utils'
import { type CategoryNode } from '@/lib/category-tree-utils'

const MAX_POPULATION = 1200000 // 1.2 million
const MIN_POPULATION = 5001 // Changed from 0

export default function BUAsPage() {
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
  const [mapGssCodes, setMapGssCodes] = useState<string[]>([])  // All gsscodes for map filtering
  const [sidebarSelectionNonce, setSidebarSelectionNonce] = useState(0)

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
  const [selectedRequirementCompanies, setSelectedRequirementCompanies] = useState<string[]>([])

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
  const [assessCompanies, setAssessCompanies] = useState<string[]>([])
  const [assessCategories, setAssessCategories] = useState<string[]>([])
  const [nearbyStores, setNearbyStores] = useState<StoreType[]>([])
  const [isLoadingStores, setIsLoadingStores] = useState(false)

  // Derived values for map filtering
  const minPop = populationRange[0]
  const maxPop = populationRange[1]

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

  const handleBUASelect = (bua: {
    name: string
    coordinates: { lat: number; lng: number }
    gsscode: string
    pop: number
  }) => {
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
        const names: Record<string, string> = {}

        // Fetch categories
        const categoriesResponse = await fetch('/api/public/categories')
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json()
          const categories = categoriesData.categories || []
          categories.forEach((cat: any) => {
            names[cat.id] = cat.name
          })
        }

        // Fetch all brands (to get fascias)
        const brandsResponse = await fetch('/api/public/brands?limit=2000')
        if (brandsResponse.ok) {
          const brandsData = await brandsResponse.json()
          const brands = brandsData.brands || []

          // For each brand, fetch its fascias directly by brand ID
          const fasciaPromises = brands.map(async (brand: any) => {
            try {
              const fasciasResponse = await fetch(
                `/api/public/fascias/search?brandId=${encodeURIComponent(brand.id)}&limit=100`
              )
              const fasciasData = await fasciasResponse.json()
              const brandFascias = fasciasData.fascias || []
              brandFascias.forEach((fascia: any) => {
                names[fascia.id] = fascia.name
              })
            } catch {
              return
            }
          })

          await Promise.all(fasciaPromises)
        }

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
      currentMode !== 'find-gaps' ||
      (requirementBrandScope === 'selected' && selectedRequirementCompanies.length === 0)
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
          maxLon: mapViewport.maxLon.toString(),
          limit: '2000'
        })

        // Add company filter if in 'selected' mode
        if (requirementBrandScope === 'selected' && selectedRequirementCompanies.length > 0) {
          params.set('companyNames', selectedRequirementCompanies.join(','))
        }

        const response = await fetch(`/api/public/gapfinder/requirement-locations?${params.toString()}`, {
          signal: abortController.signal
        })

        if (response.ok) {
          const data = await response.json()
          setRequirementLocations(data.results || [])
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
  }, [showRequirementLocations, mapViewport, requirementBrandScope, selectedRequirementCompanies, currentMode])

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
      } catch {
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
    // Sidebar click - map will fly to BUA, next store update should NOT auto-fit
    setStoreUpdateSource(StoreUpdateSource.SIDEBAR_CLICK)
    setCenter({ lat: bua.centroid_lat, lng: bua.centroid_lon })
    setSelectedBUAGsscode(bua.gsscode)
    setSelectedBUA({ name: bua.name, pop: bua.pop })
    setSidebarSelectionNonce(current => current + 1)
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

  return (
    <div className="h-screen bg-background overflow-hidden">
      <div className="flex flex-col h-full">
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
                  GapFinder
                </h1>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
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
                <Collapsible open={showRequirementLocations} onOpenChange={setShowRequirementLocations}>
                  <div className="flex items-center justify-between w-full p-4 hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-purple-50/30 rounded-lg transition-all duration-200">
                    <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                      <ChevronDown
                        className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                          showRequirementLocations ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                      <span className="font-medium text-gray-900">Requirement Locations</span>
                    </CollapsibleTrigger>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showRequirementLocations}
                      onClick={() => setShowRequirementLocations((enabled) => !enabled)}
                      className={`h-7 rounded-full px-3 text-xs font-medium transition-colors ${
                        showRequirementLocations
                          ? 'bg-violet-600 text-white shadow-sm hover:bg-violet-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {showRequirementLocations ? 'On' : 'Off'}
                    </button>
                  </div>
                  <CollapsibleContent className="px-3 pb-6 pt-4 space-y-3">
                    {/* Brand scope selector - only visible when overlay is enabled */}
                    {showRequirementLocations && (
                      <>
                        <div className="px-2 space-y-2">
                          <Label className="text-xs text-gray-600">Show</Label>
                          <div className="grid grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-1">
                            <button
                              type="button"
                              onClick={() => setRequirementBrandScope('all')}
                              className={`h-8 rounded-md text-xs font-medium transition-colors ${
                                requirementBrandScope === 'all'
                                  ? 'bg-white text-violet-700 shadow-sm'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              All brands
                            </button>
                            <button
                              type="button"
                              onClick={() => setRequirementBrandScope('selected')}
                              className={`h-8 rounded-md text-xs font-medium transition-colors ${
                                requirementBrandScope === 'selected'
                                  ? 'bg-white text-violet-700 shadow-sm'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              Selected brands
                            </button>
                          </div>
                        </div>

                        {/* Company selector - only when "selected" is active */}
                        {requirementBrandScope === 'selected' && (
                          <>
                            <RequirementCompanySelector
                              selectedCompanies={selectedRequirementCompanies}
                              onSelectionChange={setSelectedRequirementCompanies}
                            />
                            {selectedRequirementCompanies.length === 0 && (
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

                {/* 3. "Filters" Header/Divider */}
                <div className="pt-2 pb-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-200 to-transparent" />
                    <span className="text-xs font-medium text-violet-700 uppercase tracking-wider">Filters</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-200 to-transparent" />
                  </div>
                </div>

                {/* 4. Collapsible: Population Range */}
                <Collapsible open={isPopulationFilterOpen} onOpenChange={setIsPopulationFilterOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-purple-50/30 rounded-lg transition-all duration-200">
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                          isPopulationFilterOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                      <span className="font-medium text-gray-900">Population</span>
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
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-purple-50/30 rounded-lg transition-all duration-200">
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${
                          isBrandFiltersOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                      <span className="font-medium text-gray-900">Brands</span>
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
              onPointSelected={setSelectedPoint}
              radiusMeters={radiusMeters}
              stores={nearbyStores}
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
              targetBadgeMapping={targetBadgeMapping}
              onViewportChange={handleViewportChange}
              storeUpdateSource={storeUpdateSource}
              companiesVisibility={currentMode === 'find-gaps' ? companiesVisibility : {}}
              categoriesVisibility={currentMode === 'find-gaps' ? categoriesVisibility : {}}
              requirementLocations={currentMode === 'find-gaps' ? requirementLocations : []}
              onFasciaVisibilityToggle={handleFasciaVisibilityToggle}
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
            onExport={currentMode === 'find-gaps' ? handleExportBUAs : undefined}
            isExporting={currentMode === 'find-gaps' ? isExportingBUAs : false}
            canExport={currentMode === 'find-gaps' ? filteredBUAs.length > 0 : false}
          />
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
