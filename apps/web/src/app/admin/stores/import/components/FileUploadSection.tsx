'use client'

import { useRef, useState } from 'react'

interface FileUploadSectionProps {
  onFileSelect: (file: File) => void
  onUpload: () => void
  file: File | null
  isLoading: boolean
}

export function FileUploadSection({
  onFileSelect,
  onUpload,
  file,
  isLoading
}: FileUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      onFileSelect(selectedFile)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      onFileSelect(droppedFile)
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-6">
      {/* CSV Format Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3 text-blue-900">CSV Format Requirements</h2>
        <div className="space-y-3 text-sm text-blue-800">
          <div>
            <p className="font-medium mb-1">Required columns:</p>
            <code className="bg-white px-2 py-1 rounded text-xs">
              name, address, brand, category
            </code>
          </div>
          <div>
            <p className="font-medium mb-1">Optional columns:</p>
            <code className="bg-white px-2 py-1 rounded text-xs">
              fascia, postcode, town, suburb, county, lat, lon
            </code>
          </div>
          <div>
            <p className="font-medium mb-1">Example:</p>
            <pre className="bg-white p-3 rounded text-xs overflow-x-auto">
{`name,address,brand,category,postcode,town,lat,lon
Tesco Express Oxford,123 High St,Tesco,Grocery,OX1 1AA,Oxford,51.752,-1.258
Shell Reading,456 Bath Rd,Shell,Petrol,RG1 2BB,Reading,51.454,-0.972`}
            </pre>
          </div>
          <div className="flex items-start gap-2 mt-4">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs space-y-1">
              <p>If <strong>fascia</strong> is empty, brand name will be used as fascia</p>
              <p>If <strong>lat/lon</strong> are missing, addresses will be geocoded (max 500 rows)</p>
              <p>Coordinates must be within UK bounds (lat: 49-61, lon: -8 to 2)</p>
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          {file ? (
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(2)} KB
              </p>
              <button
                onClick={handleButtonClick}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Choose different file
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-700">
                Drop your CSV file here, or{' '}
                <button
                  onClick={handleButtonClick}
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  browse
                </button>
              </p>
              <p className="text-sm text-gray-500">Maximum file size: 10MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Button */}
      {file && (
        <div className="flex justify-end">
          <button
            onClick={onUpload}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Analyzing...
              </span>
            ) : (
              'Run Import'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
