'use client'

export function PreviewBanner() {
  return (
    <div className="bg-yellow-100 border-b-4 border-yellow-400 py-4 sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👁️</span>
            <div>
              <p className="font-bold text-yellow-900">Preview Mode</p>
              <p className="text-sm text-yellow-800">
                This is how your article will look when published
              </p>
            </div>
          </div>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-yellow-900 text-white rounded-lg hover:bg-yellow-800 transition-colors font-semibold"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  )
}
