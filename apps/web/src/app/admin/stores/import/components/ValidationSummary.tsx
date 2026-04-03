'use client'

import type { ImportPreviewResponse } from '@/types/store-import'

interface ValidationSummaryProps {
  data: ImportPreviewResponse
  onDownloadReport: () => void
}

export function ValidationSummary({ data, onDownloadReport }: ValidationSummaryProps) {
  const hasIssues = data.errors.length > 0 || data.warnings.length > 0 || data.infos.length > 0

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Valid Rows */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
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
              <p className="text-2xl font-bold text-green-900">{data.validRows}</p>
              <p className="text-sm text-green-700">Valid rows (will import)</p>
            </div>
          </div>
        </div>

        {/* Total Rows */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-900">{data.totalRows}</p>
              <p className="text-sm text-blue-700">Total rows in CSV</p>
            </div>
          </div>
        </div>

        {/* Rows with Issues */}
        <div className={`border rounded-lg p-4 ${
          data.rowsWithIssues > 0
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              data.rowsWithIssues > 0
                ? 'bg-yellow-100'
                : 'bg-gray-100'
            }`}>
              <svg
                className={`w-6 h-6 ${
                  data.rowsWithIssues > 0 ? 'text-yellow-600' : 'text-gray-400'
                }`}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className={`text-2xl font-bold ${
                data.rowsWithIssues > 0 ? 'text-yellow-900' : 'text-gray-700'
              }`}>
                {data.rowsWithIssues}
              </p>
              <p className={`text-sm ${
                data.rowsWithIssues > 0 ? 'text-yellow-700' : 'text-gray-500'
              }`}>
                Rows with issues
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Entity Changes */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Entity Changes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          {/* Brands */}
          <div>
            <p className="font-medium text-gray-700 mb-2">Brands</p>
            <div className="space-y-1">
              {data.newBrands.length > 0 && (
                <p className="text-green-700">
                  New: {data.newBrands.length}
                  {data.newBrands.length <= 5 && (
                    <span className="text-xs ml-1">({data.newBrands.join(', ')})</span>
                  )}
                </p>
              )}
              {data.existingBrands.length > 0 && (
                <p className="text-gray-600">
                  Existing: {data.existingBrands.length}
                </p>
              )}
            </div>
          </div>

          {/* Fascias */}
          <div>
            <p className="font-medium text-gray-700 mb-2">Fascias</p>
            <div className="space-y-1">
              {data.newFascias.length > 0 && (
                <p className="text-green-700">
                  New: {data.newFascias.length}
                  {data.newFascias.length <= 5 && (
                    <span className="text-xs ml-1">({data.newFascias.join(', ')})</span>
                  )}
                </p>
              )}
              {data.existingFascias.length > 0 && (
                <p className="text-gray-600">
                  Existing: {data.existingFascias.length}
                </p>
              )}
            </div>
          </div>

          {/* Categories */}
          <div>
            <p className="font-medium text-gray-700 mb-2">Categories</p>
            <div className="space-y-1">
              {data.newCategories.length > 0 && (
                <p className="text-green-700">
                  New: {data.newCategories.length}
                  {data.newCategories.length <= 5 && (
                    <span className="text-xs ml-1">({data.newCategories.join(', ')})</span>
                  )}
                </p>
              )}
              {data.existingCategories.length > 0 && (
                <p className="text-gray-600">
                  Existing: {data.existingCategories.length}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Issues Breakdown */}
      {hasIssues && (
        <div className="space-y-3">
          {/* Errors */}
          {data.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold text-red-900">
                    {data.errors.length} Error{data.errors.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    These rows will be blocked and won't be imported
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold text-yellow-900">
                    {data.warnings.length} Warning{data.warnings.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Please verify these are intentional before proceeding
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Infos */}
          {data.infos.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
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
                <div className="flex-1">
                  <p className="font-semibold text-blue-900">
                    {data.infos.length} Notice{data.infos.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Informational messages about the import
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Download Error Report Button */}
          <div className="flex justify-end">
            <button
              onClick={onDownloadReport}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Download Full Error Report (CSV)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
