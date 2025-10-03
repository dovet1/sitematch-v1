'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { AlreadySubscribedModal } from '@/components/AlreadySubscribedModal';
import { useAuth } from '@/contexts/auth-context';
import { ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

export function FinalCTA() {
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
    <section className="py-24 bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
          Ready to find the perfect match for your site?
        </h2>
        <p className="text-xl md:text-2xl text-violet-100 mb-10 max-w-3xl mx-auto">
          Join our community of property professionals who've found qualified requirements through SiteMatcher
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {user ? (
            subscriptionStatus === 'active' || subscriptionStatus === 'trialing' ? (
              <Button
                asChild
                size="lg"
                className="bg-white text-violet-700 hover:bg-violet-50 px-10 py-7 text-lg font-semibold rounded-xl shadow-2xl hover:shadow-white/20 transition-all duration-300 hover:scale-105"
              >
                <Link href="/search">
                  Explore requirements
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
            ) : (
              <Button
                onClick={handleProCheckout}
                disabled={isLoadingCheckout}
                size="lg"
                className="bg-white text-violet-700 hover:bg-violet-50 px-10 py-7 text-lg font-semibold rounded-xl shadow-2xl hover:shadow-white/20 transition-all duration-300 hover:scale-105"
              >
                {isLoadingCheckout ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Start Free Trial
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            )
          ) : (
            <TrialSignupModal context="search" redirectPath="/search">
              <Button
                size="lg"
                className="bg-white text-violet-700 hover:bg-violet-50 px-10 py-7 text-lg font-semibold rounded-xl shadow-2xl hover:shadow-white/20 transition-all duration-300 hover:scale-105"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </TrialSignupModal>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mt-12 md:mt-16 pt-12 md:pt-16 border-t border-white/20">
          <div>
            <p className="text-4xl md:text-5xl font-bold text-white mb-2">1,200+</p>
            <p className="text-violet-100">Active Requirements</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-bold text-white mb-2">500+</p>
            <p className="text-violet-100">Property Professionals</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-bold text-white mb-2">20+</p>
            <p className="text-violet-100">Sectors</p>
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
