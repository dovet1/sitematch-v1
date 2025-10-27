// =====================================================
// Gallery Upload Component - Story 3.2 Task 3
// Specialized gallery upload for fit-out examples
// =====================================================

'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Image as ImageIcon, Video, X, Loader2, AlertCircle, Play, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { uploadMultipleFilesViaApi } from '@/lib/file-upload-api';
import { validateFiles, deleteFile } from '@/lib/file-upload';
import {
  formatFileSize,
  isImageFile,
  isVideoFile,
  validateVideoUrl,
  getVideoEmbedUrl,
  detectVideoProvider
} from '@/types/uploads';
import type { 
  GalleryUploadProps,
  GalleryItem,
  FileValidationResult 
} from '@/types/uploads';

interface ExtendedGalleryUploadProps extends GalleryUploadProps {
  organizationId: string;
  listingId?: string;
  allowReordering?: boolean;
  showCaptions?: boolean;
  fileType?: 'photo' | 'video';
  allowExternalUrls?: boolean;
}

export function GalleryUpload({
  value = [],
  onChange,
  maxFiles = 10,
  onProgress,
  disabled = false,
  error,
  className,
  organizationId,
  listingId,
  allowReordering = true,
  showCaptions = true,
  fileType = 'photo',
  allowExternalUrls = false
}: ExtendedGalleryUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // =====================================================
  // FILE HANDLING
  // =====================================================

  const handleFileValidation = useCallback((files: File[]): FileValidationResult => {
    const validation = validateFiles(files, fileType);

    // Check total file count
    if (value.length + files.length > maxFiles) {
      validation.errors.push({
        code: 'INVALID_TYPE',
        message: `Maximum ${maxFiles} files allowed. Currently have ${value.length}, trying to add ${files.length}.`
      });
      validation.isValid = false;
    }

    setValidationError(validation.isValid ? null : validation.errors[0]?.message || 'Invalid files');
    return validation;
  }, [value.length, maxFiles, fileType]);

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
        fileType,
        organizationId,
        (progress) => {
          setUploadProgress(progress);
          onProgress?.(progress);
        },
        listingId
      );

      // Convert to gallery items
      const newGalleryItems: GalleryItem[] = uploadedFiles.map((file, index) => ({
        ...file,
        displayOrder: value.length + index,
        caption: '',
        isVideo: fileType === 'video'
      }));

      // Add to existing files
      const updatedItems = [...value, ...newGalleryItems];
      onChange(updatedItems);
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
  }, [disabled, organizationId, onChange, onProgress, value, maxFiles, handleFileValidation, fileType, listingId]);

  const handleItemRemove = useCallback(async (itemToRemove: GalleryItem) => {
    if (disabled) return;

    try {
      // Delete from storage (skip if external URL)
      if (itemToRemove.path) {
        await deleteFile(itemToRemove.path, fileType);
      }
      
      // Remove from local state and reorder
      const updatedItems = value
        .filter(item => item.id !== itemToRemove.id)
        .map((item, index) => ({ ...item, displayOrder: index }));
      
      onChange(updatedItems);
      
    } catch (error) {
      console.error('File deletion error:', error);
      setValidationError(error instanceof Error ? error.message : 'Failed to delete file');
    }
  }, [disabled, value, onChange, fileType]);

  const handleCaptionUpdate = useCallback((itemId: string, caption: string) => {
    const updatedItems = value.map(item =>
      item.id === itemId ? { ...item, caption } : item
    );
    onChange(updatedItems);
    setEditingCaption(null);
  }, [value, onChange]);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (!allowReordering || disabled) return;

    const updatedItems = [...value];
    const [moved] = updatedItems.splice(fromIndex, 1);
    updatedItems.splice(toIndex, 0, moved);

    // Update display order
    const reorderedItems = updatedItems.map((item, index) => ({
      ...item,
      displayOrder: index
    }));

    onChange(reorderedItems);
  }, [allowReordering, disabled, value, onChange]);

  // =====================================================
  // EXTERNAL URL HANDLING
  // =====================================================

  const handleAddExternalUrl = useCallback(async () => {
    if (!externalUrl.trim() || disabled) return;

    // Validate URL
    const validation = validateVideoUrl(externalUrl);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid video URL');
      return;
    }

    setIsAddingUrl(true);
    setValidationError(null);

    try {
      const provider = detectVideoProvider(externalUrl);
      if (!provider) {
        throw new Error('Unsupported video provider');
      }

      // Call API to add external video
      const response = await fetch('/api/files/external-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: externalUrl,
          listingId: listingId,
          name: `${provider} Video`,
          displayOrder: value.length
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add video');
      }

      const { file } = await response.json();

      // Add to gallery
      const newItem: GalleryItem = {
        id: file.id,
        name: file.file_name,
        url: externalUrl,
        path: '',
        type: 'video',
        size: 0,
        mimeType: 'video/external',
        uploadedAt: new Date(file.created_at),
        displayOrder: value.length,
        caption: '',
        isVideo: true,
        externalUrl: externalUrl,
        videoProvider: provider
      };

      onChange([...value, newItem]);
      setExternalUrl('');
      setShowUrlInput(false);

    } catch (error) {
      console.error('Add external URL error:', error);
      setValidationError(error instanceof Error ? error.message : 'Failed to add video');
    } finally {
      setIsAddingUrl(false);
    }
  }, [externalUrl, disabled, listingId, value, onChange]);

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
    if (!disabled && value.length < maxFiles) {
      fileInputRef.current?.click();
    }
  }, [disabled, value.length, maxFiles]);

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  const renderGalleryItem = (item: GalleryItem, index: number) => (
    <div
      key={item.id}
      className="relative group bg-white rounded-lg border overflow-hidden"
    >
      {/* Media Preview */}
      <div className="aspect-square relative">
        {item.isVideo ? (
          <div className="relative w-full h-full bg-gray-100 flex items-center justify-center">
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt={item.caption || 'Video thumbnail'}
                className="w-full h-full object-cover"
              />
            ) : (
              <Video className="w-12 h-12 text-gray-400" />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                <Play className="w-6 h-6 text-white ml-1" />
              </div>
            </div>
          </div>
        ) : (
          <img
            src={item.url || item.preview}
            alt={item.caption || item.name}
            className="w-full h-full object-cover"
          />
        )}

        {/* Overlay Controls */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-start justify-between p-2">
          {/* Reorder Handle */}
          {allowReordering && !disabled && (
            <Button
              variant="secondary"
              size="sm"
              className="opacity-0 group-hover:opacity-100 h-10 w-10 sm:h-8 sm:w-8 p-0 bg-white/90 hover:bg-white"
            >
              <GripVertical className="w-5 h-5 sm:w-4 sm:h-4" />
            </Button>
          )}

          {/* Remove Button */}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleItemRemove(item)}
            disabled={disabled}
            className="opacity-0 group-hover:opacity-100 h-10 w-10 sm:h-8 sm:w-8 p-0 ml-auto"
          >
            <X className="w-5 h-5 sm:w-4 sm:h-4" />
          </Button>
        </div>

        {/* File Type Badge */}
        <Badge 
          variant="secondary" 
          className="absolute bottom-2 left-2 text-xs"
        >
          {item.isVideo ? 'VIDEO' : 'IMAGE'}
        </Badge>
      </div>

      {/* Caption Input */}
      {showCaptions && (
        <div className="p-2">
          {editingCaption === item.id ? (
            <Input
              type="text"
              placeholder="Add caption..."
              defaultValue={item.caption}
              className="h-8 text-xs"
              onBlur={(e) => handleCaptionUpdate(item.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCaptionUpdate(item.id, e.currentTarget.value);
                } else if (e.key === 'Escape') {
                  setEditingCaption(null);
                }
              }}
              autoFocus
            />
          ) : (
            <p
              className={cn(
                "text-xs text-gray-600 cursor-pointer hover:text-gray-900 truncate",
                !item.caption && "text-gray-400"
              )}
              onClick={() => setEditingCaption(item.id)}
            >
              {item.caption || 'Click to add caption...'}
            </p>
          )}
        </div>
      )}

      {/* File Info */}
      <div className="px-2 pb-2">
        <p className="text-xs text-gray-500 truncate">{item.name}</p>
        <p className="text-xs text-gray-400">{formatFileSize(item.size)}</p>
      </div>
    </div>
  );

  const showError = error || validationError;
  const canAddMore = value.length < maxFiles;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      {canAddMore && (
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
            accept={fileType === 'video'
              ? 'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm'
              : 'image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif'
            }
            onChange={handleInputChange}
            multiple
            className="hidden"
            disabled={disabled}
          />

          <CardContent className="p-6">
            {/* Upload Progress */}
            {isUploading && (
              <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-10">
                <div className="max-w-xs w-full mx-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Uploading gallery...</span>
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
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  {dragOver ? `Drop ${fileType === 'video' ? 'videos' : 'photos'} here` : `Add ${fileType === 'video' ? 'videos' : 'photos'}`}
                </p>
                <p className="text-xs text-gray-500">
                  Drag and drop or click to browse
                </p>
                <p className="text-xs text-gray-400">
                  {fileType === 'video' ? 'MP4, MOV, AVI, MKV, WebM up to 100MB' : 'JPG, PNG, WebP up to 10MB'} • {value.length}/{maxFiles} files
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* External URL Input for Videos */}
      {allowExternalUrls && canAddMore && (
        <div className="space-y-2">
          {!showUrlInput ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowUrlInput(true)}
              disabled={disabled}
              className="w-full"
            >
              <Video className="w-4 h-4 mr-2" />
              Add YouTube or Vimeo URL
            </Button>
          ) : (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      disabled={disabled || isAddingUrl}
                      className="text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Paste a YouTube or Vimeo video URL
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddExternalUrl}
                    disabled={disabled || isAddingUrl || !externalUrl.trim()}
                  >
                    {isAddingUrl ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Video'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowUrlInput(false);
                      setExternalUrl('');
                      setValidationError(null);
                    }}
                    disabled={disabled || isAddingUrl}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Error Message */}
      {showError && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span>{showError}</span>
        </div>
      )}

      {/* Gallery Grid */}
      {value.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">{fileType === 'video' ? 'Videos' : 'Photos'}</h4>
            <Badge variant="secondary" className="text-xs">
              {value.length}/{maxFiles} files
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {value
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map(renderGalleryItem)}
          </div>

          {allowReordering && value.length > 1 && (
            <p className="text-xs text-gray-500 text-center">
              Drag {fileType === 'video' ? 'videos' : 'photos'} to reorder them
            </p>
          )}
        </div>
      )}

      {/* Empty State */}
      {value.length === 0 && !isUploading && (
        <div className="text-center py-8 text-gray-500">
          {fileType === 'video' ? (
            <Video className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          ) : (
            <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          )}
          <p className="text-sm">No {fileType === 'video' ? 'videos' : 'photos'} added yet</p>
          <p className="text-xs text-gray-400 mt-1">
            {fileType === 'video'
              ? 'Upload videos or add YouTube/Vimeo links to showcase your company'
              : 'Upload photos to help visualize your space requirements'}
          </p>
        </div>
      )}
    </div>
  );
}