'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BillingInterval, SubscriptionTier } from '@/lib/stripe'
import { getUpgradePricing } from '@/data/homepage-new/constants'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  currentTier: SubscriptionTier
  targetTier: SubscriptionTier
  billingInterval: BillingInterval
}

export default function UpgradeModal({
  open,
  onClose,
  currentTier,
  targetTier,
  billingInterval
}: UpgradeModalProps) {
  const router = useRouter()
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [syncPending, setSyncPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleUpgrade = async () => {
    setIsUpgrading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/upgrade-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetTier,
          billingInterval
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to upgrade')
      }

      // Check if database update is pending
      if (data.tierUpdatePending) {
        // Show refresh message, don't redirect
        setSyncPending(true)
        setIsUpgrading(false)
        return
      }

      // Normal success! Tier already updated, redirect immediately
      router.push('/gapfinder?upgraded=true')
      router.refresh()
      onClose()
    } catch (err) {
      console.error('Upgrade error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upgrade subscription')
      setIsUpgrading(false)
    }
  }

  // Get tier-specific pricing from centralized constants
  const pricing = getUpgradePricing(billingInterval)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {syncPending ? (
          <div>
            <h2 className="text-2xl font-bold mb-4">Upgrade Successful!</h2>
            <p className="mb-4 text-gray-700">
              Your subscription has been upgraded in Stripe. Please refresh the page to see your Plus features.
            </p>
            <button
              onClick={() => {
                router.refresh()
                onClose()
              }}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-4">Upgrade to Plus</h2>

            <div className="mb-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Current Plan (Pro)</span>
                  <span className="font-semibold">{pricing.current.display}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">New Plan (Plus)</span>
                  <span className="font-semibold text-blue-600">{pricing.new.display}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Additional cost</span>
                    <span className="font-bold text-blue-600">{pricing.difference.display}</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                You will be charged a prorated amount for the remainder of your current billing period.
                The exact amount depends on your remaining cycle and any active coupons.
              </p>

              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-2">Plus Plan includes:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  <li>Everything in Pro</li>
                  <li>GapFinder - Advanced market analysis</li>
                  <li>Operator coverage analysis</li>
                  <li>Retail white space identification</li>
                  <li>Priority support</li>
                </ul>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isUpgrading}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpgrade}
                disabled={isUpgrading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpgrading ? 'Upgrading...' : 'Confirm Upgrade'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
