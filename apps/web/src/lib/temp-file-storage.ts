/**
 * Temporary File Storage Utility
 * 
 * Handles file uploads to Supabase Storage without immediately inserting into database.
 * Files are stored temporarily and database records are created later when listing exists.
 */

import { createClientClient } from '@/lib/supabase'

export interface TempFileUpload {
  id: string
  name: string
  path: string
  url: string
  size: number
  mimeType: string
  type: 'logo' | 'brochure' | 'sitePlan' | 'fitOut' | 'headshot'
  uploadedAt: Date
}

export interface TempUploadOptions {
  file: File
  fileType: 'logo' | 'brochure' | 'sitePlan' | 'fitOut' | 'headshot'
  userId: string
  onProgress?: (progress: number) => void
}

export interface TempUploadResult {
  success: boolean
  file?: TempFileUpload
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
 * Upload file to Supabase Storage only (no database record yet)
 */
export async function uploadFileTemporary({
  file,
  fileType,
  userId,
  onProgress
}: TempUploadOptions): Promise<TempUploadResult> {
  try {
    const supabase = createClientClient()
    
    console.log('Temporary upload attempt:', {
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
    const folderName = `temp_${userId}` // Use temp folder for user
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${folderName}/${timestamp}-${sanitizedFileName}`

    // Upload to Supabase Storage with progress tracking
    let uploadData: any = null
    
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
      console.error('Storage upload error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path)

    // Return temporary file info (no database record yet)
    return {
      success: true,
      file: {
        id: crypto.randomUUID(), // Generate temporary ID
        name: file.name,
        path: uploadData.path,
        url: urlData.publicUrl,
        size: file.size,
        mimeType: file.type,
        type: fileType,
        uploadedAt: new Date()
      }
    }
  } catch (error) {
    console.error('Temporary upload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}

/**
 * Delete temporary file from storage only
 */
export async function deleteTempFile(
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
      console.error('Temporary file deletion error:', storageError)
      return { success: false, error: storageError.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete temporary file error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed'
    }
  }
}

/**
 * Clean up temporary files for a user (call this periodically or on error)
 */
export async function cleanupTempFiles(userId: string): Promise<void> {
  try {
    const supabase = createClientClient()
    const folderName = `temp_${userId}`

    // List all buckets and clean up temp files
    for (const bucket of Object.values(BUCKET_MAP)) {
      try {
        const { data: files } = await supabase.storage
          .from(bucket)
          .list(folderName)

        if (files && files.length > 0) {
          const filePaths = files.map(f => `${folderName}/${f.name}`)
          await supabase.storage.from(bucket).remove(filePaths)
        }
      } catch (error) {
        console.warn(`Failed to clean up temp files in ${bucket}:`, error)
      }
    }
  } catch (error) {
    console.error('Cleanup temp files error:', error)
  }
}