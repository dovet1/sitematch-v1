'use client'

import type { UploadResponse } from '@/types/store-import'

interface CompleteSectionProps {
  data: UploadResponse
  onReset: () => void
}

export function CompleteSection({ data, onReset }: CompleteSectionProps) {
  const handleDownloadFailedStores = () => {
    if (!data.failedStoresCSV || data.failedStoresCSV.length === 0) return

    const blob = new Blob([data.failedStoresCSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    a.download = `failed-stores-${timestamp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Success Header */}
      <div className="border rounded-lg p-8 bg-green-50 border-green-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg
              className="w-7 h-7 text-green-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-green-900">
              Import Complete!
            </h2>
            <p className="mt-2 text-green-700">
              {data.insertedCount > 0
                ? `Successfully imported ${data.insertedCount} store${data.insertedCount !== 1 ? 's' : ''}.`
                : 'No stores were imported.'}
              {data.failedCount > 0 && ` ${data.failedCount} store${data.failedCount !== 1 ? 's' : ''} failed validation.`}
            </p>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Imported Count */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.insertedCount}</p>
              <p className="text-sm text-gray-600">Stores imported</p>
            </div>
          </div>
        </div>

        {/* Failed Count */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.failedCount}</p>
              <p className="text-sm text-gray-600">Stores failed validation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rebuild Status */}
      {data.rebuildTriggered && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 animate-spin flex-shrink-0"
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
            <div>
              <p className="font-semibold text-blue-900">Data Rebuild in Progress</p>
              <p className="text-sm text-blue-700 mt-1">
                BUA summary tables are being rebuilt. Data will be available in the Gap Analysis tool in 5-10 minutes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Successful Stores List */}
      {data.successfulStores.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Successfully Imported Stores</h3>
          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2">
              {data.successfulStores.slice(0, 50).map((store, index) => (
                <div key={index} className="text-sm py-2 px-3 bg-gray-50 rounded border border-gray-100">
                  <div className="font-medium text-gray-900">{store.name}</div>
                  <div className="text-gray-600 text-xs mt-0.5">
                    {store.address} • {store.brand} ({store.fascia}) • {store.category}
                  </div>
                </div>
              ))}
              {data.successfulStores.length > 50 && (
                <p className="text-sm text-gray-500 italic py-2">
                  ... and {data.successfulStores.length - 50} more stores
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Failed Stores Section */}
      {data.failedCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="font-semibold text-red-900 mb-4">Failed Stores</h3>
          <div className="space-y-3 text-sm">
            <p className="text-red-800">
              {data.failedCount} store{data.failedCount !== 1 ? 's' : ''} could not be imported due to validation issues:
            </p>
            <ul className="list-disc list-inside text-red-700 space-y-1 text-xs">
              <li>Missing required fields</li>
              <li>Invalid coordinates (outside UK bounds)</li>
              <li>Geocoding failed</li>
              <li>Distance validation failed (≥10 meters between Mapbox and Google)</li>
              <li>Category conflicts</li>
              <li>Google Places validation errors</li>
            </ul>
            <div className="pt-3">
              <button
                onClick={handleDownloadFailedStores}
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Download Failed Stores CSV
              </button>
              <p className="text-xs text-red-700 mt-2">
                The CSV includes all original columns plus: failure_reason, mapbox_lat, mapbox_lon, google_lat, google_lon
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t pt-6">
        <div className="flex gap-3">
          <button
            onClick={onReset}
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Import More Stores
          </button>
          <a
            href="/admin"
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Return to Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
