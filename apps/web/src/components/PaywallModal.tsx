'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Check, X, Zap } from 'lucide-react'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
  userType?: 'searcher' | 'agency' | 'sitesketcher' | 'general'
  redirectPath?: string
}

export function PaywallModal({
  isOpen,
  onClose,
  userType = 'general',
  redirectPath
}: PaywallModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const getCustomContent = () => {
    switch (userType) {
      case 'agency':
        return {
          title: 'Showcase Your Properties',
          description: 'Create agency listings and connect with qualified occupiers',
          features: [
            'Create unlimited agency listings',
            'Direct contact with occupiers',
            'Professional property showcase',
            'Access to requirement listings'
          ]
        }
      case 'sitesketcher':
        return {
          title: 'Unlock SiteSketcher',
          description: 'Visualize and plan your property projects with advanced tools',
          features: [
            'Advanced visualization tools',
            'Property project planning',
            'Site analysis features',
            'Export and share projects'
          ]
        }
      case 'searcher':
        return {
          title: 'Find Your Perfect Property',
          description: 'Access thousands of property listings and requirements',
          features: [
            'Search thousands of properties',
            'View detailed requirement listings',
            'Advanced filtering and search',
            'Direct contact with property owners'
          ]
        }
      default:
        return {
          title: 'Unlock Full Access',
          description: 'Subscribe to access premium features and property listings',
          features: [
            'View all requirement listings',
            'Access SiteSketcher tools',
            'Create agency listings',
            'Direct contact with occupiers'
          ]
        }
    }
  }

  const content = getCustomContent()

  const handleStartTrial = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'current_user_id', // This needs to be populated with actual user ID
          userType,
          redirectPath
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Error starting trial:', error)
      // Fallback: redirect to pricing page
      router.push('/pricing')
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewPricing = () => {
    router.push('/pricing')
    onClose()
  }

  const handleContinueToFree = () => {
    router.push('/dashboard')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Zap className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle className="text-xl font-bold">
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="text-center mb-4">
              <div className="text-2xl font-bold text-blue-600">£975/year</div>
              <div className="text-sm text-muted-foreground">30 days free, then billed annually</div>
            </div>

            <ul className="space-y-2 mb-4">
              {content.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="text-xs text-center text-muted-foreground mb-4">
              Cancel anytime during your trial - no charge
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Button
            onClick={handleStartTrial}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {isLoading ? 'Loading...' : 'Start Free Trial'}
          </Button>

          <Button
            variant="outline"
            onClick={handleViewPricing}
            className="w-full"
          >
            View Full Pricing
          </Button>

          <Button
            variant="ghost"
            onClick={handleContinueToFree}
            className="w-full text-muted-foreground"
          >
            Continue to Free Features
          </Button>
        </div>

        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      </DialogContent>
    </Dialog>
  )
}