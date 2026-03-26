'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { BUA } from '@/lib/buas'
import { formatPopulation } from '@/lib/format-population'

interface BUASearchProps {
  value: string
  onChange: (value: string) => void
  onBUASelect: (bua: { name: string; coordinates: { lat: number; lng: number }; gsscode: string; pop: number }) => void
  placeholder?: string
  className?: string
}

export function BUASearch({
  value,
  onChange,
  onBUASelect,
  placeholder = 'Search for a built-up area...',
  className = ''
}: BUASearchProps) {
  const [suggestions, setSuggestions] = useState<BUA[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [userInteracted, setUserInteracted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Fetch suggestions with debounce
  useEffect(() => {
    const handleSearch = async () => {
      if (value.length < 2) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/public/buas/search?q=${encodeURIComponent(value)}&limit=20`)
        if (response.ok) {
          const data = await response.json()
          setSuggestions(data.results || [])
          setShowSuggestions(true)
        }
      } catch (error) {
        console.error('Error fetching BUA suggestions:', error)
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setIsLoading(false)
      }
    }

    const debounceTimer = setTimeout(handleSearch, 300)
    return () => clearTimeout(debounceTimer)
  }, [value, userInteracted])

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSuggestionClick = useCallback((bua: BUA) => {
    onChange(bua.name)
    setShowSuggestions(false)
    setUserInteracted(false)
    onBUASelect({
      name: bua.name,
      gsscode: bua.gsscode,
      pop: bua.pop,
      coordinates: {
        lat: bua.centroid_lat,
        lng: bua.centroid_lon
      }
    })
  }, [onChange, onBUASelect])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Escape') {
        setShowSuggestions(false)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
      case 'Tab':
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault()
          handleSuggestionClick(suggestions[selectedIndex])
        }
        break
    }
  }

  const handleClear = () => {
    onChange('')
    setSuggestions([])
    setShowSuggestions(false)
    setUserInteracted(false)
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
    setUserInteracted(true)
    setSelectedIndex(-1)
  }

  const handleInputFocus = () => {
    if (value.length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true)
    }
    setUserInteracted(true)
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-80 overflow-auto"
        >
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              Searching...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              No built-up areas found
            </div>
          ) : (
            suggestions.map((bua, index) => (
              <button
                key={bua.gsscode}
                onClick={() => handleSuggestionClick(bua)}
                className={cn(
                  'w-full px-4 py-3 text-left hover:bg-violet-50 transition-colors border-b border-gray-100 last:border-b-0',
                  selectedIndex === index && 'bg-violet-50'
                )}
              >
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-violet-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{bua.name}</div>
                    <div className="text-sm text-gray-600 mt-0.5">
                      Population: {formatPopulation(bua.pop_final)}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
