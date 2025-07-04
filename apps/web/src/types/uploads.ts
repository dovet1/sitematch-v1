// =====================================================
// File Upload Types - Story 3.2
// TypeScript definitions for multi-type file uploads
// =====================================================

/**
 * Supported file types for uploads
 */
export type FileUploadType = 'logo' | 'brochure' | 'sitePlan' | 'fitOut';

/**
 * File upload configuration
 */
export interface FileUploadConfig {
  bucket: string;
  allowedTypes: string[];
  maxSize: number; // in bytes
  maxFiles?: number;
  requiresOptimization?: boolean;
  description: string;
}

/**
 * File upload configurations by type
 */
export const FILE_UPLOAD_CONFIGS: Record<FileUploadType, FileUploadConfig> = {
  logo: {
    bucket: 'logos',
    allowedTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
    maxSize: 2 * 1024 * 1024, // 2MB
    maxFiles: 1,
    requiresOptimization: true,
    description: 'Company logo (PNG, JPG, SVG - max 2MB)'
  },
  brochure: {
    bucket: 'brochures',
    allowedTypes: ['application/pdf'],
    maxSize: 40 * 1024 * 1024, // 40MB
    maxFiles: 3,
    requiresOptimization: false,
    description: 'Company brochures (PDF - max 40MB each)'
  },
  sitePlan: {
    bucket: 'site-plans',
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    requiresOptimization: true, // Now true since we support images
    description: 'Site plans and documents (PDF, DOC, DOCX, JPG, PNG - max 10MB each)'
  },
  fitOut: {
    bucket: 'fit-outs',
    allowedTypes: ['image/jpeg', 'image/png', 'video/mp4'],
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 10,
    requiresOptimization: true,
    description: 'Fit-out examples (JPG, PNG, MP4 - max 5MB each)'
  }
};

/**
 * File upload state
 */
export interface FileUploadState {
  files: UploadFile[];
  isUploading: boolean;
  progress: number;
  error: string | null;
  completedFiles: UploadedFile[];
}

/**
 * File being uploaded
 */
export interface UploadFile {
  id: string;
  file: File;
  type: FileUploadType;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  preview?: string; // For images
  thumbnail?: string; // For videos
}

/**
 * Successfully uploaded file
 */
export interface UploadedFile {
  id: string;
  name: string;
  url: string;
  path: string;
  type: FileUploadType;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  preview?: string;
  thumbnail?: string;
}

/**
 * File upload progress callback
 */
export type UploadProgressCallback = (progress: number) => void;

/**
 * File upload error types
 */
export interface FileUploadError {
  code: 'FILE_TOO_LARGE' | 'INVALID_TYPE' | 'UPLOAD_FAILED' | 'NETWORK_ERROR' | 'QUOTA_EXCEEDED';
  message: string;
  file?: string;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  errors: FileUploadError[];
  warnings: string[];
}

/**
 * Multi-file upload props
 */
export interface MultiFileUploadProps {
  type: FileUploadType;
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  onProgress?: (progress: number) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

/**
 * Single file upload props
 */
export interface SingleFileUploadProps {
  type: FileUploadType;
  value?: UploadedFile;
  onChange: (file: UploadedFile | null) => void;
  onProgress?: (progress: number) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

/**
 * Drag and drop state
 */
export interface DragDropState {
  isDragOver: boolean;
  isDragActive: boolean;
  files: File[];
}

/**
 * Image optimization options
 */
export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  format?: 'jpeg' | 'png' | 'webp';
  generateThumbnail?: boolean;
  thumbnailSize?: number;
}

/**
 * File preview component props
 */
export interface FilePreviewProps {
  file: UploadedFile;
  onRemove?: () => void;
  onReplace?: () => void;
  showActions?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Gallery item for fit-out examples
 */
export interface GalleryItem extends UploadedFile {
  displayOrder: number;
  caption?: string;
  isVideo: boolean;
}

/**
 * Gallery upload props
 */
export interface GalleryUploadProps {
  value: GalleryItem[];
  onChange: (items: GalleryItem[]) => void;
  maxFiles?: number;
  onProgress?: (progress: number) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

/**
 * File type helpers
 */
export const FILE_TYPE_LABELS: Record<FileUploadType, string> = {
  logo: 'Company Logo',
  brochure: 'Company Brochures',
  sitePlan: 'Site Plans',
  fitOut: 'Fit-out Examples'
};

/**
 * MIME type mappings
 */
export const MIME_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'video/mp4': 'mp4'
};

/**
 * File size formatting helper
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if file is an image
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if file is a video
 */
export function isVideoFile(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

/**
 * Check if file is a document
 */
export function isDocumentFile(mimeType: string): boolean {
  return mimeType.startsWith('application/');
}