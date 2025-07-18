'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Loader2 } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  fallback?: React.ReactNode
}

export function AuthGuard({ children, requireAuth = true, fallback }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    if (!loading && requireAuth && !user && !isRedirecting) {
      setIsRedirecting(true)
      // Capture current URL including search params
      const currentUrl = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
      const encodedRedirect = encodeURIComponent(currentUrl)
      router.push(`/auth/signup?redirect=${encodedRedirect}`)
    }
  }, [user, loading, requireAuth, pathname, searchParams, router, isRedirecting])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (requireAuth && !user) {
    return fallback || (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <h2 className="text-2xl font-semibold mb-2">Authentication Required</h2>
        <p className="text-muted-foreground">Redirecting to sign up...</p>
      </div>
    )
  }

  return <>{children}</>
}