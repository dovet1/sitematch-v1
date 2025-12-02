'use client';

import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';
import { TrialSignupModal } from '@/components/TrialSignupModal';

export function FreeListingBanner() {
  return (
    <div className="mt-16 pt-12 border-t border-gray-200">
      <div className="max-w-2xl mx-auto px-6 py-8 text-center">
        {/* Subtle Icon */}
        <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-50 rounded-full mb-4">
          <Sparkles className="w-5 h-5 text-violet-500" />
        </div>

        {/* Softer Headline */}
        <h3 className="text-xl md:text-2xl font-semibold text-gray-800 mb-2">
          Discover 8,700+ more required locations
        </h3>

        {/* Concise Subtext */}
        <p className="text-base text-gray-600 mb-6 max-w-md mx-auto leading-relaxed">
          Access our complete directory with advanced search and filters, instant contact details, and requirements verified and added regularly.
        </p>

        {/* CTA */}
        <TrialSignupModal context="search" redirectPath="/search">
          <Button
            size="lg"
            className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Start Free Trial - View All Requirements
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </TrialSignupModal>

        <p className="text-sm text-gray-500 mt-4">
          30-day free trial • Cancel anytime
        </p>
      </div>
    </div>
  );
}
