'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Search, X, Loader2, ChevronDown, ChevronRight, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Category {
  id: string  // UUID
  name: string
  parent_category_id: string | null  // UUID
}

interface Fascia {
  id: string
  name: string
  brand_id: string
  brands?: { id: string; name: string }
}

interface Brand {
  id: string
  name: string
  fascias?: Fascia[]
}

interface EnhancedCompanySelectorProps {
  selectedCompanies: string[]  // Fascia IDs (UUIDs)
  selectedCategories: string[]  // Category IDs (UUIDs)
  onCompaniesChange: (ids: string[]) => void
  onCategoriesChange: (ids: string[]) => void
  companiesVisibility?: Record<string, boolean>
  categoriesVisibility?: Record<string, boolean>
  onCompaniesVisibilityChange?: (visibility: Record<string, boolean>) => void
  onCategoriesVisibilityChange?: (visibility: Record<string, boolean>) => void
  mode: 'include' | 'exclude' | 'proximity'
}

export function EnhancedCompanySelector({
  selectedCompanies,
  selectedCategories,
  onCompaniesChange,
  onCategoriesChange,
  companiesVisibility,
  categoriesVisibility,
  onCompaniesVisibilityChange,
  onCategoriesVisibilityChange,
  mode
}: EnhancedCompanySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [storeSearchQuery, setStoreSearchQuery] = useState('')
  const [allBrands, setAllBrands] = useState<Brand[]>([])
  const [isLoadingStores, setIsLoadingStores] = useState(false)
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set())
  const [categoriesError, setCategoriesError] = useState<string>('')
  const [storesError, setStoresError] = useState<string>('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')

  // Fetch categories on mount
  useEffect(() => {
    async function fetchCategories() {
      setIsLoadingCategories(true)
      setCategoriesError('')
      try {
        const response = await fetch('/api/public/categories')
        if (!response.ok) {
          throw new Error('Failed to load categories')
        }
        const data = await response.json()
        setCategories(data.categories || [])
      } catch (error) {
        setCategories([])
        setCategoriesError(error instanceof Error ? error.message : 'Failed to load categories')
      } finally {
        setIsLoadingCategories(false)
      }
    }
    fetchCategories()
  }, [])

  // Debounce search query for performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(storeSearchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [storeSearchQuery])

  // Fetch all brands with fascias on mount
  useEffect(() => {
    async function fetchAllBrands() {
      setIsLoadingStores(true)
      setStoresError('')
      try {
        // Fetch all brands using the new endpoint
        const brandsResponse = await fetch('/api/public/brands?limit=1000')
        if (!brandsResponse.ok) {
          throw new Error('Failed to load brands')
        }
        const brandsData = await brandsResponse.json()
        const brands: Brand[] = brandsData.brands || []

        // For each brand, fetch its fascias directly by brand ID
        const brandsWithFascias = await Promise.all(
          brands.map(async (brand) => {
            try {
              const fasciasResponse = await fetch(
                `/api/public/fascias/search?brandId=${encodeURIComponent(brand.id)}&limit=100`
              )
              const fasciasData = await fasciasResponse.json()
              const brandFascias = (fasciasData.fascias || []) as Fascia[]
              return { ...brand, fascias: brandFascias }
            } catch {
              return { ...brand, fascias: [] }
            }
          })
        )

        setAllBrands(brandsWithFascias)
      } catch (error) {
        setAllBrands([])
        setStoresError(error instanceof Error ? error.message : 'Failed to load stores')
      } finally {
        setIsLoadingStores(false)
      }
    }
    fetchAllBrands()
  }, [])

  // Filter brands based on debounced search query (client-side filtering)
  const filteredBrands = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return allBrands
    }

    const query = debouncedSearchQuery.toLowerCase()
    return allBrands.filter((brand) => {
      // Search in brand name
      if (brand.name.toLowerCase().includes(query)) {
        return true
      }
      // Search in fascia names
      return brand.fascias?.some((fascia) =>
        fascia.name.toLowerCase().includes(query)
      )
    })
  }, [allBrands, debouncedSearchQuery])

  const handleCategoryToggle = useCallback(
    (categoryId: string) => {
      const newSelection = selectedCategories.includes(categoryId)
        ? selectedCategories.filter((id) => id !== categoryId)
        : [...selectedCategories, categoryId]
      onCategoriesChange(newSelection)
    },
    [selectedCategories, onCategoriesChange]
  )

  const handleFasciaToggle = useCallback(
    (fasciaId: string) => {
      const newSelection = selectedCompanies.includes(fasciaId)
        ? selectedCompanies.filter((id) => id !== fasciaId)
        : [...selectedCompanies, fasciaId]
      onCompaniesChange(newSelection)
    },
    [selectedCompanies, onCompaniesChange]
  )

  const handleBrandToggle = useCallback(
    (brand: Brand) => {
      const fasciaIds = brand.fascias?.map(f => f.id) || []
      const allSelected = fasciaIds.every(id => selectedCompanies.includes(id))

      if (allSelected) {
        // Deselect all fascias of this brand
        const newSelection = selectedCompanies.filter(id => !fasciaIds.includes(id))
        onCompaniesChange(newSelection)
      } else {
        // Select all fascias of this brand
        const newSelection = Array.from(new Set([...selectedCompanies, ...fasciaIds]))
        onCompaniesChange(newSelection)
      }
    },
    [selectedCompanies, onCompaniesChange]
  )

  const isBrandFullySelected = (brand: Brand): boolean => {
    const fasciaIds = brand.fascias?.map(f => f.id) || []
    return fasciaIds.length > 0 && fasciaIds.every(id => selectedCompanies.includes(id))
  }

  const isBrandPartiallySelected = (brand: Brand): boolean => {
    const fasciaIds = brand.fascias?.map(f => f.id) || []
    const selectedCount = fasciaIds.filter(id => selectedCompanies.includes(id)).length
    return selectedCount > 0 && selectedCount < fasciaIds.length
  }

  const toggleBrandExpansion = (brandId: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev)
      if (next.has(brandId)) {
        next.delete(brandId)
      } else {
        next.add(brandId)
      }
      return next
    })
  }

  const handleClearAll = useCallback(() => {
    onCategoriesChange([])
    onCompaniesChange([])
    setStoreSearchQuery('')
  }, [onCategoriesChange, onCompaniesChange])

  const handleSelectAllVisibleStores = useCallback(() => {
    const allVisibleFasciaIds = filteredBrands.flatMap(brand =>
      brand.fascias?.map(f => f.id) || []
    )
    const newSelection = Array.from(new Set([...selectedCompanies, ...allVisibleFasciaIds]))
    onCompaniesChange(newSelection)
  }, [filteredBrands, selectedCompanies, onCompaniesChange])

  const handleClearAllStores = useCallback(() => {
    onCompaniesChange([])
  }, [onCompaniesChange])

  const handleSelectAllCategories = useCallback(() => {
    const allCategoryIds = categories.map(cat => cat.id)
    onCategoriesChange(allCategoryIds)
  }, [categories, onCategoriesChange])

  const handleClearAllCategories = useCallback(() => {
    onCategoriesChange([])
  }, [onCategoriesChange])

  const totalSelected = selectedCategories.length + selectedCompanies.length

  return (
    <div className="space-y-3">
      {/* Header with clear all button */}
      {totalSelected > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 font-medium">
            {totalSelected} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-7 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Tabs for Categories vs Stores */}
      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categories" className="text-xs">
            Categories
            {selectedCategories.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">
                {selectedCategories.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="stores" className="text-xs">
            Stores
            {selectedCompanies.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">
                {selectedCompanies.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-3 space-y-2" role="region" aria-live="polite">
          {/* Bulk actions for categories */}
          {!isLoadingCategories && !categoriesError && categories.length > 0 && (
            <div className="flex items-center justify-end gap-2 pb-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllCategories}
                className="h-7 text-xs text-gray-600 hover:text-gray-900"
              >
                Select All
              </Button>
              {selectedCategories.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllCategories}
                  className="h-7 text-xs text-gray-600 hover:text-gray-900"
                >
                  Clear All
                </Button>
              )}
            </div>
          )}

          {isLoadingCategories ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading categories...
            </div>
          ) : categoriesError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">{categoriesError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="h-7 text-xs ml-2"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : categories.length === 0 ? (
            <div className="text-sm text-gray-600 text-center py-8">
              No categories available
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[400px]">
              {categories.map((category) => {
                const isSelected = selectedCategories.includes(category.id)
                const isVisible = categoriesVisibility?.[category.id] ?? true
                const categoryName = category.name

                return (
                  <div
                    key={category.id}
                    className="flex items-center justify-between hover:bg-gray-50 p-2 rounded-md transition-all duration-150"
                  >
                    <div className="flex items-center space-x-2 flex-1 cursor-pointer" onClick={() => handleCategoryToggle(category.id)}>
                      <Checkbox
                        id={`cat-${category.id}`}
                        checked={isSelected}
                        onCheckedChange={() => handleCategoryToggle(category.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Label
                        htmlFor={`cat-${category.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {categoryName}
                      </Label>
                    </div>

                    {/* Visibility toggle button */}
                    {isSelected && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 p-0 hover:bg-gray-100"
                        aria-label={`${isVisible ? 'Hide' : 'Show'} ${categoryName} on map`}
                        onClick={(e) => {
                          e.stopPropagation()
                          const newVisibility = { ...categoriesVisibility }
                          if (isVisible) {
                            // Toggle to hidden: set false
                            newVisibility[category.id] = false
                          } else {
                            // Toggle to visible: delete key (sparse state pattern)
                            delete newVisibility[category.id]
                          }
                          onCategoriesVisibilityChange?.(newVisibility)
                        }}
                      >
                        {isVisible ? (
                          <Eye className="h-4 w-4 text-gray-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* Stores Tab - Hierarchical brand/fascia selection */}
        <TabsContent value="stores" className="mt-3 space-y-3" role="region" aria-live="polite">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search stores..."
              value={storeSearchQuery}
              onChange={(e) => setStoreSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search stores"
            />
          </div>

          {/* Bulk actions for stores */}
          {!isLoadingStores && !storesError && filteredBrands.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllVisibleStores}
                className="h-7 text-xs text-gray-600 hover:text-gray-900"
              >
                Select All {storeSearchQuery ? 'Visible' : ''}
              </Button>
              {selectedCompanies.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllStores}
                  className="h-7 text-xs text-gray-600 hover:text-gray-900"
                >
                  Clear All
                </Button>
              )}
            </div>
          )}

          {/* Brand list */}
          {isLoadingStores ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading stores...
            </div>
          ) : storesError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">{storesError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="h-7 text-xs ml-2"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : filteredBrands.length === 0 ? (
            <div className="text-sm text-gray-600 text-center py-8">
              {storeSearchQuery ? (
                <>
                  No stores found for &quot;{storeSearchQuery}&quot;.
                  <br />
                  <span className="text-xs text-gray-500 mt-1 inline-block">
                    Try different keywords.
                  </span>
                </>
              ) : (
                'No stores available'
              )}
            </div>
          ) : (
            <div className="space-y-1 overflow-y-auto max-h-[400px]">
              {filteredBrands.map((brand) => {
                const isExpanded = expandedBrands.has(brand.id)
                const hasFascias = (brand.fascias?.length || 0) > 0
                const isFullySelected = isBrandFullySelected(brand)
                const isPartiallySelected = isBrandPartiallySelected(brand)

                return (
                  <Collapsible
                    key={brand.id}
                    open={isExpanded}
                    onOpenChange={() => toggleBrandExpansion(brand.id)}
                  >
                    <div className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded-md transition-all duration-150">
                      <Checkbox
                        id={`brand-${brand.id}`}
                        checked={isPartiallySelected ? "indeterminate" : isFullySelected}
                        onCheckedChange={() => handleBrandToggle(brand)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <CollapsibleTrigger
                        className="flex-1 flex items-start justify-between cursor-pointer gap-2 text-left"
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${brand.name}`}
                      >
                        <div className="flex-1 min-w-0">
                          <Label
                            htmlFor={`brand-${brand.id}`}
                            className="cursor-pointer text-sm inline"
                          >
                            {brand.name}
                          </Label>
                          {hasFascias && brand.fascias!.length > 1 && (
                            <span className="text-xs text-gray-500 ml-1.5">
                              ({brand.fascias!.length} types)
                            </span>
                          )}
                          {!isExpanded && isPartiallySelected && (
                            <span className="inline-block w-1.5 h-1.5 bg-violet-500 rounded-full ml-1.5 align-middle" title="Some types selected" />
                          )}
                        </div>
                        {hasFascias && (
                          <div className="flex-shrink-0 mt-0.5">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-gray-500 transition-transform duration-150" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-gray-500 transition-transform duration-150" />
                            )}
                          </div>
                        )}
                      </CollapsibleTrigger>
                    </div>

                    {hasFascias && (
                      <CollapsibleContent className="ml-8 space-y-1 mt-1">
                        {brand.fascias!.map((fascia) => {
                          const isFasciaSelected = selectedCompanies.includes(fascia.id)
                          const isFasciaVisible = companiesVisibility?.[fascia.id] ?? true
                          const fasciaName = fascia.name

                          return (
                            <div
                              key={fascia.id}
                              className="flex items-center justify-between hover:bg-gray-50 p-2 rounded-md transition-all duration-150"
                            >
                              <div className="flex items-center space-x-2 flex-1 cursor-pointer" onClick={() => handleFasciaToggle(fascia.id)}>
                                <Checkbox
                                  id={`fascia-${fascia.id}`}
                                  checked={isFasciaSelected}
                                  onCheckedChange={() => handleFasciaToggle(fascia.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <Label
                                  htmlFor={`fascia-${fascia.id}`}
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {fasciaName}
                                </Label>
                              </div>

                              {/* Visibility toggle button */}
                              {isFasciaSelected && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 p-0 hover:bg-gray-100"
                                  aria-label={`${isFasciaVisible ? 'Hide' : 'Show'} ${fasciaName} on map`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const newVisibility = { ...companiesVisibility }
                                    if (isFasciaVisible) {
                                      // Toggle to hidden: set false
                                      newVisibility[fascia.id] = false
                                    } else {
                                      // Toggle to visible: delete key (sparse state pattern)
                                      delete newVisibility[fascia.id]
                                    }
                                    onCompaniesVisibilityChange?.(newVisibility)
                                  }}
                                >
                                  {isFasciaVisible ? (
                                    <Eye className="h-4 w-4 text-gray-600" />
                                  ) : (
                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                  )}
                                </Button>
                              )}
                            </div>
                          )
                        })}
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
