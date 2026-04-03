'use client'

interface ProgressSectionProps {
  isDryRun: boolean
}

export function ProgressSection({ isDryRun }: ProgressSectionProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <div className="text-center space-y-6">
          {/* Animated Spinner */}
          <div className="mx-auto w-16 h-16 relative">
            <svg
              className="animate-spin w-16 h-16 text-blue-600"
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
          </div>

          {/* Title */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isDryRun ? 'Running Dry Run...' : 'Processing Import...'}
            </h2>
            <p className="text-gray-600 mt-2">
              {isDryRun
                ? 'Testing the import without inserting data. This may take a few minutes.'
                : 'Importing stores and updating summary tables. This may take a few minutes.'}
            </p>
          </div>

          {/* Progress Steps */}
          <div className="bg-gray-50 rounded-lg p-6 text-left space-y-3">
            <div className="flex items-center gap-3 text-gray-700">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              <span>Validating rows...</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              <span>Geocoding addresses (if needed)...</span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
              <span>Checking for duplicates...</span>
            </div>
            {!isDryRun && (
              <>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  <span>Inserting stores...</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                  <span>Triggering data rebuild...</span>
                </div>
              </>
            )}
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Please do not close this window. The process will complete shortly.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
