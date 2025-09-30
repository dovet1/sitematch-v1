'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess'
import { TrialSignupModal } from '@/components/TrialSignupModal'
import { PaywallModal } from '@/components/PaywallModal'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function CreateAgencyPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess()
  const [showTrialModal, setShowTrialModal] = useState(false)
  const [showPaywallModal, setShowPaywallModal] = useState(false)
  const [isSignupInProgress, setIsSignupInProgress] = useState(false)

  const handleTrialModalClose = () => {
    setShowTrialModal(false)
    // Redirect back to agencies page when user closes modal
    router.push('/agencies')
  }

  const handlePaywallModalClose = () => {
    setShowPaywallModal(false)
    // Redirect back to agencies page when user closes modal
    router.push('/agencies')
  }

  const handleSignupStarted = (loading: boolean) => {
    // When signup starts (loading = true), immediately close the modal and prevent it from reappearing
    if (loading) {
      setShowTrialModal(false)
      setIsSignupInProgress(true)
    }
  }

  // Check subscription access and show appropriate modal
  useEffect(() => {
    if (!loading && !subscriptionLoading && !isSignupInProgress) {
      if (!user) {
        // User not logged in - show trial signup modal
        setShowTrialModal(true)
        setShowPaywallModal(false)
      } else if (user && !hasAccess) {
        // User logged in but no subscription - show paywall modal
        setShowTrialModal(false)
        setShowPaywallModal(true)
      } else {
        // User has access - hide both modals
        setShowTrialModal(false)
        setShowPaywallModal(false)
      }
    }
  }, [user, hasAccess, loading, subscriptionLoading, isSignupInProgress])

  // Show loading state while checking auth
  if (loading || subscriptionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-200 rounded mb-4 mx-auto" />
            <div className="h-4 w-32 bg-gray-200 rounded mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  // Show access modal for non-paid users
  const showAccessDenied = !user || (user && !hasAccess)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/agencies"
                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors"
                title="Back to Agency Directory"
              >
                <ArrowLeft className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-primary">Create Agency Profile</h1>
                <p className="text-sm text-muted-foreground">
                  Join our directory of commercial real estate agencies
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Only show if user has access */}
      {!showAccessDenied ? (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-2xl font-bold mb-4">Agency Profile Information</h2>
            <p className="text-muted-foreground mb-6">
              Create your agency profile to showcase your properties and connect with potential clients.
            </p>

            {/* Placeholder for agency creation form */}
            <div className="space-y-6">
              <div className="p-8 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                <p>Agency creation form will be implemented here</p>
                <p className="text-sm mt-2">Form fields: Agency name, description, contact info, etc.</p>
              </div>

              <div className="flex justify-end gap-4">
                <Button variant="outline" onClick={() => router.push('/agencies')}>
                  Cancel
                </Button>
                <Button disabled>
                  Create Agency Profile
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Placeholder content for non-paid users */
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
              <div className="h-64 bg-gray-200 rounded-lg max-w-4xl mx-auto mt-8"></div>
            </div>
          </div>
        </div>
      )}

      {/* Trial Modal for non-authenticated users */}
      <TrialSignupModal
        context="agency"
        forceOpen={showTrialModal && !isSignupInProgress}
        onClose={handleTrialModalClose}
        onLoadingChange={handleSignupStarted}
      >
        <div />
      </TrialSignupModal>

      {/* Paywall Modal for authenticated users without subscription */}
      <PaywallModal
        context="agency"
        isOpen={showPaywallModal}
        onClose={handlePaywallModalClose}
        redirectTo="/agencies/create"
      />
    </div>
  )
}