// =====================================================
// Step 4: Supporting Documents - Story 3.2 Task 4
// File uploads for supporting documents
// =====================================================

'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, AlertCircle } from 'lucide-react';

import { EnhancedImageUpload } from '@/components/listings/enhanced-image-upload';
import { DocumentUpload } from '@/components/listings/document-upload';
import { GalleryUpload } from '@/components/listings/gallery-upload';
import { FAQManager, type FAQ } from '@/components/listings/faq-manager';

import type { WizardStepProps, SupportingDocumentsData } from '@/types/wizard';
import type { UploadedFile, GalleryItem } from '@/types/uploads';
import { validateStep } from '@/lib/wizard-utils';
import { cn } from '@/lib/utils';

interface Step4FormData extends SupportingDocumentsData {}

interface Step4Props extends WizardStepProps {
  organizationId: string;
}

export function Step4SupportingDocuments({
  data,
  onUpdate,
  onNext,
  onPrevious,
  onValidationChange,
  errors,
  organizationId
}: Step4Props) {
  const {
    handleSubmit,
    formState: { errors: formErrors }
  } = useForm<Step4FormData>({
    defaultValues: {
      photoFiles: data.photoFiles || [],
      videoFiles: data.videoFiles || []
    },
    mode: 'onChange'
  });

  // =====================================================
  // REFS AND STATE
  // =====================================================

  const prevValuesRef = useRef<string>('');
  const prevValidRef = useRef<boolean>(false);

  // =====================================================
  // CURRENT FORM VALUES
  // =====================================================

  const currentFormData: Step4FormData = {
    photoFiles: data.photoFiles || [],
    videoFiles: data.videoFiles || []
  };

  // =====================================================
  // UPDATE EFFECTS
  // =====================================================

  // Debounced update to parent
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

  // Debounced validation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const stepErrors = validateStep(4, currentFormData);
      const isValid = Object.keys(stepErrors).length === 0;
      
      if (prevValidRef.current !== isValid) {
        prevValidRef.current = isValid;
        onValidationChange(isValid);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [currentFormData, onValidationChange]);

  // =====================================================
  // FILE UPLOAD HANDLERS
  // =====================================================

  const handleBrochureFilesChange = useCallback((files: UploadedFile[]) => {
    onUpdate({
      ...currentFormData,
      brochureFiles: files.filter(f => f.type === 'brochure').map(f => ({ ...f, type: 'brochure' as const }))
    });
  }, [currentFormData, onUpdate]);

  const handlePhotoFilesChange = useCallback((files: GalleryItem[]) => {
    onUpdate({
      ...currentFormData,
      photoFiles: files.map(f => ({
        id: f.id,
        name: f.name,
        url: f.url,
        path: f.path,
        type: 'photo' as const,
        size: f.size,
        mimeType: f.mimeType,
        uploadedAt: f.uploadedAt,
        displayOrder: f.displayOrder,
        caption: f.caption,
        thumbnail: f.thumbnail
      }))
    });
  }, [currentFormData, onUpdate]);

  const handleVideoFilesChange = useCallback((files: GalleryItem[]) => {
    onUpdate({
      ...currentFormData,
      videoFiles: files.map(f => ({
        id: f.id,
        name: f.name,
        url: f.url,
        path: f.path,
        type: 'video' as const,
        size: f.size,
        mimeType: f.mimeType,
        uploadedAt: f.uploadedAt,
        displayOrder: f.displayOrder,
        caption: f.caption,
        thumbnail: f.thumbnail,
        externalUrl: f.externalUrl,
        videoProvider: f.videoProvider
      }))
    });
  }, [currentFormData, onUpdate]);

  const handleFAQsChange = useCallback((faqs: FAQ[]) => {
    onUpdate({
      ...currentFormData,
      faqs: faqs.map(faq => ({
        ...faq,
        displayOrder: faq.displayOrder
      }))
    });
  }, [currentFormData, onUpdate]);

  // =====================================================
  // FORM SUBMISSION
  // =====================================================

  const onSubmit = (formData: Step4FormData) => {
    onNext();
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Supporting Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Supporting Documents
          </CardTitle>
          <p className="text-sm text-gray-600">
            Upload documents and images to help landlords understand your requirements. All uploads are optional.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Company Brochures */}
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Company Brochures</h4>
            <p className="text-sm text-gray-600 mb-4">
              Upload company brochures, capability statements, or other marketing materials.
            </p>
            <DocumentUpload
              type="brochure"
              value={data.brochureFiles || []}
              onChange={handleBrochureFilesChange}
              organizationId={organizationId}
              acceptedTypes={['application/pdf']}
              maxFileSize={40 * 1024 * 1024} // 40MB
              showPreview={true}
            />
          </div>

          <div className="border-t pt-8">
            <h4 className="font-medium text-gray-900 mb-4">Photos</h4>
            <p className="text-sm text-gray-600 mb-4">
              Upload photos to help landlords visualize your space requirements and company culture.
            </p>
            <GalleryUpload
              value={(data.photoFiles || []).map(f => ({
                ...f,
                isVideo: false
              }))}
              onChange={handlePhotoFilesChange}
              organizationId={organizationId}
              maxFiles={20}
              allowReordering={true}
              showCaptions={true}
              fileType="photo"
            />
          </div>

          <div className="border-t pt-8">
            <h4 className="font-medium text-gray-900 mb-4">Videos</h4>
            <p className="text-sm text-gray-600 mb-4">
              Upload videos or add YouTube/Vimeo links to showcase your company and space requirements.
            </p>
            <GalleryUpload
              value={(data.videoFiles || []).map(f => ({
                ...f,
                path: f.path || ''
              }))}
              onChange={handleVideoFilesChange}
              organizationId={organizationId}
              maxFiles={10}
              allowReordering={true}
              showCaptions={true}
              fileType="video"
              allowExternalUrls={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* FAQ Management Section - Story 3.3 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Frequently Asked Questions (Optional)</CardTitle>
          <p className="text-sm text-gray-600">
            Add questions and answers that might help potential partners understand your requirements better.
          </p>
        </CardHeader>
        <CardContent>
          <FAQManager
            faqs={data.faqs || []}
            onChange={handleFAQsChange}
            maxFaqs={10}
          />
        </CardContent>
      </Card>

      {/* Hidden submit button for form validation */}
      <Button type="submit" className="hidden">
        Next
      </Button>
    </form>
  );
}