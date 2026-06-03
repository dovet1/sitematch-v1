'use client';

import { X, Loader2 } from 'lucide-react';
import { Check } from '@/components/homepage-new/icons/Check';
import { getUpgradePricing } from '@/data/homepage-new/constants';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface CadUpgradeModalProps {
  onClose: () => void;
  billingInterval: 'month' | 'year';
  onUpgrade?: () => void;
}

export function CadUpgradeModal({ onClose, billingInterval, onUpgrade }: CadUpgradeModalProps) {
  const [upgrading, setUpgrading] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // Get pricing comparison using centralized helper
  const pricing = getUpgradePricing(billingInterval);

  const cadFeatures = [
    'Everything in Pro tier',
    'Add your CAD drawings to site sketches',
    'Full access to GapFinder',
    'Priority email support',
  ];

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    setUpgradeError(null);

    try {
      const response = await fetch('/api/stripe/upgrade-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTier: 'plus',
          billingInterval, // Already 'month' | 'year', don't convert
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || data.details || 'Upgrade failed');
      }

      // Check if database sync is pending
      if (data.tierUpdatePending) {
        setSyncPending(true);
        setUpgrading(false);
        return;
      }

      // Success! Show toast and reload page
      toast.success('Successfully upgraded to Plus!');

      if (onUpgrade) {
        onUpgrade();
      }

      // Hard reload to trigger useSubscriptionTier refetch
      window.location.reload();
    } catch (error) {
      console.error('Upgrade error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upgrade. Please try again.';
      setUpgradeError(errorMessage);
      toast.error(errorMessage);
      setUpgrading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-[18px] shadow-2xl border border-[#E8E4DC] overflow-hidden relative max-h-[calc(100vh-3rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        aria-describedby="paywall-description"
      >
        {/* Close Button */}
        <button
          className="absolute right-6 top-6 text-[#7C7588] hover:text-[#171419] transition-colors z-10"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 min-h-[500px]">
          {/* Left Column - Features */}
          <div className="bg-[#FBFAF7] p-8 md:p-10 border-b md:border-r md:border-b-0 border-[#E8E4DC] flex flex-col justify-center">
            <div className="space-y-6">
              <div>
                <h3 className="text-[15px] font-[600] text-[#171419] mb-4 tracking-[-0.01em]">
                  Plus tier benefits:
                </h3>
              </div>

              <ul className="space-y-4">
                {cadFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check size={16} color="#7033FF" />
                    <span className="text-[14px] text-[#171419] leading-[1.5]">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column - Upgrade Content */}
          <div className="bg-white p-8 md:p-10 flex flex-col justify-center">
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 id="paywall-title" className="text-[24px] font-[600] text-[#171419] mb-2 tracking-[-0.02em]">
                  Upgrade to Plus
                </h2>
                <p id="paywall-description" className="text-[14px] text-[#7C7588]">
                  Get access to CAD Overlay and advanced site planning tools
                </p>
              </div>

              {/* Pricing Breakdown */}
              <div className="bg-[#F5F1FF] rounded-[10px] p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#4A4451]">Current: Pro</span>
                  <span className="text-[15px] font-[600] text-[#171419]">
                    {pricing.current.display}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#4A4451]">New: Plus</span>
                  <span className="text-[15px] font-[600] text-[#7033FF]">
                    {pricing.new.display}
                  </span>
                </div>
                <div className="border-t border-[#EEE9FF] pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[14px] text-[#4A4451]">Additional</span>
                    <span className="text-[16px] font-[600] text-[#7033FF]">
                      {pricing.difference.display}
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {upgradeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-[10px]">
                  <p className="text-[13px] text-red-700">{upgradeError}</p>
                </div>
              )}

              {/* Sync Pending Display */}
              {syncPending && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-[10px]">
                  <p className="text-[13px] text-blue-700 mb-2">
                    Your upgrade is being processed. Please refresh the page.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full h-[36px] bg-blue-600 hover:bg-blue-700 text-white text-[14px] font-[600] rounded-[8px] transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>
              )}

              {/* CTA Button */}
              <button
                onClick={handleUpgrade}
                disabled={upgrading || syncPending}
                className="w-full h-[44px] bg-[#7033FF] hover:bg-[#5421CC] text-white text-[15px] font-[600] rounded-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#7033FF]"
              >
                {upgrading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Upgrading...</span>
                  </div>
                ) : (
                  'Upgrade to Plus Now'
                )}
              </button>

              {/* Footer Note */}
              <p className="text-[12px] text-center text-[#7C7588] leading-[1.5]">
                You'll be charged a prorated amount for the remainder of your billing period
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
