'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { AuthLeftRail } from '@/components/auth/auth-left-rail'
import { AuthFormSignIn } from '@/components/auth/auth-form-signin'
import { AuthFormSignUp } from '@/components/auth/auth-form-signup'

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()

  const modeParam = searchParams.get('mode')
  const returnUrl = searchParams.get('returnUrl')

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
      <div className="min-h-screen flex items-center justify-center bg-[#FBFAF7]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[#7033FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] text-[#7C7588] font-inter">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Left Rail - Editorial Content */}
        <AuthLeftRail mode={mode} />

        {/* Right Column - Form */}
        <div className="flex flex-col p-6 lg:py-8 lg:px-12 bg-white overflow-y-auto">
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
