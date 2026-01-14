'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'

function PostHogAuthIdentifier() {
  const { user, profile } = useAuth()

  useEffect(() => {
    if (user && profile) {
      // Identify the user in PostHog with their details
      posthog.identify(user.id, {
        email: profile.email,
        role: profile.role,
        user_type: profile.user_type,
        company_name: profile.user_company_name,
        subscription_status: profile.subscription_status,
      })
    } else if (!user) {
      // Reset PostHog when user logs out
      posthog.reset()
    }
  }, [user, profile])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
      const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

      if (apiKey) {
        posthog.init(apiKey, {
          api_host: apiHost,
          capture_pageview: true,
          capture_pageleave: true,
          autocapture: true,
        })
      }
    }
  }, [])

  return (
    <PHProvider client={posthog}>
      <PostHogAuthIdentifier />
      {children}
    </PHProvider>
  )
}
