'use client'

import type { ImportExecuteResponse } from '@/types/store-import'

interface CompleteSectionProps {
  data: ImportExecuteResponse
  onReset: () => void
  onRunRealImport: () => void
}

export function CompleteSection({
  data,
  onReset,
  onRunRealImport
}: CompleteSectionProps) {
  const handleDownloadErrorReport = () => {
    const allIssues = [...data.skippedRows, ...data.blockedRows]
    const csvContent = [
      'Row Number,Severity,Type,Message,Field,Suggestion',
      ...allIssues.map(issue =>
        [
          issue.rowNumber,
          issue.severity,
          issue.type,
          `"${issue.message}"`,
          issue.field || '',
          issue.suggestion ? `"${issue.suggestion}"` : ''
        ].join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import-error-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Success Header */}
      <div className={`border rounded-lg p-8 ${
        data.isDryRun
          ? 'bg-blue-50 border-blue-200'
          : 'bg-green-50 border-green-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
            data.isDryRun ? 'bg-blue-100' : 'bg-green-100'
          }`}>
            <svg
              className={`w-7 h-7 ${
                data.isDryRun ? 'text-blue-600' : 'text-green-600'
              }`}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {data.isDryRun ? (
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              ) : (
                <path d="M5 13l4 4L19 7" />
              )}
            </svg>
          </div>
          <div className="flex-1">
            <h2 className={`text-2xl font-bold ${
              data.isDryRun ? 'text-blue-900' : 'text-green-900'
            }`}>
              {data.isDryRun
                ? 'Dry Run Complete - No Data Inserted'
                : 'Import Complete!'}
            </h2>
            <p className={`mt-2 ${
              data.isDryRun ? 'text-blue-700' : 'text-green-700'
            }`}>
              {data.isDryRun
                ? 'This shows EXACTLY what will happen in a real import'
                : 'Stores have been imported successfully.'}
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
              <p className="text-sm text-gray-600">
                {data.isDryRun ? 'Would import' : 'Stores imported'}
              </p>
            </div>
          </div>
        </div>

        {/* Skipped Count */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-yellow-600"
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
              <p className="text-2xl font-bold text-gray-900">{data.skippedCount}</p>
              <p className="text-sm text-gray-600">
                {data.isDryRun ? 'Would skip' : 'Rows skipped'} (duplicates)
              </p>
            </div>
          </div>
        </div>

        {/* Blocked Count */}
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
              <p className="text-2xl font-bold text-gray-900">{data.blockedCount}</p>
              <p className="text-sm text-gray-600">
                {data.isDryRun ? 'Would block' : 'Rows blocked'} (errors)
              </p>
            </div>
          </div>
        </div>

        {/* Entity Changes */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              {data.isDryRun ? 'Would create:' : 'Created:'}
            </p>
            <div className="space-y-1 text-sm text-gray-600">
              <p>{data.brandsCreated} brand{data.brandsCreated !== 1 ? 's' : ''}</p>
              <p>{data.fasciasCreated} fascia{data.fasciasCreated !== 1 ? 's' : ''}</p>
              <p>{data.categoriesCreated} categor{data.categoriesCreated !== 1 ? 'ies' : 'y'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rebuild Status */}
      {!data.isDryRun && data.rebuildTriggered && (
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
                {data.rebuildMessage || 'BUA summary tables are being rebuilt. Data will be available in the Gap Analysis tool in 5-10 minutes.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Report */}
      {(data.skippedCount > 0 || data.blockedCount > 0) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Issues Summary</h3>
          <div className="space-y-3 text-sm">
            {data.skippedCount > 0 && (
              <p className="text-yellow-700">
                {data.skippedCount} row{data.skippedCount !== 1 ? 's were' : ' was'} skipped
                due to duplicates (within 50m of existing store with same brand/fascia)
              </p>
            )}
            {data.blockedCount > 0 && (
              <p className="text-red-700">
                {data.blockedCount} row{data.blockedCount !== 1 ? 's were' : ' was'} blocked
                due to validation errors (see error report for details)
              </p>
            )}
            <button
              onClick={handleDownloadErrorReport}
              className="text-blue-600 hover:text-blue-700 underline"
            >
              Download Full Error Report (CSV)
            </button>
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

        {data.isDryRun && (
          <button
            onClick={onRunRealImport}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Run Real Import
          </button>
        )}
      </div>
    </div>
  )
}
