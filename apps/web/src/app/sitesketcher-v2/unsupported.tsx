'use client';

export default function UnsupportedViewport() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-sm-bg p-8">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-full bg-sm-violet-tint-soft">
          <svg
            className="w-8 h-8 text-sm-violet"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-sm-ink mb-3">
          Desktop or Tablet Required
        </h1>

        <p className="text-base text-sm-ink/70 mb-6 leading-relaxed">
          SiteSketcher v2 is optimized for larger screens. Please access this tool from a
          desktop computer or tablet in landscape mode (minimum 1024px width).
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-sm-violet text-white rounded-lg font-medium hover:bg-sm-violet/90 transition-colors"
          >
            Return to Home
          </a>

          <a
            href="/sitesketcher"
            className="inline-flex items-center justify-center px-6 py-3 border border-sm-border bg-sm-surface text-sm-ink rounded-lg font-medium hover:bg-sm-bg transition-colors"
          >
            Try SiteSketcher v1
          </a>
        </div>

        <div className="mt-8 p-4 bg-sm-surface border border-sm-border rounded-lg text-left">
          <h2 className="text-sm font-semibold text-sm-ink mb-2">Why desktop/tablet?</h2>
          <p className="text-xs text-sm-ink/70 leading-relaxed">
            SiteSketcher v2 includes advanced features like polygon drawing with 90° snapping,
            CAD overlay calibration, and multi-panel workflows that require precision and screen
            real estate for the best experience.
          </p>
        </div>
      </div>
    </div>
  );
}
