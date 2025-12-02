'use client';

import { Button } from '@/components/ui/button';
import { PenTool, Mail, Star, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { AuthChoiceModal } from '@/components/auth/auth-choice-modal';
import { useAuth } from '@/contexts/auth-context';

export function FreePostingCTA() {
  const { user } = useAuth();

  return (
    <section className="relative py-16 md:py-24 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-amber-300/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        {/* Main Card with bold design */}
        <div className="relative bg-white rounded-[2.5rem] p-8 md:p-12 lg:p-16 border-4 border-orange-200 shadow-2xl overflow-hidden">
          {/* Decorative corner accent */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-orange-200/40 to-transparent rounded-bl-full"></div>

          {/* Bold badge with #3 */}
          <div className="flex justify-center mb-6 md:mb-8">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-white rounded-xl shadow-xl flex items-center justify-center transform rotate-3 border-2 border-orange-300">
                <span className="text-2xl md:text-3xl font-black text-orange-600">#3</span>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full border-2 border-orange-300">
                <span className="text-sm md:text-base font-bold text-orange-700 uppercase tracking-wide">Solution Three</span>
              </div>
            </div>
          </div>

          {/* Header with highlighted text */}
          <div className="relative text-center mb-10 md:mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-gray-900 mb-4 md:mb-5 leading-tight">
              Looking to buy or lease a site?{' '}
              <span className="relative inline-block">
                <span className="relative z-10">Post your requirements free</span>
                <span className="absolute inset-0 bg-orange-200 transform skew-y-1 rotate-1"></span>
              </span>
            </h2>
            <p className="text-xl md:text-2xl lg:text-3xl text-gray-700 font-bold max-w-2xl mx-auto mb-3">
              It is free now. It will be free forever. No catch.
            </p>
            <div className="flex items-center justify-center gap-2 text-base md:text-lg text-orange-600 font-bold">
              <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
              <span>Get discovered by 1,400+ property professionals</span>
            </div>
          </div>

          {/* Two Options - Bold design */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-10 md:mb-12">
            {/* Option 1: DIY */}
            <div className="group relative bg-gradient-to-br from-violet-50 to-purple-50 rounded-3xl p-6 md:p-8 border-3 border-violet-300 hover:border-violet-400 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
              {/* Decorative accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-300/30 to-transparent rounded-bl-full"></div>

              <div className="relative">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-5 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <PenTool className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>

                <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-3 relative">
                  Post yourself
                  <span className="absolute -bottom-1 left-0 w-16 h-2 bg-violet-200 transform -skew-x-12"></span>
                </h3>
                <p className="text-base md:text-lg text-gray-700 font-medium mb-6 md:mb-8">
                  Add your requirement in under 2 minutes with our simple form
                </p>

                {user ? (
                  <Button
                    asChild
                    size="lg"
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-black rounded-xl py-6 text-base md:text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
                  >
                    <Link href="/occupier/create-listing-quick">
                      Post your requirement
                    </Link>
                  </Button>
                ) : (
                  <AuthChoiceModal
                    redirectTo="/occupier/create-listing-quick"
                    title="Sign in to post requirements"
                    description="Access your account to create and manage property listings"
                  >
                    <Button
                      size="lg"
                      className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-black rounded-xl py-6 text-base md:text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
                    >
                      Post your requirement
                    </Button>
                  </AuthChoiceModal>
                )}
              </div>
            </div>

            {/* Option 2: Let us do it */}
            <div className="group relative bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl p-6 md:p-8 border-3 border-blue-300 hover:border-blue-400 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
              {/* Decorative accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-300/30 to-transparent rounded-bl-full"></div>

              <div className="relative">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-5 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <Mail className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>

                <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-3 relative">
                  Let us do it
                  <span className="absolute -bottom-1 left-0 w-16 h-2 bg-blue-200 transform -skew-x-12"></span>
                </h3>
                <p className="text-base md:text-lg text-gray-700 font-medium mb-6 md:mb-8">
                  Email us your requirement flyer and we will add it within 24 hours
                </p>

                <Button
                  asChild
                  size="lg"
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-black rounded-xl py-6 text-base md:text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
                >
                  <a href="mailto:rob@sitematcher.co.uk?subject=Add my requirement">
                    rob@sitematcher.co.uk
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* Why note - Bold design */}
          <div className="relative bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-6 md:p-8 border-2 border-amber-200 shadow-lg overflow-hidden">
            {/* Decorative sparkle */}
            <div className="absolute top-2 right-2 opacity-20">
              <Sparkles className="w-16 h-16 text-amber-500" />
            </div>

            <p className="relative text-base md:text-lg text-gray-800 text-center leading-relaxed font-medium">
              <span className="font-black text-gray-900 text-lg md:text-xl">Why?</span>{' '}
              We believe everyone should have access to the market, not just those who can afford premium listings. Your requirements deserve to be seen.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
