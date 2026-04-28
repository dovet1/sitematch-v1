'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

interface RequirementCompanySelectorProps {
  selectedCompanies: string[]
  onSelectionChange: (companies: string[]) => void
}

export function RequirementCompanySelector({
  selectedCompanies,
  onSelectionChange
}: RequirementCompanySelectorProps) {
  const [companies, setCompanies] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Fetch companies on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await fetch('/api/public/gapfinder/requirement-companies')
        if (response.ok) {
          const data = await response.json()
          setCompanies(data.companies || [])
        }
      } catch (error) {
        console.error('Failed to fetch companies:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompanies()
  }, [])

  // Filter companies based on search query
  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies
    const query = searchQuery.toLowerCase()
    return companies.filter(company => company.toLowerCase().includes(query))
  }, [companies, searchQuery])

  const handleToggleCompany = (company: string) => {
    if (selectedCompanies.includes(company)) {
      onSelectionChange(selectedCompanies.filter(c => c !== company))
    } else {
      onSelectionChange([...selectedCompanies, company])
    }
  }

  const handleRemoveCompany = (company: string) => {
    onSelectionChange(selectedCompanies.filter(c => c !== company))
  }

  const handleClearAll = () => {
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

      {/* Selected companies as badges */}
      {selectedCompanies.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-600">
              Selected ({selectedCompanies.length})
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
            {selectedCompanies.map(company => (
              <Badge
                key={company}
                variant="secondary"
                className="text-xs gap-1 pr-1"
              >
                {company}
                <button
                  type="button"
                  onClick={() => handleRemoveCompany(company)}
                  className="hover:bg-gray-300 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Company list */}
      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white">
        {filteredCompanies.length === 0 ? (
          <div className="p-3 text-center text-xs text-gray-500">
            {searchQuery ? 'No brands found' : 'No brands available'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCompanies.map(company => (
              <div
                key={company}
                className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleToggleCompany(company)}
              >
                <Checkbox
                  checked={selectedCompanies.includes(company)}
                  onCheckedChange={() => handleToggleCompany(company)}
                  onClick={(e) => e.stopPropagation()}
                />
                <Label
                  htmlFor={`company-${company}`}
                  className="text-xs text-gray-700 flex-1 cursor-pointer"
                >
                  {company}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
