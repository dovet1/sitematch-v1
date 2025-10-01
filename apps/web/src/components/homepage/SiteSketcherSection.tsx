'use client';

import { Ruler, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function SiteSketcherSection() {
  return (
    <section className="sitesketcher-section py-12 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="sitesketcher-section__container max-w-6xl mx-auto px-6">
        {/* Compact Banner Card */}
        <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 to-purple-700 rounded-3xl shadow-2xl">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400/20 rounded-full blur-2xl" />
          </div>

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6 p-8 md:p-10">
            {/* Left: Icon & Content */}
            <div className="flex items-start gap-4 md:gap-6 flex-1">
              <div className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Ruler className="w-7 h-7 md:w-8 md:h-8 text-white" />
              </div>

              <div className="text-center md:text-left">
                <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                  <h3 className="text-2xl md:text-3xl font-bold text-white">
                    SiteSketcher
                  </h3>
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                </div>
                <p className="text-violet-100 text-sm md:text-base max-w-lg">
                  Paid subscribers get access to our easy-to-use site feasibility tool
                </p>
              </div>
            </div>

            {/* Right: CTA */}
            <div className="flex-shrink-0">
              <Button
                asChild
                variant="secondary"
                className="bg-white text-violet-700 hover:bg-violet-50 px-6 py-3 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              >
                <Link href="/sitesketcher/landing" className="flex items-center gap-2">
                  Learn more
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
