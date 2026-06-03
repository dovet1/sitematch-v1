'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Building2 } from 'lucide-react'
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
  const { user } = useAuth()
  const { hasAccess } = useSubscriptionAccess()
  const router = useRouter()

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

  // User is authenticated and has subscription - show agency creation modal
  if (user && hasAccess) {
    return (
      <AgencyCreationModal>
        {agencyButton}
      </AgencyCreationModal>
    )
  }

  // For users without auth or subscription, navigate to auth/pricing flow
  return (
    <Button
      className={className}
      size={size}
      variant={variant}
      onClick={() => {
        if (!user) {
          router.push('/auth?mode=signup&returnUrl=/pricing')
        } else if (!hasAccess) {
          router.push('/pricing')
        }
      }}
    >
      {children || (
        <>
          <Building2 className="mr-2 h-5 w-5" />
          Create Agency Profile
        </>
      )}
    </Button>
  )
}
