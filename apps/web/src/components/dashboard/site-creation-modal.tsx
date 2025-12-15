'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { searchLocations, formatLocationDisplay } from '@/lib/mapbox';
import type { LocationResult } from '@/lib/mapbox';
import { Loader2, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';

interface Site {
  id: string;
  name: string;
  address: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

interface SiteCreationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingSite?: Site | null;
}

export function SiteCreationModal({
  open,
  onClose,
  onSuccess,
  editingSite,
}: SiteCreationModalProps) {
  const [loading, setLoading] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [description, setDescription] = useState('');

  // Load editing data
  useEffect(() => {
    if (editingSite) {
      setName(editingSite.name);
      setDescription(editingSite.description || '');
      setLocationQuery(editingSite.address);
      // For editing, we don't have the lat/lng, but we can set the address
      setSelectedLocation({
        id: 'existing',
        place_name: editingSite.address,
        center: [0, 0], // Will be replaced if user searches
        place_type: [],
        text: editingSite.address,
      });
    } else {
      // Reset form
      setName('');
      setDescription('');
      setLocationQuery('');
      setSelectedLocation(null);
    }
  }, [editingSite, open]);

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
        console.error('Error searching locations:', error);
      } finally {
        setLocationLoading(false);
      }
    }, 300);

    return () => clearTimeout(searchDebounced);
  }, [locationQuery]);

  const handleLocationSelect = (location: LocationResult) => {
    setSelectedLocation(location);
    setLocationQuery(formatLocationDisplay(location));
    setShowLocationDropdown(false);
  };

  const handleClearLocation = () => {
    setSelectedLocation(null);
    setLocationQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name.trim()) {
      toast.error('Site name is required');
      return;
    }

    if (!selectedLocation || !locationQuery.trim()) {
      toast.error('Location is required');
      return;
    }

    // For editing, if location hasn't changed, we need to get new coordinates
    if (editingSite && selectedLocation.id === 'existing' && selectedLocation.center[0] === 0) {
      toast.error('Please select a location from the dropdown or re-enter the address');
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        name: name.trim(),
        address: locationQuery.trim(),
        lng: selectedLocation.center[0],
        lat: selectedLocation.center[1],
        description: description.trim() || null,
      };

      const url = editingSite ? `/api/sites/${editingSite.id}` : '/api/sites';
      const method = editingSite ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save site');
      }

      toast.success(editingSite ? 'Site updated successfully' : 'Site created successfully');
      onSuccess();
    } catch (error) {
      console.error('Error saving site:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save site');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">
            {editingSite ? 'Edit Site' : 'Create New Site'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Site Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-bold text-gray-700">
              Site Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., High Street Opportunity"
              maxLength={100}
              className="border-2 border-gray-200 focus:border-violet-500 rounded-xl"
              required
            />
            <p className="text-xs text-gray-500">
              {name.length}/100 characters
            </p>
          </div>

          {/* Address/Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-bold text-gray-700">
              Address *
            </Label>
            <div className="relative">
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="location"
                  value={locationQuery}
                  onChange={(e) => {
                    setLocationQuery(e.target.value);
                    // Clear selected location when user types
                    if (selectedLocation?.id === 'existing') {
                      setSelectedLocation(null);
                    }
                  }}
                  onFocus={() => {
                    if (locationResults.length > 0) {
                      setShowLocationDropdown(true);
                    }
                  }}
                  placeholder="Search for address or postcode..."
                  className="pl-9 pr-9 border-2 border-gray-200 focus:border-violet-500 rounded-xl"
                  required
                />
                {selectedLocation && (
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {locationLoading && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-violet-600" />
                )}
              </div>

              {/* Location Dropdown */}
              {showLocationDropdown && locationResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border-2 border-violet-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {locationResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleLocationSelect(result)}
                      className="w-full text-left px-4 py-3 hover:bg-violet-50 border-b border-gray-100 last:border-0 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {formatLocationDisplay(result)}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {result.place_name}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedLocation && selectedLocation.id !== 'existing' && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Location selected
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-bold text-gray-700">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes about this site..."
              maxLength={500}
              rows={4}
              className="border-2 border-gray-200 focus:border-violet-500 rounded-xl resize-none"
            />
            <p className="text-xs text-gray-500">
              {description.length}/500 characters
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full sm:flex-1 border-2 border-gray-200 hover:bg-gray-50 font-bold rounded-xl"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingSite ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                editingSite ? 'Update Site' : 'Create Site'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
