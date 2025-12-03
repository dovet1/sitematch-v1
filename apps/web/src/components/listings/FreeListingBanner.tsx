'use client';

import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';
import { TrialSignupModal } from '@/components/TrialSignupModal';

export function FreeListingBanner() {
  return (
    <div className="mt-8 md:mt-16 pt-8 md:pt-12 border-t border-gray-200">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 md:py-8 text-center">
        {/* Subtle Icon */}
        <div className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-violet-50 rounded-full mb-3 md:mb-4">
          <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-violet-500" />
        </div>

        {/* Softer Headline */}
        <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800 mb-2 px-2">
          Discover 7,500+ more required locations
        </h3>

        {/* Concise Subtext */}
        <p className="text-sm sm:text-base text-gray-600 mb-5 md:mb-6 max-w-md mx-auto leading-relaxed px-2">
          Access our complete directory with advanced search and filters, instant contact details, and requirements verified and added regularly.
        </p>

        {/* CTA - Mobile Optimized */}
        <TrialSignupModal context="search" redirectPath="/search">
          <Button
            size="lg"
            className="bg-violet-600 hover:bg-violet-700 text-white w-full sm:w-auto px-6 sm:px-8 py-5 md:py-6 text-base md:text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <span className="hidden sm:inline">Start Free Trial - View All Requirements</span>
            <span className="sm:hidden">Start Free Trial</span>
            <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </TrialSignupModal>

        <p className="text-xs sm:text-sm text-gray-500 mt-3 md:mt-4">
          30-day free trial • Cancel anytime
        </p>
      </div>
    </div>
  );
}
