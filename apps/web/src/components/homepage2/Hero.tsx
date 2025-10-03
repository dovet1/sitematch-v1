'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { AuthChoiceModal } from '@/components/auth/auth-choice-modal';
import { AlreadySubscribedModal } from '@/components/AlreadySubscribedModal';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export function Hero() {
  const { user } = useAuth();
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'trialing' | null>(null);
  const [showAlreadySubscribed, setShowAlreadySubscribed] = useState(false);

  // Fetch subscription status when component mounts and user is logged in
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!user?.id) {
        setSubscriptionStatus(null);
        return;
      }

      try {
        const response = await fetch('/api/user/subscription-status');
        if (response.ok) {
          const data = await response.json();
          setSubscriptionStatus(data.subscriptionStatus);
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error);
      }
    };

    fetchSubscriptionStatus();
  }, [user?.id]);

  const handleProCheckout = async () => {
    if (!user) return;

    // First check if user is already subscribed
    if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      setShowAlreadySubscribed(true);
      return;
    }

    setIsLoadingCheckout(true);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userType: 'search',
          redirectPath: '/search'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.subscriptionStatus === 'active' || data.subscriptionStatus === 'trialing') {
          setSubscriptionStatus(data.subscriptionStatus);
          setShowAlreadySubscribed(true);
          setIsLoadingCheckout(false);
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
      setIsLoadingCheckout(false);
    }
  };

  return (
    <section className="relative bg-gradient-to-br from-slate-50 to-white py-12 md:py-16 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-violet-100/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-100/30 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="text-center lg:text-left">
            {/* Social proof badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 rounded-full border border-violet-200 mb-6">
              <svg className="w-4 h-4 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-semibold text-violet-700">Trusted by 500+ property professionals</span>
            </div>

            {/* Main headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Connect your sites with verified companies{' '}
              <span className="text-violet-600">actively seeking their next location</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Access a curated directory of verified property requirements. Match your sites with qualified companies ready to commit.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              {user ? (
                <Button
                  onClick={handleProCheckout}
                  disabled={isLoadingCheckout}
                  size="lg"
                  className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                  {isLoadingCheckout ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Start Free Trial'
                  )}
                </Button>
              ) : (
                <TrialSignupModal context="search" redirectPath="/search">
                  <Button size="lg" className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300">
                    Start Free Trial
                  </Button>
                </TrialSignupModal>
              )}

              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-2 border-gray-300 hover:border-violet-400 hover:bg-violet-50 px-8 py-6 text-lg font-semibold rounded-xl"
              >
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>

            {/* Secondary CTA for occupiers */}
            <div className="mt-8">
              <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-3 px-5 py-3 bg-gradient-to-r from-orange-50 to-orange-100/50 rounded-xl border border-orange-200/60">
                <p className="text-sm text-gray-600 text-center sm:text-left">Looking to buy or lease a site?</p>
                {user ? (
                  <Link
                    href="/occupier/create-listing-quick"
                    className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1 whitespace-nowrap"
                  >
                    Post for free
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <AuthChoiceModal
                    redirectTo="/occupier/create-listing-quick"
                    title="Sign in to post requirements"
                    description="Access your account to create and manage property listings"
                  >
                    <button className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1 whitespace-nowrap">
                      Post for free
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </AuthChoiceModal>
                )}
              </div>
            </div>
          </div>

          {/* Right: Product screenshot/demo */}
          <div className="relative">
            <div className="relative bg-white rounded-3xl shadow-2xl p-4 border-4 border-gray-100">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50">
                <img
                  src="/map-screenshot.png"
                  alt="SiteMatcher requirement map showing distribution across UK and Ireland"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    console.error('Failed to load map screenshot');
                  }}
                />
              </div>
            </div>

            {/* Floating stats cards - Hidden on mobile to prevent overflow */}
            <div className="hidden md:block absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">1,200+</p>
                  <p className="text-sm text-gray-600">Active Requirements</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Already Subscribed Modal */}
      {subscriptionStatus && (
        <AlreadySubscribedModal
          open={showAlreadySubscribed}
          onClose={() => setShowAlreadySubscribed(false)}
          subscriptionStatus={subscriptionStatus}
        />
      )}
    </section>
  );
}
