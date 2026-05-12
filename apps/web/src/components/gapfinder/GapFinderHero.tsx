'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { VideoLightbox } from '@/components/VideoLightbox';
import Image from 'next/image';

interface GapFinderHeroProps {
  isLoggedIn: boolean;
}

export function GapFinderHero({ isLoggedIn }: GapFinderHeroProps) {
  const [showVideoLightbox, setShowVideoLightbox] = useState(false);

  // YouTube video ID for demo (using homepage demo as placeholder)
  const DEMO_VIDEO_ID = 'KBOKzYEdPm0';

  return (
    <section className="relative bg-gradient-to-br from-violet-50 via-purple-50 to-blue-50 py-8 md:py-12 lg:py-14 overflow-hidden min-h-[calc(100vh-64px)] flex items-center">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-[500px] h-[500px] bg-violet-300/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-purple-300/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Content */}
          <div className="text-center lg:text-left">
            {/* Social proof badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-100 rounded-full border-2 border-violet-300 mb-4 md:mb-5 transform rotate-[-0.5deg] shadow-md">
              <svg className="w-5 h-5 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm md:text-base font-bold text-violet-700 uppercase tracking-wide">Trusted by 1,400+ property professionals</span>
            </div>

            {/* Main headline */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-gray-900 mb-4 md:mb-5 leading-tight">
              Find retail opportunities{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-gray-900">in minutes, not weeks</span>
                <span className="absolute inset-0 bg-violet-200 transform skew-y-1 rotate-1"></span>
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl lg:text-2xl text-gray-700 font-semibold mb-5 md:mb-6 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              Identify underserved markets • Compare locations side-by-side • Export evidence for reports
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-4">
              {isLoggedIn ? (
                <>
                  <Button
                    asChild
                    size="lg"
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-5 text-base md:text-lg font-black rounded-2xl shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300"
                  >
                    <a href="#pricing">Start Free Trial - 50% Off</a>
                  </Button>
                  <Button
                    onClick={() => setShowVideoLightbox(true)}
                    size="lg"
                    variant="outline"
                    className="border-3 border-violet-300 hover:border-violet-400 hover:bg-violet-50 px-8 py-5 text-base md:text-lg font-black rounded-2xl hover:shadow-xl transition-all duration-300"
                  >
                    Watch Demo
                  </Button>
                </>
              ) : (
                <>
                  <TrialSignupModal context="gapfinder" redirectPath="/gapfinder">
                    <Button size="lg" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-8 py-5 text-base md:text-lg font-black rounded-2xl shadow-2xl hover:shadow-violet-500/50 hover:scale-105 transition-all duration-300">
                      Start Free Trial - 50% Off
                    </Button>
                  </TrialSignupModal>
                  <Button
                    onClick={() => setShowVideoLightbox(true)}
                    size="lg"
                    variant="outline"
                    className="border-3 border-violet-300 hover:border-violet-400 hover:bg-violet-50 px-8 py-5 text-base md:text-lg font-black rounded-2xl hover:shadow-xl transition-all duration-300"
                  >
                    Watch Demo
                  </Button>
                </>
              )}
            </div>

            {/* Trust badges */}
            <p className="text-sm md:text-base text-gray-600 font-medium text-center lg:text-left">
              30-day free trial • No credit card required • Cancel anytime
            </p>
          </div>

          {/* Right: Product screenshot */}
          <div className="relative mt-6 lg:mt-0">
            {/* Decorative accent behind screenshot */}
            <div className="absolute top-4 right-4 w-full h-full bg-gradient-to-br from-violet-200 to-purple-200 rounded-3xl transform rotate-3"></div>

            <div className="relative bg-white rounded-3xl shadow-2xl p-3 md:p-4 border-4 border-violet-200 transform hover:scale-[1.02] transition-transform duration-500">
              <div className="aspect-[16/10] md:aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 ring-2 ring-violet-100">
                <Image
                  src="/gapfinder/hero-interface.png"
                  alt="GapFinder interface showing map with 56 retail locations"
                  width={1200}
                  height={900}
                  className="w-full h-full object-cover"
                  priority
                  onError={(e) => {
                    // Fallback to map screenshot if hero image not available
                    const target = e.target as HTMLImageElement;
                    target.src = '/map-screenshot.png';
                  }}
                />
              </div>
            </div>

            {/* Floating stats card */}
            <div className="hidden md:block absolute -bottom-8 -left-8 bg-white rounded-2xl shadow-2xl p-5 border-3 border-green-200 hover:scale-110 transition-transform duration-300">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-black text-gray-900">56</p>
                  <p className="text-sm font-bold text-gray-600">Locations found in seconds</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Demo Modal */}
      <VideoLightbox
        isOpen={showVideoLightbox}
        onClose={() => setShowVideoLightbox(false)}
        videoId={DEMO_VIDEO_ID}
        title="GapFinder Demo"
      />
    </section>
  );
}
