'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Search, X, Loader2, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

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

  // Fetch categories on mount
  useEffect(() => {
    async function fetchCategories() {
      setIsLoadingCategories(true)
      try {
        const response = await fetch('/api/public/categories')
        const data = await response.json()
        setCategories(data.categories || [])
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      } finally {
        setIsLoadingCategories(false)
      }
    }
    fetchCategories()
  }, [])

  // Fetch all brands with fascias on mount
  useEffect(() => {
    async function fetchAllBrands() {
      setIsLoadingStores(true)
      try {
        // Fetch all brands using the new endpoint
        const brandsResponse = await fetch('/api/public/brands?limit=1000')
        const brandsData = await brandsResponse.json()
        const brands: Brand[] = brandsData.brands || []

        // For each brand, fetch its fascias
        const brandsWithFascias = await Promise.all(
          brands.map(async (brand) => {
            try {
              const fasciasResponse = await fetch(
                `/api/public/fascias/search?q=${encodeURIComponent(brand.name)}&limit=100`
              )
              const fasciasData = await fasciasResponse.json()
              const brandFascias = (fasciasData.fascias || []).filter(
                (f: Fascia) => f.brand_id === brand.id
              )
              return { ...brand, fascias: brandFascias }
            } catch (error) {
              console.error(`Failed to fetch fascias for brand ${brand.name}:`, error)
              return { ...brand, fascias: [] }
            }
          })
        )

        setAllBrands(brandsWithFascias)
      } catch (error) {
        console.error('Failed to fetch brands:', error)
      } finally {
        setIsLoadingStores(false)
      }
    }
    fetchAllBrands()
  }, [])

  // Filter brands based on search query (client-side filtering)
  const filteredBrands = useMemo(() => {
    if (!storeSearchQuery.trim()) {
      return allBrands
    }

    const query = storeSearchQuery.toLowerCase()
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
  }, [allBrands, storeSearchQuery])

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

  const totalSelected = selectedCategories.length + selectedCompanies.length

  return (
    <div className="space-y-3">
      {/* Header with clear all button */}
      {totalSelected > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600">
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
        <TabsContent value="categories" className="mt-3 space-y-2">
          {isLoadingCategories ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8">
              No categories available
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between hover:bg-gray-50 p-2 rounded-md transition-colors"
                >
                  <div className="flex items-center space-x-2 flex-1 cursor-pointer" onClick={() => handleCategoryToggle(category.id)}>
                    <Checkbox
                      id={`cat-${category.id}`}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={() => handleCategoryToggle(category.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Label
                      htmlFor={`cat-${category.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {category.name}
                    </Label>
                  </div>

                  {/* Visibility toggle button */}
                  {selectedCategories.includes(category.id) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 p-0 hover:bg-gray-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        const newVisibility = {
                          ...categoriesVisibility,
                          [category.id]: !(categoriesVisibility?.[category.id] ?? true)
                        }
                        onCategoriesVisibilityChange?.(newVisibility)
                      }}
                    >
                      {(categoriesVisibility?.[category.id] ?? true) ? (
                        <Eye className="h-4 w-4 text-gray-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Stores Tab - Hierarchical brand/fascia selection */}
        <TabsContent value="stores" className="mt-3 space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search stores..."
              value={storeSearchQuery}
              onChange={(e) => setStoreSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Brand list */}
          {isLoadingStores ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading stores...
            </div>
          ) : filteredBrands.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-8">
              {storeSearchQuery ? 'No stores found matching your search' : 'No stores available'}
            </div>
          ) : (
            <div className="space-y-1 overflow-y-auto">
              {filteredBrands.map((brand) => {
                const isExpanded = expandedBrands.has(brand.id)
                const hasFascias = (brand.fascias?.length || 0) > 0

                return (
                  <Collapsible
                    key={brand.id}
                    open={isExpanded}
                    onOpenChange={() => toggleBrandExpansion(brand.id)}
                  >
                    <div className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded-md">
                      <Checkbox
                        id={`brand-${brand.id}`}
                        checked={
                          isBrandPartiallySelected(brand)
                            ? "indeterminate"
                            : isBrandFullySelected(brand)
                        }
                        onCheckedChange={() => handleBrandToggle(brand)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <CollapsibleTrigger className="flex-1 flex items-center justify-between cursor-pointer">
                        <Label
                          htmlFor={`brand-${brand.id}`}
                          className="cursor-pointer flex-1"
                        >
                          {brand.name}
                          {hasFascias && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({brand.fascias!.length} fascia{brand.fascias!.length !== 1 ? 's' : ''})
                            </span>
                          )}
                        </Label>
                        {hasFascias && (
                          isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )
                        )}
                      </CollapsibleTrigger>
                    </div>

                    {hasFascias && (
                      <CollapsibleContent className="ml-8 space-y-1 mt-1">
                        {brand.fascias!.map((fascia) => (
                          <div
                            key={fascia.id}
                            className="flex items-center justify-between hover:bg-gray-50 p-2 rounded-md transition-colors"
                          >
                            <div className="flex items-center space-x-2 flex-1 cursor-pointer" onClick={() => handleFasciaToggle(fascia.id)}>
                              <Checkbox
                                id={`fascia-${fascia.id}`}
                                checked={selectedCompanies.includes(fascia.id)}
                                onCheckedChange={() => handleFasciaToggle(fascia.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Label
                                htmlFor={`fascia-${fascia.id}`}
                                className="text-sm cursor-pointer flex-1"
                              >
                                {fascia.name}
                              </Label>
                            </div>

                            {/* Visibility toggle button */}
                            {selectedCompanies.includes(fascia.id) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 p-0 hover:bg-gray-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const newVisibility = {
                                    ...companiesVisibility,
                                    [fascia.id]: !(companiesVisibility?.[fascia.id] ?? true)
                                  }
                                  onCompaniesVisibilityChange?.(newVisibility)
                                }}
                              >
                                {(companiesVisibility?.[fascia.id] ?? true) ? (
                                  <Eye className="h-4 w-4 text-gray-600" />
                                ) : (
                                  <EyeOff className="h-4 w-4 text-gray-400" />
                                )}
                              </Button>
                            )}
                          </div>
                        ))}
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
