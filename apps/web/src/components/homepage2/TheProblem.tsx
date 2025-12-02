'use client';

import { X } from 'lucide-react';

export function TheProblem() {
  const painPoints = [
    {
      emoji: '📄',
      title: 'Flyers everywhere',
      description: 'Requirements scattered across multiple platforms and formats'
    },
    {
      emoji: '📅',
      title: 'Out-of-date listings',
      description: 'Following up on requirements that are months old'
    },
    {
      emoji: '🔍',
      title: 'Hidden opportunities',
      description: 'Missing active occupiers because they are not on traditional portals'
    }
  ];

  return (
    <section className="relative py-16 md:py-24 overflow-hidden bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      {/* Decorative crossed-out background */}
      <div className="absolute inset-0 opacity-5">
        <X className="absolute top-20 left-10 w-32 h-32 text-red-600 rotate-12" />
        <X className="absolute bottom-20 right-10 w-40 h-40 text-orange-600 -rotate-6" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* Bold asymmetric header */}
        <div className="mb-12 md:mb-16 max-w-4xl">
          <div className="inline-block mb-4 px-4 py-2 bg-red-100 rounded-full border-2 border-red-300 rotate-[-1deg]">
            <span className="text-sm font-bold text-red-700 uppercase tracking-wide">Sound familiar?</span>
          </div>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-4 leading-tight">
            Tired of <span className="relative inline-block">
              <span className="relative z-10">outdated requirements</span>
              <span className="absolute inset-0 bg-red-200 transform -skew-y-1 -rotate-1"></span>
            </span>{' '}
            and <span className="relative inline-block">
              <span className="relative z-10">wasted flyers</span>
              <span className="absolute inset-0 bg-orange-200 transform skew-y-1 rotate-1"></span>
            </span>?
          </h2>
          <p className="text-xl md:text-2xl text-gray-700 font-medium">
            You are not alone. Finding the right occupiers should not feel like searching for a needle in a haystack.
          </p>
        </div>

        {/* Staggered pain point cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {painPoints.map((point, index) => (
            <div
              key={index}
              className={`relative group ${
                index === 1 ? 'md:mt-8' : index === 2 ? 'md:mt-16' : ''
              }`}
            >
              {/* Big emoji background */}
              <div className="absolute -top-6 -right-6 text-8xl md:text-9xl opacity-10 group-hover:opacity-20 transition-opacity duration-300 select-none">
                {point.emoji}
              </div>

              {/* Card */}
              <div className="relative bg-white rounded-3xl p-6 md:p-8 border-2 border-gray-200 shadow-lg hover:shadow-2xl hover:border-red-300 transition-all duration-300 hover:-translate-y-1">
                {/* Bold emoji */}
                <div className="text-5xl md:text-6xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                  {point.emoji}
                </div>

                {/* Title with red underline */}
                <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-3 relative inline-block">
                  {point.title}
                  <span className="absolute bottom-0 left-0 w-full h-2 bg-red-200 transform -skew-x-12"></span>
                </h3>

                {/* Description */}
                <p className="text-base md:text-lg text-gray-700 leading-relaxed font-medium">
                  {point.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
