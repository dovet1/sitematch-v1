// =====================================================
// Step 1: Company Information - Updated
// Company details, contact information, requirements brochure, and optional headshot
// =====================================================

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import { DocumentUpload } from '@/components/listings/document-upload';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle, AlertCircle } from 'lucide-react';

import type { WizardStepProps, CompanyInfoData, ListingContact } from '@/types/wizard';
import { validateStep } from '@/lib/wizard-utils';
import { cn } from '@/lib/utils';
import { fetchCompanyLogo, validateDomain, normalizeDomain } from '@/lib/clearbit-logo';

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
      listingType: data.listingType || 'commercial',
      primaryContact: {
        contactName: data.primaryContact?.contactName || (data as any).contactName || '',
        contactTitle: data.primaryContact?.contactTitle || (data as any).contactTitle || '',
        contactEmail: data.primaryContact?.contactEmail || (data as any).contactEmail || '',
        contactPhone: data.primaryContact?.contactPhone || (data as any).contactPhone || '',
        contactArea: data.primaryContact?.contactArea || (data as any).contactArea || '',
        isPrimaryContact: true,
        headshotFile: data.primaryContact?.headshotFile || (data as any).headshotFile || undefined,
        headshotPreview: data.primaryContact?.headshotPreview || (data as any).headshotPreview || (data as any).headshotUrl || '',
        headshotUrl: data.primaryContact?.headshotUrl || (data as any).headshotUrl || ''
      },
      // Logo method fields - Story 9.0
      logoMethod: data.logoMethod || 'clearbit', // Default to Clearbit method
      companyDomain: data.companyDomain || '',
      clearbitLogo: data.clearbitLogo || false,
      logoFile: data.logoFile || undefined,
      logoPreview: data.logoPreview || data.logoUrl || '',
      logoUrl: data.logoUrl || '',
      brochureFiles: data.brochureFiles || [],
      propertyPageLink: data.propertyPageLink || ''
    },
    mode: 'onChange'
  });

  const watchedValues = watch();

  // Logo method state - Story 9.0
  const [logoLoading, setLogoLoading] = useState(false);
  const [domainError, setDomainError] = useState<string>('');

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
        console.log('Step1 updating with propertyPageLink:', watchedValues.propertyPageLink);
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

  // Track if we've initialized the logo to prevent overwriting
  const hasInitializedLogoRef = useRef(false);
  
  // Set initial values when data loads from database (for edit mode)
  const prevDataRef = useRef(data);
  const hasInitializedFormRef = useRef(false);
  
  useEffect(() => {
    // Only initialize when we get meaningful data (not empty objects)
    const hasValidData = data.companyName && data.companyName.trim() !== '';
    
    if (hasValidData && !hasInitializedFormRef.current) {
      hasInitializedFormRef.current = true;
      
      console.log('🔍 DEBUG: Initializing form with loaded data:', {
        companyName: data.companyName,
        listingType: data.listingType,
        logoMethod: data.logoMethod,
        clearbitLogo: data.clearbitLogo,
        companyDomain: data.companyDomain,
        logoUrl: data.logoUrl,
        logoPreview: data.logoPreview,
        hasLogoFile: !!data.logoFile,
        contactName: data.primaryContact?.contactName
      });
      
      if (data.companyName !== undefined) setValue('companyName', data.companyName);
      if (data.listingType !== undefined) setValue('listingType', data.listingType);
      if (data.logoMethod !== undefined) setValue('logoMethod', data.logoMethod);
      if (data.clearbitLogo !== undefined) setValue('clearbitLogo', data.clearbitLogo);
      if (data.companyDomain !== undefined) setValue('companyDomain', data.companyDomain);
      
      // Handle primary contact data (support both old and new structure)
      const primaryContact = data.primaryContact || {
        contactName: (data as any).contactName || '',
        contactTitle: (data as any).contactTitle || '',
        contactEmail: (data as any).contactEmail || '',
        contactPhone: (data as any).contactPhone || '',
        contactArea: (data as any).contactArea || '',
        isPrimaryContact: true,
        headshotFile: (data as any).headshotFile,
        headshotPreview: (data as any).headshotPreview || (data as any).headshotUrl || '',
        headshotUrl: (data as any).headshotUrl || ''
      };
      
      setValue('primaryContact', primaryContact);
      
      if (data.logoFile !== undefined) setValue('logoFile', data.logoFile);
      if (data.logoPreview !== undefined) setValue('logoPreview', data.logoPreview);
      // Only set logoPreview from logoUrl if it's a valid URL (not empty) and we haven't initialized yet
      if (data.logoUrl && data.logoUrl.trim() !== '' && !hasInitializedLogoRef.current) {
        setValue('logoPreview', data.logoUrl);
        hasInitializedLogoRef.current = true;
      }
      if (data.brochureFiles !== undefined) setValue('brochureFiles', data.brochureFiles);
      if (data.propertyPageLink !== undefined) setValue('propertyPageLink', data.propertyPageLink);
    }
  }, [data, setValue]);

  // =====================================================
  // LOGO METHOD HANDLERS - Story 9.0
  // =====================================================

  // Handle logo method selection
  const handleLogoMethodChange = useCallback((method: 'clearbit' | 'upload') => {
    setValue('logoMethod', method);
    setDomainError('');
    
    // Clear logo data when switching methods
    if (method === 'clearbit') {
      // Switching to Clearbit method - clear upload data
      setValue('logoFile', undefined);
      setValue('logoPreview', '');
      setValue('logoUrl', '');
      setValue('clearbitLogo', false);
    } else {
      // Switching to upload method - clear Clearbit data but preserve uploaded logo data
      setValue('companyDomain', '');
      setValue('clearbitLogo', false);
      // Only clear logo preview/URL if it was from Clearbit (not from upload)
      if (watchedValues.clearbitLogo) {
        setValue('logoPreview', '');
        setValue('logoUrl', '');
      }
      setLogoLoading(false);
      setDomainError('');
    }
  }, [setValue, watchedValues.clearbitLogo]);

  // Handle domain input - just update the value, don't fetch yet
  const handleDomainInput = useCallback((domain: string) => {
    setValue('companyDomain', domain);
    // Clear any previous errors when user starts typing
    if (domainError) {
      setDomainError('');
    }
    
    // Clear logo data if domain is empty
    if (!domain.trim()) {
      setValue('logoPreview', '');
      setValue('logoUrl', '');
      setValue('clearbitLogo', false);
      setLogoLoading(false);
    }
  }, [setValue, domainError]);

  // Debounced logo fetching - only runs after user stops typing
  const fetchLogoForDomain = useCallback(async (domain: string) => {
    if (!domain.trim()) return;

    // Only validate and fetch if it looks like a complete domain
    if (!validateDomain(domain)) {
      // Don't show error for incomplete domains, just skip fetching
      return;
    }

    setLogoLoading(true);
    setDomainError(''); // Clear any previous errors
    
    try {
      const logoUrl = await fetchCompanyLogo(domain);
      if (logoUrl) {
        setValue('logoPreview', logoUrl);
        // Don't set logoUrl for Clearbit - we'll generate it dynamically
        setValue('clearbitLogo', true);
        setDomainError('');
      } else {
        setValue('logoPreview', '');
        setValue('clearbitLogo', false);
        setDomainError('No logo found for this domain. Try uploading your own logo instead.');
      }
    } catch (error) {
      setValue('logoPreview', '');
      setValue('clearbitLogo', false);
      if (error instanceof Error) {
        setDomainError(error.message);
      } else {
        setDomainError('Failed to fetch logo. Please try again or upload your own logo.');
      }
    } finally {
      setLogoLoading(false);
    }
  }, [setValue]);

  // Debounced effect to fetch logo after user stops typing
  useEffect(() => {
    const domain = watchedValues.companyDomain;
    if (!domain || watchedValues.logoMethod !== 'clearbit') return;

    const timeoutId = setTimeout(() => {
      fetchLogoForDomain(domain);
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [watchedValues.companyDomain, watchedValues.logoMethod, fetchLogoForDomain]);

  // =====================================================
  // CALLBACK DEFINITIONS - Story 9.0
  // =====================================================

  // Logo upload callback for file upload method
  const handleLogoFileUpload = useCallback(async (file: File | null) => {
    console.log('🔍 DEBUG: Logo file upload handler called with:', file?.name || 'null');
    setValue('logoFile', file || undefined);
    setValue('clearbitLogo', false); // Not using Clearbit
    if (!file) {
      setValue('logoPreview', '');
    }
    
    // Upload logo file to server if provided
    if (file instanceof File) {
      console.log('🔍 DEBUG: Uploading logo file to server, listingId:', listingId);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'logo');
        formData.append('is_primary', 'true'); // Mark as primary logo file
        
        // Add listing ID if available
        if (listingId) {
          formData.append('listingId', listingId);
        }
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('🔍 DEBUG: Logo upload successful, URL:', result.url);
          setValue('logoUrl', result.url);
        } else {
          console.error('Failed to upload logo:', await response.text());
        }
      } catch (error) {
        console.error('Error uploading logo:', error);
      }
    }
  }, [setValue, listingId]);

  // Logo preview callback
  const handleLogoPreviewChange = useCallback((preview: string | null) => {
    setValue('logoPreview', preview || '');
  }, [setValue]);

  // Headshot upload callback
  const handleHeadshotUpload = useCallback(async (file: File | null) => {
    setValue('primaryContact.headshotFile', file || undefined);
    if (!file) {
      setValue('primaryContact.headshotPreview', '');
      setValue('primaryContact.headshotUrl', '');
    } else {
      // Upload the file to get a URL
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'headshot');
        formData.append('is_primary', 'true'); // Mark as primary contact headshot
        
        // Add listing ID if available
        if (listingId) {
          formData.append('listingId', listingId);
        }
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          setValue('primaryContact.headshotUrl', result.url);
        } else {
          console.error('Failed to upload headshot:', await response.text());
        }
      } catch (error) {
        console.error('Error uploading headshot:', error);
      }
    }
    // Update parent state to save headshot changes
    onUpdate({ 
      ...watchedValues,
      primaryContact: {
        ...watchedValues.primaryContact,
        headshotFile: file || undefined,
        headshotPreview: file ? undefined : '',
        headshotUrl: file ? data.primaryContact?.headshotUrl : undefined,
        contactArea: watchedValues.primaryContact?.contactArea || ''
      }
    });
  }, [setValue, onUpdate, data.primaryContact?.headshotUrl, watchedValues, listingId]);

  // Headshot preview callback
  const handleHeadshotPreviewChange = useCallback((preview: string | null) => {
    setValue('primaryContact.headshotPreview', preview || '');
  }, [setValue]);

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
      {/* Listing Type Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Listing Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Listing Type Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select listing type *</Label>
            <RadioGroup
              value={watchedValues.listingType || 'commercial'}
              onValueChange={(value) => setValue('listingType', value as 'residential' | 'commercial')}
              className="space-y-3"
            >
              {/* Commercial Option */}
              <div className="flex items-start space-x-3 p-3 sm:p-4 rounded-lg border border-muted hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="commercial" id="commercial" className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="commercial" className="text-sm font-medium cursor-pointer">
                    Commercial
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Office spaces, retail units, industrial sites, and other business properties
                  </p>
                </div>
              </div>
              
              {/* Residential Option */}
              <div className="flex items-start space-x-3 p-3 sm:p-4 rounded-lg border border-muted hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="residential" id="residential" className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="residential" className="text-sm font-medium cursor-pointer">
                    Residential
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Houses, apartments, condos, and other living spaces
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

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

      {/* Company Logo Section - Story 9.0 */}
      <Card>
        <CardHeader>
          <CardTitle>Company Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Enhanced Logo Method Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium leading-relaxed">How would you like to add your logo?</Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We can automatically find your logo, or you can upload your own
              </p>
            </div>
            
            <RadioGroup
              value={watchedValues.logoMethod || 'clearbit'}
              onValueChange={(value) => handleLogoMethodChange(value as 'clearbit' | 'upload')}
              className="space-y-3"
            >
              {/* Clearbit Method Card - Mobile Responsive */}
              <div className="flex items-start space-x-3 p-3 sm:p-4 rounded-lg border border-muted hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="clearbit" id="clearbit" className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="clearbit" className="text-sm font-medium cursor-pointer">
                      Find logo automatically
                    </Label>
                    <Badge variant="secondary" className="text-xs ml-2 sm:ml-0">Recommended</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We'll search for your company's logo using your domain • Usually instant
                  </p>
                </div>
              </div>
              
              {/* Upload Method Card - Mobile Responsive */}
              <div className="flex items-start space-x-3 p-3 sm:p-4 rounded-lg border border-muted hover:bg-muted/30 transition-colors">
                <RadioGroupItem value="upload" id="upload" className="mt-0.5" />
                <div className="flex-1 space-y-1">
                  <Label htmlFor="upload" className="text-sm font-medium cursor-pointer">
                    Upload your own logo
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Choose a custom logo file • PNG, JPG, or SVG up to 2MB
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Clearbit Domain Method */}
          {watchedValues.logoMethod === 'clearbit' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="companyDomain" className="text-sm font-medium leading-relaxed">
                  Company Domain
                </Label>
                <Input
                  id="companyDomain"
                  value={watchedValues.companyDomain || ''}
                  onChange={(e) => handleDomainInput(e.target.value)}
                  placeholder="e.g., apple.com"
                  className={cn(
                    domainError ? 'border-red-500 focus:ring-red-500' : '',
                    'placeholder:text-muted-foreground'
                  )}
                />
                {domainError && (
                  <div className="p-3 sm:p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex flex-col space-y-2 sm:flex-row sm:items-start sm:space-y-0 sm:space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 sm:mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-900 break-words">
                          {domainError.includes('No logo found') ? 
                            'Logo not found' : 
                            'Invalid domain format'
                          }
                        </p>
                        <p className="text-xs text-red-600 mt-1 leading-relaxed break-words">
                          {domainError.includes('No logo found') ? 
                            'Try uploading your own logo instead, or check if the domain is correct.' :
                            'Please enter a valid domain like "company.com" (without www or https://)'
                          }
                        </p>
                        {domainError.includes('No logo found') && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleLogoMethodChange('upload')}
                            className="mt-2 text-xs w-full sm:w-auto"
                          >
                            Upload logo instead
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {logoLoading && (
                  <p className="text-sm text-blue-600 flex items-center gap-2">
                    <span className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full"></span>
                    Looking for logo...
                  </p>
                )}
              </div>
              
              {/* Enhanced Logo Preview for Clearbit - Mobile Responsive */}
              {watchedValues.logoPreview && watchedValues.clearbitLogo && (
                <div className="p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
                    <div className="flex items-center space-x-3 sm:space-x-3">
                      <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-lg border border-green-300 flex items-center justify-center">
                        <img
                          src={watchedValues.logoPreview}
                          alt="Company logo"
                          className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <p className="text-sm font-medium text-green-900">Logo found!</p>
                        </div>
                        <p className="text-xs text-green-600 break-words leading-relaxed">
                          We found your logo automatically from {watchedValues.companyDomain}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleLogoMethodChange('upload')}
                      className="text-xs w-full sm:w-auto sm:flex-shrink-0"
                    >
                      Use different logo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File Upload Method */}
          {watchedValues.logoMethod === 'upload' && (() => {
            const uploadValue = watchedValues.logoFile || watchedValues.logoPreview || data.logoUrl;
            console.log('🔍 DEBUG: ImageUpload value for logo:', {
              logoFile: watchedValues.logoFile?.name || 'none',
              logoPreview: watchedValues.logoPreview || 'none',
              dataLogoUrl: data.logoUrl || 'none',
              finalValue: uploadValue
            });
            
            return (
              <ImageUpload
                value={uploadValue}
                onChange={handleLogoFileUpload}
                onPreviewChange={handleLogoPreviewChange}
                placeholder="Upload your company logo"
                maxSize={2 * 1024 * 1024} // 2MB
                acceptedTypes={["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]}
              />
            );
          })()}
        </CardContent>
      </Card>

      {/* Requirements Brochure Section */}
      <Card>
        <CardHeader>
          <CardTitle>Requirements material</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Requirements Brochure Upload */}
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
          
          {/* Property Page Link */}
          <div className="space-y-2">
            <Label htmlFor="propertyPageLink" className="text-sm font-medium">
              Property Page Link
              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
            </Label>
            <Input
              id="propertyPageLink"
              type="url"
              {...register('propertyPageLink', {
                pattern: {
                  value: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
                  message: 'Please enter a valid URL starting with http:// or https://'
                }
              })}
              placeholder="https://example.com/property-page"
              className={cn(
                formErrors.propertyPageLink || errors?.propertyPageLink
                  ? 'border-red-500 focus:ring-red-500'
                  : '',
                'placeholder:text-muted-foreground'
              )}
            />
            {(formErrors.propertyPageLink || errors?.propertyPageLink) && (
              <p className="text-sm text-red-600">
                {formErrors.propertyPageLink?.message || errors?.propertyPageLink}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Link to the occupier's property page or additional information
            </p>
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
              placeholder="Enter the contact name"
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

          {/* Coverage Area */}
          <div className="space-y-2">
            <Label htmlFor="contactArea" className="text-sm font-medium">
              Coverage Area
              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
            </Label>
            <Input
              id="contactArea"
              {...register('primaryContact.contactArea', {
                maxLength: {
                  value: 255,
                  message: 'Coverage area must be no more than 255 characters'
                }
              })}
              placeholder="e.g., The South West"
              className={cn(
                formErrors.primaryContact?.contactArea
                  ? 'border-red-500 focus:ring-red-500'
                  : '',
                'placeholder:text-muted-foreground'
              )}
            />
            {formErrors.primaryContact?.contactArea && (
              <p className="text-sm text-red-600">
                {formErrors.primaryContact?.contactArea?.message}
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
              onChange={handleHeadshotUpload}
              onPreviewChange={handleHeadshotPreviewChange}
              placeholder="Upload photo"
              maxSize={5 * 1024 * 1024} // 5MB
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