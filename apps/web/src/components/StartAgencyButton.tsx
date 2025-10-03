'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Building2 } from 'lucide-react'
import { TrialSignupModal } from '@/components/TrialSignupModal'
import { PaywallModal } from '@/components/PaywallModal'
import { AgencyCreationModal } from '@/components/agencies/agency-creation-modal'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess'

interface StartAgencyButtonProps {
  className?: string
  size?: 'sm' | 'lg' | 'default'
  variant?: 'default' | 'outline' | 'ghost'
  children?: React.ReactNode
}

export function StartAgencyButton({
  className = '',
  size = 'lg',
  variant = 'default',
  children
}: StartAgencyButtonProps) {
  const [isSignupLoading, setIsSignupLoading] = useState(false)
  const isSignupInProgress = useRef(false)
  const { user } = useAuth()
  const { hasAccess } = useSubscriptionAccess()
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

  const agencyButton = (
    <Button
      className={className}
      size={size}
      variant={variant}
    >
      {children || (
        <>
          <Building2 className="mr-2 h-5 w-5" />
          Create Agency Profile
        </>
      )}
    </Button>
  )

  // If user is not authenticated OR signup is in progress, use TrialSignupModal
  if (!user || isSignupInProgress.current) {
    return (
      <TrialSignupModal
        context="agency"
        redirectPath="/agencies/create"
        forceOpen={isSignupInProgress.current}
        onLoadingChange={handleLoadingChange}
      >
        {agencyButton}
      </TrialSignupModal>
    )
  }

  // If user is authenticated but no subscription, use PaywallModal
  if (user && !hasAccess) {
    return (
      <PaywallModal
        context="agency"
        redirectTo="/agencies/create"
      >
        {agencyButton}
      </PaywallModal>
    )
  }

  // User is authenticated and has subscription - show agency creation modal
  return (
    <AgencyCreationModal>
      {agencyButton}
    </AgencyCreationModal>
  )
}