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
      'Leisure': 'bg-cyan-50 text-cyan-700 border-cyan-200',
      'Investment': 'bg-amber-50 text-amber-700 border-amber-200',
      'Development': 'bg-lime-50 text-lime-700 border-lime-200',
      'Agricultural': 'bg-green-50 text-green-700 border-green-200',
      'Residential': 'bg-rose-50 text-rose-700 border-rose-200',
      'Student Accommodation': 'bg-teal-50 text-teal-700 border-teal-200'
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
        <div className="pt-2">
          <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5">
            <Plus className="w-3 h-3" />
            Quick Add Common Areas
          </p>
          <div className="flex flex-wrap gap-2">
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
      </div>

      {/* Specialisms - Compact Multi-Select */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-gray-900">
            Property Specialisms
          </Label>
        </div>

        {/* Selected Specialisms Pills */}
        {data.specialisms.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 rounded-xl border-2 border-gray-100">
            {data.specialisms.map((specialism) => (
              <button
                key={specialism}
                type="button"
                onClick={() => toggleSpecialism(specialism)}
                className={`
                  inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                  transition-all duration-200 hover:scale-105 hover:shadow-sm
                  ${getSpecialismColor(specialism)}
                `}
              >
                <span>{specialism}</span>
                <X className="w-3 h-3 hover:scale-110" />
              </button>
            ))}
            <span className="text-xs text-gray-500 self-center ml-1">
              {data.specialisms.length} selected
            </span>
          </div>
        )}

        {/* Quick Search + Add Interface */}
        <div className="relative group">
          <Input
            type="text"
            value={specialismSearch}
            onChange={(e) => setSpecialismSearch(e.target.value)}
            placeholder={data.specialisms.length > 0 ? "Add more specialisms..." : "Search and select specialisms..."}
            className="pl-10 pr-10 py-2.5 text-sm rounded-xl border-2 border-gray-200 hover:border-gray-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all duration-200"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Plus className="w-4 h-4 text-gray-400 group-focus-within:text-violet-500 transition-colors" />
          </div>
          {specialismSearch && (
            <button
              type="button"
              onClick={() => setSpecialismSearch('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Available Specialisms - Horizontal Scroll */}
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
            {filteredSpecialisms
              .filter(specialism => !data.specialisms.includes(specialism))
              .map((specialism) => (
                <button
                  key={specialism}
                  type="button"
                  onClick={() => toggleSpecialism(specialism)}
                  className={`
                    flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                    border-2 border-dashed transition-all duration-200 hover:border-solid hover:scale-105 hover:shadow-sm
                    focus:outline-none focus:border-solid focus:ring-2 focus:ring-violet-200
                    ${getSpecialismColor(specialism)}
                  `}
                >
                  <Plus className="w-3 h-3" />
                  <span className="whitespace-nowrap">{specialism}</span>
                </button>
              ))}
          </div>
          
          {/* Fade gradient for scroll hint */}
          <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>

        {/* Status Messages */}
        {errors.some(error => error.includes('specialism')) ? (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <X className="w-3 h-3" />
            {errors.find(error => error.includes('specialism'))}
          </p>
        ) : data.specialisms.length > 0 ? (
          <p className="text-xs text-green-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            Great! You've selected {data.specialisms.length} specialism{data.specialisms.length !== 1 ? 's' : ''}
          </p>
        ) : (
          <p className="text-xs text-gray-500">
            Select property types to help clients find your expertise
          </p>
        )}
      </div>

      {/* Add scrollbar hide CSS */}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>


    </div>
  )
}