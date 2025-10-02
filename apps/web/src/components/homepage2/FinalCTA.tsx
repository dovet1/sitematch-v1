'use client';

import { Button } from '@/components/ui/button';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { ArrowRight } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="py-24 bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
          Ready to find the perfect match for your site?
        </h2>
        <p className="text-xl md:text-2xl text-violet-100 mb-10 max-w-3xl mx-auto">
          Join our community of property professionals who've found qualified requirements through SiteMatcher
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <TrialSignupModal context="search" redirectPath="/search">
            <Button
              size="lg"
              className="bg-white text-violet-700 hover:bg-violet-50 px-10 py-7 text-lg font-semibold rounded-xl shadow-2xl hover:shadow-white/20 transition-all duration-300 hover:scale-105"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </TrialSignupModal>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mt-12 md:mt-16 pt-12 md:pt-16 border-t border-white/20">
          <div>
            <p className="text-4xl md:text-5xl font-bold text-white mb-2">1,200+</p>
            <p className="text-violet-100">Active Requirements</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-bold text-white mb-2">500+</p>
            <p className="text-violet-100">Property Professionals</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-bold text-white mb-2">20+</p>
            <p className="text-violet-100">Sectors</p>
          </div>
        </div>
      </div>
    </section>
  );
}
