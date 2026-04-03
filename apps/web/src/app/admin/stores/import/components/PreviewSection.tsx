'use client'

import { useState } from 'react'
import type { ImportPreviewResponse } from '@/types/store-import'
import { ValidationSummary } from './ValidationSummary'
import { PreviewTable } from './PreviewTable'

interface PreviewSectionProps {
  data: ImportPreviewResponse
  onExecute: (isDryRun: boolean) => void
  onCancel: () => void
  isLoading: boolean
}

export function PreviewSection({
  data,
  onExecute,
  onCancel,
  isLoading
}: PreviewSectionProps) {
  const [showDryRun, setShowDryRun] = useState(false)

  const handleDownloadErrorReport = () => {
    const allIssues = [...data.errors, ...data.warnings, ...data.infos]
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
    <div className="space-y-6">
      {/* Validation Summary */}
      <ValidationSummary data={data} onDownloadReport={handleDownloadErrorReport} />

      {/* Preview Table */}
      <PreviewTable data={data} />

      {/* Action Buttons */}
      <div className="flex items-center justify-between border-t pt-6">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>

        <div className="flex items-center gap-4">
          {/* Dry Run Checkbox */}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showDryRun}
              onChange={(e) => setShowDryRun(e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Run Dry Run First</span>
            <span className="text-gray-500">(test without inserting data)</span>
          </label>

          <button
            onClick={() => onExecute(showDryRun)}
            disabled={isLoading || !data.canProceed}
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
                Processing...
              </span>
            ) : showDryRun ? (
              'Run Dry Run'
            ) : (
              'Confirm Import'
            )}
          </button>
        </div>
      </div>

      {!data.canProceed && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            Cannot proceed: All rows have errors. Please fix the CSV and try again.
          </p>
        </div>
      )}
    </div>
  )
}
