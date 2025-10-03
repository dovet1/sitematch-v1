'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { TrialSignupModal } from '@/components/TrialSignupModal'
import { PaywallModal } from '@/components/PaywallModal'
import { useAuth } from '@/contexts/auth-context'

interface StartTrialButtonProps {
  className?: string
  size?: 'sm' | 'lg' | 'default'
  userType?: 'searcher' | 'agency' | 'sitesketcher' | 'general'
  redirectPath?: string
}

export function StartTrialButton({
  className = '',
  size = 'lg',
  userType = 'general',
  redirectPath
}: StartTrialButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSignupLoading, setIsSignupLoading] = useState(false)
  const isSignupInProgress = useRef(false)
  const { user } = useAuth()
  const router = useRouter()

  // When signup loading starts, set the ref immediately to prevent modal switch
  const handleLoadingChange = (loading: boolean) => {
    setIsSignupLoading(loading)
    if (loading) {
      // Set ref immediately to prevent component switch on next render
      isSignupInProgress.current = true
    } else {
      // Only clear after a delay to ensure redirect happens
      setTimeout(() => {
        isSignupInProgress.current = false
      }, 1000)
    }
  }

  const handleStartTrial = async () => {
    if (!user) {
      // This shouldn't happen since we wrap with AuthChoiceModal, but just in case
      return
    }

    setIsLoading(true)

    try {
      console.log('User object:', user)
      console.log('User ID:', user.id)

      // Create Stripe checkout session
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userType,
          redirectPath
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create checkout session')
      }

      const { url } = await response.json()

      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url
      } else {
        throw new Error('No checkout URL received')
      }

    } catch (error) {
      console.error('Error starting trial:', error)

      // Show user-friendly error message
      alert('Sorry, there was an error starting your trial. Please try again or contact support.')
    } finally {
      setIsLoading(false)
    }
  }

  const trialButton = (
    <Button
      onClick={handleStartTrial}
      disabled={isLoading}
      className={`bg-blue-600 hover:bg-blue-700 ${className}`}
      size={size}
    >
      <Zap className="mr-2 h-5 w-5" />
      {isLoading ? 'Loading...' : 'Start Free Trial'}
    </Button>
  )

  // If user is not authenticated OR signup is in progress (using ref for immediate response), use TrialSignupModal
  if (!user || isSignupInProgress.current) {
    return (
      <TrialSignupModal
        context={userType === 'searcher' ? 'search' : userType === 'agency' ? 'agency' : userType === 'sitesketcher' ? 'sitesketcher' : 'general'}
        redirectPath={redirectPath}
        forceOpen={isSignupInProgress.current}
        onLoadingChange={handleLoadingChange}
      >
        {trialButton}
      </TrialSignupModal>
    )
  }

  // If user is authenticated, use PaywallModal for existing users
  return (
    <PaywallModal
      context={userType === 'searcher' ? 'search' : userType === 'agency' ? 'agency' : userType === 'sitesketcher' ? 'sitesketcher' : 'general'}
      redirectTo={redirectPath}
    >
      {trialButton}
    </PaywallModal>
  )
}