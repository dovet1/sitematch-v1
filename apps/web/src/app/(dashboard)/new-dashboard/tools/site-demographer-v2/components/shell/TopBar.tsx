'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronRight, MapPin, X, Loader2, Sparkles, Save, Lock } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '../primitives/Button'
import { searchLocations, formatLocationDisplay } from '@/lib/mapbox'
import type { LocationResult } from '@/lib/mapbox'
import type { MeasurementMode } from '@/components/demographics/desktop/LocationInputPanel'

interface TopBarProps {
  selectedLocation: LocationResult | null
  onLocationChange: (location: LocationResult | null) => void
  measurementMode: MeasurementMode
  onMeasurementModeChange: (mode: MeasurementMode) => void
  measurementValue: number
  onMeasurementValueChange: (value: number) => void
  onAnalyze: (location?: LocationResult, shouldReset?: boolean) => void
  loading: boolean
  hasResults: boolean
  onSave: () => void
  analysisName?: string | null
  analysisId?: string | null
  hasProAccess: boolean
}

export function TopBar({
  selectedLocation,
  onLocationChange,
  measurementMode,
  onMeasurementModeChange,
  measurementValue,
  onMeasurementValueChange,
  onAnalyze,
  loading,
  hasResults,
  onSave,
  analysisName,
  analysisId,
  hasProAccess,
}: TopBarProps) {
  const [locationQuery, setLocationQuery] = useState('')
  const [locationResults, setLocationResults] = useState<LocationResult[]>([])
  const [locationLoading, setLocationLoading] = useState(false)
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Get configuration based on mode
  const getModeConfig = () => {
    switch (measurementMode) {
      case 'distance':
        return { label: 'Distance', unit: 'miles', min: 1, max: 50 }
      case 'drive_time':
        return { label: 'Drive Time', unit: 'mins', min: 2, max: 120 }
      case 'walk_time':
        return { label: 'Walk Time', unit: 'mins', min: 1, max: 60 }
    }
  }

  const config = getModeConfig()

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showLocationDropdown || locationResults.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < locationResults.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < locationResults.length) {
          handleLocationSelect(locationResults[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowLocationDropdown(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [locationResults])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowLocationDropdown(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search locations with debounce
  useEffect(() => {
    const selectedLocationDisplay = selectedLocation ? formatLocationDisplay(selectedLocation) : ''
    const isTypingNewQuery = locationQuery !== selectedLocationDisplay

    if (selectedLocation && !isTypingNewQuery) {
      setLocationResults([])
      setShowLocationDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      if (locationQuery.trim().length > 2) {
        setLocationLoading(true)
        try {
          const results = await searchLocations(locationQuery)
          setLocationResults(results)
          setShowLocationDropdown(true)
        } catch (error) {
          console.error('Location search error:', error)
          setLocationResults([])
        } finally {
          setLocationLoading(false)
        }
      } else {
        setLocationResults([])
        setShowLocationDropdown(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [locationQuery, selectedLocation])

  const handleLocationSelect = (location: LocationResult) => {
    onLocationChange(location)
    setLocationQuery(formatLocationDisplay(location))
    setShowLocationDropdown(false)
    setLocationResults([])
    searchInputRef.current?.blur()

    // Auto-analyze only on first search (no existing results)
    if (!hasResults) {
      onAnalyze(location, false)
    }
  }

  const handleClearLocation = () => {
    onLocationChange(null)
    setLocationQuery('')
    setLocationResults([])
  }

  const canAnalyze = selectedLocation && !loading && measurementValue && Number(measurementValue) > 0

  return (
    <header className="h-14 border-b border-sm-border bg-sm-surface flex items-center justify-between px-4 shrink-0">
      {/* Left: Logo + Brand + Analysis Name */}
      <div className="flex items-center gap-3">
        {/* Logo Icon */}
        <Link
          href="/"
          className="w-8 h-8 flex items-center justify-center hover:opacity-70 transition-opacity"
          aria-label="SiteMatcher home"
        >
          <Image
            src="/logo_icon.svg"
            alt="SiteMatcher"
            width={32}
            height={32}
            className="w-8 h-8"
            priority
          />
        </Link>

        {/* Brand Name */}
        <span className="font-semibold text-sm text-sm-ink">SiteAnalyser</span>

        {/* Separator */}
        <ChevronRight className="w-4 h-4 text-sm-ink/30" />

        {/* Analysis Name */}
        <span className="text-sm font-medium text-sm-ink">
          {analysisName || 'Untitled Report'}
        </span>
      </div>

      {/* Center: Location search */}
      <div className="flex-1 max-w-2xl mx-8 flex items-center gap-3">
        <div className="flex-1 relative" ref={inputRef}>
          <div className="relative group">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sm-ink/40 group-focus-within:text-sm-violet transition-colors" />
            <input
              ref={searchInputRef}
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search UK location..."
              className="w-full h-9 pl-10 pr-10 text-sm bg-sm-surface-hover border border-sm-border rounded-md focus:outline-none focus:ring-2 focus:ring-sm-violet/20 focus:border-sm-violet transition-all"
              disabled={loading}
            />
            {selectedLocation && (
              <button
                onClick={handleClearLocation}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm-ink/40 hover:text-sm-ink hover:bg-sm-surface-hover rounded p-0.5 transition-all"
                disabled={loading}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {locationLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sm-violet animate-spin" />
            )}
          </div>

          {/* Location Dropdown */}
          {showLocationDropdown && locationResults.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-sm-surface border border-sm-border rounded-md shadow-lg max-h-64 overflow-y-auto z-50">
              {locationResults.map((result, idx) => (
                <button
                  key={result.id}
                  onClick={() => handleLocationSelect(result)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-sm-surface-hover transition-colors ${
                    idx === selectedIndex ? 'bg-sm-surface-hover' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-sm-ink/40 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm-ink truncate">
                        {result.place_name.split(',')[0]}
                      </div>
                      <div className="text-xs text-sm-ink/60 truncate">
                        {result.place_name.split(',').slice(1).join(',')}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Measurement Mode & Value */}
        <div className="flex items-center gap-2">
          <select
            value={measurementMode}
            onChange={(e) => onMeasurementModeChange(e.target.value as MeasurementMode)}
            className="h-9 px-3 text-sm bg-sm-surface border border-sm-border rounded-md focus:outline-none focus:ring-2 focus:ring-sm-violet/20 focus:border-sm-violet transition-all"
            disabled={loading}
          >
            <option value="distance">Distance</option>
            <option value="drive_time">Drive Time</option>
            <option value="walk_time">Walk Time</option>
          </select>

          <div className="flex items-center gap-1">
            <input
              type="number"
              value={measurementValue}
              onChange={(e) => onMeasurementValueChange(Number(e.target.value))}
              min={config.min}
              max={config.max}
              className="w-16 h-9 px-2 text-sm text-center bg-sm-surface border border-sm-border rounded-md focus:outline-none focus:ring-2 focus:ring-sm-violet/20 focus:border-sm-violet transition-all"
              disabled={loading}
            />
            <span className="text-xs text-sm-ink/60">{config.unit}</span>
          </div>
        </div>
      </div>

      {/* Right: Analyse + Save */}
      <div className="flex items-center gap-2">
        <Button
          onClick={() => onAnalyze()}
          disabled={!canAnalyze || loading}
          variant="secondary"
          size="sm"
          icon={loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        >
          {loading ? 'Analyzing...' : 'Analyse'}
        </Button>

        <Button
          onClick={onSave}
          disabled={!hasResults}
          variant={hasProAccess ? "primary" : "secondary"}
          size="sm"
          icon={hasProAccess ? <Save className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
        >
          {hasProAccess ? 'Save Analysis' : 'Upgrade to Save'}
        </Button>
      </div>
    </header>
  )
}
