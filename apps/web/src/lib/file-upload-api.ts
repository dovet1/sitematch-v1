// Client-side file upload using API route
import type { FileUploadType, UploadedFile } from '@/types/uploads'

export interface UploadApiResponse {
  success: boolean
  file?: UploadedFile
  organizationId?: string
  error?: string
}

export async function uploadFileViaApi(
  file: File,
  type: FileUploadType,
  organizationId: string,
  onProgress?: (progress: number) => void,
  listingId?: string
): Promise<UploadedFile> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', type)
  
  // Mark logos and headshots as primary files for search functionality
  if (type === 'logo' || type === 'headshot') {
    formData.append('is_primary', 'true')
  }
  
  // Add listing ID if provided (for draft listing association)
  if (listingId) {
    formData.append('listingId', listingId)
  }

  // Create XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = (event.loaded / event.total) * 100
        onProgress(progress)
      }
    })

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response: UploadApiResponse = JSON.parse(xhr.responseText)
          if (response.success && response.file) {
            resolve(response.file)
          } else {
            reject(new Error(response.error || 'Upload failed'))
          }
        } catch (error) {
          reject(new Error('Invalid response format'))
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText)
          reject(new Error(errorResponse.error || `Upload failed with status ${xhr.status}`))
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }
    }

    xhr.onerror = () => {
      reject(new Error('Network error during upload'))
    }

    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  })
}

export async function uploadMultipleFilesViaApi(
  files: File[],
  type: FileUploadType,
  organizationId: string,
  onProgress?: (progress: number) => void,
  listingId?: string
): Promise<UploadedFile[]> {
  const uploadPromises = files.map((file, index) => {
    return uploadFileViaApi(file, type, organizationId || '', (fileProgress) => {
      if (onProgress) {
        // Calculate overall progress across all files
        const overallProgress = ((index + fileProgress / 100) / files.length) * 100
        onProgress(overallProgress)
      }
    }, listingId)
  })

  return Promise.all(uploadPromises)
}