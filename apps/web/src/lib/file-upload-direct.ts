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
    
    // Log upload attempt details
    console.log('Direct upload attempt:', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / (1024 * 1024)).toFixed(2),
      fileType: file.type,
      uploadType: fileType,
      bucket: BUCKET_MAP[fileType]
    })
    
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

    // Upload to Supabase Storage with progress tracking
    let uploadData: any = null
    let uploadError: any = null
    
    try {
      // Get session for authorization
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      // Create upload URL
      const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`
      
      // Create XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100)
            onProgress?.(progress)
          }
        })
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              uploadData = { path: filePath, id: response.id || filePath }
              resolve()
            } catch (e) {
              // If response isn't JSON, assume success with basic data
              uploadData = { path: filePath, id: filePath }
              resolve()
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`))
          }
        })
        
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed - network error'))
        })
        
        xhr.addEventListener('timeout', () => {
          reject(new Error('Upload failed - timeout'))
        })
        
        xhr.open('POST', uploadUrl)
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.setRequestHeader('Cache-Control', 'max-age=3600')
        xhr.timeout = 5 * 60 * 1000 // 5 minute timeout
        
        xhr.send(file)
      })
    } catch (error) {
      uploadError = {
        message: error instanceof Error ? error.message : 'Upload failed'
      }
    }

    if (uploadError) {
      console.error('Storage upload error:', {
        error: uploadError,
        message: uploadError.message,
        statusCode: (uploadError as any).statusCode,
        details: (uploadError as any).details,
        hint: (uploadError as any).hint,
        code: (uploadError as any).code
      })
      
      // Check if it's a 413 error (payload too large)
      if (uploadError.message?.includes('413') || 
          uploadError.message?.toLowerCase().includes('payload too large') ||
          (uploadError as any).statusCode === 413) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
        return { 
          success: false, 
          error: `File size (${sizeMB}MB) exceeds server limits. Please try a smaller file or contact support.` 
        }
      }
      
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