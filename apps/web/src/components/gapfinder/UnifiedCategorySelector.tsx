'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Loader2, ChevronDown, ChevronRight, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Category, Brand, Fascia } from '@/lib/stores'
import {
  buildCategoryTree,
  organizeBrandsByCategory,
  attachBrandsToTree,
  filterTree,
  getAllFasciaIdsInCategory,
  type CategoryNode,
  type BrandNode,
  type FasciaCategory
} from '@/lib/category-tree-utils'

interface UnifiedCategorySelectorProps {
  selectedCompanies: string[]  // Fascia IDs (UUIDs)
  selectedCategories: string[]  // Category IDs (UUIDs)
  onCompaniesChange: (ids: string[]) => void
  onCategoriesChange: (ids: string[]) => void
  companiesVisibility?: Record<string, boolean>
  categoriesVisibility?: Record<string, boolean>
  onCompaniesVisibilityChange?: (visibility: Record<string, boolean>) => void
  onCategoriesVisibilityChange?: (visibility: Record<string, boolean>) => void
  mode: 'include' | 'exclude' | 'proximity'
  onCategoryTreeLoaded?: (tree: CategoryNode[]) => void
}

export function UnifiedCategorySelector({
  selectedCompanies,
  selectedCategories,
  onCompaniesChange,
  onCategoriesChange,
  companiesVisibility,
  categoriesVisibility,
  onCompaniesVisibilityChange,
  onCategoriesVisibilityChange,
  mode,
  onCategoryTreeLoaded
}: UnifiedCategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [allBrands, setAllBrands] = useState<Brand[]>([])
  const [fasciaCategoryMappings, setFasciaCategoryMappings] = useState<FasciaCategory[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set())

  // Debounce search query for performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Build unfiltered tree for selection operations
  const unfilteredCategoryTree = useMemo(() => {
    if (categories.length === 0 || allBrands.length === 0) {
      return []
    }

    const tree = buildCategoryTree(categories)
    const categoryBrandsMap = organizeBrandsByCategory(allBrands, fasciaCategoryMappings)
    attachBrandsToTree(tree, categoryBrandsMap)

    return tree // NO filterTree() call
  }, [categories, allBrands, fasciaCategoryMappings])

  // Fetch all data on mount
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      setError('')

      try {
        // Fetch categories
        const categoriesResponse = await fetch('/api/public/categories')
        if (!categoriesResponse.ok) throw new Error('Failed to load categories')
        const categoriesData = await categoriesResponse.json()
        setCategories(categoriesData.categories || [])

        // Fetch brands
        const brandsResponse = await fetch('/api/public/brands?limit=1000')
        if (!brandsResponse.ok) throw new Error('Failed to load brands')
        const brandsData = await brandsResponse.json()
        const brands = brandsData.brands || []

        // Fetch fascias for each brand
        const brandsWithFascias = await Promise.all(
          brands.map(async (brand: Brand) => {
            try {
              const fasciasResponse = await fetch(`/api/public/fascias/search?brandId=${brand.id}&limit=100`)
              if (!fasciasResponse.ok) {
                console.error(`Failed to fetch fascias for brand ${brand.name}`)
                return { ...brand, fascias: [] }
              }
              const fasciasData = await fasciasResponse.json()
              return { ...brand, fascias: fasciasData.fascias || [] }
            } catch (err) {
              console.error(`Error fetching fascias for brand ${brand.name}:`, err)
              return { ...brand, fascias: [] }
            }
          })
        )
        setAllBrands(brandsWithFascias)

        // Fetch fascia-category mappings
        const mappingsResponse = await fetch('/api/public/fascia-categories')
        if (!mappingsResponse.ok) throw new Error('Failed to load category mappings')
        const mappingsData = await mappingsResponse.json()
        setFasciaCategoryMappings(mappingsData.mappings || [])

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
        console.error('Error fetching data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Call callback when unfiltered tree is built
  useEffect(() => {
    if (unfilteredCategoryTree.length > 0 && onCategoryTreeLoaded) {
      onCategoryTreeLoaded(unfilteredCategoryTree)
    }
  }, [unfilteredCategoryTree, onCategoryTreeLoaded])

  // Build and filter the category tree
  const categoryTree = useMemo(() => {
    if (categories.length === 0 || allBrands.length === 0) {
      return []
    }

    // Build category hierarchy
    const tree = buildCategoryTree(categories)

    // Organize brands by category
    const categoryBrandsMap = organizeBrandsByCategory(allBrands, fasciaCategoryMappings)

    // Attach brands to tree
    attachBrandsToTree(tree, categoryBrandsMap)

    // Filter by search query
    return filterTree(tree, debouncedSearchQuery)
  }, [categories, allBrands, fasciaCategoryMappings, debouncedSearchQuery])

  // Derive effective fascia selection from explicitly selected fascias + fascias under selected categories
  const effectiveSelectedFasciaIds = useMemo(() => {
    const fasciaSet = new Set(selectedCompanies)

    // Add all fascias from selected categories
    selectedCategories.forEach(categoryId => {
      const fasciaIds = getAllFasciaIdsInCategory(categoryId, unfilteredCategoryTree)
      fasciaIds.forEach(id => fasciaSet.add(id))
    })

    return fasciaSet
  }, [selectedCompanies, selectedCategories, unfilteredCategoryTree])

  // Toggle handlers
  const handleCategoryToggle = useCallback(
    (categoryId: string, categoryNode: CategoryNode) => {
      const fasciaIds = getAllFasciaIdsInCategory(categoryId, unfilteredCategoryTree)
      const allSelected = fasciaIds.length > 0 && fasciaIds.every(id => effectiveSelectedFasciaIds.has(id))

      if (allSelected) {
        // Deselect the category
        const newCategoriesSelection = selectedCategories.filter(id => id !== categoryId)
        onCategoriesChange(newCategoriesSelection)

        // Also remove any explicitly selected fascias that were in this category
        const newCompaniesSelection = selectedCompanies.filter(id => !fasciaIds.includes(id))
        if (newCompaniesSelection.length !== selectedCompanies.length) {
          onCompaniesChange(newCompaniesSelection)
        }
      } else {
        // Select the category
        const newCategoriesSelection = selectedCategories.includes(categoryId)
          ? selectedCategories
          : [...selectedCategories, categoryId]
        onCategoriesChange(newCategoriesSelection)
      }
    },
    [selectedCategories, selectedCompanies, onCategoriesChange, onCompaniesChange, unfilteredCategoryTree, effectiveSelectedFasciaIds]
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
    (brandNode: BrandNode) => {
      const fasciaIds = brandNode.fascias.map(f => f.id)
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

  const isBrandFullySelected = (brandNode: BrandNode): boolean => {
    const fasciaIds = brandNode.fascias.map(f => f.id)
    return fasciaIds.length > 0 && fasciaIds.every(id => effectiveSelectedFasciaIds.has(id))
  }

  const isBrandPartiallySelected = (brandNode: BrandNode): boolean => {
    const fasciaIds = brandNode.fascias.map(f => f.id)
    const selectedCount = fasciaIds.filter(id => effectiveSelectedFasciaIds.has(id)).length
    return selectedCount > 0 && selectedCount < fasciaIds.length
  }

  const isCategoryFullySelected = (categoryNode: CategoryNode): boolean => {
    const fasciaIds = getAllFasciaIdsInCategory(categoryNode.category.id, unfilteredCategoryTree)
    return fasciaIds.length > 0 && fasciaIds.every(id => effectiveSelectedFasciaIds.has(id))
  }

  const isCategoryPartiallySelected = (categoryNode: CategoryNode): boolean => {
    const fasciaIds = getAllFasciaIdsInCategory(categoryNode.category.id, unfilteredCategoryTree)
    const selectedCount = fasciaIds.filter(id => effectiveSelectedFasciaIds.has(id)).length
    return selectedCount > 0 && selectedCount < fasciaIds.length
  }

  const toggleCategoryExpansion = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
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
    setSearchQuery('')
  }, [onCategoriesChange, onCompaniesChange])

  const totalSelected = selectedCategories.length + selectedCompanies.length

  // Recursive component to render category nodes
  const renderCategoryNode = (node: CategoryNode, depth: number = 0) => {
    const isExpanded = expandedCategories.has(node.category.id)
    const isCategorySelected = selectedCategories.includes(node.category.id)
    const isCategoryVisible = categoriesVisibility?.[node.category.id] ?? true
    const hasChildren = node.children.length > 0
    const hasBrands = node.brands.length > 0

    return (
      <div key={node.category.id} style={{ marginLeft: depth > 0 ? '1.5rem' : '0' }}>
        <Collapsible
          open={isExpanded}
          onOpenChange={() => toggleCategoryExpansion(node.category.id)}
        >
          <div className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded-md transition-all duration-150">
            <Checkbox
              id={`cat-${node.category.id}`}
              checked={isCategoryPartiallySelected(node) ? "indeterminate" : isCategoryFullySelected(node)}
              onCheckedChange={() => handleCategoryToggle(node.category.id, node)}
              onClick={(e) => e.stopPropagation()}
            />
            <CollapsibleTrigger
              className="flex-1 flex items-start justify-between cursor-pointer gap-2 text-left"
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.category.name}`}
            >
              <div className="flex-1 min-w-0">
                <Label
                  htmlFor={`cat-${node.category.id}`}
                  className="cursor-pointer text-sm font-medium inline"
                >
                  {node.category.name}
                </Label>
                {hasBrands && (
                  <span className="text-xs text-gray-500 ml-1.5">
                    ({node.brands.length} {node.brands.length === 1 ? 'brand' : 'brands'})
                  </span>
                )}
              </div>
              {(hasChildren || hasBrands) && (
                <div className="flex-shrink-0 mt-0.5">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500 transition-transform duration-150" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500 transition-transform duration-150" />
                  )}
                </div>
              )}
            </CollapsibleTrigger>

            {/* Visibility toggle for category */}
            {isCategorySelected && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 p-0 hover:bg-gray-100"
                aria-label={`${isCategoryVisible ? 'Hide' : 'Show'} ${node.category.name} on map`}
                onClick={(e) => {
                  e.stopPropagation()
                  const newVisibility = { ...categoriesVisibility }
                  if (isCategoryVisible) {
                    newVisibility[node.category.id] = false
                  } else {
                    delete newVisibility[node.category.id]
                  }
                  onCategoriesVisibilityChange?.(newVisibility)
                }}
              >
                {isCategoryVisible ? (
                  <Eye className="h-4 w-4 text-gray-600" />
                ) : (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            )}
          </div>

          <CollapsibleContent>
            {/* Render brands under this category */}
            {hasBrands && (
              <div className="ml-8 space-y-1 mt-1">
                {node.brands.map((brandNode) => {
                  const isBrandExpanded = expandedBrands.has(brandNode.brand.id)
                  const hasFascias = brandNode.fascias.length > 0
                  const isFullySelected = isBrandFullySelected(brandNode)
                  const isPartiallySelected = isBrandPartiallySelected(brandNode)

                  return (
                    <Collapsible
                      key={`${node.category.id}-${brandNode.brand.id}`}
                      open={isBrandExpanded}
                      onOpenChange={() => toggleBrandExpansion(brandNode.brand.id)}
                    >
                      <div className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded-md transition-all duration-150">
                        <Checkbox
                          id={`brand-${node.category.id}-${brandNode.brand.id}`}
                          checked={isPartiallySelected ? "indeterminate" : isFullySelected}
                          onCheckedChange={() => handleBrandToggle(brandNode)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <CollapsibleTrigger
                          className="flex-1 flex items-start justify-between cursor-pointer gap-2 text-left"
                          aria-label={`${isBrandExpanded ? 'Collapse' : 'Expand'} ${brandNode.brand.name}`}
                        >
                          <div className="flex-1 min-w-0">
                            <Label
                              htmlFor={`brand-${node.category.id}-${brandNode.brand.id}`}
                              className="cursor-pointer text-sm inline"
                            >
                              {brandNode.brand.name}
                            </Label>
                            {hasFascias && brandNode.fascias.length > 1 && (
                              <span className="text-xs text-gray-500 ml-1.5">
                                ({brandNode.fascias.length} types)
                              </span>
                            )}
                            {!isBrandExpanded && isPartiallySelected && (
                              <span className="inline-block w-1.5 h-1.5 bg-violet-500 rounded-full ml-1.5 align-middle" title="Some types selected" />
                            )}
                          </div>
                          {hasFascias && (
                            <div className="flex-shrink-0 mt-0.5">
                              {isBrandExpanded ? (
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
                          {brandNode.fascias.map((fascia) => {
                            const isFasciaSelected = effectiveSelectedFasciaIds.has(fascia.id)
                            const isFasciaVisible = companiesVisibility?.[fascia.id] ?? true

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
                                    {fascia.name}
                                  </Label>
                                </div>

                                {/* Visibility toggle for fascia */}
                                {isFasciaSelected && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 p-0 hover:bg-gray-100"
                                    aria-label={`${isFasciaVisible ? 'Hide' : 'Show'} ${fascia.name} on map`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const newVisibility = { ...companiesVisibility }
                                      if (isFasciaVisible) {
                                        newVisibility[fascia.id] = false
                                      } else {
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

            {/* Render child categories */}
            {hasChildren && (
              <div className="mt-1">
                {node.children.map(childNode => renderCategoryNode(childNode, depth + 1))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    )
  }

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

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search brands"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          aria-label="Search"
        />
      </div>

      {/* Category tree */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading...
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">{error}</span>
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
      ) : categoryTree.length === 0 ? (
        <div className="text-sm text-gray-600 text-center py-8">
          {searchQuery ? 'No results found' : 'No categories available'}
        </div>
      ) : (
        <div className="space-y-1 overflow-y-auto max-h-[400px]">
          {categoryTree.map(node => renderCategoryNode(node))}
        </div>
      )}
    </div>
  )
}
