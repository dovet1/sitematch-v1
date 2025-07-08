// =====================================================
// Step 2: Requirement Details - Story 3.1
// Property requirements and specifications form
// =====================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RangeSlider } from '@/components/ui/range-slider';
import { SearchableDropdown, type SearchableOption } from '@/components/ui/searchable-dropdown';
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';

import type { WizardStepProps, RequirementDetailsData } from '@/types/wizard';
import { validateStep, formatSiteSize } from '@/lib/wizard-utils';
import { getSectorOptions, getUseClassOptions } from '@/lib/reference-data';

interface Step2FormData extends RequirementDetailsData {}

// PRD-specified sector options for multi-select
const SECTOR_OPTIONS: SearchableOption[] = [
  { value: 'retail', label: 'Retail', description: 'Retail and consumer-facing businesses' },
  { value: 'food_beverage', label: 'Food & Beverage', description: 'Food & Beverage establishments' },
  { value: 'leisure', label: 'Leisure', description: 'Entertainment and hospitality' },
  { value: 'industrial_logistics', label: 'Industrial & Logistics', description: 'Industrial & Logistics operations' },
  { value: 'office', label: 'Office', description: 'Office and professional services' },
  { value: 'healthcare', label: 'Healthcare', description: 'Healthcare and medical services' },
  { value: 'automotive', label: 'Automotive', description: 'Automotive and transport services' },
  { value: 'roadside', label: 'Roadside', description: 'Roadside and highway services' },
  { value: 'other', label: 'Other', description: 'Other sectors not specified above' }
];

// PRD use class options for dropdown
const USE_CLASS_OPTIONS: SearchableOption[] = [
  { value: 'e-a', label: 'E(a) - Retail', description: 'Display or retail sale of goods' },
  { value: 'e-b', label: 'E(b) - Café/Restaurant', description: 'Sale of food and drink for consumption' },
  { value: 'e-g-i', label: 'E(g)(i) - Office', description: 'Offices to carry out operational/administrative functions' },
  { value: 'e-g-iii', label: 'E(g)(iii) - Light Industrial', description: 'Light industrial processes' },
  { value: 'b2', label: 'B2 - General Industrial', description: 'General industrial processes' },
  { value: 'b8', label: 'B8 - Storage/Distribution', description: 'Storage or distribution of goods' },
  { value: 'c1', label: 'C1 - Hotel', description: 'Hotels and accommodation' },
  { value: 'sui-generis', label: 'Sui Generis - Special Use', description: 'Drive-thru, Petrol, Cinema, Casino, etc.' }
];

