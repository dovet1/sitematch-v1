'use client'

import React, { useState } from 'react';
import { BaseCrudModal } from './base-crud-modal';
import { LocationSearch } from '@/components/listings/location-search';
import { Badge } from '@/components/ui/badge';
import { MapPin, X } from 'lucide-react';

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
    locations?: Location[];
  };
  onSave: (locations: Location[]) => void;
}

export function LocationsModal({ 
  isOpen, 
  onClose, 
  currentData,
  onSave 
}: LocationsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(locations);
      onClose();
    } catch (error) {
      console.error('Error saving locations:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseCrudModal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Preferred Locations"
      onSave={handleSave}
      isSaving={isSaving}
      className="max-w-2xl"
    >
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Add or Remove Locations</h3>
          <p className="text-sm text-gray-600">
            Search and select your preferred locations. Leave empty to accept opportunities nationwide.
          </p>
        </div>

        {/* Location Search */}
        <LocationSearch
          onLocationSelect={handleLocationAdd}
          placeholder="Search for cities, towns, or areas..."
          className="w-full"
        />

        {/* Selected Locations */}
        {locations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-900">
              Selected Locations ({locations.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {locations.map((location) => (
                <Badge 
                  key={location.id} 
                  variant="secondary"
                  className="flex items-center gap-2 px-3 py-1.5"
                >
                  <MapPin className="w-3 h-3" />
                  <span>{location.name}</span>
                  <button
                    onClick={() => handleLocationRemove(location.id)}
                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5 transition-colors"
                    aria-label={`Remove ${location.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {locations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No specific locations selected</p>
            <p className="text-xs mt-1">Your listing will show nationwide coverage</p>
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-gray-500">
          💡 <strong>Tip:</strong> You can select multiple locations. If no locations are selected, 
          your listing will show as accepting opportunities nationwide.
        </div>
      </div>
    </BaseCrudModal>
  );
}