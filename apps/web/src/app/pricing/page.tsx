'use client';

import { useState, useEffect } from 'react';
import { PricingCard } from '@/components/homepage-new/PricingCard';
import { RevealWrapper } from '@/components/homepage-new/RevealWrapper';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { AlreadySubscribedModal } from '@/components/AlreadySubscribedModal';
import UpgradeModal from '@/components/UpgradeModal';
import { useAuth } from '@/contexts/auth-context';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import Link from 'next/link';
import { Footer } from '@/components/homepage2/Footer';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type Period = 'monthly' | 'annual';
type Tier = 'free' | 'pro' | 'plus';

export default function PricingPage() {
  const { user } = useAuth();

  // Use hook as single source of truth for subscription state
  const {
    subscriptionStatus,
    subscriptionTier,
    hasStripeSubscription,
    billingInterval,
    loading: tierLoading
  } = useSubscriptionTier();

  const [isLoadingCheckout, setIsLoadingCheckout] = useState<Tier | null>(null);
  const [showAlreadySubscribed, setShowAlreadySubscribed] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [period, setPeriod] = useState<Period>('annual');

  const handleCheckout = async (tier: 'pro' | 'plus') => {
    if (!user) return;

    console.log('[PRICING] Checkout requested for tier:', tier);

    // Only block if user has REAL Stripe subscription (including past_due during dunning)
    const activeStatuses = ['active', 'trialing', 'past_due'];
    if (activeStatuses.includes(subscriptionStatus || '') && hasStripeSubscription) {
      if (subscriptionTier === 'pro' && tier === 'plus') {
        setShowUpgradeModal(true); // Show upgrade modal
        return;
      }
      setShowAlreadySubscribed(true); // Block same tier
      return;
    }
    // Legacy users and non-subscribed users pass through to checkout

    setIsLoadingCheckout(tier);
    try {
      // Convert period to API format
      const apiInterval = period === 'monthly' ? 'month' : 'year';

      // Determine redirect path based on tier
      const redirectPath = tier === 'plus' ? '/gapfinder' : '/search';

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          tier: tier,
          redirectPath: redirectPath,
          billingInterval: apiInterval
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if user is already subscribed
        if (data.subscriptionStatus === 'active' || data.subscriptionStatus === 'trialing') {
          setShowAlreadySubscribed(true);
          setIsLoadingCheckout(null);
          return;
        }

        console.error('Checkout session error:', data);
        throw new Error(data.details || data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setIsLoadingCheckout(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <RevealWrapper>
            <div className="text-center mb-12 md:mb-16">
              {/* Eyebrow */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-sm-violet"></div>
                <span className="text-sm text-sm-ink3 tracking-wide">PRICING</span>
              </div>

              {/* Heading */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-sm-ink mb-4 tracking-tight">
                Simple, transparent pricing.
              </h1>

              {/* Subtitle */}
              <p className="text-lg md:text-xl text-sm-ink3 max-w-2xl mx-auto mb-8">
                Start with Free, upgrade to Pro or Plus when you're ready. 30-day free trial on Pro & Plus.
              </p>

              {/* Sale Chip */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sm-violet-tint border border-sm-violet/20 mb-8">
                <span className="text-sm font-medium text-sm-violet-deep">
                  Summer Sale — 50% off, ends 31 August
                </span>
              </div>

              {/* Period Toggle */}
              <div className="flex items-center justify-center gap-0">
                <div className="inline-flex items-center gap-0 bg-sm-surface rounded-full p-1 border border-sm-border">
                  <button
                    className={`px-6 py-2 rounded-full transition-all duration-200 text-sm font-medium ${
                      period === 'monthly'
                        ? 'bg-sm-ink text-white'
                        : 'text-sm-ink3 hover:text-sm-ink'
                    }`}
                    onClick={() => setPeriod('monthly')}
                  >
                    Monthly
                  </button>
                  <button
                    className={`px-6 py-2 rounded-full transition-all duration-200 text-sm font-medium ${
                      period === 'annual'
                        ? 'bg-sm-ink text-white'
                        : 'text-sm-ink3 hover:text-sm-ink'
                    }`}
                    onClick={() => setPeriod('annual')}
                  >
                    Annual
                  </button>
                </div>
              </div>
            </div>
          </RevealWrapper>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
            {/* Free Tier */}
            <RevealWrapper delay={0.1}>
              <PricingCard
                tier="free"
                period={period}
                ctaElement={
                  <Link
                    href={user ? "/occupier/create-listing-quick" : `/auth?mode=signin&returnUrl=${encodeURIComponent('/occupier/create-listing-quick')}`}
                    className="block"
                  >
                    <button className="w-full mt-5 px-5 py-[13px] rounded-sm-btn font-medium text-[15px] border tracking-[-0.1px] transition-colors bg-transparent text-sm-ink border-sm-border hover:bg-sm-border-soft">
                      Get started
                    </button>
                  </Link>
                }
              />
            </RevealWrapper>

            {/* Pro Tier */}
            <RevealWrapper delay={0.2}>
              <PricingCard
                tier="pro"
                period={period}
                ctaElement={
                  user ? (
                    subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? (
                      <Link href="/search" className="block">
                        <button className="w-full mt-5 px-5 py-[13px] rounded-sm-btn font-medium text-[15px] border tracking-[-0.1px] transition-colors bg-transparent text-sm-ink border-sm-border hover:bg-sm-border-soft">
                          Explore requirements
                        </button>
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleCheckout('pro')}
                        disabled={isLoadingCheckout === 'pro'}
                        className="w-full mt-5 px-5 py-[13px] rounded-sm-btn font-medium text-[15px] border tracking-[-0.1px] transition-colors bg-transparent text-sm-ink border-sm-border hover:bg-sm-border-soft disabled:opacity-50"
                      >
                        {isLoadingCheckout === 'pro' ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                          </span>
                        ) : (
                          'Start 30-day free trial'
                        )}
                      </button>
                    )
                  ) : (
                    <TrialSignupModal
                      context="search"
                      redirectPath="/search"
                      billingInterval={period === 'monthly' ? 'month' : 'year'}
                    >
                      <button className="w-full mt-5 px-5 py-[13px] rounded-sm-btn font-medium text-[15px] border tracking-[-0.1px] transition-colors bg-transparent text-sm-ink border-sm-border hover:bg-sm-border-soft">
                        Start 30-day free trial
                      </button>
                    </TrialSignupModal>
                  )
                }
              />
            </RevealWrapper>

            {/* Plus Tier */}
            <RevealWrapper delay={0.3}>
              <PricingCard
                tier="plus"
                period={period}
                featured={true}
                ctaElement={
                  user ? (
                    // Check if Pro user first for upgrade detection - WAIT for hook to load
                    subscriptionTier === 'pro' && hasStripeSubscription && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') ? (
                      <button
                        onClick={() => setShowUpgradeModal(true)}
                        disabled={tierLoading}
                        className="w-full mt-5 px-5 py-[13px] rounded-sm-btn font-medium text-[15px] border tracking-[-0.1px] transition-colors bg-sm-violet text-white border-sm-violet hover:bg-sm-violet-deep disabled:opacity-50"
                      >
                        {tierLoading ? 'Loading...' : 'Upgrade to Plus'}
                      </button>
                    ) : subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? (
                      // Plus users or other active subs
                      <Link href="/gapfinder" className="block">
                        <button className="w-full mt-5 px-5 py-[13px] rounded-sm-btn font-medium text-[15px] border tracking-[-0.1px] transition-colors bg-sm-violet text-white border-sm-violet hover:bg-sm-violet-deep">
                          Explore GapFinder
                        </button>
                      </Link>
                    ) : (
                      // Free/canceled/expired users
                      <button
                        onClick={() => handleCheckout('plus')}
                        disabled={isLoadingCheckout === 'plus'}
                        className="w-full mt-5 px-5 py-[13px] rounded-sm-btn font-medium text-[15px] border tracking-[-0.1px] transition-colors bg-sm-violet text-white border-sm-violet hover:bg-sm-violet-deep disabled:opacity-50"
                      >
                        {isLoadingCheckout === 'plus' ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                          </span>
                        ) : (
                          'Start 30-day free trial'
                        )}
                      </button>
                    )
                  ) : (
                    // Anonymous users
                    <TrialSignupModal
                      context="gapfinder"
                      redirectPath="/gapfinder"
                      billingInterval={period === 'monthly' ? 'month' : 'year'}
                      tier="plus"
                    >
                      <button className="w-full mt-5 px-5 py-[13px] rounded-sm-btn font-medium text-[15px] border tracking-[-0.1px] transition-colors bg-sm-violet text-white border-sm-violet hover:bg-sm-violet-deep">
                        Start 30-day free trial
                      </button>
                    </TrialSignupModal>
                  )
                }
              />
            </RevealWrapper>
          </div>

          {/* Additional info */}
          <RevealWrapper delay={0.4}>
            <div className="text-center max-w-3xl mx-auto">
              <div className="bg-sm-surface rounded-sm-card p-6 border border-sm-border">
                <p className="text-sm text-sm-ink3">
                  Prefer to pay by bank transfer? Contact us at{' '}
                  <a
                    href="mailto:rob@sitematcher.co.uk"
                    className="text-sm-violet font-medium hover:underline"
                  >
                    rob@sitematcher.co.uk
                  </a>{' '}
                  to request an invoice
                </p>
              </div>
            </div>
          </RevealWrapper>
        </div>

        {/* Already Subscribed Modal */}
        {subscriptionStatus && ['active', 'trialing', 'past_due'].includes(subscriptionStatus) && (
          <AlreadySubscribedModal
            open={showAlreadySubscribed}
            onClose={() => setShowAlreadySubscribed(false)}
            subscriptionStatus={subscriptionStatus as 'trialing' | 'active' | 'past_due'}
          />
        )}

        {/* Upgrade Modal */}
        <UpgradeModal
          open={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentTier="pro"
          targetTier="plus"
          billingInterval={billingInterval}
        />
      </section>
      <Footer />
    </div>
  );
}
