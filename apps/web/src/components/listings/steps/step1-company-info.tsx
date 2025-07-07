// =====================================================
// Step 1: Company Information - Updated
// Company details, contact information, requirements brochure, and optional headshot
// =====================================================

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ImageUpload } from '@/components/ui/image-upload';
import { DocumentUpload } from '@/components/listings/document-upload';

import type { WizardStepProps, CompanyInfoData, ListingContact } from '@/types/wizard';
import { validateStep } from '@/lib/wizard-utils';
import { cn } from '@/lib/utils';

interface Step1FormData extends CompanyInfoData {}

export function Step1CompanyInfo({
  data,
  onUpdate,
  onNext,
  onValidationChange,
  errors,
  listingId
}: WizardStepProps & { listingId?: string }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors: formErrors }
  } = useForm<Step1FormData>({
    defaultValues: {
      companyName: data.companyName || '',
      primaryContact: {
        contactName: data.primaryContact?.contactName || (data as any).contactName || '',
        contactTitle: data.primaryContact?.contactTitle || (data as any).contactTitle || '',
        contactEmail: data.primaryContact?.contactEmail || (data as any).contactEmail || '',
        contactPhone: data.primaryContact?.contactPhone || (data as any).contactPhone || '',
        isPrimaryContact: true,
        headshotFile: data.primaryContact?.headshotFile || (data as any).headshotFile || undefined,
        headshotPreview: data.primaryContact?.headshotPreview || (data as any).headshotPreview || (data as any).headshotUrl || '',
        headshotUrl: data.primaryContact?.headshotUrl || (data as any).headshotUrl || ''
      },
      logoFile: data.logoFile || undefined,
      logoPreview: data.logoPreview || data.logoUrl || '',
      brochureFiles: data.brochureFiles || []
    },
    mode: 'onChange'
  });

  const watchedValues = watch();

  // =====================================================
  // EFFECTS
  // =====================================================

  const prevValuesRef = useRef<string>('');
  const prevValidRef = useRef<boolean>(false);

  // Debounced update to parent
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentJson = JSON.stringify(watchedValues, (key, value) => {
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

  // Debounced validation
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

  // Set initial values
  const prevDataRef = useRef(data);
  useEffect(() => {
    if (prevDataRef.current !== data) {
      prevDataRef.current = data;
      
      if (data.companyName !== undefined) setValue('companyName', data.companyName);
      
      // Handle primary contact data (support both old and new structure)
      const primaryContact = data.primaryContact || {
        contactName: (data as any).contactName || '',
        contactTitle: (data as any).contactTitle || '',
        contactEmail: (data as any).contactEmail || '',
        contactPhone: (data as any).contactPhone || '',
        isPrimaryContact: true,
        headshotFile: (data as any).headshotFile,
        headshotPreview: (data as any).headshotPreview || (data as any).headshotUrl || '',
        headshotUrl: (data as any).headshotUrl || ''
      };
      
      setValue('primaryContact', primaryContact);
      
      if (data.logoFile !== undefined) setValue('logoFile', data.logoFile);
      if (data.logoPreview !== undefined) setValue('logoPreview', data.logoPreview);
      if (data.logoUrl !== undefined) setValue('logoPreview', data.logoUrl);
      if (data.brochureFiles !== undefined) setValue('brochureFiles', data.brochureFiles);
    }
  }, [data, setValue]);

  // =====================================================
  // FORM SUBMISSION
  // =====================================================

  const onSubmit = () => {
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
                  ? 'violet-bloom-error'
                  : ''
              }
            />
            {(formErrors.companyName || errors?.companyName) && (
              <p className="body-small text-error">
                {formErrors.companyName?.message || errors?.companyName}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company Logo Section */}
      <Card>
        <CardHeader>
          <CardTitle>Company Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUpload
            value={watchedValues.logoFile || watchedValues.logoPreview || data.logoUrl}
            onChange={useCallback((file) => {
              setValue('logoFile', file || undefined);
              if (!file) {
                setValue('logoPreview', '');
              }
              // Update parent state to clear logo URL when removing
              onUpdate({ 
                ...watchedValues,
                logoFile: file || undefined,
                logoPreview: file ? undefined : '',
                logoUrl: file ? data.logoUrl : undefined
              });
            }, [setValue, onUpdate, data.logoUrl, watchedValues])}
            onPreviewChange={useCallback((preview: string | null) => setValue('logoPreview', preview || ''), [setValue])}
            placeholder="Upload your company logo"
            maxSize={2 * 1024 * 1024} // 2MB
            acceptedTypes={["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]}
          />
        </CardContent>
      </Card>

      {/* Requirements Brochure Section */}
      <Card>
        <CardHeader>
          <CardTitle>Requirements Brochure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Requirements Brochure
              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
            </Label>
            <DocumentUpload
              type="brochure"
              value={watchedValues.brochureFiles || []}
              onChange={(files) => {
                // Convert UploadedFile[] to the specific brochure format expected by wizard
                const brochureFiles = files.map(file => ({
                  id: file.id,
                  name: file.name,
                  url: file.url,
                  path: file.path,
                  type: 'brochure' as const,
                  size: file.size,
                  mimeType: file.mimeType,
                  uploadedAt: file.uploadedAt
                }));
                setValue('brochureFiles', brochureFiles);
                // Also update parent state
                onUpdate({ ...watchedValues, brochureFiles });
              }}
              acceptedTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
              maxFileSize={10 * 1024 * 1024} // 10MB
              organizationId=""
              listingId={listingId}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information Section */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Contact Name */}
          <div className="space-y-2">
            <Label htmlFor="contactName">
              Contact Name *
            </Label>
            <Input
              id="contactName"
              {...register('primaryContact.contactName', {
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
                formErrors.primaryContact?.contactName || errors?.contactName
                  ? 'violet-bloom-error'
                  : ''
              }
            />
            {(formErrors.primaryContact?.contactName || errors?.contactName) && (
              <p className="body-small text-error">
                {formErrors.primaryContact?.contactName?.message || errors?.contactName}
              </p>
            )}
          </div>

          {/* Contact Title */}
          <div className="space-y-2">
            <Label htmlFor="contactTitle">
              Contact Title *
            </Label>
            <Input
              id="contactTitle"
              {...register('primaryContact.contactTitle', {
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
                formErrors.primaryContact?.contactTitle || errors?.contactTitle
                  ? 'violet-bloom-error'
                  : ''
              }
            />
            {(formErrors.primaryContact?.contactTitle || errors?.contactTitle) && (
              <p className="body-small text-error">
                {formErrors.primaryContact?.contactTitle?.message || errors?.contactTitle}
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
              {...register('primaryContact.contactEmail', {
                required: 'Contact email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Please enter a valid email address'
                }
              })}
              placeholder="your.email@company.com"
              className={cn(
                formErrors.primaryContact?.contactEmail || errors?.contactEmail
                  ? 'border-red-500 focus:ring-red-500'
                  : '',
                'placeholder:text-muted-foreground'
              )}
            />
            {(formErrors.primaryContact?.contactEmail || errors?.contactEmail) && (
              <p className="text-sm text-red-600">
                {formErrors.primaryContact?.contactEmail?.message || errors?.contactEmail}
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
              {...register('primaryContact.contactPhone', {
                pattern: {
                  value: /^(\+?[0-9\s\-\(\)]{7,20})$/,
                  message: 'Please enter a valid phone number'
                }
              })}
              placeholder="E.g. 07123 456789"
              className={cn(
                formErrors.primaryContact?.contactPhone || errors?.contactPhone
                  ? 'border-red-500 focus:ring-red-500'
                  : '',
                'placeholder:text-muted-foreground'
              )}
            />
            {(formErrors.primaryContact?.contactPhone || errors?.contactPhone) && (
              <p className="text-sm text-red-600">
                {formErrors.primaryContact?.contactPhone?.message || errors?.contactPhone}
              </p>
            )}
          </div>

          {/* Headshot */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Headshot
              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
            </Label>
            <ImageUpload
              value={watchedValues.primaryContact?.headshotFile || watchedValues.primaryContact?.headshotPreview || data.primaryContact?.headshotUrl}
              onChange={useCallback((file) => {
                setValue('primaryContact.headshotFile', file || undefined);
                if (!file) {
                  setValue('primaryContact.headshotPreview', '');
                }
                // Update parent state to save headshot changes
                onUpdate({ 
                  ...watchedValues,
                  primaryContact: {
                    ...watchedValues.primaryContact,
                    headshotFile: file || undefined,
                    headshotPreview: file ? undefined : '',
                    headshotUrl: file ? data.primaryContact?.headshotUrl : undefined
                  }
                });
              }, [setValue, onUpdate, data.primaryContact?.headshotUrl, watchedValues])}
              onPreviewChange={useCallback((preview: string | null) => setValue('primaryContact.headshotPreview', preview || ''), [setValue])}
              placeholder="Upload professional headshot"
              maxSize={2 * 1024 * 1024} // 2MB
              acceptedTypes={["image/png", "image/jpeg", "image/jpg"]}
            />
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