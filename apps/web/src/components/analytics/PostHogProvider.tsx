'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
      const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

      if (apiKey) {
        posthog.init(apiKey, {
          api_host: apiHost,
          capture_pageviews: true,
          capture_pageleave: true,
          autocapture: true,
        })
      }
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
