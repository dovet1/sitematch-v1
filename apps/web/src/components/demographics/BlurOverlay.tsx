'use client';

import { Lock } from 'lucide-react';

interface BlurOverlayProps {
  children: React.ReactNode;
  onUpgradeClick: () => void;
  title?: string;
}

export function BlurOverlay({ children, onUpgradeClick, title = "Premium Feature" }: BlurOverlayProps) {
  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="blur-sm pointer-events-none select-none">
        {children}
      </div>

      {/* Overlay with upgrade prompt - stretch to fill parent section */}
      <div className="absolute flex items-center justify-center bg-[#F5F1FF]/95 border border-[rgba(112,51,255,0.2)] rounded-lg" style={{ left: '-1rem', right: '-1rem', top: '-0.75rem', bottom: '-0.75rem' }}>
        <div className="p-3">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-[#7033FF] mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-[#171419] leading-relaxed">
                <span className="font-[600]">{title}</span> requires Pro
              </p>
              <button
                onClick={onUpgradeClick}
                className="mt-2 text-xs font-[600] text-[#7033FF] hover:text-[#5421CC] transition-colors"
              >
                Upgrade to unlock →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
