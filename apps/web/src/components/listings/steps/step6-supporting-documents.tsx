// =====================================================
// Step 6: Supporting Documents - Story 3.2 Task 4
// File uploads for site plans and fit-out examples
// =====================================================

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle, FileImage, Building } from 'lucide-react';

import { EnhancedImageUpload } from '@/components/listings/enhanced-image-upload';
import { DocumentUpload } from '@/components/listings/document-upload';
import { GalleryUpload } from '@/components/listings/gallery-upload';

import type { WizardStepProps, SupportingDocumentsData } from '@/types/wizard';
import type { UploadedFile, GalleryItem } from '@/types/uploads';
import { validateStep } from '@/lib/wizard-utils';
import { cn } from '@/lib/utils';

interface Step6FormData extends SupportingDocumentsData {}

interface Step6Props extends WizardStepProps {
  listingId?: string;
}

export function Step6SupportingDocuments({
  data,
  onUpdate,
  onNext,
  onPrevious,
  onValidationChange,
  errors,
  listingId
}: Step6Props) {
  const {
    handleSubmit,
    formState: { errors: formErrors }
  } = useForm<Step6FormData>({
    defaultValues: {
      sitePlanFiles: data.sitePlanFiles || [],
      fitOutFiles: data.fitOutFiles || []
    },
    mode: 'onChange'
  });

  // =====================================================
  // STATE MANAGEMENT
  // =====================================================

  const [sitePlanFiles, setSitePlanFiles] = useState<UploadedFile[]>(data.sitePlanFiles || []);
  const [fitOutFiles, setFitOutFiles] = useState<GalleryItem[]>(
    (data.fitOutFiles || []).map(file => ({
      ...file,
      isVideo: file.isVideo || false
    }))
  );

  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);

  // =====================================================
  // EFFECTS
  // =====================================================

  const prevValuesRef = useRef<string>('');
  const prevValidRef = useRef<boolean>(false);

  // Update parent when files change
  useEffect(() => {
    const formData = {
      sitePlanFiles: sitePlanFiles.map(file => ({
        ...file,
        type: 'sitePlan' as const
      })),
      fitOutFiles: fitOutFiles.map(file => ({
        id: file.id,
        name: file.name,
        url: file.url,
        path: file.path,
        type: 'fitOut' as const,
        size: file.size,
        mimeType: file.mimeType,
        uploadedAt: file.uploadedAt,
        displayOrder: file.displayOrder,
        caption: file.caption,
        isVideo: file.isVideo,
        thumbnail: file.thumbnail
      }))
    };
    const currentJson = JSON.stringify(formData, (key, value) => {
      if (value instanceof File) {
        return { name: value.name, size: value.size, type: value.type };
      }
      return value;
    });
    
    if (prevValuesRef.current !== currentJson) {
      prevValuesRef.current = currentJson;
      onUpdate(formData);
    }
  }, [sitePlanFiles, fitOutFiles, onUpdate]);

  // Validation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const stepErrors = validateStep(6, {
        sitePlanFiles: sitePlanFiles.map(file => ({
          ...file,
          type: 'sitePlan' as const
        })),
        fitOutFiles: fitOutFiles.map(file => ({
          ...file,
          type: 'fitOut' as const
        }))
      });
      const isValid = Object.keys(stepErrors).length === 0 && !isUploading;
      
      if (prevValidRef.current !== isValid) {
        prevValidRef.current = isValid;
        onValidationChange(isValid);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [sitePlanFiles, fitOutFiles, isUploading, onValidationChange]);

  // =====================================================
  // HANDLERS
  // =====================================================

  const handleSitePlanFilesChange = useCallback((files: UploadedFile[]) => {
    setSitePlanFiles(files);
    setUploadErrors(prev => ({ ...prev, sitePlans: '' }));
  }, []);

  const handleFitOutFilesChange = useCallback((files: GalleryItem[]) => {
    setFitOutFiles(files);
    setUploadErrors(prev => ({ ...prev, fitOuts: '' }));
  }, []);

  const handleUploadStart = useCallback(() => {
    setIsUploading(true);
  }, []);

  const handleUploadComplete = useCallback(() => {
    setIsUploading(false);
  }, []);

  const handleUploadError = useCallback((type: string, error: string) => {
    setUploadErrors(prev => ({ ...prev, [type]: error }));
    setIsUploading(false);
  }, []);

  const onSubmit = (formData: Step6FormData) => {
    if (isUploading) {
      return; // Prevent submission while uploading
    }
    onNext();
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Supporting Documents
          </CardTitle>
          <p className="text-sm text-gray-600">
            Upload example site plans and fit-out images to help potential partners understand your space requirements.
          </p>
        </CardHeader>
      </Card>

      {/* Site Plans Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileImage className="w-4 h-4" />
            Example Site Plans
            <span className="text-sm font-normal text-gray-500">(Optional)</span>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Upload example site plans or layouts that represent your ideal space configuration.
          </p>
        </CardHeader>
        <CardContent>
          <DocumentUpload
            value={sitePlanFiles}
            onChange={handleSitePlanFilesChange}
            organizationId=""
            listingId={listingId}
            type="sitePlan"
            acceptedTypes={[
              "application/pdf",
              "image/png", 
              "image/jpeg", 
              "image/jpg",
              "application/vnd.dwg",
              "application/dxf"
            ]}
            maxFileSize={10 * 1024 * 1024} // 10MB
          />
          {uploadErrors.sitePlans && (
            <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {uploadErrors.sitePlans}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fit-Out Examples Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="w-4 h-4" />
            Example Fit-Outs
            <span className="text-sm font-normal text-gray-500">(Optional)</span>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Upload images of fit-out examples or interior designs that reflect your aesthetic preferences.
          </p>
        </CardHeader>
        <CardContent>
          <GalleryUpload
            value={fitOutFiles}
            onChange={handleFitOutFilesChange}
            organizationId=""
            listingId={listingId}
            maxFiles={10}
          />
          {uploadErrors.fitOuts && (
            <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {uploadErrors.fitOuts}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Status */}
      {isUploading && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-blue-700">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
              <span className="text-sm">Uploading files...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {(sitePlanFiles.length > 0 || fitOutFiles.length > 0) && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="text-sm text-green-700">
              <p className="font-medium mb-1">Files Ready:</p>
              <ul className="space-y-1">
                {sitePlanFiles.length > 0 && (
                  <li>• {sitePlanFiles.length} site plan{sitePlanFiles.length !== 1 ? 's' : ''}</li>
                )}
                {fitOutFiles.length > 0 && (
                  <li>• {fitOutFiles.length} fit-out example{fitOutFiles.length !== 1 ? 's' : ''}</li>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden submit button for form validation */}
      <Button type="submit" className="hidden">
        Submit
      </Button>
    </form>
  );
}