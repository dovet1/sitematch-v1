import { getUserSubscriptionStatus } from '@/lib/subscription';

export type SubscriptionTier = 'free' | 'pro' | 'plus';

export async function getUserSubscriptionTier(userId: string): Promise<SubscriptionTier> {
  const user = await getUserSubscriptionStatus(userId);

  if (!user) return 'free';

  const { subscription_status, subscription_tier, stripe_subscription_id } = user;

  // Valid status check (matches useSubscriptionTier.ts logic)
  const isValidStatus =
    subscription_status === 'trialing' ||
    subscription_status === 'active' ||
    (subscription_status === 'past_due' && !!stripe_subscription_id);

  if (!isValidStatus) return 'free';

  // Return actual tier (pro, plus, or free)
  return (subscription_tier as SubscriptionTier) || 'free';
}

export async function hasProAccess(userId: string): Promise<boolean> {
  const tier = await getUserSubscriptionTier(userId);
  // Pro access = Pro OR Plus tier (matches client-side logic)
  return tier === 'pro' || tier === 'plus';
}

export async function hasPlusAccess(userId: string): Promise<boolean> {
  const tier = await getUserSubscriptionTier(userId);
  return tier === 'plus';
}
