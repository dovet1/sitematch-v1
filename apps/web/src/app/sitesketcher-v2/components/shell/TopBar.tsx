'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Button } from '../primitives';
import {
  Save,
  Undo2,
  Redo2,
  Search,
  ChevronRight,
  Home,
  Loader2,
  MapPin
} from 'lucide-react';
import Link from 'next/link';
import { createDebouncedLocationSearch, formatLocationDisplay } from '@/lib/mapbox';
import type { LocationResult } from '@/lib/mapbox';

export function TopBar() {
  const {
    sketchId,
    sketchName,
    isDirty,
    lastSaved,
    canUndo,
    canRedo,
    undo,
    redo,
    getSketchData,
    setSketchName,
    setSketchId,
    setLastSaved,
    markClean,
    setViewport,
  } = useSketchStore();

  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useRef(createDebouncedLocationSearch(300));

  const handleSave = async () => {
    setSaving(true);

    try {
      const data = getSketchData();

      if (sketchId) {
        // Update existing sketch
        const response = await fetch(`/api/sitesketcher-v2/sketches/${sketchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sketchName,
            data,
          }),
        });

        if (response.status === 403) {
          const error = await response.json();
          alert(error.error || 'Pro subscription required to save');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to save sketch');
        }

        const result = await response.json();
        setLastSaved(new Date(result.sketch.updated_at));
        markClean();
      } else {
        // Create new sketch - prompt for name
        const name = prompt('Enter sketch name:', sketchName);
        if (!name) {
          return;
        }

        const response = await fetch('/api/sitesketcher-v2/sketches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            data,
          }),
        });

        if (response.status === 403) {
          const error = await response.json();
          alert(error.error || 'Pro subscription required to save');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to create sketch');
        }

        const result = await response.json();
        setSketchId(result.sketch.id);
        setSketchName(result.sketch.name);
        setLastSaved(new Date(result.sketch.updated_at));
        markClean();
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save sketch. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = () => {
    if (canUndo()) undo();
  };

  const handleRedo = () => {
    if (canRedo()) redo();
  };

  // Location search functionality
  const performLocationSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);

    try {
      const results = await debouncedSearch.current(query, {
        limit: 5,
        country: ['GB', 'IE'],
        types: ['place', 'locality', 'neighborhood', 'address']
      });

      setSearchResults(results);
      setShowResults(results.length > 0);
      setFocusedIndex(-1);
    } catch (error) {
      console.error('Location search error:', error);
      setSearchResults([]);
      setShowResults(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    performLocationSearch(searchQuery);
  }, [searchQuery, performLocationSearch]);

  const handleLocationSelect = (location: LocationResult) => {
    // Fly to the selected location
    setViewport({
      center: location.center as [number, number],
      zoom: 16,
    });

    // Clear search
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    searchInputRef.current?.blur();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    if (!showResults || searchResults.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev =>
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev =>
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Enter':
        event.preventDefault();
        if (focusedIndex >= 0 && searchResults[focusedIndex]) {
          handleLocationSelect(searchResults[focusedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setFocusedIndex(-1);
        searchInputRef.current?.blur();
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-save effect
  useEffect(() => {
    // Only auto-save if sketch already exists (has ID)
    if (!sketchId || !isDirty || saving) return;

    const timer = setTimeout(async () => {
      try {
        const data = getSketchData();

        const response = await fetch(`/api/sitesketcher-v2/sketches/${sketchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sketchName, data }),
        });

        if (response.ok) {
          const result = await response.json();
          setLastSaved(new Date(result.sketch.updated_at));
          markClean();
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
        // Silent failure - manual save still works
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [isDirty, sketchId, sketchName, saving, getSketchData, setLastSaved, markClean]);

  return (
    <div className="h-14 bg-sm-surface border-b border-sm-border flex items-center justify-between px-4 flex-shrink-0">
      {/* Left: Logo + Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-70 transition-opacity"
        >
          <div className="w-8 h-8 bg-sm-violet rounded-lg flex items-center justify-center">
            <Home className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-sm-ink">CD</span>
        </Link>

        <ChevronRight className="w-4 h-4 text-sm-ink/30" />

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-sm-ink">
            {sketchName}
          </span>
          {isDirty && (
            <span className="w-2 h-2 bg-sm-violet rounded-full" title="Unsaved changes" />
          )}
        </div>

        {lastSaved && !isDirty && (
          <span className="text-xs text-sm-ink/50">
            Saved {formatTimeSince(lastSaved)}
          </span>
        )}
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sm-ink/40" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => setShowResults(searchResults.length > 0)}
            placeholder="Search location..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-sm-bg border border-sm-border rounded-lg focus:outline-none focus:border-sm-violet transition-colors"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sm-ink/40 animate-spin" />
          )}

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div
              ref={resultsRef}
              className="absolute top-full left-0 right-0 mt-2 bg-white border border-sm-border rounded-lg shadow-lg max-h-80 overflow-y-auto z-50"
            >
              {searchResults.map((location, index) => (
                <div
                  key={location.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    index === focusedIndex
                      ? 'bg-sm-violet/10'
                      : 'hover:bg-sm-bg'
                  } ${
                    index !== searchResults.length - 1
                      ? 'border-b border-sm-border'
                      : ''
                  }`}
                  onClick={() => handleLocationSelect(location)}
                >
                  <MapPin className="w-4 h-4 text-sm-ink/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-sm-ink truncate">
                      {location.text}
                    </p>
                    <p className="text-xs text-sm-ink/50 truncate">
                      {formatLocationDisplay(location)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Undo2 className="w-4 h-4" />}
            onClick={handleUndo}
            disabled={!canUndo()}
            title="Undo (⌘Z)"
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<Redo2 className="w-4 h-4" />}
            onClick={handleRedo}
            disabled={!canRedo()}
            title="Redo (⌘⇧Z)"
          />
        </div>

        <Button
          size="md"
          variant="primary"
          icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          onClick={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
