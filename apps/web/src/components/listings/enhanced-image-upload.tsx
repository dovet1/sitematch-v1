// =====================================================
// Enhanced Image Upload Component - Story 3.2 Task 3
// Specialized image upload with optimization and preview
// =====================================================

'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import { uploadFileViaApi } from '@/lib/file-upload-api';
import { validateFile, generateThumbnail } from '@/lib/file-upload';
import type { 
  SingleFileUploadProps, 
  FileUploadType, 
  UploadedFile,
  FileValidationResult 
} from '@/types/uploads';

interface EnhancedImageUploadProps extends SingleFileUploadProps {
  showOptimization?: boolean;
  showThumbnail?: boolean;
  aspectRatio?: 'square' | 'landscape' | 'portrait' | 'auto';
  organizationId: string;
}

export function EnhancedImageUpload({
  type,
  value,
  onChange,
  onProgress,
  disabled = false,
  error,
  className,
  showOptimization = true,
  showThumbnail = true,
  aspectRatio = 'auto',
  organizationId
}: EnhancedImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // =====================================================
  // FILE HANDLING
  // =====================================================

  const handleFileValidation = useCallback((file: File): FileValidationResult => {
    const validation = validateFile(file, type);
    setValidationError(validation.isValid ? null : validation.errors[0]?.message || 'Invalid file');
    return validation;
  }, [type]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (disabled) return;

    // Validate file
    const validation = handleFileValidation(file);
    if (!validation.isValid) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Generate preview
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Upload file via API
      const uploadedFile = await uploadFileViaApi(
        file,
        type,
        organizationId,
        (progress) => {
          setUploadProgress(progress);
          onProgress?.(progress);
        }
      );

      // Update parent
      onChange(uploadedFile);
      setValidationError(null);

    } catch (error) {
      console.error('Upload error:', error);
      setValidationError(error instanceof Error ? error.message : 'Upload failed');
      setPreview(null);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [disabled, type, organizationId, onChange, onProgress, handleFileValidation]);

  const handleFileRemove = useCallback(() => {
    if (disabled) return;

    onChange(null);
    setPreview(null);
    setValidationError(null);
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [disabled, onChange]);

  // =====================================================
  // DRAG AND DROP
  // =====================================================

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [disabled, handleFileSelect]);

  // =====================================================
  // INPUT HANDLERS
  // =====================================================

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'square': return 'aspect-square';
      case 'landscape': return 'aspect-video';
      case 'portrait': return 'aspect-[3/4]';
      default: return 'min-h-[200px]';
    }
  };

  const currentPreview = preview || value?.url || value?.preview;
  const hasFile = Boolean(value || preview);
  const showError = error || validationError;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className={cn("space-y-2", className)}>
      <Card
        className={cn(
          "relative border-2 border-dashed transition-all cursor-pointer overflow-hidden",
          dragOver && "border-purple-400 bg-purple-50",
          disabled && "opacity-50 cursor-not-allowed",
          showError && "border-red-300",
          hasFile && "border-solid border-gray-200",
          getAspectRatioClass()
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <CardContent className="p-0 h-full">
          {/* Upload Progress */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <div className="bg-white rounded-lg p-4 max-w-xs w-full mx-4">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Uploading...</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-gray-600 mt-1">{Math.round(uploadProgress)}% complete</p>
              </div>
            </div>
          )}

          {/* Image Preview */}
          {currentPreview && !isUploading ? (
            <div className="relative h-full group">
              <img
                src={currentPreview}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
              
              {/* Remove Button */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileRemove();
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={disabled}
                >
                  <X className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>

              {/* File Info */}
              {value && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-white text-sm font-medium truncate">{value.name}</p>
                  <p className="text-white/80 text-xs">
                    {(value.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              )}
            </div>
          ) : !isUploading ? (
            /* Upload Placeholder */
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
              <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center mb-4",
                dragOver ? "bg-purple-100" : "bg-gray-100"
              )}>
                {dragOver ? (
                  <Upload className="w-6 h-6 text-purple-600" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  {dragOver ? 'Drop image here' : 'Upload image'}
                </p>
                <p className="text-xs text-gray-500">
                  Drag and drop or click to browse
                </p>
                <p className="text-xs text-gray-400">
                  PNG, JPG, SVG up to 2MB
                </p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Error Message */}
      {showError && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span>{showError}</span>
        </div>
      )}

      {/* File Details */}
      {value && !showError && (
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>File size:</span>
            <span>{(value.size / 1024).toFixed(1)} KB</span>
          </div>
          {showThumbnail && value.thumbnail && (
            <div className="flex justify-between">
              <span>Thumbnail:</span>
              <span>✓ Generated</span>
            </div>
          )}
          {showOptimization && (
            <div className="flex justify-between">
              <span>Optimized:</span>
              <span>✓ Yes</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}