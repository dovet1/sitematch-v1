'use client';

import { useRouter } from 'next/navigation';
import { X, Check } from 'lucide-react';
import { ACTIVE_PROMOTION } from '@/data/homepage-new/constants';

export function AnonymousPaywallOverlay() {
  const router = useRouter();

  const FeaturesColumn = () => (
    <div className="bg-[#FBFAF7] p-8 md:p-10 border-r border-[#E8E4DC] flex flex-col justify-center">
      <div className="space-y-6">
        <div>
          <h3 className="text-[15px] font-[600] text-[#171419] font-inter mb-4 tracking-[-0.01em]">
            SiteAnalyser tiers:
          </h3>
        </div>

        <div className="space-y-5">
          {/* Free Tier */}
          <div>
            <h4 className="text-[13px] font-[600] text-[#171419] font-inter mb-2 uppercase tracking-wide">
              Free
            </h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#7033FF] flex-shrink-0 mt-0.5" />
                <span className="text-[13.5px] text-[#171419] font-inter leading-[1.5]">
                  Search UK locations
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#7033FF] flex-shrink-0 mt-0.5" />
                <span className="text-[13.5px] text-[#171419] font-inter leading-[1.5]">
                  Adjust catchments by distance or time
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#7033FF] flex-shrink-0 mt-0.5" />
                <span className="text-[13.5px] text-[#171419] font-inter leading-[1.5]">
                  Population & affluence data
                </span>
              </li>
            </ul>
          </div>

          {/* Pro Tier */}
          <div>
            <h4 className="text-[13px] font-[600] text-[#7033FF] font-inter mb-2 uppercase tracking-wide">
              Pro
            </h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#7033FF] flex-shrink-0 mt-0.5" />
                <span className="text-[13.5px] text-[#171419] font-inter leading-[1.5]">
                  Everything in Free
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#7033FF] flex-shrink-0 mt-0.5" />
                <span className="text-[13.5px] text-[#171419] font-inter leading-[1.5] font-[600]">
                  Full demographic breakdowns
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#7033FF] flex-shrink-0 mt-0.5" />
                <span className="text-[13.5px] text-[#171419] font-inter leading-[1.5] font-[600]">
                  Traffic flow & count point data
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-[#7033FF] flex-shrink-0 mt-0.5" />
                <span className="text-[13.5px] text-[#171419] font-inter leading-[1.5] font-[600]">
                  Save and load analyses
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
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

          {/* Right Column - CTAs */}
          <div className="bg-white p-8 md:p-10 flex flex-col justify-center">
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2
                  id="paywall-title"
                  className="text-[24px] font-[600] text-[#171419] font-inter mb-2 tracking-[-0.02em]"
                >
                  Sign up to use SiteAnalyser
                </h2>
                <p id="paywall-description" className="text-[14px] text-[#7C7588] font-inter">
                  Create a free account to analyze site demographics
                </p>
              </div>

              {/* Pricing Display */}
              <div className="bg-[#F5F1FF] rounded-[10px] p-5">
                {/* Promotion Badge */}
                {ACTIVE_PROMOTION.isActive && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FF6B35] rounded-full mb-3">
                    <span className="text-[12px] font-[600] text-white font-inter">
                      {ACTIVE_PROMOTION.name} — {ACTIVE_PROMOTION.discountPercent}% off Pro & Plus
                    </span>
                  </div>
                )}

                {/* Free Tier Highlight */}
                <div className="mb-4">
                  <div className="flex items-baseline justify-center gap-2 mb-2">
                    <span className="text-[32px] font-[600] text-[#171419] font-inter tracking-[-0.02em]">
                      Free
                    </span>
                    <span className="text-[15px] text-[#7C7588] font-inter">forever</span>
                  </div>
                  <p className="text-[13px] text-center text-[#7C7588] font-inter">
                    No credit card required
                  </p>
                </div>

                {/* Pro Pricing */}
                <div className="border-t border-[rgba(112,51,255,0.15)] pt-4">
                  <p className="text-[12px] text-center text-[#7C7588] font-inter mb-2">
                    Upgrade anytime to Pro or Plus
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[15px] text-[#7C7588] line-through font-inter">£79/month</span>
                    <span className="text-[18px] font-[600] text-[#7033FF] font-inter">£39.50/month</span>
                    <span className="text-[12px] font-[600] text-[#7033FF] bg-white px-2 py-0.5 rounded-full">
                      50% off
                    </span>
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="space-y-3">
                <button
                  onClick={() =>
                    router.push(`/auth?mode=signup&returnUrl=${encodeURIComponent('/siteanalyser')}`)
                  }
                  className="w-full h-[44px] bg-[#7033FF] hover:bg-[#5421CC] text-white text-[15px] font-[600] rounded-[10px] font-inter transition-colors"
                >
                  Create Free Account
                </button>

                <button
                  onClick={() =>
                    router.push(`/auth?mode=signup&returnUrl=${encodeURIComponent('/siteanalyser')}`)
                  }
                  className="w-full h-[40px] bg-transparent text-[#7C7588] hover:text-[#4A4451] hover:bg-[#FBFAF7] text-[14px] font-[500] rounded-[10px] font-inter transition-colors border border-[#E8E4DC]"
                >
                  Start Pro Trial
                </button>
              </div>

              {/* Footer Note */}
              <p className="text-[12px] text-center text-[#7C7588] font-inter">
                30-day free trial on Pro & Plus • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
