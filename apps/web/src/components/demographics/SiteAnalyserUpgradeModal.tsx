'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Zap, Users, MapPin, TrendingUp, Lock } from 'lucide-react';

interface SiteAnalyserUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature?: 'save' | 'traffic' | 'count' | 'demographics';
  onUpgrade: () => void;
}

export function SiteAnalyserUpgradeModal({
  isOpen,
  onClose,
  feature = 'demographics',
  onUpgrade,
}: SiteAnalyserUpgradeModalProps) {
  const getFeatureMessage = () => {
    switch (feature) {
      case 'save':
        return 'Save your demographic analyses and revisit them anytime.';
      case 'traffic':
        return 'View detailed traffic flow data to understand site accessibility.';
      case 'count':
        return 'Access precise traffic count points from DfT data.';
      case 'demographics':
        return 'Unlock detailed demographic breakdowns for deeper insights.';
      default:
        return 'Access all SiteAnalyser Pro features.';
    }
  };

  const features = [
    { icon: Users, text: 'Detailed demographic breakdowns' },
    { icon: MapPin, text: 'Traffic flow & count point data' },
    { icon: TrendingUp, text: 'Save and revisit analyses' },
    { icon: Lock, text: 'Unlock all premium insights' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-white border border-[#E8E4DC] shadow-lg p-8 rounded-[18px]">
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-12 h-12 rounded-full bg-[rgba(112,51,255,0.08)] flex items-center justify-center">
            <Zap className="w-6 h-6 text-[#7033FF]" />
          </div>
        </div>

        {/* Title */}
        <DialogTitle className="text-[26px] font-[600] text-[#171419] font-inter text-center leading-[1.2] tracking-[-0.02em]">
          Upgrade to Pro
        </DialogTitle>

        {/* Message */}
        <p className="text-[15px] leading-[1.5] text-[#4A4451] font-inter text-center mt-3">
          {getFeatureMessage()}
        </p>

        {/* Features List */}
        <div className="mt-5 space-y-3">
          {features.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[rgba(112,51,255,0.08)] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#7033FF]" />
                </div>
                <p className="text-[14px] text-[#4A4451] font-inter">{item.text}</p>
              </div>
            );
          })}
        </div>

        {/* Pricing Note */}
        <p className="text-[13px] text-[#7C7588] font-inter text-center mt-4">
          30-day free trial • No charge • Cancel anytime
        </p>

        {/* Buttons */}
        <div className="mt-6 space-y-2.5">
          {/* Primary Button */}
          <button
            onClick={onUpgrade}
            className="w-full h-[44px] bg-[#7033FF] hover:bg-[#5421CC] text-white text-[15px] font-[600] rounded-[10px] font-inter transition-colors"
          >
            Start Free Trial
          </button>

          {/* Secondary Button */}
          <button
            onClick={onClose}
            className="w-full h-[40px] bg-transparent text-[#7C7588] hover:text-[#4A4451] hover:bg-[#FBFAF7] text-[14px] font-[500] rounded-[10px] font-inter transition-colors border border-[#E8E4DC]"
          >
            Maybe Later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
