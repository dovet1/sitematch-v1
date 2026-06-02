'use client';

import { Lock } from 'lucide-react';
import { ReactNode } from 'react';

interface PreviewOverlayProps {
  children: ReactNode;
  onUpgradeClick: () => void;
  title?: string;
  previewRows?: number;
}

export function PreviewOverlay({
  children,
  onUpgradeClick,
  title = "Full Data",
  previewRows = 3
}: PreviewOverlayProps) {
  return (
    <div className="relative">
      {/* Preview content with fade */}
      <div className="relative">
        <div className="max-h-[180px] overflow-hidden">
          {children}
        </div>

        {/* Fade gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-sm-surface via-sm-surface/80 to-transparent pointer-events-none" />
      </div>

      {/* Upgrade prompt card */}
      <div className="mt-3 bg-[#F5F1FF] border border-[rgba(112,51,255,0.2)] rounded-lg p-3">
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
  );
}
