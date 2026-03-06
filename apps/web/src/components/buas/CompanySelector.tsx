'use client'

import { useState, useEffect, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Search, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Category {
  id: number
  name: string
  parent_category_id: number | null
}

interface Brand {
  id: number
  name: string
}

interface CompanySelectorProps {
  selectedCompanies: number[]
  selectedCategories: number[]
  onCompaniesChange: (ids: number[]) => void
  onCategoriesChange: (ids: number[]) => void
  mode: 'include' | 'exclude' | 'proximity'
}

export function CompanySelector({
  selectedCompanies,
  selectedCategories,
  onCompaniesChange,
  onCategoriesChange,
  mode
}: CompanySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [brandSearchQuery, setBrandSearchQuery] = useState('')
  const [brandSearchResults, setBrandSearchResults] = useState<Brand[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)

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

  // Debounced brand search
  useEffect(() => {
    if (brandSearchQuery.length < 2) {
      setBrandSearchResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await fetch(
          `/api/public/brands/search?q=${encodeURIComponent(brandSearchQuery)}&limit=20`
        )
        const data = await response.json()
        setBrandSearchResults(data.brands || [])
      } catch (error) {
        console.error('Failed to search brands:', error)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [brandSearchQuery])

  const handleCategoryToggle = useCallback(
    (categoryId: number) => {
      const newSelection = selectedCategories.includes(categoryId)
        ? selectedCategories.filter((id) => id !== categoryId)
        : [...selectedCategories, categoryId]
      onCategoriesChange(newSelection)
    },
    [selectedCategories, onCategoriesChange]
  )

  const handleBrandToggle = useCallback(
    (brandId: number) => {
      const newSelection = selectedCompanies.includes(brandId)
        ? selectedCompanies.filter((id) => id !== brandId)
        : [...selectedCompanies, brandId]
      onCompaniesChange(newSelection)
    },
    [selectedCompanies, onCompaniesChange]
  )

  const handleClearAll = useCallback(() => {
    onCategoriesChange([])
    onCompaniesChange([])
    setBrandSearchQuery('')
  }, [onCategoriesChange, onCompaniesChange])

  const selectedBrands = brandSearchResults.filter((brand) =>
    selectedCompanies.includes(brand.id)
  )

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

      {/* Selected items as chips */}
      {(selectedCategories.length > 0 || selectedCompanies.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {selectedCategories.map((catId) => {
            const category = categories.find((c) => c.id === catId)
            return (
              <Badge
                key={`cat-${catId}`}
                variant="secondary"
                className="text-xs gap-1"
              >
                {category?.name || `Category ${catId}`}
                <button
                  onClick={() => handleCategoryToggle(catId)}
                  className="hover:text-gray-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
          {selectedBrands.map((brand) => (
            <Badge
              key={`brand-${brand.id}`}
              variant="secondary"
              className="text-xs gap-1"
            >
              {brand.name}
              <button
                onClick={() => handleBrandToggle(brand.id)}
                className="hover:text-gray-900"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tabs for Categories vs Companies */}
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
          <TabsTrigger value="companies" className="text-xs">
            Companies
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
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded-md cursor-pointer"
                  onClick={() => handleCategoryToggle(category.id)}
                >
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
              ))}
            </div>
          )}
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="mt-3 space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search companies..."
              value={brandSearchQuery}
              onChange={(e) => setBrandSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
            )}
          </div>

          {/* Search results */}
          {brandSearchQuery.length < 2 ? (
            <div className="text-xs text-gray-500 text-center py-8">
              Type at least 2 characters to search
            </div>
          ) : brandSearchResults.length === 0 && !isSearching ? (
            <div className="text-xs text-gray-500 text-center py-8">
              No companies found
            </div>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {brandSearchResults.map((brand) => (
                <div
                  key={brand.id}
                  className="flex items-center space-x-2 hover:bg-gray-50 p-2 rounded-md cursor-pointer"
                  onClick={() => handleBrandToggle(brand.id)}
                >
                  <Checkbox
                    id={`brand-${brand.id}`}
                    checked={selectedCompanies.includes(brand.id)}
                    onCheckedChange={() => handleBrandToggle(brand.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Label
                    htmlFor={`brand-${brand.id}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {brand.name}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
