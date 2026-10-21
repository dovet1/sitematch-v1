'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'

// A stable link to the Stripe customer portal, for emails (the trial reminder) and anywhere a
// plain URL is needed. Signs the user in first if they need it.
export default function BillingRedirectPage() {
  const { user, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      window.location.replace(`/auth?mode=signin&returnUrl=${encodeURIComponent('/account/billing')}`)
      return
    }
    let cancelled = false
    fetch('/api/stripe/create-portal-session', { method: 'POST' })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { url?: string; message?: string; error?: string } | null
        if (cancelled) return
        if (res.ok && body?.url) window.location.replace(body.url)
        else setError(body?.message || body?.error || 'We could not open billing.')
      })
      .catch(() => !cancelled && setError('We could not open billing.'))
    return () => {
      cancelled = true
    }
  }, [user, loading])

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-sm-bg px-6">
      <div className="max-w-md text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-sm-ink">{error}</h1>
            <p className="mt-2 text-sm text-sm-ink2">
              Email <a className="text-sm-violet" href="mailto:rob@sitematcher.co.uk">rob@sitematcher.co.uk</a> and we&apos;ll sort it out, or{' '}
              <Link className="text-sm-violet" href="/">go back home</Link>.
            </p>
          </>
        ) : (
          <p className="text-sm text-sm-ink2">Opening billing…</p>
        )}
      </div>
    </div>
  )
}
