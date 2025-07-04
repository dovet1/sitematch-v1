// =====================================================
// Enhanced File Upload Utilities - Story 3.2 Task 2
// Multi-type file upload with validation and optimization
// =====================================================

import { browserClient } from '@/lib/supabase';
import type {
  FileUploadType,
  FileUploadConfig,
  UploadFile,
  UploadedFile,
  FileValidationResult,
  FileUploadError,
  UploadProgressCallback,
  ImageOptimizationOptions
} from '@/types/uploads';
import { FILE_UPLOAD_CONFIGS } from '@/types/uploads';

/**
 * Validate file against upload configuration
 */
export function validateFile(
  file: File,
  type: FileUploadType
): FileValidationResult {
  const config = FILE_UPLOAD_CONFIGS[type];
  const errors: FileUploadError[] = [];
  const warnings: string[] = [];

  // Check file type
  if (!config.allowedTypes.includes(file.type)) {
    errors.push({
      code: 'INVALID_TYPE',
      message: `Invalid file type. Allowed types: ${config.allowedTypes.join(', ')}`,
      file: file.name
    });
  }

  // Check file size
  if (file.size > config.maxSize) {
    const maxSizeMB = (config.maxSize / (1024 * 1024)).toFixed(1);
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: `File too large. Maximum size: ${maxSizeMB}MB`,
      file: file.name
    });
  }

  // Check if file is empty
  if (file.size === 0) {
    errors.push({
      code: 'INVALID_TYPE',
      message: 'File appears to be empty',
      file: file.name
    });
  }

  // Add warnings for large files (even if within limits)
  if (file.size > config.maxSize * 0.8) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    warnings.push(`Large file size (${sizeMB}MB). Consider optimizing for faster upload.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate multiple files
 */
export function validateFiles(
  files: File[],
  type: FileUploadType
): FileValidationResult {
  const config = FILE_UPLOAD_CONFIGS[type];
  const allErrors: FileUploadError[] = [];
  const allWarnings: string[] = [];

  // Check total number of files
  if (config.maxFiles && files.length > config.maxFiles) {
    allErrors.push({
      code: 'INVALID_TYPE',
      message: `Too many files. Maximum allowed: ${config.maxFiles}`
    });
  }

  // Validate each file
  files.forEach(file => {
    const result = validateFile(file, type);
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  });

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  };
}

/**
 * Optimize image file
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.85,
    format = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const optimizedFile = new File([blob], file.name, {
                type: `image/${format}`,
                lastModified: Date.now()
              });
              resolve(optimizedFile);
            } else {
              reject(new Error('Failed to optimize image'));
            }
          },
          `image/${format}`,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate thumbnail for image or video
 */
export async function generateThumbnail(
  file: File,
  size: number = 200
): Promise<string> {
  if (file.type.startsWith('image/')) {
    return generateImageThumbnail(file, size);
  } else if (file.type.startsWith('video/')) {
    return generateVideoThumbnail(file, size);
  }
  
  throw new Error('Unsupported file type for thumbnail generation');
}

/**
 * Generate image thumbnail
 */
async function generateImageThumbnail(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const { width, height } = img;
      const ratio = Math.min(size / width, size / height);
      
      canvas.width = size;
      canvas.height = size;
      
      const newWidth = width * ratio;
      const newHeight = height * ratio;
      const x = (size - newWidth) / 2;
      const y = (size - newHeight) / 2;

      // Fill background with white
      ctx!.fillStyle = '#ffffff';
      ctx!.fillRect(0, 0, size, size);
      
      // Draw image centered
      ctx!.drawImage(img, x, y, newWidth, newHeight);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    img.onerror = () => reject(new Error('Failed to load image for thumbnail'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generate video thumbnail
 */
async function generateVideoThumbnail(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onloadeddata = () => {
      canvas.width = size;
      canvas.height = size;
      
      // Seek to 1 second or 10% of video, whichever is smaller
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      const { videoWidth, videoHeight } = video;
      const ratio = Math.min(size / videoWidth, size / videoHeight);
      
      const newWidth = videoWidth * ratio;
      const newHeight = videoHeight * ratio;
      const x = (size - newWidth) / 2;
      const y = (size - newHeight) / 2;

      // Fill background with black
      ctx!.fillStyle = '#000000';
      ctx!.fillRect(0, 0, size, size);
      
      // Draw video frame centered
      ctx!.drawImage(video, x, y, newWidth, newHeight);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    video.onerror = () => reject(new Error('Failed to load video for thumbnail'));
    video.src = URL.createObjectURL(file);
    video.load();
  });
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
  file: File,
  type: FileUploadType,
  organizationId: string,
  onProgress?: UploadProgressCallback
): Promise<UploadedFile> {
  
  const supabase = browserClient;
  const config = FILE_UPLOAD_CONFIGS[type];

  // Validate file
  const validation = validateFile(file, type);
  if (!validation.isValid) {
    throw new Error(validation.errors[0]?.message || 'File validation failed');
  }

  try {
    // Optimize image if required
    let processedFile = file;
    let thumbnail: string | undefined;

    if (config.requiresOptimization && file.type.startsWith('image/')) {
      processedFile = await optimizeImage(file);
      thumbnail = await generateThumbnail(processedFile);
    } else if (file.type.startsWith('video/')) {
      thumbnail = await generateVideoThumbnail(file, 200); // 200px thumbnail
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop() || 'bin';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const fileName = `${organizationId}/${timestamp}-${randomId}.${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(config.bucket)
      .upload(fileName, processedFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(config.bucket)
      .getPublicUrl(uploadData.path);

    // Handle organization creation if needed
    let finalOrgId = organizationId;
    if (organizationId === '00000000-0000-0000-0000-000000000000') {
      // This is a placeholder - we need to create an organization first
      const { getOrCreateOrganizationForUser } = await import('@/lib/auto-organization');
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Use a default company name for file uploads
      const defaultCompanyName = `${user.email?.split('@')[0] || 'User'} Company`;
      const orgResult = await getOrCreateOrganizationForUser(user.id, defaultCompanyName);
      
      if (orgResult.error) {
        throw new Error(`Failed to create organization: ${orgResult.error}`);
      }
      
      finalOrgId = orgResult.organizationId;
    }

    // Create upload record in database
    const { data: fileRecord, error: dbError } = await supabase
      .from('file_uploads')
      .insert({
        org_id: finalOrgId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        file_path: uploadData.path,
        file_name: file.name,
        file_size: processedFile.size,
        file_type: type,
        mime_type: processedFile.type,
        bucket_name: config.bucket
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage.from(config.bucket).remove([uploadData.path]);
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Return uploaded file info
    return {
      id: fileRecord.id,
      name: file.name,
      url: urlData.publicUrl,
      path: uploadData.path,
      type,
      size: processedFile.size,
      mimeType: processedFile.type,
      uploadedAt: new Date(fileRecord.created_at),
      thumbnail
    };

  } catch (error) {
    console.error('File upload error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('An unexpected error occurred during file upload');
  }
}

/**
 * Upload multiple files
 */
export async function uploadFiles(
  files: File[],
  type: FileUploadType,
  organizationId: string,
  onProgress?: UploadProgressCallback
): Promise<UploadedFile[]> {
  const config = FILE_UPLOAD_CONFIGS[type];

  // Validate all files first
  const validation = validateFiles(files, type);
  if (!validation.isValid) {
    throw new Error(validation.errors[0]?.message || 'File validation failed');
  }

  const uploadedFiles: UploadedFile[] = [];
  let completedUploads = 0;

  try {
    // Upload files sequentially to avoid overwhelming the server
    for (const file of files) {
      const uploadedFile = await uploadFile(file, type, organizationId);
      uploadedFiles.push(uploadedFile);
      
      completedUploads++;
      if (onProgress) {
        onProgress((completedUploads / files.length) * 100);
      }
    }

    return uploadedFiles;

  } catch (error) {
    // Clean up any successfully uploaded files
    await Promise.all(
      uploadedFiles.map(file => deleteFile(file.path, type))
    );
    
    throw error;
  }
}

/**
 * Delete file from storage and database
 */
export async function deleteFile(
  filePath: string,
  type: FileUploadType
): Promise<void> {
  const supabase = browserClient;
  const config = FILE_UPLOAD_CONFIGS[type];

  try {
    // Delete from database first
    const { error: dbError } = await supabase
      .from('file_uploads')
      .delete()
      .eq('file_path', filePath);

    if (dbError) {
      console.error('Database deletion error:', dbError);
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(config.bucket)
      .remove([filePath]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      throw new Error(`Failed to delete file from storage: ${storageError.message}`);
    }

  } catch (error) {
    console.error('File deletion error:', error);
    throw error;
  }
}

/**
 * Get files for organization
 */
export async function getOrganizationFiles(
  organizationId: string,
  type?: FileUploadType
): Promise<UploadedFile[]> {
  const supabase = browserClient;

  let query = supabase
    .from('file_uploads')
    .select('*')
    .eq('org_id', organizationId);

  if (type) {
    query = query.eq('file_type', type);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch files: ${error.message}`);
  }

  return data.map(record => ({
    id: record.id,
    name: record.file_name,
    url: '', // Will need to generate public URL
    path: record.file_path,
    type: record.file_type,
    size: record.file_size,
    mimeType: record.mime_type,
    uploadedAt: new Date(record.created_at)
  }));
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check storage quota usage
 */
export async function checkStorageQuota(
  organizationId: string
): Promise<{ used: number; limit: number; percentage: number }> {
  const supabase = browserClient;

  const { data, error } = await supabase
    .from('file_uploads')
    .select('file_size')
    .eq('org_id', organizationId);

  if (error) {
    throw new Error(`Failed to check storage quota: ${error.message}`);
  }

  const used = data.reduce((total, file) => total + file.file_size, 0);
  const limit = 1024 * 1024 * 1024; // 1GB default limit
  const percentage = (used / limit) * 100;

  return { used, limit, percentage };
}