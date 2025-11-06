'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';
import type { SearchableOption } from '@/components/ui/searchable-dropdown';
import { CheckboxMultiSelect } from '@/components/ui/checkbox-multi-select';
import type { CheckboxOption } from '@/components/ui/checkbox-multi-select';
import { searchLocations, formatLocationDisplay } from '@/lib/mapbox';
import type { LocationResult } from '@/lib/mapbox';
import { Loader2, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import type { CreateSavedSearch, SavedSearch } from '@/lib/saved-searches-types';

interface CreateSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingSearch?: SavedSearch | null;
  sectorOptions: SearchableOption[];
  useClassOptions: SearchableOption[];
}

export function CreateSearchModal({
  open,
  onClose,
  onSuccess,
  editingSearch,
  sectorOptions,
  useClassOptions,
}: CreateSearchModalProps) {
  const [loading, setLoading] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [listingType, setListingType] = useState<'any' | 'commercial' | 'residential'>('any');
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [radiusMiles, setRadiusMiles] = useState('10');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedUseClasses, setSelectedUseClasses] = useState<string[]>([]);
  const [minSize, setMinSize] = useState('');
  const [maxSize, setMaxSize] = useState('');

  // Load editing data
  useEffect(() => {
    if (editingSearch) {
      setName(editingSearch.name);
      setListingType(editingSearch.listing_type || 'any');
      setRadiusMiles(editingSearch.location_radius_miles?.toString() || '10');
      setSelectedSectors(editingSearch.sectors || []);
      setSelectedUseClasses(editingSearch.planning_use_classes || []);
      setMinSize(editingSearch.min_size?.toString() || '');
      setMaxSize(editingSearch.max_size?.toString() || '');

      if (editingSearch.location_address) {
        setLocationQuery(editingSearch.location_address);
        setSelectedLocation({
          id: 'existing',
          place_name: editingSearch.location_address,
          center: [editingSearch.location_lng || 0, editingSearch.location_lat || 0],
          place_type: [],
          text: editingSearch.location_address,
        });
      }
    } else {
      // Reset form
      setName('');
      setListingType('any');
      setLocationQuery('');
      setSelectedLocation(null);
      setRadiusMiles('10');
      setSelectedSectors([]);
      setSelectedUseClasses([]);
      setMinSize('');
      setMaxSize('');
    }
  }, [editingSearch, open]);

  // Search locations as user types
  useEffect(() => {
    if (!locationQuery || locationQuery.length < 3) {
      setLocationResults([]);
      return;
    }

    const searchDebounced = setTimeout(async () => {
      setLocationLoading(true);
      try {
        const results = await searchLocations(locationQuery);
        setLocationResults(results);
        setShowLocationDropdown(true);
      } catch (error) {
        console.error('Location search error:', error);
        toast.error('Failed to search locations');
      } finally {
        setLocationLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchDebounced);
  }, [locationQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a search name');
      return;
    }

    const minSizeNum = minSize ? parseFloat(minSize) : undefined;
    const maxSizeNum = maxSize ? parseFloat(maxSize) : undefined;

    if (minSizeNum && maxSizeNum && minSizeNum > maxSizeNum) {
      toast.error('Minimum size must be less than maximum size');
      return;
    }

    setLoading(true);

    try {
      const searchData: CreateSavedSearch = {
        name: name.trim(),
        listing_type: listingType === 'any' ? null : listingType,
        location_address: selectedLocation?.place_name || null,
        location_lat: selectedLocation?.center[1] || null,
        location_lng: selectedLocation?.center[0] || null,
        location_radius_miles: selectedLocation ? parseFloat(radiusMiles) : null,
        sectors: selectedSectors.length > 0 ? selectedSectors : null,
        planning_use_classes: selectedUseClasses.length > 0 ? selectedUseClasses : null,
        min_size: minSizeNum || null,
        max_size: maxSizeNum || null,
      };

      const url = editingSearch
        ? `/api/saved-searches/${editingSearch.id}`
        : '/api/saved-searches';
      const method = editingSearch ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save search');
      }

      toast.success(editingSearch ? 'Search updated successfully' : 'Search saved successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving search:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save search');
    } finally {
      setLoading(false);
    }
  };

  const sizeLabel = listingType === 'residential' ? 'acres' : 'sq ft';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingSearch ? 'Edit' : 'Create'} Saved Search</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Search Name */}
          <div>
            <Label htmlFor="name">Search Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Canterbury Retail Spaces"
              required
            />
          </div>

          {/* Listing Type */}
          <div>
            <Label>Listing Type</Label>
            <RadioGroup value={listingType} onValueChange={(v: any) => setListingType(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="any" id="any" />
                <Label htmlFor="any">Any</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="commercial" id="commercial" />
                <Label htmlFor="commercial">Commercial</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="residential" id="residential" />
                <Label htmlFor="residential">Residential</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Location */}
          <div className="relative">
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="location"
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                  if (!e.target.value) {
                    setSelectedLocation(null);
                  }
                }}
                onFocus={() => setShowLocationDropdown(true)}
                placeholder="Search for a location..."
                className="pl-10 pr-10"
              />
              {locationLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
              )}
              {selectedLocation && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLocation(null);
                    setLocationQuery('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Location Dropdown */}
            {showLocationDropdown && locationResults.length > 0 && !selectedLocation && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {locationResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setSelectedLocation(result);
                      setLocationQuery(formatLocationDisplay(result));
                      setShowLocationDropdown(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-violet-600 mt-1 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">{result.text}</div>
                        <div className="text-xs text-gray-500">{formatLocationDisplay(result)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Radius */}
          {selectedLocation && (
            <div>
              <Label htmlFor="radius">Radius (miles)</Label>
              <Input
                id="radius"
                type="number"
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(e.target.value)}
                min="1"
                max="100"
                step="1"
              />
            </div>
          )}

          {/* Sectors */}
          <div>
            <Label>Sectors</Label>
            <CheckboxMultiSelect
              options={sectorOptions.map(opt => ({ value: opt.value, label: opt.label }))}
              selected={selectedSectors}
              onChange={setSelectedSectors}
              placeholder="Select sectors..."
              searchPlaceholder="Search sectors..."
            />
          </div>

          {/* Planning Use Classes */}
          <div>
            <Label>Planning Use Class</Label>
            <CheckboxMultiSelect
              options={useClassOptions.map(opt => ({ value: opt.value, label: opt.label }))}
              selected={selectedUseClasses}
              onChange={setSelectedUseClasses}
              placeholder="Select use classes..."
              searchPlaceholder="Search use classes..."
            />
          </div>

          {/* Size Range */}
          <div>
            <Label>Size Range ({sizeLabel})</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input
                  type="number"
                  value={minSize}
                  onChange={(e) => setMinSize(e.target.value)}
                  placeholder="Min"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Input
                  type="number"
                  value={maxSize}
                  onChange={(e) => setMaxSize(e.target.value)}
                  placeholder="Max"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSearch ? 'Update' : 'Save'} Search
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
