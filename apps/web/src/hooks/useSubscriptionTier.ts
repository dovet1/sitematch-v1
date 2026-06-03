'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trial_canceled'
  | 'trial_expired'
  | 'expired'
  | null;

export type SubscriptionTier = 'free' | 'pro' | 'plus';

export interface UseSubscriptionTierReturn {
  subscriptionStatus: SubscriptionStatus;
  subscriptionTier: SubscriptionTier;
  hasProAccess: boolean;   // Pro OR Plus with valid status
  hasPlusAccess: boolean;  // Plus with valid status
  isTrialing: boolean;     // Any trial
  hasStripeSubscription: boolean;  // Has real Stripe subscription (for upgrade detection)
  billingInterval: 'month' | 'year';  // User's current billing interval (for Pro → Plus upgrades)
  loading: boolean;
}

/**
 * Hook to determine user's subscription status and tier
 * - Separates status (trialing, active, past_due, etc.) from tier (free, pro, plus)
 * - Returns derived access booleans for feature gating
 * - hasProAccess: Pro OR Plus users with valid subscription
 * - hasPlusAccess: Plus users with valid subscription
 */
export function useSubscriptionTier(): UseSubscriptionTierReturn {
  const { user, loading: authLoading, profile } = useAuth();

  // State for raw subscription data
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [hasStripeSubscription, setHasStripeSubscription] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('year');
  const [loading, setLoading] = useState(true);

  // State for derived access booleans
  const [hasProAccess, setHasProAccess] = useState(false);
  const [hasPlusAccess, setHasPlusAccess] = useState(false);
  const [isTrialing, setIsTrialing] = useState(false);

  useEffect(() => {
    async function checkTier() {
      // If still loading auth, wait
      if (authLoading) {
        return;
      }

      // Not authenticated = free tier
      if (!user) {
        setSubscriptionStatus(null);
        setSubscriptionTier('free');
        setHasStripeSubscription(false);
        setBillingInterval('year');  // Reset to default
        setLoading(false);
        return;
      }

      try {
        // Check subscription status from API
        const response = await fetch('/api/user/subscription-status');
        if (response.ok) {
          const data = await response.json();
          const status = data.subscriptionStatus;  // 'trialing', 'active', etc.
          const tier = data.subscription_tier;     // 'free', 'pro', 'plus'
          const hasStripe = data.hasStripeSubscription || false;

          // Store in state
          setSubscriptionStatus(status);
          setSubscriptionTier(tier || 'free');
          setHasStripeSubscription(hasStripe);
          setBillingInterval(data.billing_interval || 'year');  // Get from API
        } else {
          // If API fails, fall back to free tier
          setSubscriptionStatus(null);
          setSubscriptionTier('free');
          setHasStripeSubscription(false);
          setBillingInterval('year');  // Reset to default
        }
      } catch (error) {
        console.error('Error checking subscription tier:', error);
        setSubscriptionStatus(null);
        setSubscriptionTier('free');
        setHasStripeSubscription(false);
        setBillingInterval('year');  // Reset to default
      } finally {
        setLoading(false);
      }
    }

    checkTier();
  }, [user, authLoading, profile]);

  // Derive access booleans from current state
  useEffect(() => {
    // Determine if subscription status is valid for access
    // past_due only grants access if real Stripe subscription exists (dunning grace period)
    const isValidStatus =
      subscriptionStatus === 'trialing' ||
      subscriptionStatus === 'active' ||
      (subscriptionStatus === 'past_due' && hasStripeSubscription);

    // hasProAccess: Pro OR Plus users with valid subscription
    const proAccess = isValidStatus && (subscriptionTier === 'pro' || subscriptionTier === 'plus');

    // hasPlusAccess: Plus users with valid subscription
    const plusAccess = isValidStatus && subscriptionTier === 'plus';

    // isTrialing: Any trial (Pro or Plus)
    const trialing = subscriptionStatus === 'trialing';

    setHasProAccess(proAccess);
    setHasPlusAccess(plusAccess);
    setIsTrialing(trialing);
  }, [subscriptionStatus, subscriptionTier, hasStripeSubscription]);

  return {
    subscriptionStatus,
    subscriptionTier,
    hasProAccess,   // Pro OR Plus users with valid subscription
    hasPlusAccess,  // Plus users with valid subscription
    isTrialing,     // Any trialing user (Pro or Plus)
    hasStripeSubscription,  // Has real Stripe subscription (for upgrade detection)
    billingInterval,  // User's current billing interval (for Pro → Plus upgrades)
    loading: loading || authLoading
  };
}
