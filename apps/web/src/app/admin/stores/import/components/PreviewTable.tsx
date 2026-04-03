'use client'

import type { ImportPreviewResponse, CSVRow } from '@/types/store-import'

interface PreviewTableProps {
  data: ImportPreviewResponse
}

export function PreviewTable({ data }: PreviewTableProps) {
  if (data.previewRows.length === 0) {
    return null
  }

  // Get all column names from the first row
  const firstRow = data.previewRows[0].data
  const columns = Object.keys(firstRow)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">
          Preview (First {data.previewRows.length} Rows)
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">
                Row
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap">
                Status
              </th>
              {columns.map(col => (
                <th
                  key={col}
                  className="px-4 py-3 text-left font-medium text-gray-700 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.previewRows.map((row) => {
              const statusIcon =
                row.status === 'valid' ? (
                  <div className="flex items-center gap-2 text-green-700">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    Valid
                  </div>
                ) : row.status === 'warning' ? (
                  <div className="flex items-center gap-2 text-yellow-700">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Warning
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-700">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Error
                  </div>
                )

              return (
                <tr
                  key={row.rowNumber}
                  className={
                    row.status === 'error'
                      ? 'bg-red-50'
                      : row.status === 'warning'
                      ? 'bg-yellow-50'
                      : ''
                  }
                >
                  <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">
                    {row.rowNumber}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{statusIcon}</td>
                  {columns.map(col => (
                    <td
                      key={col}
                      className="px-4 py-3 text-gray-700 max-w-xs truncate"
                      title={String(row.data[col as keyof CSVRow] || '')}
                    >
                      {String(row.data[col as keyof CSVRow] || '')}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Issues Detail (Below Table) */}
      {data.previewRows.some(row => row.issues.length > 0) && (
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
          <h4 className="font-medium text-gray-900 mb-3">Issues Detail</h4>
          <div className="space-y-2">
            {data.previewRows
              .filter(row => row.issues.length > 0)
              .map(row => (
                <div key={row.rowNumber} className="text-sm">
                  <p className="font-medium text-gray-700">Row {row.rowNumber}:</p>
                  <ul className="ml-4 mt-1 space-y-1">
                    {row.issues.map((issue, idx) => (
                      <li
                        key={idx}
                        className={
                          issue.severity === 'error'
                            ? 'text-red-700'
                            : issue.severity === 'warning'
                            ? 'text-yellow-700'
                            : 'text-blue-700'
                        }
                      >
                        {issue.message}
                        {issue.suggestion && (
                          <span className="text-gray-600 ml-2">
                            ({issue.suggestion})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
