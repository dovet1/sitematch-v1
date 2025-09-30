'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'

interface SubscriptionAccess {
  hasAccess: boolean
  loading: boolean
  error: string | null
}

export function useSubscriptionAccess(): SubscriptionAccess {
  const { user, loading: authLoading } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkAccess() {
      if (authLoading) return

      if (!user) {
        setHasAccess(false)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/subscription/check', {
          method: 'GET',
          credentials: 'include'
        })

        if (!response.ok) {
          throw new Error('Failed to check subscription status')
        }

        const data = await response.json()
        setHasAccess(data.hasAccess)
      } catch (err) {
        console.error('Error checking subscription access:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [user, authLoading])

  return { hasAccess, loading, error }
}