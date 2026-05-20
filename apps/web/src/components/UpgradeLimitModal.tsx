'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Zap } from 'lucide-react';

interface UpgradeLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitType: 'polygon' | 'parking';
  onUpgrade: () => void;
}

export function UpgradeLimitModal({
  isOpen,
  onClose,
  limitType,
  onUpgrade,
}: UpgradeLimitModalProps) {
  const message =
    limitType === 'polygon'
      ? 'Upgrade to add unlimited shapes and unlock all SiteSketcher features.'
      : 'Upgrade to add unlimited parking blocks and unlock all SiteSketcher features.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] bg-white border border-[#E8E4DC] shadow-lg p-8 rounded-[18px]">
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
          {message}
        </p>

        {/* Feature Note */}
        <p className="text-[13px] text-[#7C7588] font-inter text-center mt-2">
          With Pro, you can also save, load, and export your sketches.
        </p>

        {/* Buttons */}
        <div className="mt-6 space-y-2.5">
          {/* Primary Button */}
          <button
            onClick={onUpgrade}
            className="w-full h-[44px] bg-[#7033FF] hover:bg-[#5421CC] text-white text-[15px] font-[600] rounded-[10px] font-inter transition-colors"
          >
            Get Started Now
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
