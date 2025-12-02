'use client';

import { Button } from '@/components/ui/button';
import { PenTool, Mail, Star, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { AuthChoiceModal } from '@/components/auth/auth-choice-modal';
import { useAuth } from '@/contexts/auth-context';

export function FreePostingCTA() {
  const { user } = useAuth();

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Main Card */}
        <div className="bg-white rounded-3xl p-8 md:p-12 border-2 border-orange-200 shadow-2xl">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full border border-orange-300">
              <Star className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-700">Solution #3</span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8 md:mb-10">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 md:mb-4">
              Looking to buy or lease a site?{' '}
              <span className="text-orange-600">Post your requirements free</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-2">
              It's free now. It'll be free forever. No catch.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-orange-600 font-medium">
              <Sparkles className="w-4 h-4" />
              <span>Get discovered by 1,400+ property professionals</span>
            </div>
          </div>

          {/* Two Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8">
            {/* Option 1: DIY */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 md:p-8 border-2 border-violet-200">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <PenTool className="w-6 h-6 text-white" />
              </div>

              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                Post yourself
              </h3>
              <p className="text-sm md:text-base text-gray-600 mb-6">
                Add your requirement in under 2 minutes with our simple form
              </p>

              {user ? (
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
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
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Post your requirement
                  </Button>
                </AuthChoiceModal>
              )}
            </div>

            {/* Option 2: Let us do it */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 md:p-8 border-2 border-blue-200">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <Mail className="w-6 h-6 text-white" />
              </div>

              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                Let us do it
              </h3>
              <p className="text-sm md:text-base text-gray-600 mb-6">
                Email us your requirement flyer and we will add it within 24 hours
              </p>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full border-2 border-blue-300 hover:border-blue-400 hover:bg-blue-50 text-blue-700 hover:text-blue-800 font-semibold rounded-xl transition-all duration-200"
              >
                <a href="mailto:rob@sitematcher.co.uk?subject=Add my requirement">
                  Email your flyer
                </a>
              </Button>
            </div>
          </div>

          {/* Why note */}
          <div className="bg-gray-50 rounded-xl p-4 md:p-6 border border-gray-200">
            <p className="text-sm md:text-base text-gray-700 text-center leading-relaxed">
              <span className="font-semibold text-gray-900">Why?</span>{' '}
              We believe everyone should have access to the market, not just those who can afford premium listings. Your requirements deserve to be seen.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
