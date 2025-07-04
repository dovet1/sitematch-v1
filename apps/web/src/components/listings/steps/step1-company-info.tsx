// =====================================================
// Step 1: Company Information - Story 3.1
// Company details and contact information form
// =====================================================

'use client';

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ui/image-upload';
import { ArrowRight } from 'lucide-react';

import type { WizardStepProps, CompanyInfoData } from '@/types/wizard';
import { validateStep } from '@/lib/wizard-utils';
import { cn } from '@/lib/utils';

interface Step1FormData extends CompanyInfoData {}

export function Step1CompanyInfo({
  data,
  onUpdate,
  onNext,
  onValidationChange,
  errors
}: WizardStepProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors: formErrors }
  } = useForm<Step1FormData>({
    defaultValues: {
      companyName: data.companyName || '',
      contactName: data.contactName || '',
      contactTitle: data.contactTitle || '',
      contactEmail: data.contactEmail || '',
      contactPhone: data.contactPhone || '',
      logoFile: data.logoFile || undefined,
      logoPreview: data.logoPreview || data.logoUrl || ''
    },
    mode: 'onChange'
  });

  // Get current form values without watching to avoid excessive re-renders
  const watchedValues = watch();

  // =====================================================
  // EFFECTS
  // =====================================================

  // Use refs to track previous values and prevent unnecessary updates
  const prevValuesRef = useRef<string>('');
  const prevValidRef = useRef<boolean>(false);

  // Debounced update to parent (reduces excessive parent re-renders)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentJson = JSON.stringify(watchedValues, (key, value) => {
        // Handle File objects properly
        if (value instanceof File) {
          return { name: value.name, size: value.size, type: value.type };
        }
        return value;
      });
      
      if (prevValuesRef.current !== currentJson) {
        prevValuesRef.current = currentJson;
        onUpdate(watchedValues);
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [watchedValues, onUpdate]);

  // Debounced validation (expensive operation)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const stepErrors = validateStep(1, watchedValues);
      const isValid = Object.keys(stepErrors).length === 0;
      
      if (prevValidRef.current !== isValid) {
        prevValidRef.current = isValid;
        onValidationChange(isValid);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [watchedValues, onValidationChange]);

  // Set initial values only once when data prop changes
  const prevDataRef = useRef(data);
  useEffect(() => {
    // Only update if data reference actually changed
    if (prevDataRef.current !== data) {
      prevDataRef.current = data;
      
      if (data.companyName !== undefined) setValue('companyName', data.companyName);
      if (data.contactName !== undefined) setValue('contactName', data.contactName);
      if (data.contactTitle !== undefined) setValue('contactTitle', data.contactTitle);
      if (data.contactEmail !== undefined) setValue('contactEmail', data.contactEmail);
      if (data.contactPhone !== undefined) setValue('contactPhone', data.contactPhone);
      if (data.logoFile !== undefined) setValue('logoFile', data.logoFile);
      if (data.logoPreview !== undefined) setValue('logoPreview', data.logoPreview);
      if (data.logoUrl !== undefined) setValue('logoPreview', data.logoUrl);
    }
  }, [data, setValue]);

  // =====================================================
  // FORM SUBMISSION
  // =====================================================

  const onSubmit = (formData: Step1FormData) => {
    onNext();
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Company Details Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Company Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName" className="text-sm font-medium">
              Company Name *
            </Label>
            <Input
              id="companyName"
              {...register('companyName', {
                required: 'Company name is required',
                minLength: {
                  value: 2,
                  message: 'Company name must be at least 2 characters'
                },
                maxLength: {
                  value: 100,
                  message: 'Company name must be no more than 100 characters'
                }
              })}
              placeholder="Enter your company name"
              className={
                formErrors.companyName || errors?.companyName
                  ? 'border-red-500 focus:ring-red-500'
                  : ''
              }
            />
            {(formErrors.companyName || errors?.companyName) && (
              <p className="text-sm text-red-600">
                {formErrors.companyName?.message || errors?.companyName}
              </p>
            )}
          </div>

        </CardContent>
      </Card>

      {/* Company Logo Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Company Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUpload
            value={watchedValues.logoFile || watchedValues.logoPreview || data.logoUrl}
            onChange={useCallback((file) => {
              setValue('logoFile', file || undefined);
              if (!file) {
                setValue('logoPreview', '');
              }
            }, [setValue])}
            onPreviewChange={useCallback((preview: string | null) => setValue('logoPreview', preview || ''), [setValue])}
            placeholder="Upload your company logo"
            maxSize={2 * 1024 * 1024} // 2MB
            acceptedTypes={["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]}
          />
        </CardContent>
      </Card>

      {/* Contact Information Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contact Name */}
          <div className="space-y-2">
            <Label htmlFor="contactName" className="text-sm font-medium">
              Contact Name *
            </Label>
            <Input
              id="contactName"
              {...register('contactName', {
                required: 'Contact name is required',
                minLength: {
                  value: 2,
                  message: 'Contact name must be at least 2 characters'
                },
                maxLength: {
                  value: 100,
                  message: 'Contact name must be no more than 100 characters'
                }
              })}
              placeholder="Enter the primary contact name"
              className={
                formErrors.contactName || errors?.contactName
                  ? 'border-red-500 focus:ring-red-500'
                  : ''
              }
            />
            {(formErrors.contactName || errors?.contactName) && (
              <p className="text-sm text-red-600">
                {formErrors.contactName?.message || errors?.contactName}
              </p>
            )}
          </div>

          {/* Contact Title */}
          <div className="space-y-2">
            <Label htmlFor="contactTitle" className="text-sm font-medium">
              Contact Title *
            </Label>
            <Input
              id="contactTitle"
              {...register('contactTitle', {
                required: 'Contact title is required',
                minLength: {
                  value: 2,
                  message: 'Contact title must be at least 2 characters'
                },
                maxLength: {
                  value: 100,
                  message: 'Contact title must be no more than 100 characters'
                }
              })}
              placeholder="e.g., Property Manager, Facilities Director"
              className={
                formErrors.contactTitle || errors?.contactTitle
                  ? 'border-red-500 focus:ring-red-500'
                  : ''
              }
            />
            {(formErrors.contactTitle || errors?.contactTitle) && (
              <p className="text-sm text-red-600">
                {formErrors.contactTitle?.message || errors?.contactTitle}
              </p>
            )}
          </div>
          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="contactEmail" className="text-sm font-medium">
              Contact Email *
            </Label>
            <Input
              id="contactEmail"
              type="email"
              {...register('contactEmail', {
                required: 'Contact email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Please enter a valid email address'
                }
              })}
              placeholder="your.email@company.com"
              className={cn(
                formErrors.contactEmail || errors?.contactEmail
                  ? 'border-red-500 focus:ring-red-500'
                  : '',
                'placeholder:text-muted-foreground'
              )}
            />
            {(formErrors.contactEmail || errors?.contactEmail) && (
              <p className="text-sm text-red-600">
                {formErrors.contactEmail?.message || errors?.contactEmail}
              </p>
            )}
          </div>

          {/* Contact Phone */}
          <div className="space-y-2">
            <Label htmlFor="contactPhone" className="text-sm font-medium">
              Contact Phone
              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
            </Label>
            <Input
              id="contactPhone"
              type="tel"
              {...register('contactPhone', {
                pattern: {
                  value: /^(\+44|0)[1-9]\d{8,9}$/,
                  message: 'Please enter a valid UK phone number'
                }
              })}
              placeholder="E.g. 07123 456789"
              className={cn(
                formErrors.contactPhone || errors?.contactPhone
                  ? 'border-red-500 focus:ring-red-500'
                  : '',
                'placeholder:text-muted-foreground'
              )}
            />
            {(formErrors.contactPhone || errors?.contactPhone) && (
              <p className="text-sm text-red-600">
                {formErrors.contactPhone?.message || errors?.contactPhone}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hidden submit button for form validation */}
      <Button type="submit" className="hidden">
        Next
      </Button>
    </form>
  );
}