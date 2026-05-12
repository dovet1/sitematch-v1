'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import Link from 'next/link';

export function SummerSaleBanner() {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('summer-sale-banner-dismissed');
    setIsDismissed(dismissed === 'true');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('summer-sale-banner-dismissed', 'true');
    setIsDismissed(true);
  };

  if (isDismissed) return null;

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 justify-center">
          <Sparkles className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
          <span className="font-black text-xs sm:text-sm md:text-base text-center">
            Summer Sale - 50% Off All Plans - Limited Time
          </span>
          <Link
            href="#pricing"
            className="hidden sm:inline font-bold underline hover:no-underline ml-2 whitespace-nowrap"
          >
            View Pricing
          </Link>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-white/20 rounded flex-shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>
    </div>
  );
}
