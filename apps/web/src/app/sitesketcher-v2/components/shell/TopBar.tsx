'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Button } from '../primitives';
import {
  Save,
  FilePlus,
  Undo2,
  Redo2,
  Search,
  ChevronRight,
  Loader2,
  MapPin,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { createDebouncedLocationSearch, formatLocationDisplay } from '@/lib/mapbox';
import type { LocationResult } from '@/lib/mapbox';
import { SaveModal } from '../modals/SaveModal';
import { NewSketchConfirmModal } from '../modals/NewSketchConfirmModal';
import { toast } from 'sonner';

export function TopBar() {
  const {
    sketchId,
    sketchName,
    sketchDescription,
    isDirty,
    lastSaved,
    canUndo,
    canRedo,
    undo,
    redo,
    getSketchData,
    setSketchName,
    setSketchDescription,
    setSketchId,
    setLastSaved,
    markClean,
    reset,
    setViewport,
    polygons,
    parkingBlocks,
    cadImages,
  } = useSketchStore();

  const [saving, setSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showNewSketchModal, setShowNewSketchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useRef(createDebouncedLocationSearch(300));
  const objectCount = {
    polygons: polygons.length,
    parkingBlocks: parkingBlocks.length,
    cadImages: cadImages.length,
  };
  const totalObjects = objectCount.polygons + objectCount.parkingBlocks + objectCount.cadImages;
  const hasCurrentWork = Boolean(sketchId) || isDirty || totalObjects > 0;
  const newSketchMode = !sketchId
    ? 'unsaved'
    : isDirty
      ? 'saved-dirty'
      : 'saved-clean';

  const performSave = async (name: string, description: string): Promise<boolean> => {
    setSaving(true);

    try {
      const data = getSketchData();

      if (sketchId) {
        // Update existing - always send description (empty string becomes null in API)
        const response = await fetch(`/api/sitesketcher-v2/sketches/${sketchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            data,
          }),
        });

        if (response.status === 403) {
          const error = await response.json();
          alert(error.error || 'Pro subscription required to save');
          return false;
        }

        if (!response.ok) {
          throw new Error('Failed to save sketch');
        }

        const result = await response.json();
        setSketchName(result.sketch.name);
        setSketchDescription(result.sketch.description || '');
        setLastSaved(new Date(result.sketch.updated_at));
        markClean();
        return true;
      } else {
        // Create new
        const response = await fetch('/api/sitesketcher-v2/sketches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            data,
          }),
        });

        if (response.status === 403) {
          const error = await response.json();
          alert(error.error || 'Pro subscription required to save');
          return false;
        }

        if (!response.ok) {
          throw new Error('Failed to create sketch');
        }

        const result = await response.json();
        setSketchId(result.sketch.id);
        setSketchName(result.sketch.name);
        setSketchDescription(result.sketch.description || '');
        setLastSaved(new Date(result.sketch.updated_at));
        markClean();
        return true;
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save sketch. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleModalSave = async (data: { name: string; description?: string }) => {
    const desc = data.description ?? '';
    const success = await performSave(data.name, desc);
    if (success) {
      setShowSaveModal(false);
    }
  };

  const handleSave = async () => {
    if (!sketchId) {
      // New sketch - open modal for name/description
      setShowSaveModal(true);
      return;
    }

    // Existing sketch - save data directly (metadata via Edit Details button)
    await performSave(sketchName, sketchDescription);
  };

  const startNewSketch = () => {
    const hadSavedSketch = Boolean(sketchId);

    reset();
    setShowNewSketchModal(false);
    toast.success(
      hadSavedSketch
        ? 'Started a new sketch. Your previous sketch is still saved.'
        : 'Started a new sketch.'
    );
  };

  const handleNewSketch = () => {
    if (!hasCurrentWork) return;
    setShowNewSketchModal(true);
  };

  const handleSaveAndStartNew = async () => {
    const success = await performSave(sketchName, sketchDescription);
    if (success) {
      startNewSketch();
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
        types: ['place', 'locality', 'neighborhood', 'address', 'postcode', 'poi', 'region']
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
    // Only auto-save if sketch already exists (has ID) and modal is not open
    if (!sketchId || !isDirty || saving || showSaveModal || showNewSketchModal) return;

    const timer = setTimeout(async () => {
      try {
        const data = getSketchData();

        const response = await fetch(`/api/sitesketcher-v2/sketches/${sketchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sketchName,
            description: sketchDescription,
            data
          }),
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
  }, [isDirty, sketchId, sketchName, sketchDescription, saving, showSaveModal, showNewSketchModal, getSketchData, setLastSaved, markClean]);

  return (
    <div className="h-14 bg-sm-surface border-b border-sm-border flex items-center justify-between px-4 flex-shrink-0">
      {/* Left: Logo + Breadcrumb */}
      <div className="flex items-center gap-3">
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

        <span className="font-semibold text-sm text-sm-ink">SiteSketcher</span>

        <ChevronRight className="w-4 h-4 text-sm-ink/30" />

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-sm-ink">
            {sketchName}
          </span>
          {sketchId && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="p-1 text-sm-ink/50 hover:text-sm-violet hover:bg-sm-bg rounded transition-colors"
              aria-label="Edit sketch details"
              title="Edit sketch details"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
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
            placeholder="Search location or postcode..."
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
          variant="secondary"
          icon={<FilePlus className="w-4 h-4" />}
          onClick={handleNewSketch}
          disabled={!hasCurrentWork || saving}
        >
          New sketch
        </Button>

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

      {showSaveModal && (
        <SaveModal
          currentName={sketchName}
          currentDescription={sketchDescription}
          objectCount={objectCount}
          onSave={handleModalSave}
          onCancel={() => setShowSaveModal(false)}
          isLoading={saving}
        />
      )}

      {showNewSketchModal && (
        <NewSketchConfirmModal
          mode={newSketchMode}
          sketchName={sketchName}
          objectCount={objectCount}
          onCancel={() => setShowNewSketchModal(false)}
          onStartNew={startNewSketch}
          onSaveAndStart={handleSaveAndStartNew}
          isLoading={saving}
        />
      )}
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
