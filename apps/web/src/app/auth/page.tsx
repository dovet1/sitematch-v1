'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { AuthLeftRail } from '@/components/auth/auth-left-rail'
import { AuthFormSignIn } from '@/components/auth/auth-form-signin'
import { AuthFormSignUp } from '@/components/auth/auth-form-signup'

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()

  const modeParam = searchParams?.get('mode')
  const returnUrl = searchParams?.get('returnUrl')

  const [mode, setMode] = useState<'signin' | 'signup'>(
    modeParam === 'signup' ? 'signup' : 'signin'
  )

  // Sync mode with URL parameter
  useEffect(() => {
    if (modeParam === 'signup' || modeParam === 'signin') {
      setMode(modeParam)
    }
  }, [modeParam])

  // Redirect authenticated users
  useEffect(() => {
    if (!loading && user) {
      const destination = returnUrl && returnUrl.startsWith('/') ? returnUrl : '/new-dashboard'
      router.push(destination)
    }
  }, [user, loading, returnUrl, router])

  const handleModeSwitch = (newMode: 'signin' | 'signup') => {
    setMode(newMode)
    const params = new URLSearchParams()
    params.set('mode', newMode)
    if (returnUrl) {
      params.set('returnUrl', returnUrl)
    }
    router.push(`/auth?${params.toString()}`, { scroll: false })
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="h-[calc(100dvh-4rem)] overflow-hidden flex items-center justify-center bg-[#FBFAF7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[#7033FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] text-[#7C7588] font-inter">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100dvh-4rem)] bg-white overflow-hidden">
      <div className="grid lg:grid-cols-2 h-full min-h-0">
        {/* Left Rail - Editorial Content */}
        <AuthLeftRail mode={mode} />

        {/* Right Column - Form */}
        <div className="flex flex-col justify-center p-6 lg:py-8 lg:px-12 bg-white min-h-0">
          {/* Form Content */}
          {mode === 'signin' ? (
            <AuthFormSignIn
              returnUrl={returnUrl || undefined}
              onSwitchMode={() => handleModeSwitch('signup')}
            />
          ) : (
            <AuthFormSignUp
              returnUrl={returnUrl || undefined}
              onSwitchMode={() => handleModeSwitch('signin')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="h-[calc(100dvh-4rem)] overflow-hidden flex items-center justify-center bg-[#FBFAF7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[#7033FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] text-[#7C7588] font-inter">Loading...</p>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  )
}
