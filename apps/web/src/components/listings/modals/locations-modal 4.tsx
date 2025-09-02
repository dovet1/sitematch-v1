'use client'

import React, { useState } from 'react';
import { BaseCrudModal } from './base-crud-modal';
import { LocationSearch } from '@/components/listings/location-search';
import { Badge } from '@/components/ui/badge';
import { MapPin, X, Globe, Target, Zap, Map } from 'lucide-react';
import { useMobileBreakpoint } from '@/components/listings/ImmersiveListingModal/hooks/useMobileBreakpoint';
import { cn } from '@/lib/utils';

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
  const { isMobileUI } = useMobileBreakpoint();

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
      title="Add Locations"
      onSave={handleSave}
      isSaving={isSaving}
      saveButtonText="Update Locations"
      className="max-w-2xl"
    >
      <div className={cn(
        "space-y-6",
        isMobileUI ? "p-4" : "p-6"
      )}>
        {/* Visual Header Section */}
        <div className={cn(
          "relative overflow-hidden rounded-xl",
          isMobileUI ? "p-5" : "p-6"
        )} style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        }}>
          {/* Content */}
          <div className="relative">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={cn(
                  "font-semibold text-white mb-1",
                  isMobileUI ? "text-lg" : "text-xl"
                )}>
                  Target Your Reach
                </h3>
                <p className="text-white/90 text-sm leading-relaxed">
                  Select specific target locations which will then be added to our map
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Location Search - with shorter placeholder */}
        <div className="space-y-3">
          <LocationSearch
            onLocationSelect={handleLocationAdd}
            placeholder={isMobileUI ? "Search locations..." : "Search for cities, towns, or areas..."}
            className="w-full"
          />
        </div>

        {/* Selected Locations - Improved for mobile */}
        {locations.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900">
                Selected ({locations.length})
              </h4>
              <button
                onClick={() => setLocations([])}
                className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className={cn(
              "flex flex-wrap gap-2",
              isMobileUI && "gap-3" // More space on mobile for easier tapping
            )}>
              {locations.map((location) => (
                <Badge 
                  key={location.id} 
                  variant="secondary"
                  className={cn(
                    "flex items-center gap-2 transition-all hover:bg-gray-200",
                    isMobileUI 
                      ? "px-4 py-2.5 text-sm" // Larger touch targets
                      : "px-3 py-1.5"
                  )}
                >
                  <MapPin className={cn(isMobileUI ? "w-4 h-4" : "w-3 h-3")} />
                  <span className="font-medium">{location.name}</span>
                  <button
                    onClick={() => handleLocationRemove(location.id)}
                    className={cn(
                      "ml-1 hover:bg-gray-300 rounded-full transition-all active:scale-90",
                      isMobileUI ? "p-1.5" : "p-0.5"
                    )}
                    aria-label={`Remove ${location.name}`}
                  >
                    <X className={cn(isMobileUI ? "w-4 h-4" : "w-3 h-3")} />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Empty State */}
        {locations.length === 0 && (
          <div className={cn(
            "text-center text-gray-500 rounded-xl border-2 border-dashed border-gray-200 transition-all",
            isMobileUI ? "py-12 px-6" : "py-8 px-4"
          )}>
            <div className="mb-3">
              <Globe className={cn(
                "mx-auto text-gray-300",
                isMobileUI ? "w-12 h-12" : "w-8 h-8"
              )} />
            </div>
            <p className={cn(
              "font-medium text-gray-700 mb-1",
              isMobileUI ? "text-base" : "text-sm"
            )}>
              Nationwide Coverage
            </p>
            <p className={cn(
              "text-gray-500",
              isMobileUI ? "text-sm" : "text-xs"
            )}>
              Open to opportunities across the UK & Ireland
            </p>
          </div>
        )}

      </div>
    </BaseCrudModal>
  );
}