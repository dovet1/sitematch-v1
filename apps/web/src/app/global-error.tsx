'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '4rem', fontWeight: 'bold', marginBottom: '1rem' }}>Error</h1>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h2>
            <p style={{ marginBottom: '2rem', color: '#666' }}>
              We're sorry, but something unexpected happened.
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1rem',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '0.25rem',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
