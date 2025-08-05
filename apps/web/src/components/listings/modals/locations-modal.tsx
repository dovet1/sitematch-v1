'use client'

import React, { useState } from 'react';
import { BaseCrudModal } from './base-crud-modal';
import { LocationSearch } from '@/components/listings/location-search';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { MapPin, X, Globe } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  coordinates?: [number, number];
  type?: string;
}

interface LocationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData?: {
    isNationwide?: boolean;
    locations?: Location[];
  };
  onSave: (data: { isNationwide: boolean; locations: Location[] }) => void;
}

export function LocationsModal({ 
  isOpen, 
  onClose, 
  currentData,
  onSave 
}: LocationsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isNationwide, setIsNationwide] = useState(currentData?.isNationwide || false);
  const [locations, setLocations] = useState<Location[]>(currentData?.locations || []);

  const handleLocationAdd = (location: Location) => {
    // Avoid duplicates
    if (!locations.find(loc => loc.id === location.id)) {
      setLocations(prev => [...prev, location]);
    }
  };

  const handleLocationRemove = (locationId: string) => {
    setLocations(prev => prev.filter(loc => loc.id !== locationId));
  };

  const handleNationwideToggle = (checked: boolean) => {
    setIsNationwide(checked);
    // Clear specific locations when switching to nationwide
    if (checked) {
      setLocations([]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        isNationwide,
        locations: isNationwide ? [] : locations
      });
      onClose();
    } catch (error) {
      console.error('Error saving locations:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getLocationDisplayText = () => {
    if (isNationwide) {
      return 'Open to opportunities across the UK & Ireland';
    }
    if (locations.length === 0) {
      return 'No specific locations selected';
    }
    if (locations.length === 1) {
      return `1 specific location: ${locations[0].name}`;
    }
    return `${locations.length} specific locations selected`;
  };

  return (
    <BaseCrudModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Preferred Locations"
      onSave={handleSave}
      isSaving={isSaving}
      className="max-w-3xl"
    >
      <div className="p-6 space-y-8">
        {/* Nationwide Toggle Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Coverage Area</h3>
            <p className="text-sm text-gray-600">Choose between nationwide coverage or specific locations</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">Nationwide Coverage</div>
                <div className="text-sm text-gray-600">Open to opportunities across the UK & Ireland</div>
              </div>
            </div>
            <Switch
              checked={isNationwide}
              onCheckedChange={handleNationwideToggle}
            />
          </div>
        </div>

        {/* Specific Locations Section */}
        {!isNationwide && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Specific Locations</h3>
              <p className="text-sm text-gray-600">Search and select your preferred locations</p>
            </div>

            {/* Location Search */}
            <LocationSearch
              onLocationSelect={handleLocationAdd}
              placeholder="Search for cities, towns, or areas..."
              className="w-full"
            />

            {/* Selected Locations */}
            {locations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Selected Locations</h4>
                <div className="flex flex-wrap gap-2">
                  {locations.map((location) => (
                    <Badge 
                      key={location.id} 
                      variant="secondary"
                      className="flex items-center gap-2 px-3 py-1"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>{location.name}</span>
                      <button
                        onClick={() => handleLocationRemove(location.id)}
                        className="ml-1 hover:bg-gray-300 rounded-full p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Help Text */}
            <div className="text-xs text-gray-500">
              You can select multiple locations. Agents will see all your preferred areas.
            </div>
          </div>
        )}

        {/* Preview Section */}
        <div className="border-t pt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Preview</h4>
          <div className="text-xs text-gray-500 mb-3">This is how your location preferences will appear to agents:</div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            {isNationwide ? (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Nationwide Coverage</span>
                <span className="text-gray-600">- Open to opportunities across the UK & Ireland</span>
              </div>
            ) : locations.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-violet-600" />
                  Preferred Locations ({locations.length})
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  {locations.map((location) => (
                    <div key={location.id} className="flex items-center gap-2">
                      <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                      {location.name}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">
                No locations specified - please add locations or enable nationwide coverage
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="mt-3 text-xs text-gray-600">
            {getLocationDisplayText()}
          </div>
        </div>
      </div>
    </BaseCrudModal>
  );
}