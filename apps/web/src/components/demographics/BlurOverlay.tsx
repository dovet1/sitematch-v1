'use client';

import { Lock, Sparkles } from 'lucide-react';

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
      <div className="absolute flex items-center justify-center bg-gradient-to-br from-violet-50/95 via-purple-50/95 to-violet-50/95 backdrop-blur-sm" style={{ left: '-1rem', right: '-1rem', top: '-0.75rem', bottom: '-0.75rem' }}>
        <button
          onClick={onUpgradeClick}
          className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/90 backdrop-blur-sm border-2 border-violet-200 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div className="text-center space-y-1">
            <h4 className="text-base font-bold text-gray-900">{title}</h4>
            <p className="text-sm font-semibold text-violet-600 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Upgrade to unlock
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
