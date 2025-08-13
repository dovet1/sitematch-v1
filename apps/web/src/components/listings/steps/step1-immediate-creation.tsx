// =====================================================
// Step 1: Immediate Creation Flow - Epic 1, Story 1.1
// Enhanced Step 1 that creates listing immediately and redirects to detail page
// =====================================================

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import { DocumentUpload } from '@/components/listings/document-upload';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import type { WizardStepProps, CompanyInfoData, ListingContact } from '@/types/wizard';
import { validateStep } from '@/lib/wizard-utils';
import { cn } from '@/lib/utils';
import { fetchCompanyLogo, validateDomain, normalizeDomain, formatDomainWithProtocol } from '@/lib/clearbit-logo';

interface Step1FormData extends CompanyInfoData {}

interface Step1ImmediateCreationProps extends WizardStepProps {
  listingId?: string;
  userEmail: string;
  userId: string;
  onImmediateCreate: (data: CompanyInfoData) => Promise<{ success: boolean; listingId?: string; error?: string }>;
}

export function Step1ImmediateCreation({
  data,
  onUpdate,
  onNext,
  onValidationChange,
  errors,
  listingId,
  userEmail,
  userId,
  onImmediateCreate
}: Step1ImmediateCreationProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  
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
        contactName: data.primaryContact?.contactName || '',
        contactTitle: data.primaryContact?.contactTitle || '',
        contactEmail: data.primaryContact?.contactEmail || userEmail || '',
        contactPhone: data.primaryContact?.contactPhone || '',
        contactArea: data.primaryContact?.contactArea || '',
        isPrimaryContact: true,
        headshotFile: data.primaryContact?.headshotFile || undefined,
        headshotPreview: data.primaryContact?.headshotPreview || '',
        headshotUrl: data.primaryContact?.headshotUrl || ''
      },
      // Logo method fields
      logoMethod: data.logoMethod || 'clearbit',
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

  // Logo method state
  const [logoLoading, setLogoLoading] = useState(false);
  const [domainError, setDomainError] = useState<string>('');
  const [headshotUploading, setHeadshotUploading] = useState(false);

  // =====================================================
  // EFFECTS - Same as original Step1CompanyInfo
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

  // =====================================================
  // LOGO METHOD HANDLERS - Same as original
  // =====================================================

  // Handle logo method selection
  const handleLogoMethodChange = useCallback((method: 'clearbit' | 'upload') => {
    setValue('logoMethod', method);
    setDomainError('');
    
    if (method === 'clearbit') {
      setValue('logoFile', undefined);
      setValue('logoPreview', '');
      setValue('logoUrl', '');
      setValue('clearbitLogo', false);
    } else {
      setValue('companyDomain', '');
      setValue('clearbitLogo', false);
      if (watchedValues.clearbitLogo) {
        setValue('logoPreview', '');
        setValue('logoUrl', '');
      }
      setLogoLoading(false);
      setDomainError('');
    }
  }, [setValue, watchedValues.clearbitLogo]);

  // Handle domain input
  const handleDomainInput = useCallback((domain: string) => {
    setValue('companyDomain', domain);
    if (domainError) {
      setDomainError('');
    }
    
    if (!domain.trim()) {
      setValue('logoPreview', '');
      setValue('logoUrl', '');
      setValue('clearbitLogo', false);
      setLogoLoading(false);
    }
  }, [setValue, domainError]);

  // Debounced logo fetching
  const fetchLogoForDomain = useCallback(async (domain: string) => {
    if (!domain.trim()) return;

    if (!validateDomain(domain)) {
      return;
    }

    setLogoLoading(true);
    setDomainError('');
    
    try {
      const logoUrl = await fetchCompanyLogo(domain);
      if (logoUrl) {
        setValue('logoPreview', logoUrl);
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

  // Debounced effect to fetch logo
  useEffect(() => {
    const domain = watchedValues.companyDomain;
    if (!domain || watchedValues.logoMethod !== 'clearbit') return;

    const timeoutId = setTimeout(() => {
      fetchLogoForDomain(domain);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [watchedValues.companyDomain, watchedValues.logoMethod, fetchLogoForDomain]);

  // =====================================================
  // FILE UPLOAD HANDLERS - Same as original
  // =====================================================

  const handleLogoFileUpload = useCallback(async (file: File | null) => {
    setValue('logoFile', file || undefined);
    setValue('clearbitLogo', false);
    if (!file) {
      setValue('logoPreview', '');
      setValue('logoUrl', '');
      return;
    }
    
    if (file instanceof File) {
      try {
        // Use temporary file storage since listing doesn't exist yet
        const { uploadFileTemporary } = await import('@/lib/temp-file-storage');
        const result = await uploadFileTemporary({
          file,
          fileType: 'logo',
          userId: userId
        });
        
        if (result.success && result.file) {
          setValue('logoUrl', result.file.url);
          // Store metadata for later database insertion
          setValue('logoFile', {
            tempPath: result.file.path,
            tempUrl: result.file.url,
            name: file.name,
            size: file.size,
            type: file.type
          } as any);
          // Set preview so ImageUpload shows the uploaded logo
          setValue('logoPreview', result.file.url);
        } else {
          console.error('Failed to upload logo:', result.error);
          toast.error('Failed to upload logo');
        }
      } catch (error) {
        console.error('Error uploading logo:', error);
        toast.error('Error uploading logo');
      }
    }
  }, [setValue, userId]);

  const handleLogoPreviewChange = useCallback((preview: string | null) => {
    setValue('logoPreview', preview || '');
  }, [setValue]);

  const handleHeadshotUpload = useCallback(async (file: File | null) => {
    if (!file) {
      setValue('primaryContact.headshotFile', undefined);
      setValue('primaryContact.headshotPreview', '');
      setValue('primaryContact.headshotUrl', '');
      setHeadshotUploading(false);
      return;
    }
    
    setHeadshotUploading(true);
    try {
      // Use temporary file storage since listing doesn't exist yet
      const { uploadFileTemporary } = await import('@/lib/temp-file-storage');
      const result = await uploadFileTemporary({
        file,
        fileType: 'headshot',
        userId: userId
      });
      
      if (result.success && result.file) {
        console.log('Headshot upload response:', result);
        console.log('Headshot URL:', result.file.url);
        
        // Set the URL for server-side processing
        setValue('primaryContact.headshotUrl', result.file.url);
        
        // Store all metadata needed for server action
        setValue('primaryContact.headshotFile', {
          tempPath: result.file.path,
          tempUrl: result.file.url,
          name: file.name,
          size: file.size,
          type: file.type
        } as any);
        
        // Use the uploaded URL for preview (ImageUpload will display this)
        setValue('primaryContact.headshotPreview', result.file.url);
      } else {
        console.error('Failed to upload headshot:', result.error);
        toast.error('Failed to upload headshot');
      }
    } catch (error) {
      console.error('Error uploading headshot:', error);
      toast.error('Error uploading headshot');
    } finally {
      setHeadshotUploading(false);
    }
  }, [setValue, userId]);

  const handleHeadshotPreviewChange = useCallback((preview: string | null) => {
    setValue('primaryContact.headshotPreview', preview || '');
  }, [setValue]);

  // =====================================================
  // IMMEDIATE CREATION HANDLER - NEW FOR EPIC 1
  // =====================================================

  const handleImmediateCreation = useCallback(async (formData: Step1FormData) => {
    console.log('Form submission data:', {
      companyName: formData.companyName,
      headshotUrl: formData.primaryContact?.headshotUrl,
      headshotFile: formData.primaryContact?.headshotFile,
      headshotFileType: typeof formData.primaryContact?.headshotFile,
      logoFile: formData.logoFile,
      logoFileType: typeof formData.logoFile
    });
    
    setIsCreating(true);
    setCreationProgress(10);

    try {
      // Progress updates for user feedback
      setCreationProgress(30);
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UX

      setCreationProgress(60);
      const result = await onImmediateCreate(formData);
      
      setCreationProgress(80);
      await new Promise(resolve => setTimeout(resolve, 300));

      if (result.success && result.listingId) {
        setCreationProgress(100);
        toast.success('Listing created successfully!');
        
        // Brief delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Redirect to listing detail page
        router.push(`/occupier/listing/${result.listingId}`);
      } else {
        throw new Error(result.error || 'Failed to create listing');
      }
    } catch (error) {
      console.error('Failed to create listing:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create listing');
      setIsCreating(false);
      setCreationProgress(0);
    }
  }, [onImmediateCreate, router]);

  // Check if form is valid for immediate creation
  const stepErrors = validateStep(1, watchedValues);
  const isValid = Object.keys(stepErrors).length === 0;

  // =====================================================
  // LOADING SCREEN - NEW FOR EPIC 1
  // =====================================================

  if (isCreating) {
    return (
      <div className="min-h-[600px] flex flex-col items-center justify-center space-y-6 text-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">Creating Your Listing</h3>
          <p className="text-muted-foreground max-w-md">
            We're setting up your property requirement with the information you provided...
          </p>
        </div>
        
        <div className="w-full max-w-xs space-y-2">
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${creationProgress}%` }}
            ></div>
          </div>
          <p className="text-sm text-muted-foreground">
            {creationProgress < 30 && 'Validating information...'}
            {creationProgress >= 30 && creationProgress < 60 && 'Creating listing...'}
            {creationProgress >= 60 && creationProgress < 80 && 'Processing files...'}
            {creationProgress >= 80 && 'Almost done...'}
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER - Same form as original but with new button
  // =====================================================

  return (
    <form onSubmit={handleSubmit(handleImmediateCreation)} className="space-y-6">
      {/* Listing Type Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Listing Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select listing type *</Label>
            <RadioGroup
              value={watchedValues.listingType || 'commercial'}
              onValueChange={(value) => setValue('listingType', value as 'residential' | 'commercial')}
              className="space-y-3"
            >
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

      {/* Company Logo Section - Same as original */}
      <Card>
        <CardHeader>
          <CardTitle>Company Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  onBlur={(e) => {
                    // Auto-format and clean the domain when user finishes editing
                    const rawDomain = e.target.value.trim();
                    if (rawDomain) {
                      const normalizedDomain = normalizeDomain(rawDomain);
                      const formattedDomain = formatDomainWithProtocol(rawDomain);
                      
                      // Update the input field to show the cleaned domain (without protocol for Clearbit)
                      setValue('companyDomain', normalizedDomain);
                      
                      // Store the formatted version for other uses if needed
                      console.log('Domain normalized:', normalizedDomain, 'Formatted:', formattedDomain);
                    }
                  }}
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
          {watchedValues.logoMethod === 'upload' && (
            <ImageUpload
              value={watchedValues.logoFile || watchedValues.logoPreview}
              onChange={handleLogoFileUpload}
              onPreviewChange={handleLogoPreviewChange}
              placeholder="Upload your company logo"
              maxSize={2 * 1024 * 1024}
              acceptedTypes={["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]}
            />
          )}
        </CardContent>
      </Card>

      {/* Requirements Brochure Section - Same as original */}
      <Card>
        <CardHeader>
          <CardTitle>Requirements Material</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Requirements Brochure
              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
            </Label>
            <DocumentUpload
              type="brochure"
              value={watchedValues.brochureFiles || []}
              onChange={(files) => {
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
                onUpdate({ ...watchedValues, brochureFiles });
              }}
              acceptedTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
              maxFileSize={10 * 1024 * 1024}
              organizationId=""
              listingId={listingId}
              useTemporaryStorage={true}
            />
          </div>
          
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

      {/* Contact Information Section - Same as original */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  message: 'e.g. South-West England'
                }
              })}
              placeholder="e.g., South-West England"
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

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Headshot
              <span className="text-gray-500 font-normal ml-1">(Optional)</span>
            </Label>
            <ImageUpload
              value={watchedValues.primaryContact?.headshotPreview || watchedValues.primaryContact?.headshotFile}
              onChange={handleHeadshotUpload}
              onPreviewChange={handleHeadshotPreviewChange}
              placeholder="Upload photo"
              maxSize={5 * 1024 * 1024}
              acceptedTypes={["image/png", "image/jpeg", "image/jpg"]}
            />
            {headshotUploading && (
              <p className="text-sm text-blue-600 flex items-center gap-2">
                <span className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full"></span>
                Uploading headshot...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* NEW: Create My Listing Button - Epic 1, Story 1.1 */}
      <div className="pt-6 border-t">
        <div className="flex flex-col items-center space-y-4">
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-lg">Ready to create your listing?</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              We'll create your listing with this information and you can add more details on the next page.
            </p>
          </div>
          
          <Button
            type="submit"
            disabled={!isValid || isCreating || headshotUploading}
            className="violet-bloom-button violet-bloom-touch shadow-lg hover:shadow-xl transition-all w-full sm:w-auto min-w-[200px]"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Create My Listing
              </>
            )}
          </Button>
          
          {!isValid && (
            <p className="text-sm text-muted-foreground text-center">
              Please fill in all required fields above
            </p>
          )}
          
          {headshotUploading && (
            <p className="text-sm text-blue-600 text-center">
              Please wait for the headshot to finish uploading...
            </p>
          )}
        </div>
      </div>
    </form>
  );
}