'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { AuthChoiceModal } from '@/components/auth/auth-choice-modal'
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
  const { user } = useAuth()
  const router = useRouter()

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

  // If user is not authenticated, wrap with auth modal
  if (!user) {
    return (
      <AuthChoiceModal
        redirectTo="/pricing"
        title="Start Your Free Trial"
        description="Sign in to start your 30-day free trial and access premium features"
      >
        {trialButton}
      </AuthChoiceModal>
    )
  }

  // If user is authenticated, show the trial button directly
  return trialButton
}