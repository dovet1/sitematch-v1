'use client'

import { useState } from 'react'
import type { UploadResponse } from '@/types/store-import'
import { FileUploadSection } from './components/FileUploadSection'
import { ProgressSection } from './components/ProgressSection'
import { CompleteSection } from './components/CompleteSection'

type ImportStage = 'upload' | 'processing' | 'complete'

export default function StoreImportPage() {
  const [stage, setStage] = useState<ImportStage>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
  }

  const handleUpload = async () => {
    if (!file) return

    setIsLoading(true)
    setError(null)
    setStage('processing')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/stores/import/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process import')
      }

      const data: UploadResponse = await response.json()
      setUploadData(data)
      setStage('complete')
    } catch (err: any) {
      setError(err.message)
      setStage('upload') // Go back to upload on error
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setStage('upload')
    setFile(null)
    setUploadData(null)
    setError(null)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Import Stores</h1>
        <p className="text-gray-600">
          Upload a CSV file to validate and import store data in one step. Valid rows are
          inserted immediately; failed rows are skipped and returned in a downloadable CSV.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {stage === 'upload' && (
        <FileUploadSection
          onFileSelect={handleFileSelect}
          onUpload={handleUpload}
          file={file}
          isLoading={isLoading}
        />
      )}

      {stage === 'processing' && (
        <ProgressSection />
      )}

      {stage === 'complete' && uploadData && (
        <CompleteSection
          data={uploadData}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
