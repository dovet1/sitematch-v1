// =====================================================
// Step 2: Requirement Details - Story 3.1
// Property requirements and specifications form
// =====================================================

'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import type { WizardStepProps, RequirementDetailsData } from '@/types/wizard';
import { validateStep, formatSiteSize } from '@/lib/wizard-utils';

interface Step2FormData extends RequirementDetailsData {}

const SECTOR_OPTIONS = [
  { value: 'retail', label: 'Retail', description: 'Shops, stores, and retail spaces' },
  { value: 'office', label: 'Office', description: 'Office and professional services' },
  { value: 'industrial', label: 'Industrial', description: 'Industrial and logistics operations' },
  { value: 'leisure', label: 'Leisure', description: 'Entertainment and hospitality' },
  { value: 'mixed', label: 'Mixed Use', description: 'Mixed-use or multiple sectors' }
] as const;

export function Step2RequirementDetails({
  data,
  onUpdate,
  onNext,
  onValidationChange,
  errors
}: WizardStepProps) {
  const [siteSize, setSiteSize] = useState({
    min: data.siteSizeMin || '',
    max: data.siteSizeMax || ''
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors: formErrors }
  } = useForm<Step2FormData>({
    defaultValues: {
      title: data.title || '',
      description: data.description || '',
      sector: data.sector || undefined,
      useClass: data.useClass || '',
      siteSizeMin: data.siteSizeMin,
      siteSizeMax: data.siteSizeMax
    },
    mode: 'onChange'
  });

  const watchedValues = watch();

  // =====================================================
  // EFFECTS
  // =====================================================

  // Update parent component when form data changes
  useEffect(() => {
    const updatedData = {
      ...watchedValues,
      siteSizeMin: siteSize.min ? Number(siteSize.min) : undefined,
      siteSizeMax: siteSize.max ? Number(siteSize.max) : undefined
    };
    onUpdate(updatedData);
  }, [watchedValues, siteSize, onUpdate]);

  // Update validation state
  useEffect(() => {
    const formDataWithSizes = {
      ...watchedValues,
      siteSizeMin: siteSize.min ? Number(siteSize.min) : undefined,
      siteSizeMax: siteSize.max ? Number(siteSize.max) : undefined
    };
    const stepErrors = validateStep(2, formDataWithSizes);
    const isValid = Object.keys(stepErrors).length === 0;
    onValidationChange(isValid);
  }, [watchedValues, siteSize, onValidationChange]);

  // Set initial values when data prop changes
  useEffect(() => {
    if (data.title !== undefined) setValue('title', data.title);
    if (data.description !== undefined) setValue('description', data.description);
    if (data.sector !== undefined) setValue('sector', data.sector);
    if (data.useClass !== undefined) setValue('useClass', data.useClass);
    
    if (data.siteSizeMin !== undefined || data.siteSizeMax !== undefined) {
      setSiteSize({
        min: data.siteSizeMin?.toString() || '',
        max: data.siteSizeMax?.toString() || ''
      });
    }
  }, [data, setValue]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleSiteSizeChange = (field: 'min' | 'max', value: string) => {
    // Only allow numeric input
    if (value === '' || /^\d+$/.test(value)) {
      setSiteSize(prev => ({ ...prev, [field]: value }));
    }
  };

  const onSubmit = (formData: Step2FormData) => {
    // Form is submitted via the wizard's submit button
  };

  // =====================================================
  // VALIDATION HELPERS
  // =====================================================

  const getSiteSizeError = () => {
    const min = siteSize.min ? Number(siteSize.min) : undefined;
    const max = siteSize.max ? Number(siteSize.max) : undefined;
    
    if (min && max && min > max) {
      return 'Minimum size cannot be greater than maximum size';
    }
    return null;
  };

  const siteSizeError = getSiteSizeError();

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Listing Details Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Listing Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Listing Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Listing Title *
            </Label>
            <Input
              id="title"
              {...register('title', {
                required: 'Listing title is required',
                minLength: {
                  value: 5,
                  message: 'Title must be at least 5 characters'
                },
                maxLength: {
                  value: 200,
                  message: 'Title must be no more than 200 characters'
                }
              })}
              placeholder="e.g., High Street Retail Space Required - London"
              className={
                formErrors.title || errors?.title
                  ? 'border-red-500 focus:ring-red-500'
                  : ''
              }
            />
            {(formErrors.title || errors?.title) && (
              <p className="text-sm text-red-600">
                {formErrors.title?.message || errors?.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
            </Label>
            <textarea
              id="description"
              {...register('description', {
                maxLength: {
                  value: 2000,
                  message: 'Description must be no more than 2000 characters'
                }
              })}
              placeholder="Describe your property requirements in detail..."
              rows={4}
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {(formErrors.description || errors?.description) && (
              <p className="text-sm text-red-600">
                {formErrors.description?.message || errors?.description}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Property Specifications Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Property Specifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sector Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Sector *
            </Label>
            <RadioGroup
              value={watchedValues.sector || ''}
              onValueChange={(value) => setValue('sector', value as any)}
              className="space-y-3"
            >
              {SECTOR_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                  <div className="grid gap-1">
                    <Label
                      htmlFor={option.value}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {option.label}
                    </Label>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
            {(formErrors.sector || errors?.sector) && (
              <p className="text-sm text-red-600">
                {formErrors.sector?.message || errors?.sector || 'Please select a sector'}
              </p>
            )}
          </div>

          {/* Use Class */}
          <div className="space-y-2">
            <Label htmlFor="useClass" className="text-sm font-medium">
              Planning Use Class *
            </Label>
            <Input
              id="useClass"
              {...register('useClass', {
                required: 'Use class is required',
                minLength: {
                  value: 2,
                  message: 'Use class must be at least 2 characters'
                },
                maxLength: {
                  value: 50,
                  message: 'Use class must be no more than 50 characters'
                }
              })}
              placeholder="e.g., E(a), E(b), B8, Sui Generis"
              className={
                formErrors.useClass || errors?.useClass
                  ? 'border-red-500 focus:ring-red-500'
                  : ''
              }
            />
            <p className="text-xs text-gray-500">
              Common classes: E(a) Retail, E(b) Café/Restaurant, E(g)(i) Office, B8 Storage, etc.
            </p>
            {(formErrors.useClass || errors?.useClass) && (
              <p className="text-sm text-red-600">
                {formErrors.useClass?.message || errors?.useClass}
              </p>
            )}
          </div>

          {/* Site Size Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Site Size Range (sq ft)
              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
            </Label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="siteSizeMin" className="text-xs text-gray-600">
                  Minimum Size
                </Label>
                <Input
                  id="siteSizeMin"
                  type="text"
                  value={siteSize.min}
                  onChange={(e) => handleSiteSizeChange('min', e.target.value)}
                  placeholder="1000"
                  className={siteSizeError ? 'border-red-500 focus:ring-red-500' : ''}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="siteSizeMax" className="text-xs text-gray-600">
                  Maximum Size
                </Label>
                <Input
                  id="siteSizeMax"
                  type="text"
                  value={siteSize.max}
                  onChange={(e) => handleSiteSizeChange('max', e.target.value)}
                  placeholder="5000"
                  className={siteSizeError ? 'border-red-500 focus:ring-red-500' : ''}
                />
              </div>
            </div>

            {siteSizeError && (
              <p className="text-sm text-red-600">{siteSizeError}</p>
            )}

            {(siteSize.min || siteSize.max) && !siteSizeError && (
              <p className="text-xs text-gray-500">
                Range: {formatSiteSize(
                  siteSize.min ? Number(siteSize.min) : undefined,
                  siteSize.max ? Number(siteSize.max) : undefined
                )}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hidden submit button for form validation */}
      <Button type="submit" className="hidden">
        Submit
      </Button>
    </form>
  );
}