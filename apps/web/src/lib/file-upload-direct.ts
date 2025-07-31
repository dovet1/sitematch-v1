import { createClientClient } from '@/lib/supabase'
import type { UploadedFile } from '@/types/uploads'

export interface DirectUploadOptions {
  file: File
  fileType: 'logo' | 'brochure' | 'sitePlan' | 'fitOut' | 'headshot'
  listingId?: string
  userId: string
  onProgress?: (progress: number) => void
}

export interface DirectUploadResult {
  success: boolean
  file?: UploadedFile
  error?: string
}

// Bucket mapping
const BUCKET_MAP = {
  'logo': 'logos',
  'brochure': 'brochures',
  'sitePlan': 'site-plans',
  'fitOut': 'fit-outs',
  'headshot': 'headshots'
} as const

/**
 * Upload file directly to Supabase Storage from the browser
 */
export async function uploadFileDirect({
  file,
  fileType,
  listingId,
  userId,
  onProgress
}: DirectUploadOptions): Promise<DirectUploadResult> {
  try {
    const supabase = createClientClient()
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Validate file
    if (!file || file.size === 0) {
      return { success: false, error: 'Invalid file' }
    }

    // Determine bucket and path
    const bucket = BUCKET_MAP[fileType]
    const folderName = listingId || userId
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${folderName}/${timestamp}-${sanitizedFileName}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return { success: false, error: uploadError.message }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path)

    // Save metadata to database via API
    const metadataResponse = await fetch('/api/files/metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_path: uploadData.path,
        file_name: file.name,
        file_size: file.size,
        file_type: fileType,
        mime_type: file.type,
        bucket_name: bucket,
        listing_id: listingId,
        user_id: userId
      })
    })

    if (!metadataResponse.ok) {
      // Try to clean up the uploaded file
      await supabase.storage.from(bucket).remove([uploadData.path])
      
      const errorData = await metadataResponse.json().catch(() => ({}))
      return { 
        success: false, 
        error: errorData.error || 'Failed to save file metadata' 
      }
    }

    const { file: fileRecord } = await metadataResponse.json()

    // Return the uploaded file info
    return {
      success: true,
      file: {
        id: fileRecord.id,
        name: file.name,
        url: urlData.publicUrl,
        path: uploadData.path,
        type: fileType,
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date(fileRecord.created_at)
      }
    }
  } catch (error) {
    console.error('Direct upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}

/**
 * Delete file from storage and database
 */
export async function deleteFileDirect(
  fileId: string,
  filePath: string,
  bucket: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClientClient()

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([filePath])

    if (storageError) {
      console.error('Storage deletion error:', storageError)
      // Continue to try to delete metadata even if storage fails
    }

    // Delete metadata from database
    const response = await fetch(`/api/files/metadata/${fileId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { 
        success: false, 
        error: errorData.error || 'Failed to delete file metadata' 
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete file error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed'
    }
  }
}