'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { UserRole } from '@/types/auth'
import { LoginModal } from './login-modal'
import { Button } from '@/components/ui/button'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole | UserRole[]
  fallback?: React.ReactNode
  redirectTo?: string
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  fallback,
  redirectTo = '/unauthorized'
}: ProtectedRouteProps) {
  const { user, profile, loading, hasRole } = useAuth()
  const router = useRouter()
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        setShowFallback(true)
        return
      }

      if (requiredRole && !hasRole(requiredRole)) {
        router.push(redirectTo)
        return
      }

      setShowFallback(false)
    }
  }, [user, profile, loading, requiredRole, hasRole, router, redirectTo])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (showFallback) {
    return fallback || <DefaultAuthFallback />
  }

  return <>{children}</>
}

function DefaultAuthFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md mx-auto p-6">
        <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
        <p className="text-muted-foreground mb-6">
          You need to sign in to access this page.
        </p>
        <LoginModal>
          <Button>Sign In</Button>
        </LoginModal>
      </div>
    </div>
  )
}

export function RequireAuth({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <ProtectedRoute fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}

export function RequireRole({ 
  children, 
  role, 
  fallback 
}: { 
  children: React.ReactNode
  role: UserRole | UserRole[]
  fallback?: React.ReactNode 
}) {
  return (
    <ProtectedRoute requiredRole={role} fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}

export function RequireAdmin({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="admin" fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}