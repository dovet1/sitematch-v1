'use client';

import { Sparkles, Crown, Gift } from 'lucide-react';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { AlreadySubscribedModal } from '@/components/AlreadySubscribedModal';
import { useState } from 'react';

interface UserStatusHeaderProps {
  email: string;
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'canceled' | null;
  onUpgradeClick?: () => void;
}

export function UserStatusHeader({
  email,
  subscriptionStatus,
  onUpgradeClick
}: UserStatusHeaderProps) {
  const [showAlreadySubscribed, setShowAlreadySubscribed] = useState(false);

  const handleUpgradeClick = () => {
    // If they're already subscribed, show the modal
    if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      setShowAlreadySubscribed(true);
      return;
    }
    // Otherwise trigger the parent's upgrade handler
    onUpgradeClick?.();
  };

  const isFree = !subscriptionStatus || subscriptionStatus === 'canceled';
  const isPro = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
  const isPastDue = subscriptionStatus === 'past_due';

  return (
    <>
      <div className="px-4 py-3 bg-gradient-to-r from-violet-50/50 to-purple-50/30 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {email}
            </p>

            {/* Status Badge */}
            <div className="flex items-center gap-2 mt-1.5">
              {isFree && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  Free Plan
                </span>
              )}

              {subscriptionStatus === 'trialing' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                  <Gift className="w-3 h-3" />
                  Pro Trial
                </span>
              )}

              {subscriptionStatus === 'active' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  <Crown className="w-3 h-3" />
                  Pro Member
                </span>
              )}

              {isPastDue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                  Payment Issue
                </span>
              )}
            </div>

            {/* Upgrade CTA for Free Users */}
            {isFree && (
              <button
                onClick={handleUpgradeClick}
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors group"
              >
                <Sparkles className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                <span>Upgrade to Pro</span>
                <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Already Subscribed Modal */}
      {(subscriptionStatus === 'active' || subscriptionStatus === 'trialing') && (
        <AlreadySubscribedModal
          open={showAlreadySubscribed}
          onClose={() => setShowAlreadySubscribed(false)}
          subscriptionStatus={subscriptionStatus}
        />
      )}
    </>
  );
}