export function Step2RequirementDetails({
  data,
  onUpdate,
  onNext,
  onValidationChange,
  errors
}: WizardStepProps) {
  const [siteSize, setSiteSize] = useState<[number, number]>([
    data.siteSizeMin || 0,
    data.siteSizeMax || 10000
  ]);

  // Database options state
  const [sectorOptions, setSectorOptions] = useState<SearchableOption[]>([]);
  const [useClassOptions, setUseClassOptions] = useState<SearchableOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // Handle both single values (from database) and arrays (from form)
  const [selectedSectors, setSelectedSectors] = useState<string[]>(() => {
    return data.sectors || [];
  });
  
  const [selectedUseClasses, setSelectedUseClasses] = useState<string[]>(() => {
    return data.useClassIds || [];
  });

  const {
    handleSubmit,
    formState: { errors: formErrors }
  } = useForm<Step2FormData>({
    defaultValues: {
      sectors: data.sectors || [],
      useClassIds: data.useClassIds || [],
      siteSizeMin: data.siteSizeMin,
      siteSizeMax: data.siteSizeMax
    },
    mode: 'onChange'
  });

  // Current form values
  const currentFormData = {
    sectors: selectedSectors,
    useClassIds: selectedUseClasses,
    siteSizeMin: siteSize[0] || undefined,
    siteSizeMax: siteSize[1] || undefined
  };

  // =====================================================
  // REFS AND DEBOUNCING
  // =====================================================

  const prevValuesRef = useRef<string>('');
  const prevValidRef = useRef<boolean>(false);

  // =====================================================
  // EFFECTS
  // =====================================================

  // Load database options on mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [sectors, useClasses] = await Promise.all([
          getSectorOptions(),
          getUseClassOptions()
        ]);
        
        setSectorOptions(sectors);
        setUseClassOptions(useClasses);
      } catch (error) {
        console.error('Failed to load reference data options:', error);
        // Use hardcoded fallbacks
        setSectorOptions(SECTOR_OPTIONS);
        setUseClassOptions(USE_CLASS_OPTIONS);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    loadOptions();
  }, []);

  // Update selected values when data changes (for edit mode) - only once
  const hasInitializedStep2Ref = useRef(false);
  
  useEffect(() => {
    const hasValidData = data.sectors && data.sectors.length > 0;
    
    if (hasValidData && !hasInitializedStep2Ref.current) {
      hasInitializedStep2Ref.current = true;
      
      console.log('Initializing Step2 with loaded data:', {
        sectors: data.sectors,
        useClassIds: data.useClassIds,
        siteSizeMin: data.siteSizeMin,
        siteSizeMax: data.siteSizeMax
      });
      
      if (data.sectors && data.sectors.length > 0) {
        setSelectedSectors(data.sectors);
      }
      if (data.useClassIds && data.useClassIds.length > 0) {
        setSelectedUseClasses(data.useClassIds);
      }
      if (data.siteSizeMin !== undefined || data.siteSizeMax !== undefined) {
        setSiteSize([data.siteSizeMin || 0, data.siteSizeMax || 10000]);
      }
    }
  }, [data.sectors, data.useClassIds, data.siteSizeMin, data.siteSizeMax]);

  // Debounced update to parent component when form data changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentJson = JSON.stringify(currentFormData);
      
      if (prevValuesRef.current !== currentJson) {
        prevValuesRef.current = currentJson;
        onUpdate(currentFormData);
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [currentFormData, onUpdate]);

  // Debounced validation state update
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const stepErrors = validateStep(2, currentFormData);
      const isValid = Object.keys(stepErrors).length === 0;
      
      if (prevValidRef.current !== isValid) {
        prevValidRef.current = isValid;
        onValidationChange(isValid);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [currentFormData, onValidationChange]);

  // Set initial values when data prop changes (only on mount or when data reference changes)
  const prevDataRef = useRef(data);
  useEffect(() => {
    // Only update if data reference actually changed
    if (prevDataRef.current !== data) {
      prevDataRef.current = data;
      
      if (data.sectors !== undefined) setSelectedSectors(data.sectors);
      if (data.useClassIds !== undefined) setSelectedUseClasses(data.useClassIds);
      
      if (data.siteSizeMin !== undefined || data.siteSizeMax !== undefined) {
        setSiteSize([
          data.siteSizeMin || 0,
          data.siteSizeMax || 10000
        ]);
      }
    }
  }, [data]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleSiteSizeChange = (newValue: [number, number]) => {
    setSiteSize(newValue);
  };

  const onSubmit = (formData: Step2FormData) => {
    // Form is submitted via the wizard's submit button
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Property Requirements Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Property Requirements</CardTitle>
          <p className="text-sm text-gray-600">
            Specify your property requirements and preferences. All fields are optional.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sector Multi-Select */}
          <MultiSelectDropdown
            label="Sectors (Optional)"
            placeholder={isLoadingOptions ? "Loading sectors..." : "Select relevant sectors..."}
            searchPlaceholder="Search sectors..."
            emptyText="No sectors found"
            options={sectorOptions.length > 0 ? sectorOptions : SECTOR_OPTIONS}
            value={selectedSectors}
            onChange={setSelectedSectors}
            maxDisplay={3}
            disabled={isLoadingOptions}
          />

          {/* Use Class Multi-Select */}
          <MultiSelectDropdown
            label="Planning Use Class (Optional)"
            placeholder={isLoadingOptions ? "Loading use classes..." : "Select planning use classes..."}
            searchPlaceholder="Search use classes..."
            emptyText="No use classes found"
            options={useClassOptions.length > 0 ? useClassOptions : USE_CLASS_OPTIONS}
            value={selectedUseClasses}
            onChange={setSelectedUseClasses}
            maxDisplay={2}
            disabled={isLoadingOptions}
          />

          {/* Site Size Range Slider */}
          <RangeSlider
            label="Site Size Range (Optional)"
            value={siteSize}
            onChange={handleSiteSizeChange}
            min={0}
            max={50000}
            step={100}
            unit="sq ft"
            showInputs={true}
            formatValue={(value) => value.toLocaleString()}
          />
        </CardContent>
      </Card>

      {/* Hidden submit button for form validation */}
      <Button type="submit" className="hidden">
        Submit
      </Button>
    </form>
  );
}