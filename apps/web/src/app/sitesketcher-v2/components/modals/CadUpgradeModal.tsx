'use client';

import { Button } from '../primitives/Button';
import { X, Layers, Check } from 'lucide-react';
import { PRICING, ACTIVE_PROMOTION } from '@/data/homepage-new/constants';
import { useState } from 'react';
import { toast } from 'sonner';

interface CadUpgradeModalProps {
  onClose: () => void;
  billingInterval: 'month' | 'year';
  onUpgrade?: () => void;
}

export function CadUpgradeModal({ onClose, billingInterval, onUpgrade }: CadUpgradeModalProps) {
  const [upgrading, setUpgrading] = useState(false);

  const plusPricing = billingInterval === 'month' ? PRICING.plus.monthly : PRICING.plus.annual;
  const proPricing = billingInterval === 'month' ? PRICING.pro.monthly : PRICING.pro.annual;

  const cadFeatures = [
    'Upload CAD drawings and site plans',
    'Calibrate scale with two-point measurement',
    'Adjust opacity and positioning',
    'Overlay multiple CAD layers',
    'Lock CAD images to prevent accidental edits',
  ];

  const handleUpgrade = async () => {
    setUpgrading(true);

    try {
      const response = await fetch('/api/stripe/upgrade-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTier: 'plus',
          billingInterval: billingInterval === 'month' ? 'monthly' : 'yearly',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upgrade failed');
      }

      toast.success('Successfully upgraded to Plus!');

      if (onUpgrade) {
        onUpgrade();
      }

      onClose();
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upgrade. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-sm-surface border border-sm-border rounded-[10px] shadow-2xl max-w-lg w-full">
        {/* Header with gradient */}
        <div className="relative p-6 bg-gradient-to-br from-violet-600 to-purple-700 rounded-t-[10px]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-[600] text-white">CAD Overlay is Plus Only</h2>
              <p className="text-sm text-white/80 mt-0.5">Upgrade to unlock CAD features</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-[13.5px] text-sm-ink/70 leading-relaxed">
            Overlay CAD drawings and site plans directly onto satellite imagery with precise calibration
            and adjustable transparency.
          </p>

          {/* Features list */}
          <div>
            <h3 className="text-sm font-[600] text-sm-ink mb-3">CAD Features</h3>
            <div className="space-y-2">
              {cadFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-2">
                  <div className="mt-0.5">
                    <Check className="w-4 h-4 text-[#7033FF]" />
                  </div>
                  <span className="text-[13.5px] text-sm-ink/70">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="p-4 bg-[#F5F1FF] border border-[rgba(112,51,255,0.2)] rounded-lg">
            {ACTIVE_PROMOTION.isActive && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FF6B35] rounded-full mb-3">
                <span className="text-[12px] font-[600] text-white">
                  {ACTIVE_PROMOTION.name} — {ACTIVE_PROMOTION.discountPercent}% off
                </span>
              </div>
            )}

            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-[600] text-sm-ink/60 uppercase tracking-wide">
                Pro → Plus Upgrade
              </span>
              {plusPricing.discount && (
                <span className="text-xs font-[600] text-[#7033FF]">{plusPricing.discount}</span>
              )}
            </div>

            <div className="flex items-baseline gap-2 mb-1">
              {plusPricing.strike && (
                <span className="text-lg line-through text-sm-ink/40">{plusPricing.strike}</span>
              )}
              <span className="text-2xl font-[600] text-sm-ink">{plusPricing.price}</span>
              <span className="text-sm text-sm-ink/60">{plusPricing.suffix}</span>
            </div>

            <p className="text-xs text-sm-ink/60 leading-relaxed">
              {plusPricing.footnote}
            </p>

            <div className="mt-3 pt-3 border-t border-[rgba(112,51,255,0.15)]">
              <p className="text-xs text-sm-ink/60">
                You'll be charged a prorated amount for the remainder of your billing period.
                Your new rate takes effect immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-sm-border bg-sm-bg/30">
          <Button variant="ghost" onClick={onClose} disabled={upgrading}>
            Maybe Later
          </Button>
          <Button
            variant="primary"
            onClick={handleUpgrade}
            disabled={upgrading}
            className="bg-[#7033FF] hover:bg-[#5421CC] text-white h-[44px]"
          >
            {upgrading ? 'Upgrading...' : 'Upgrade to Plus'}
          </Button>
        </div>
      </div>
    </div>
  );
}
