'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

export type SubscriptionTier = 'free' | 'trial' | 'pro';

export interface UseSubscriptionTierReturn {
  tier: SubscriptionTier;
  isFreeTier: boolean;
  isTrial: boolean;
  isPro: boolean;
  loading: boolean;
}

/**
 * Hook to determine user's subscription tier
 * - free: No authentication OR authenticated but no active subscription
 * - trial: Authenticated with active trial
 * - pro: Authenticated with paid subscription
 */
export function useSubscriptionTier(): UseSubscriptionTierReturn {
  const { user, loading: authLoading, profile } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkTier() {
      // If still loading auth, wait
      if (authLoading) {
        return;
      }

      // Not authenticated = free tier
      if (!user) {
        setTier('free');
        setLoading(false);
        return;
      }

      try {
        // Check subscription status from API
        const response = await fetch('/api/user/subscription-status');
        if (response.ok) {
          const data = await response.json();
          const status = data.subscriptionStatus;

          if (status === 'trialing') {
            setTier('trial');
          } else if (status === 'active') {
            setTier('pro');
          } else {
            setTier('free');
          }
        } else {
          // If API fails, fall back to free tier
          setTier('free');
        }
      } catch (error) {
        console.error('Error checking subscription tier:', error);
        setTier('free');
      } finally {
        setLoading(false);
      }
    }

    checkTier();
  }, [user, authLoading, profile]);

  return {
    tier,
    isFreeTier: tier === 'free',
    isTrial: tier === 'trial',
    isPro: tier === 'pro' || tier === 'trial', // Trial users get pro features
    loading: loading || authLoading
  };
}
