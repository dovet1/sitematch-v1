'use client';

import { useState, useMemo } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { LocationSearch } from '@/components/listings/location-search';
import type { BrochureFormData } from '@/types/brochure';
import type { LocationSelection } from '@/types/locations';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Generate a Mapbox Static Images API URL with pins for all locations
 */
function generateStaticMapUrl(locations: LocationSelection[]): string {
  if (!locations.length || !MAPBOX_TOKEN) {
    return '';
  }

  // Create marker pins for each location
  const markers = locations
    .map((loc) => {
      const [lng, lat] = loc.coordinates;
      return `pin-s+7c3aed(${lng},${lat})`;
    })
    .join(',');

  // Calculate bounds to fit all markers
  const lngs = locations.map((loc) => loc.coordinates[0]);
  const lats = locations.map((loc) => loc.coordinates[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Use auto bounds if multiple locations, or center on single location
  let viewport: string;
  if (locations.length === 1) {
    const [lng, lat] = locations[0].coordinates;
    viewport = `${lng},${lat},8`; // zoom level 8 for single location
  } else {
    // Add padding to bounds
    const lngPadding = (maxLng - minLng) * 0.2 || 0.5;
    const latPadding = (maxLat - minLat) * 0.2 || 0.5;
    viewport = `[${minLng - lngPadding},${minLat - latPadding},${maxLng + lngPadding},${maxLat + latPadding}]`;
  }

  // Static Images API URL
  // Format: https://api.mapbox.com/styles/v1/{username}/{style_id}/static/{overlay}/{lon},{lat},{zoom},{bearing},{pitch}|{bbox}|{auto}/{width}x{height}
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${markers}/auto/800x450?access_token=${MAPBOX_TOKEN}&padding=50`;
}

interface LocationsMediaStepProps {
  formData: BrochureFormData;
  onFormDataChange: (data: Partial<BrochureFormData>) => void;
}

export function LocationsMediaStep({ formData, onFormDataChange }: LocationsMediaStepProps) {
  const [imageError, setImageError] = useState<string | null>(null);

  const handleLocationsChange = (locations: LocationSelection[]) => {
    onFormDataChange({ targetLocations: locations });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setImageError(null);

    Array.from(files).forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setImageError('Please select image files only');
        return;
      }

      // Validate file size (max 5MB per image)
      if (file.size > 5 * 1024 * 1024) {
        setImageError('Images must be less than 5MB each');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const currentImages = formData.storeImages || [];
        if (currentImages.length < 6) {
          onFormDataChange({ storeImages: [...currentImages, result] });
        } else {
          setImageError('Maximum 6 images allowed');
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    const images = [...(formData.storeImages || [])];
    images.splice(index, 1);
    onFormDataChange({ storeImages: images });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Locations & Media</h2>
        <p className="text-sm text-gray-500 mt-1">
          Add target locations and store/property images
        </p>
      </div>

      {/* Target Locations */}
      <div className="space-y-3">
        <Label>Target Locations</Label>
        <p className="text-xs text-gray-500">
          Search and add towns, cities, or regions the occupier is interested in
        </p>

        <LocationSearch
          value={formData.targetLocations || []}
          onChange={handleLocationsChange}
          maxLocations={20}
          placeholder="Search for UK/Ireland locations..."
        />
      </div>

      {/* Store Images */}
      <div className="space-y-3">
        <Label>Store / Property Images</Label>
        <p className="text-xs text-gray-500">
          Upload up to 6 images of existing stores or ideal property types (max 5MB each)
        </p>

        {/* Image Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Existing Images */}
          {formData.storeImages?.map((image, index) => (
            <div
              key={index}
              className="relative aspect-video rounded-lg overflow-hidden border border-gray-200 group"
            >
              <img
                src={image}
                alt={`Store image ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Upload Button */}
          {(!formData.storeImages || formData.storeImages.length < 6) && (
            <label
              className={cn(
                'aspect-video rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-violet-300 hover:bg-violet-50/50 transition-colors',
                formData.storeImages?.length === 0 && 'col-span-2 md:col-span-3'
              )}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <Upload className="h-6 w-6 text-gray-400" />
              <span className="text-sm text-gray-500">Upload images</span>
            </label>
          )}
        </div>

        {imageError && (
          <p className="text-sm text-red-600">{imageError}</p>
        )}
      </div>

      {/* Location Map Preview */}
      <div className="space-y-3">
        <Label>Location Map</Label>
        {formData.targetLocations && formData.targetLocations.length > 0 ? (
          <div className="aspect-video rounded-lg border border-gray-200 overflow-hidden">
            <img
              src={generateStaticMapUrl(formData.targetLocations)}
              alt="Map showing target locations"
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-video rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <ImageIcon className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Add locations to see map preview</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
