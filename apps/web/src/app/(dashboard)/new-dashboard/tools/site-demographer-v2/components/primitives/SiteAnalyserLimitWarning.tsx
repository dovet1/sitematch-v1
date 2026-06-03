'use client';

import { Lock } from 'lucide-react';

interface SiteAnalyserLimitWarningProps {
  message: string;
  onUpgrade?: () => void;
}

export function SiteAnalyserLimitWarning({ message, onUpgrade }: SiteAnalyserLimitWarningProps) {
  return (
    <div className="bg-[#F5F1FF] border border-[rgba(112,51,255,0.2)] rounded-lg p-3 mb-4">
      <div className="flex items-start gap-3">
        <Lock className="w-4 h-4 text-[#7033FF] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#171419] leading-relaxed">
            {message}
          </p>
          {onUpgrade && (
            <button
              onClick={onUpgrade}
              className="mt-2 text-xs font-[600] text-[#7033FF] hover:text-[#5421CC] transition-colors"
            >
              Upgrade to Pro →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
