// =====================================================
// Document Upload Component - Story 3.2 Task 3
// Specialized document upload for PDFs and site plans
// =====================================================

'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, Loader2, AlertCircle, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { uploadMultipleFilesViaApi } from '@/lib/file-upload-api';
import { validateFiles, deleteFile } from '@/lib/file-upload';
import { formatFileSize, isDocumentFile, isImageFile } from '@/types/uploads';
import type { 
  MultiFileUploadProps, 
  UploadedFile,
  FileValidationResult 
} from '@/types/uploads';

interface DocumentUploadProps extends MultiFileUploadProps {
  acceptedTypes?: string[];
  maxFileSize?: number;
  showPreview?: boolean;
  organizationId: string;
}

export function DocumentUpload({
  type,
  value = [],
  onChange,
  onProgress,
  disabled = false,
  error,
  className,
  acceptedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  showPreview = true,
  organizationId
}: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // =====================================================
  // FILE HANDLING
  // =====================================================

  const handleFileValidation = useCallback((files: File[]): FileValidationResult => {
    const validation = validateFiles(files, type);
    setValidationError(validation.isValid ? null : validation.errors[0]?.message || 'Invalid files');
    return validation;
  }, [type]);

  const handleFileSelect = useCallback(async (files: File[]) => {
    if (disabled || files.length === 0) return;

    // Validate files
    const validation = handleFileValidation(files);
    if (!validation.isValid) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload files via API
      const uploadedFiles = await uploadMultipleFilesViaApi(
        files,
        type,
        organizationId,
        (progress) => {
          setUploadProgress(progress);
          onProgress?.(progress);
        }
      );

      // Add to existing files
      const updatedFiles = [...value, ...uploadedFiles];
      onChange(updatedFiles);
      setValidationError(null);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Upload error:', error);
      setValidationError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [disabled, type, organizationId, onChange, onProgress, value, handleFileValidation]);

  const handleFileRemove = useCallback(async (fileToRemove: UploadedFile) => {
    if (disabled) return;

    try {
      // Delete from storage
      await deleteFile(fileToRemove.path, type);
      
      // Remove from local state
      const updatedFiles = value.filter(file => file.id !== fileToRemove.id);
      onChange(updatedFiles);
      
    } catch (error) {
      console.error('File deletion error:', error);
      setValidationError(error instanceof Error ? error.message : 'Failed to delete file');
    }
  }, [disabled, type, value, onChange]);

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
      handleFileSelect(files);
    }
  }, [disabled, handleFileSelect]);

  // =====================================================
  // INPUT HANDLERS
  // =====================================================

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files);
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

  const getFileIcon = (file: UploadedFile) => {
    if (isImageFile(file.mimeType)) {
      return '🖼️';
    } else if (file.mimeType === 'application/pdf') {
      return '📄';
    } else if (file.mimeType.includes('word')) {
      return '📝';
    }
    return '📄';
  };

  const getFileTypeLabel = (mimeType: string) => {
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType === 'application/msword') return 'DOC';
    if (mimeType.includes('wordprocessingml')) return 'DOCX';
    if (mimeType === 'image/jpeg') return 'JPG';
    if (mimeType === 'image/png') return 'PNG';
    return 'FILE';
  };

  const renderFileItem = (file: UploadedFile, index: number) => (
    <div
      key={file.id}
      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="text-2xl">{getFileIcon(file)}</div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{file.name}</p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Badge variant="secondary" className="text-xs">
              {getFileTypeLabel(file.mimeType)}
            </Badge>
            <span>{formatFileSize(file.size)}</span>
            <span>•</span>
            <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Preview/Download Button */}
        {showPreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(file.url, '_blank')}
            className="h-8 w-8 p-0"
          >
            {isImageFile(file.mimeType) ? (
              <Eye className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </Button>
        )}

        {/* Remove Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleFileRemove(file)}
          disabled={disabled}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const showError = error || validationError;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <Card
        className={cn(
          "relative border-2 border-dashed transition-all cursor-pointer",
          dragOver && "border-purple-400 bg-purple-50",
          disabled && "opacity-50 cursor-not-allowed",
          showError && "border-red-300"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          multiple
          className="hidden"
          disabled={disabled}
        />

        <CardContent className="p-8">
          {/* Upload Progress */}
          {isUploading && (
            <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
              <div className="max-w-xs w-full mx-4">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Uploading documents...</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-gray-600 mt-1">{Math.round(uploadProgress)}% complete</p>
              </div>
            </div>
          )}

          {/* Upload Placeholder */}
          <div className="text-center">
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center mb-4 mx-auto",
              dragOver ? "bg-purple-100" : "bg-gray-100"
            )}>
              {dragOver ? (
                <Upload className="w-6 h-6 text-purple-600" />
              ) : (
                <FileText className="w-6 h-6 text-gray-400" />
              )}
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">
                {dragOver ? 'Drop documents here' : 'Upload documents'}
              </p>
              <p className="text-xs text-gray-500">
                Drag and drop or click to browse
              </p>
              <p className="text-xs text-gray-400">
                {type === 'brochure' ? 'PDF up to 40MB' : 'PDF, DOC, DOCX, JPG, PNG up to 40MB'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {showError && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span>{showError}</span>
        </div>
      )}

      {/* File List */}
      {value.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">
              Uploaded {type === 'brochure' ? 'Brochures' : 'Site Plans'}
            </h4>
            <Badge variant="secondary" className="text-xs">
              {value.length} file{value.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          <div className="space-y-2">
            {value.map(renderFileItem)}
          </div>
        </div>
      )}

      {/* Empty State */}
      {value.length === 0 && !isUploading && (
        <div className="text-center py-4 text-gray-500">
          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No {type === 'brochure' ? 'brochures' : 'site plans'} uploaded yet</p>
        </div>
      )}
    </div>
  );
}