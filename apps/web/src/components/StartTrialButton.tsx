'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier'

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
  const { user } = useAuth()
  const { hasProAccess } = useSubscriptionTier()
  const router = useRouter()

  const handleClick = () => {
    if (!user) {
      router.push('/auth?mode=signup&returnUrl=/pricing')
    } else if (!hasProAccess) {
      router.push('/pricing')
    } else {
      router.push(redirectPath || '/search')
    }
  }

  return (
    <Button
      onClick={handleClick}
      className={`bg-blue-600 hover:bg-blue-700 ${className}`}
      size={size}
    >
      <Zap className="mr-2 h-5 w-5" />
      Start Free Trial
    </Button>
  )
}
