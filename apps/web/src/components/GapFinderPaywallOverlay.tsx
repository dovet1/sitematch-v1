'use client'

import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { Check } from '@/components/homepage-new/icons/Check'
import { getUpgradePricing, PRICING_VALUES } from '@/data/homepage-new/constants'

interface GapFinderPaywallOverlayProps {
  userType: 'pro' | 'non-plus' | 'anonymous'
  onUpgrade?: () => void
  onNavigateAuth?: () => void
  onNavigateLearnMore?: () => void
  isUpgrading?: boolean
  upgradeError?: string | null
  billingInterval?: 'month' | 'year'
}

export function GapFinderPaywallOverlay({
  userType,
  onUpgrade,
  onNavigateAuth,
  onNavigateLearnMore,
  isUpgrading = false,
  upgradeError = null,
  billingInterval = 'year',
}: GapFinderPaywallOverlayProps) {
  const router = useRouter()

  // Get tier-specific pricing from centralized constants
  const pricing = getUpgradePricing(billingInterval)

  // Shared left column (features) for all variants
  const FeaturesColumn = () => (
    <div className="bg-[#FBFAF7] p-8 md:p-10 border-r border-[#E8E4DC] flex flex-col justify-center">
      <div className="space-y-6">
        <div>
          <h3 className="text-[15px] font-[600] text-[#171419] font-inter mb-4 tracking-[-0.01em]">
            GapFinder includes:
          </h3>
        </div>

        <ul className="space-y-4">
          <li className="flex items-start gap-3">
            <Check size={16} color="#7033FF" />
            <span className="text-[14px] text-[#171419] font-inter leading-[1.5]">
              Every major UK retail brand, mapped
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Check size={16} color="#7033FF" />
            <span className="text-[14px] text-[#171419] font-inter leading-[1.5]">
              Filter by sector, fascia or population
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Check size={16} color="#7033FF" />
            <span className="text-[14px] text-[#171419] font-inter leading-[1.5]">
              Assess an area's store presence and compare to another area
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Check size={16} color="#7033FF" />
            <span className="text-[14px] text-[#171419] font-inter leading-[1.5]">
              Export shortlists to Excel
            </span>
          </li>
        </ul>
      </div>
    </div>
  )

  // Pro user variant: Direct upgrade with pricing comparison
  if (userType === 'pro') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60"
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        aria-describedby="paywall-description"
      >
        <div className="w-full max-w-4xl bg-white rounded-[18px] shadow-2xl border border-[#E8E4DC] overflow-hidden relative">
          {/* Close Button */}
          <button
            className="absolute right-6 top-6 text-[#7C7588] hover:text-[#171419] transition-colors z-10"
            aria-label="Close"
            onClick={() => router.push('/')}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Two Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 min-h-[500px]">
            {/* Left Column - Features */}
            <FeaturesColumn />

            {/* Right Column - Pro Upgrade */}
            <div className="bg-white p-8 md:p-10 flex flex-col justify-center">
              <div className="space-y-6">
                {/* Header */}
                <div>
                  <h2 id="paywall-title" className="text-[24px] font-[600] text-[#171419] font-inter mb-2 tracking-[-0.02em]">
                    Upgrade to Plus
                  </h2>
                  <p id="paywall-description" className="text-[14px] text-[#7C7588] font-inter">
                    Get access to GapFinder and advanced market analysis
                  </p>
                </div>

                {/* Pricing Breakdown */}
                <div className="bg-[#F5F1FF] rounded-[10px] p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#4A4451] font-inter">Current: Pro</span>
                    <span className="text-[15px] font-[600] text-[#171419] font-inter">
                      {pricing.current.display}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#4A4451] font-inter">New: Plus</span>
                    <span className="text-[15px] font-[600] text-[#7033FF] font-inter">
                      {pricing.new.display}
                    </span>
                  </div>
                  <div className="border-t border-[#EEE9FF] pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[14px] text-[#4A4451] font-inter">Additional</span>
                      <span className="text-[16px] font-[600] text-[#7033FF] font-inter">
                        {pricing.difference.display}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {upgradeError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-[10px]">
                    <p className="text-[13px] text-red-700 font-inter">{upgradeError}</p>
                  </div>
                )}

                {/* CTA Button */}
                <button
                  onClick={onUpgrade}
                  disabled={isUpgrading}
                  className="w-full h-[44px] bg-[#7033FF] hover:bg-[#5421CC] text-white text-[15px] font-[600] rounded-[10px] font-inter transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#7033FF]"
                >
                  {isUpgrading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Upgrading...</span>
                    </div>
                  ) : (
                    'Upgrade to Plus Now'
                  )}
                </button>

                {/* Footer Note */}
                <p className="text-[12px] text-center text-[#7C7588] font-inter leading-[1.5]">
                  You'll be charged a prorated amount for the remainder of your billing period
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Non-Plus user variant: Feature preview with two CTAs
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      aria-describedby="paywall-description"
    >
      <div className="w-full max-w-4xl bg-white rounded-[18px] shadow-2xl border border-[#E8E4DC] overflow-hidden relative">
        {/* Close Button */}
        <button
          className="absolute right-6 top-6 text-[#7C7588] hover:text-[#171419] transition-colors z-10"
          aria-label="Close"
          onClick={() => router.push('/')}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 min-h-[500px]">
          {/* Left Column - Features */}
          <FeaturesColumn />

          {/* Right Column - Non-Plus Upgrade */}
          <div className="bg-white p-8 md:p-10 flex flex-col justify-center">
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 id="paywall-title" className="text-[24px] font-[600] text-[#171419] font-inter mb-2 tracking-[-0.02em]">
                  GapFinder is Plus only
                </h2>
                <p id="paywall-description" className="text-[14px] text-[#7C7588] font-inter">
                  Upgrade to Plus to access GapFinder and advanced market analysis tools
                </p>
              </div>

              {/* Pricing Display */}
              <div className="bg-[#F5F1FF] rounded-[10px] p-5 text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-[15px] text-[#7C7588] font-inter">From</span>
                  <span className="text-[32px] font-[600] text-[#171419] font-inter tracking-[-0.02em]">
                    {PRICING_VALUES.plus.annual.formatted}
                  </span>
                  <span className="text-[15px] text-[#7C7588] font-inter">/year</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#EEE9FF] rounded-full">
                  <span className="text-[12px] font-[600] text-[#5421CC] font-inter">
                    30-day free trial
                  </span>
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-3">
                <button
                  onClick={onNavigateAuth}
                  className="w-full h-[44px] bg-[#7033FF] hover:bg-[#5421CC] text-white text-[15px] font-[600] rounded-[10px] font-inter transition-colors"
                >
                  Start Free Trial
                </button>

                <button
                  onClick={onNavigateLearnMore}
                  className="w-full h-[40px] bg-transparent text-[#7C7588] hover:text-[#4A4451] hover:bg-[#FBFAF7] text-[14px] font-[500] rounded-[10px] font-inter transition-colors border border-[#E8E4DC]"
                >
                  Learn More About GapFinder
                </button>
              </div>

              {/* Footer Note */}
              <p className="text-[12px] text-center text-[#7C7588] font-inter">
                Cancel anytime • No credit card required for trial
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
