'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, X, Star, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'

interface PaywallModalProps {
  children?: React.ReactNode
  context: 'search' | 'sitesketcher' | 'agency' | 'general'
  isOpen?: boolean
  onClose?: () => void
  redirectTo?: string
  variant?: 'modal' | 'fullscreen'
}

const contextConfig = {
  search: {
    headline: 'Access 1000+ Property Requirements',
    subtext: 'Connect directly with qualified occupiers actively seeking space',
    cta: 'Start Free Trial - View Requirements',
    testimonial: {
      quote: 'Found our perfect warehouse in 2 weeks through SiteMatcher',
      author: 'Sarah K., Logistics Director',
      rating: 5
    }
  },
  sitesketcher: {
    headline: 'Access SiteSketcher Pro Tools',
    subtext: 'Advanced property assessment and visualization tools for commercial real estate professionals',
    cta: 'Start Free Trial - Access SiteSketcher',
    testimonial: {
      quote: 'SiteSketcher saved us hours of manual site analysis - invaluable for property evaluation',
      author: 'Emma C., Development Manager',
      rating: 5
    }
  },
  agency: {
    headline: 'Showcase Properties to Active Buyers',
    subtext: 'Connect your listings with pre-qualified occupiers',
    cta: 'Start Free Trial - Create Agency Profile',
    testimonial: {
      quote: 'Our properties get 3x more qualified leads through SiteMatcher',
      author: 'David P., Senior Partner',
      rating: 5
    }
  },
  general: {
    headline: 'Unlock Full Access',
    subtext: 'Access premium features and professional tools',
    cta: 'Start Free Trial - No Charge',
    testimonial: {
      quote: 'Game-changer for our property search process',
      author: 'Mike T., Facilities Manager',
      rating: 5
    }
  }
}

export function PaywallModal({
  children,
  context,
  isOpen: controlledOpen,
  onClose,
  redirectTo,
  variant = 'modal'
}: PaywallModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()
  const router = useRouter()

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const config = contextConfig[context]

  const handleOpenChange = (newOpen: boolean) => {
    if (controlledOpen !== undefined && onClose) {
      onClose()
    } else {
      setInternalOpen(newOpen)
    }
  }

  const handleStartTrial = async () => {
    if (!user) {
      // This shouldn't happen, but redirect to pricing if no user
      router.push('/pricing')
      return
    }

    setIsLoading(true)

    try {
      // Create Stripe checkout session for existing user
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userType: context,
          redirectPath: redirectTo
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
      alert('Sorry, there was an error starting your trial. Please try again or contact support.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewFeatures = () => {
    router.push('/pricing')
    handleOpenChange(false)
  }

  const handleContinueToFree = () => {
    router.push('/occupier/dashboard')
    handleOpenChange(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {children && (
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-0 bg-white shadow-2xl">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <DialogHeader className="space-y-3 text-center">
              <div className="mx-auto w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <DialogTitle className="text-xl font-bold text-white">
                {config.headline}
              </DialogTitle>
              <DialogDescription className="text-blue-100 text-sm max-w-md mx-auto">
                {config.subtext}
              </DialogDescription>
            </DialogHeader>

            {/* Pricing highlight */}
            <div className="text-center mt-4 p-3 bg-white/10 backdrop-blur-sm rounded-lg">
              <div className="text-lg font-semibold">£975/year - 30 days free</div>
              <div className="text-xs text-blue-100">Add payment method, cancel anytime</div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Primary CTA */}
            <Button
              onClick={handleStartTrial}
              disabled={isLoading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {isLoading ? (
                'Loading...'
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  {config.cta}
                </>
              )}
            </Button>

            {/* Secondary CTA */}
            <Button
              variant="outline"
              onClick={handleViewFeatures}
              className="w-full h-10"
            >
              View All Features
            </Button>

            {/* Testimonial */}
            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-start space-x-3">
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    {[...Array(config.testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-sm text-gray-700 italic">
                    "{config.testimonial.quote}"
                  </blockquote>
                  <cite className="text-xs text-gray-500 mt-1 block">
                    - {config.testimonial.author}
                  </cite>
                </div>
              </div>
            </div>

            {/* Tertiary option */}
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleContinueToFree}
                className="text-gray-500 hover:text-gray-700"
              >
                Continue to Free Features
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Add payment method, cancel anytime before trial ends
            </p>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}