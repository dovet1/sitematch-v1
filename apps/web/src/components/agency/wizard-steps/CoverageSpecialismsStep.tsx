'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Plus, CheckCircle2, MapPin } from 'lucide-react'

interface WizardData {
  name: string
  description: string
  website: string
  logoFile: File | null
  logoUrl: string
  coverageAreas: string
  specialisms: string[]
  directAgents: Array<{
    email: string
    name: string
    phone: string
    role: 'admin' | 'member'
    headshotFile: File | null
    headshotUrl: string
  }>
  inviteAgents: Array<{
    email: string
    name: string
    role: 'admin' | 'member'
  }>
}

interface CoverageSpecialismsStepProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
  errors: string[]
}

const AVAILABLE_SPECIALISMS = [
  'Office',
  'Retail',
  'Industrial', 
  'Warehouse',
  'Land',
  'Mixed Use',
  'Healthcare',
  'Education',
  'Hospitality',
  'Leisure',
  'Investment',
  'Development',
  'Agricultural',
  'Residential',
  'Student Accommodation'
]

const COVERAGE_SUGGESTIONS = [
  'Nationwide',
  'South East',
  'South West',
  'North East',
  'North West',
  'Scotland',
  'Ireland',
  'Wales'
]

export function CoverageSpecialismsStep({ data, updateData, errors }: CoverageSpecialismsStepProps) {
  const [specialismSearch, setSpecialismSearch] = useState('')

  const handleCoverageChange = (value: string) => {
    updateData({ coverageAreas: value })
  }

  const applyCoverageSuggestion = (suggestion: string) => {
    const current = data.coverageAreas.trim()
    const newValue = current 
      ? `${current}${current.endsWith(',') ? ' ' : ', '}${suggestion}`
      : suggestion
    updateData({ coverageAreas: newValue })
  }

  const toggleSpecialism = (specialism: string) => {
    const current = data.specialisms
    if (current.includes(specialism)) {
      updateData({ specialisms: current.filter(s => s !== specialism) })
    } else {
      updateData({ specialisms: [...current, specialism] })
    }
  }

  const filteredSpecialisms = AVAILABLE_SPECIALISMS.filter(specialism =>
    specialism.toLowerCase().includes(specialismSearch.toLowerCase())
  )

  const getSpecialismColor = (specialism: string): string => {
    const colorMap: Record<string, string> = {
      'Office': 'bg-blue-50 text-blue-700 border-blue-200',
      'Retail': 'bg-green-50 text-green-700 border-green-200',
      'Industrial': 'bg-orange-50 text-orange-700 border-orange-200',
      'Warehouse': 'bg-purple-50 text-purple-700 border-purple-200',
      'Land': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Mixed Use': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Healthcare': 'bg-red-50 text-red-700 border-red-200',
      'Education': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'Hospitality': 'bg-pink-50 text-pink-700 border-pink-200',
    }
    return colorMap[specialism] || 'bg-gray-50 text-gray-700 border-gray-200'
  }

  const completionPercentage = () => {
    let completed = 0
    if (data.coverageAreas.trim()) completed += 50
    if (data.specialisms.length > 0) completed += 50
    return completed
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Coverage & Specialisms
        </h3>
        <p className="text-gray-600">
          Define your service areas and property specializations to help clients find you.
        </p>
      </div>

      {/* Coverage Areas */}
      <div className="space-y-2">
        <Label htmlFor="coverage-areas" className="text-sm font-medium text-gray-700">
          Coverage Areas *
        </Label>
        <div className="relative">
          <Textarea
            id="coverage-areas"
            value={data.coverageAreas}
            onChange={(e) => handleCoverageChange(e.target.value)}
            placeholder="e.g., Central London, City of London, Canary Wharf, or London and South East England"
            rows={3}
            maxLength={500}
            className={`resize-none ${
              errors.some(error => error.includes('coverage')) 
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                : ''
            }`}
          />
          <div className="absolute top-3 right-3">
            <MapPin className="w-4 h-4 text-gray-400" />
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <p className={`text-xs ${
            errors.some(error => error.includes('coverage')) 
              ? 'text-red-600' 
              : 'text-gray-500'
          }`}>
            {errors.find(error => error.includes('coverage')) || 
             'Describe the geographic areas where you provide services'}
          </p>
          <p className="text-xs text-gray-400">
            {data.coverageAreas.length}/500
          </p>
        </div>

        {/* Coverage Suggestions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {COVERAGE_SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyCoverageSuggestion(suggestion)}
              className="text-xs"
              disabled={data.coverageAreas.includes(suggestion)}
            >
              <Plus className="w-3 h-3 mr-1" />
              {suggestion}
            </Button>
          ))}
        </div>
      </div>

      {/* Specialisms */}
      <div className="space-y-4">
        <Label className="text-sm font-medium text-gray-700">
          Property Specialisms *
        </Label>

        {/* Search Specialisms */}
        <div className="relative">
          <Input
            type="text"
            value={specialismSearch}
            onChange={(e) => setSpecialismSearch(e.target.value)}
            placeholder="Search specialisms..."
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {specialismSearch && (
              <button
                type="button"
                onClick={() => setSpecialismSearch('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Selected Specialisms */}
        {data.specialisms.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Selected Specialisms ({data.specialisms.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {data.specialisms.map((specialism) => (
                <Badge
                  key={specialism}
                  variant="secondary"
                  className={`${getSpecialismColor(specialism)} cursor-pointer hover:opacity-80`}
                  onClick={() => toggleSpecialism(specialism)}
                >
                  {specialism}
                  <X className="w-3 h-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Available Specialisms */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Available Specialisms
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredSpecialisms
              .filter(specialism => !data.specialisms.includes(specialism))
              .map((specialism) => (
                <button
                  key={specialism}
                  type="button"
                  onClick={() => toggleSpecialism(specialism)}
                  className={`
                    p-3 text-left text-sm border-2 border-dashed rounded-lg transition-all
                    hover:border-solid hover:bg-gray-50 focus:outline-none focus:border-solid focus:bg-gray-50
                    ${getSpecialismColor(specialism)}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{specialism}</span>
                    <Plus className="w-4 h-4" />
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* Error Message */}
        {errors.some(error => error.includes('specialism')) && (
          <p className="text-xs text-red-600">
            {errors.find(error => error.includes('specialism'))}
          </p>
        )}

        {/* Help Text */}
        {data.specialisms.length === 0 && !errors.some(error => error.includes('specialism')) && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Plus className="w-3 h-3 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900">Choose Your Specialisms</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Select the property types you work with. This helps clients find agencies that match their needs.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>


    </div>
  )
}