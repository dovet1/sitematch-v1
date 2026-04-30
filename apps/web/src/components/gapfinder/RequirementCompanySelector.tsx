'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

interface Brand {
  brandName: string
  listingIds: string[]
  count: number
}

interface RequirementCompanySelectorProps {
  selectedBrands: string[]  // Brand names (for UI state)
  onSelectionChange: (listingIds: string[]) => void  // Returns listing IDs for API
}

export function RequirementCompanySelector({
  selectedBrands,
  onSelectionChange
}: RequirementCompanySelectorProps) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBrandNames, setSelectedBrandNames] = useState<string[]>(selectedBrands)

  // Fetch brands from API
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await fetch('/api/public/gapfinder/requirement-companies')
        if (response.ok) {
          const data = await response.json()
          setBrands(data.brands || [])
        }
      } catch (error) {
        console.error('Failed to fetch brands:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBrands()
  }, [])

  // Sync selectedBrands prop with internal state
  useEffect(() => {
    setSelectedBrandNames(selectedBrands)
  }, [selectedBrands])

  // Filter brands based on search query
  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands
    const query = searchQuery.toLowerCase()
    return brands.filter(brand => brand.brandName.toLowerCase().includes(query))
  }, [brands, searchQuery])

  // Toggle brand (sends all listing IDs for that brand)
  const handleToggleBrand = (brandName: string) => {
    let newSelectedBrands: string[]

    if (selectedBrandNames.includes(brandName)) {
      newSelectedBrands = selectedBrandNames.filter(b => b !== brandName)
    } else {
      newSelectedBrands = [...selectedBrandNames, brandName]
    }

    setSelectedBrandNames(newSelectedBrands)

    // Convert brand names to listing IDs
    const allListingIds = newSelectedBrands.flatMap(name => {
      const brand = brands.find(b => b.brandName === name)
      return brand ? brand.listingIds : []
    })

    onSelectionChange(allListingIds)
  }

  const handleRemoveBrand = (brandName: string) => {
    handleToggleBrand(brandName)
  }

  const handleClearAll = () => {
    setSelectedBrandNames([])
    onSelectionChange([])
  }

  if (isLoading) {
    return (
      <div className="px-2 py-3">
        <p className="text-xs text-gray-500">Loading brands...</p>
      </div>
    )
  }

  return (
    <div className="px-2 space-y-2">
      {/* Search input */}
      <div>
        <Label htmlFor="company-search" className="text-xs text-gray-600 mb-1 block">
          Search brands
        </Label>
        <Input
          id="company-search"
          type="text"
          placeholder="Type a brand name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 text-sm"
        />
      </div>

      {/* Selected brands as badges */}
      {selectedBrandNames.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-600">
              Selected ({selectedBrandNames.length})
            </Label>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs text-violet-600 hover:text-violet-700"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedBrandNames.map(brandName => (
              <Badge
                key={brandName}
                variant="secondary"
                className="text-xs gap-1 pr-1"
              >
                {brandName}
                <button
                  type="button"
                  onClick={() => handleRemoveBrand(brandName)}
                  className="hover:bg-gray-300 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Brand list */}
      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white">
        {filteredBrands.length === 0 ? (
          <div className="p-3 text-center text-xs text-gray-500">
            {searchQuery ? 'No brands found' : 'No brands available'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredBrands.map(brand => (
              <div
                key={brand.brandName}
                className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleToggleBrand(brand.brandName)}
              >
                <Checkbox
                  checked={selectedBrandNames.includes(brand.brandName)}
                  onCheckedChange={() => handleToggleBrand(brand.brandName)}
                  onClick={(e) => e.stopPropagation()}
                />
                <Label
                  htmlFor={`brand-${brand.brandName}`}
                  className="text-xs text-gray-700 flex-1 cursor-pointer"
                >
                  {brand.brandName}
                  {brand.count > 1 && (
                    <span className="text-gray-500"> ({brand.count})</span>
                  )}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
