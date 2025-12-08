'use client';

import { useState } from 'react';
import { X, Sparkles, Zap } from 'lucide-react';
import { TrialSignupModal } from './TrialSignupModal';
import { Button } from './ui/button';

interface UpgradeBannerProps {
  title: string;
  features: string[];
  context?: 'search' | 'sitesketcher' | 'agency' | 'general';
  onDismiss?: () => void;
}

export function UpgradeBanner({
  title,
  features,
  context = 'sitesketcher',
  onDismiss
}: UpgradeBannerProps) {
  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-violet-50 via-purple-50 to-violet-50 border-2 border-violet-200 rounded-2xl p-6 md:p-8 shadow-xl overflow-hidden">
      {/* Decorative gradient circles */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-400/20 to-purple-500/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-400/20 to-violet-500/20 rounded-full blur-2xl"></div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-violet-200/50 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-5 h-5 text-violet-600" />
      </button>

      <div className="relative">
        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-violet-600 to-purple-600 rounded-2xl shadow-lg mb-4 mx-auto md:mx-0">
          <Sparkles className="w-7 h-7 text-white" />
        </div>

        {/* Title */}
        <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-4 text-center md:text-left leading-tight">
          {title}
        </h3>

        {/* Features list */}
        <div className="mb-6">
          <p className="text-base md:text-lg font-bold text-violet-900 mb-3">
            Upgrade to unlock:
          </p>
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-3 text-sm md:text-base text-gray-700 font-medium">
                <svg
                  className="w-6 h-6 flex-shrink-0 mt-0.5 text-violet-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA Button */}
        <TrialSignupModal context={context}>
          <Button
            className="w-full md:w-auto bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-black rounded-xl py-6 px-8 text-base md:text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            <Zap className="mr-2 h-5 w-5" />
            Start Free Trial - Upgrade Now
          </Button>
        </TrialSignupModal>

        <p className="text-center md:text-left text-sm text-gray-600 font-semibold mt-4">
          30 days free trial • No charge • Cancel anytime
        </p>
      </div>
    </div>
  );
}
