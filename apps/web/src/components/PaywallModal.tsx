'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, X, Star, ArrowRight } from 'lucide-react'
import Image from 'next/image'
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
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier'
import { getModalPricing } from '@/data/homepage-new/constants'

interface PaywallModalProps {
  children?: React.ReactNode
  context: 'search' | 'sitesketcher' | 'agency' | 'gapfinder' | 'general'
  isOpen?: boolean
  onClose?: () => void
  redirectTo?: string
  variant?: 'modal' | 'fullscreen'
  tier?: 'pro' | 'plus'  // NEW: defaults to 'pro'
  secondaryCTA?: { label: string; href: string }  // NEW
}

const contextConfig = {
  search: {
    headline: 'Access 8000+ Property Requirements',
    subtext: 'Connect directly with qualified occupiers actively seeking space',
    cta: 'Start Free Trial - View Requirements',
    testimonial: {
      quote: 'With SiteMatcher I can see the market in seconds. It\'s easily the fastest way I\'ve found to spot real opportunities.',
      author: 'Kerry Northfold, Director, Vedra Property',
      rating: 5
    }
  },
  sitesketcher: {
    headline: 'Access SiteSketcher Pro Tools',
    subtext: 'Advanced property assessment and visualization tools for commercial real estate professionals',
    cta: 'Start Free Trial - Access SiteSketcher',
    testimonial: {
      quote: 'SiteSketcher lets me draw a quick feasibility in minutes. It\'s straightforward, simple, and saves a huge amount of time',
      author: 'Henry Foreman, Partner, FMX Urban Property Advisory',
      rating: 5
    }
  },
  agency: {
    headline: 'Add your agency profile',
    subtext: "Connect your agency to your client's requirements",
    cta: 'Start Free Trial - Create Agency Profile',
    testimonial: {
      quote: "With SiteMatcher I can see the market in seconds. It\'s easily the fastest way I\'ve found to spot real opportunities.",
      author: 'Kerry Northfold, Director, Vedra Property',
      rating: 5
    }
  },
  gapfinder: {
    headline: 'Unlock GapFinder',
    subtext: 'Find retail white space, compare markets and analyse operator coverage across the UK',
    cta: 'Start Free Trial - Use GapFinder',
    testimonial: {
      quote: 'With SiteMatcher I can see the market in seconds. It is easily the fastest way I have found to spot real opportunities.',
      author: 'Kerry Northfold, Director, Vedra Property',
      rating: 5
    }
  },
  general: {
    headline: 'Unlock Full Access',
    subtext: 'Access premium features and professional tools',
    cta: 'Start Free Trial - No Charge',
    testimonial: {
      quote: 'With SiteMatcher I can see the market in seconds. It\'s easily the fastest way I\'ve found to spot real opportunities.',
      author: 'Kerry Northfold, Director, Vedra Property',
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
  variant = 'modal',
  tier = 'pro',  // NEW: defaults to 'pro'
  secondaryCTA  // NEW
}: PaywallModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('year')  // NEW: annual default
  const { user } = useAuth()
  const router = useRouter()

  // Call hook at top level (React Rules of Hooks)
  const { subscriptionTier, hasProAccess, hasStripeSubscription } = useSubscriptionTier()

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
      // Check if user has existing Pro subscription and is upgrading to Plus
      // CRITICAL: Only upgrade if user has valid Pro access AND real Stripe subscription
      // Canceled/expired users should create new checkout session, not upgrade old subscription
      const isUpgrade = hasProAccess && subscriptionTier === 'pro' && tier === 'plus' && hasStripeSubscription

      if (isUpgrade) {
        // Pro → Plus upgrade: use upgrade endpoint
        const response = await fetch('/api/stripe/upgrade-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetTier: 'plus',
            billingInterval: billingInterval
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upgrade failed')
        }

        const { success } = await response.json()
        if (success) {
          // Redirect to feature or show success
          if (redirectTo) {
            router.push(redirectTo)
          } else {
            router.refresh()
          }
        }
      } else {
        // Free/No subscription: create new checkout session
        const response = await fetch('/api/stripe/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            tier: tier,  // Pass tier
            billingInterval: billingInterval,  // Pass interval
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
      }

    } catch (error) {
      console.error('Error starting trial:', error)
      alert('Sorry, there was an error starting your trial. Please try again or contact support.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewFeatures = () => {
    handleOpenChange(false)
    router.push('/pricing')
  }

  const handleContinueToFree = () => {
    router.push('/new-dashboard')
    handleOpenChange(false)
  }

  // Get tier-specific pricing
  // Get pricing from centralized constants
  const monthlyPricing = getModalPricing(tier, 'month')
  const annualPricing = getModalPricing(tier, 'year')
  const pricing = {
    monthly: monthlyPricing.formatted,
    annual: annualPricing.formatted,
    original: annualPricing.originalFormatted,
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
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-0 bg-white shadow-2xl !border-0 [&>button]:text-white [&>button]:hover:text-white/80">
          {/* Header */}
          <div className="relative px-4 pt-4 pb-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white">
            <DialogHeader className="space-y-2 text-center">
              <div className="mx-auto w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center mb-1">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <DialogTitle className="text-lg font-bold text-white">
                {config.headline}
              </DialogTitle>
              <DialogDescription className={`text-violet-100 text-sm max-w-md mx-auto ${context === 'agency' ? 'text-left' : ''}`}>
                {config.subtext}
              </DialogDescription>
            </DialogHeader>

            {/* Billing interval toggle */}
            <div className="flex items-center justify-center gap-2 mt-3 mb-2">
              <button
                onClick={() => setBillingInterval('year')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  billingInterval === 'year'
                    ? 'bg-white text-violet-700'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Annual <span className="ml-1 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">Save 17%</span>
              </button>
              <button
                onClick={() => setBillingInterval('month')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  billingInterval === 'month'
                    ? 'bg-white text-violet-700'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Monthly
              </button>
            </div>

            {/* Pricing highlight */}
            <div className="text-center p-2 bg-white/10 backdrop-blur-sm rounded-lg">
              {billingInterval === 'year' ? (
                <div className="text-base font-semibold">
                  <span className="line-through text-white/70">{pricing.original}</span>{' '}
                  <span className="text-white">{pricing.annual}/year</span> - 30 days free
                </div>
              ) : (
                <div className="text-base font-semibold">
                  {pricing.monthly}/month - 30 days free
                </div>
              )}
              <div className="text-xs text-violet-100">Add payment method, cancel anytime</div>
            </div>
          </div>

          <div className="px-4 py-4 space-y-4">
            {/* Primary CTA */}
            <Button
              onClick={handleStartTrial}
              disabled={isLoading}
              className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white font-medium"
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

            {/* Secondary CTA (NEW) */}
            {secondaryCTA && (
              <Button
                variant="outline"
                onClick={() => {
                  handleOpenChange(false)
                  router.push(secondaryCTA.href)
                }}
                className="w-full h-10"
              >
                {secondaryCTA.label}
              </Button>
            )}

            {/* Legacy secondary CTA for search context */}
            {context === 'search' && !secondaryCTA && (
              <Button
                variant="outline"
                onClick={handleViewFeatures}
                className="w-full h-10"
              >
                See Full Pricing Details
              </Button>
            )}

            {/* Testimonial */}
            <div className="p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-start space-x-3">
                {config.testimonial.author === 'Kerry Northfold, Director, Vedra Property' ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden relative flex-shrink-0">
                    <Image
                      src="/testimonials/kerry-northfold.jpg"
                      alt="Kerry Northfold"
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                ) : config.testimonial.author === 'Henry Foreman, Partner, FMX Urban Property Advisory' ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden relative flex-shrink-0">
                    <Image
                      src="/testimonials/henry-foreman.jpg"
                      alt="Henry Foreman"
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {config.testimonial.author.split(' ')[0][0]}{config.testimonial.author.split(' ')[1] ? config.testimonial.author.split(' ')[1][0] : ''}
                  </div>
                )}
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

            {/* Terms and Privacy */}
            <div className="text-center mt-3">
              <p className="text-xs text-gray-500">
                By continuing, you agree to our{' '}
                <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=0d60ea82-ecb7-43d4-bf2d-a3ea5a0900c6" className="underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=70f2f9d5-072f-443a-944d-39630c45252c" className="underline">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
