// =====================================================
// Step 3: Location Selection - Story 3.2 Task 4
// Location search component for wizard
// =====================================================

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, AlertCircle } from 'lucide-react';

import { LocationSearch } from '@/components/listings/location-search';

import type { WizardStepProps, LocationData } from '@/types/wizard';
import type { LocationSelection } from '@/types/locations';
import { validateStep } from '@/lib/wizard-utils';
import { cn } from '@/lib/utils';

interface Step3FormData extends LocationData {}

interface Step3Props extends WizardStepProps {}

export function Step3LocationFiles({
  data,
  onUpdate,
  onNext,
  onPrevious,
  onValidationChange,
  errors
}: Step3Props) {
  const {
    handleSubmit,
    formState: { errors: formErrors }
  } = useForm<Step3FormData>({
    defaultValues: {
      locations: data.locations || [],
      locationSearchNationwide: data.locationSearchNationwide || false
    },
    mode: 'onChange'
  });

  // =====================================================
  // REFS AND STATE
  // =====================================================

  const prevValidRef = useRef<boolean>(false);

  // =====================================================
  // LOCATION HANDLERS - Direct update without local state
  // =====================================================

  // Use refs to track the latest values and prevent loops
  const latestDataRef = useRef(data);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  latestDataRef.current = data;

  const debouncedUpdate = useCallback((newData: Partial<LocationData>) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      const updatedData = {
        ...latestDataRef.current,
        ...newData
      };
      
      // Only update if the data actually changed
      const currentLocationsJson = JSON.stringify(latestDataRef.current.locations || []);
      const newLocationsJson = JSON.stringify(updatedData.locations || []);
      const nationwideChanged = latestDataRef.current.locationSearchNationwide !== updatedData.locationSearchNationwide;
      
      if (currentLocationsJson !== newLocationsJson || nationwideChanged) {
        onUpdate(updatedData);
      }
    }, 100);
  }, [onUpdate]);

  const handleLocationChange = useCallback((locations: LocationSelection[]) => {
    debouncedUpdate({ locations });
  }, [debouncedUpdate]);

  const handleNationwideChange = useCallback((nationwide: boolean) => {
    debouncedUpdate({
      locationSearchNationwide: nationwide,
      // Clear locations when going nationwide
      locations: nationwide ? [] : latestDataRef.current.locations || []
    });
  }, [debouncedUpdate]);

  // =====================================================
  // VALIDATION - Simple validation without complex effects
  // =====================================================

  useEffect(() => {
    const stepErrors = validateStep(3, data);
    const isValid = Object.keys(stepErrors).length === 0;
    
    if (prevValidRef.current !== isValid) {
      prevValidRef.current = isValid;
      onValidationChange(isValid);
    }
  }, [data, onValidationChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // =====================================================
  // FORM SUBMISSION
  // =====================================================

  const onSubmit = (formData: Step3FormData) => {
    onNext();
  };

  // =====================================================
  // VALIDATION HELPERS
  // =====================================================

  const hasLocationError = errors?.locations;
  const hasRequiredLocations = (data.locations && data.locations.length > 0) || data.locationSearchNationwide;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Location Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Target Locations
          </CardTitle>
          <p className="text-sm text-gray-600">
            Specify where you're looking for properties. You can add specific locations or search nationwide.
          </p>
        </CardHeader>
        <CardContent>
          <LocationSearch
            value={data.locations || []}
            onChange={handleLocationChange}
            error={hasLocationError}
          />
          
          {/* Location Error */}
          {hasLocationError && (
            <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
              <AlertCircle className="w-4 h-4" />
              <span>{hasLocationError}</span>
            </div>
          )}
          
          {/* Location Summary */}
          {hasRequiredLocations && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                {data.locationSearchNationwide 
                  ? 'Searching nationwide'
                  : `${(data.locations || []).length} location${(data.locations || []).length !== 1 ? 's' : ''} selected`
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden submit button for form validation */}
      <Button type="submit" className="hidden">
        Next
      </Button>
    </form>
  );
}