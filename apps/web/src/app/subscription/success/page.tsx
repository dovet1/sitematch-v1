'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, ArrowRight, Calendar, CreditCard } from 'lucide-react'

// Whitelist of allowed redirect paths for security
const ALLOWED_REDIRECTS = ['/search', '/agencies/create', '/sitesketcher']

// Get button configuration based on redirect destination
const getButtonConfig = (redirectPath: string | null) => {
  // Validate and sanitize redirect path
  const validatedPath = redirectPath && ALLOWED_REDIRECTS.includes(redirectPath)
    ? redirectPath
    : '/search' // Default fallback

  // Return button text and path based on destination
  switch (validatedPath) {
    case '/agencies/create':
      return {
        text: 'Complete your agency profile',
        path: '/agencies'
      }
    case '/sitesketcher':
      return {
        text: 'Start using SiteSketcher',
        path: '/sitesketcher'
      }
    case '/search':
    default:
      return {
        text: 'Start exploring requirements',
        path: '/search'
      }
  }
}

function SubscriptionSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [trialEndDate, setTrialEndDate] = useState<string>('')
  const [subscriptionAmount, setSubscriptionAmount] = useState<number>(975)

  const sessionId = searchParams?.get('session_id')
  const redirectParam = searchParams?.get('redirect') ?? null

  // Get validated button configuration
  const buttonConfig = getButtonConfig(redirectParam)

  // Refresh Supabase session on mount to restore auth after Stripe redirect
  useEffect(() => {
    async function refreshSupabaseSession() {
      try {
        const { createClientClient } = await import('@/lib/supabase')
        const supabase = createClientClient()

        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
          // Try to refresh the session
          const { error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) {
            console.error('Error refreshing session:', refreshError)
          }
        } else if (!session) {
          console.log('No session found, attempting to refresh')
          // Try to refresh the session
          const { error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) {
            console.error('Error refreshing session:', refreshError)
          }
        } else {
          // Session exists - establish session_id cookie for middleware
          console.log('[SUCCESS] Session exists, establishing session_id cookie')
          try {
            const response = await fetch('/api/auth/update-session', {
              method: 'POST',
              credentials: 'include'
            })
            const data = await response.json()

            if (data.success && data.sessionId) {
              console.log('[SUCCESS] Session ID established:', data.sessionId.substring(0, 8) + '...')
              // Store in localStorage as backup
              localStorage.setItem('session_id', data.sessionId)
              // Cookie is set by server, but also set client-side as backup
              document.cookie = `session_id=${data.sessionId}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`
            } else {
              console.error('[SUCCESS] Failed to establish session ID:', data)
            }
          } catch (sessionError) {
            console.error('[SUCCESS] Error establishing session ID:', sessionError)
          }
        }
      } catch (error) {
        console.error('Error in session refresh:', error)
      }
    }

    refreshSupabaseSession()
  }, [])

  useEffect(() => {
    async function fetchSessionDetails() {
      if (!sessionId) {
        // Fallback if no session ID
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + 30)
        setTrialEndDate(endDate.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }))
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/stripe/session?session_id=${sessionId}`)

        if (response.ok) {
          const data = await response.json()
          const endDate = new Date(data.trialEndDate)
          setTrialEndDate(endDate.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }))
          setSubscriptionAmount(data.amount)
        } else {
          throw new Error('Failed to fetch session')
        }
      } catch (error) {
        console.error('Error fetching session details:', error)
        // Fallback to default values
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + 30)
        setTrialEndDate(endDate.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }))
      } finally {
        setIsLoading(false)
      }
    }

    fetchSessionDetails()
  }, [sessionId])

  const handleContinue = () => {
    router.push(buttonConfig.path)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              Trial Started
            </Badge>
          </div>

          {/* Main Card */}
          <Card className="border-2 border-green-200 bg-green-50/30">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-green-800">
                Welcome to SiteMatcher!
              </CardTitle>
              <CardDescription className="text-base text-green-600">
                Your free trial has started successfully
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Trial Details */}
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold">Your Trial Details</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-600">
                    <strong>Trial Period:</strong> 30 days (ends {trialEndDate})
                  </p>
                  <p className="text-gray-600">
                    <strong>Next Billing:</strong> £{subscriptionAmount.toFixed(2)} on {trialEndDate} (unless cancelled)
                  </p>
                  <p className="text-green-600 font-medium">
                    ✓ Full access to all premium features during trial
                  </p>
                </div>
              </div>

              {/* What's Included */}
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <h3 className="font-semibold mb-3">What's included in your trial:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Unlimited access to our curated directory of requirement listings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Full access to SiteMatcher tools</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Add your agency to our Agency Directory and link it to published listings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Our latest requirement listings direct to your inbox</span>
                  </li>
                </ul>
              </div>

              {/* Management Info */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-3 mb-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">Manage Your Subscription</h3>
                </div>
                <p className="text-sm text-blue-600">
                  You can cancel anytime before your trial ends through your account settings.
                  No charges will be made if you cancel during the trial period.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-4">
                <Button
                  onClick={handleContinue}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <ArrowRight className="mr-2 h-5 w-5" />
                  {buttonConfig.text}
                </Button>
              </div>

              {/* Footer */}
              <div className="text-center text-xs text-gray-500 pt-4 border-t">
                Questions? Contact us anytime.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SubscriptionSuccessContent />
    </Suspense>
  )
}