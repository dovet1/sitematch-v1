'use client';

import { BarChart3, Layers3, MapPinned } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';

export function GapFinderProductShowcase() {
  const features = [
    {
      id: 'filter',
      title: 'Filter & Find Markets',
      description: 'Set your target catchment size and see exactly which built-up areas match your criteria',
      icon: BarChart3,
      screenshot: '/gapfinder/locations-sidebar.png',
      fallback: '/map-screenshot.png',
      color: 'blue',
      bullets: [
        'Filter by population size',
        'Set custom catchment areas',
        'Sort by affluence metrics',
        'Export location lists'
      ]
    },
    {
      id: 'analyze',
      title: 'Analyze Brand Gaps',
      description: 'See where operators are present, absent, or missing across comparable markets',
      icon: Layers3,
      screenshot: '/gapfinder/area-comparison.png',
      fallback: '/map-screenshot.png',
      color: 'violet',
      bullets: [
        'Compare locations side-by-side',
        'View gaps by category',
        'Track brand presence',
        'Identify white space opportunities'
      ]
    },
    {
      id: 'context',
      title: 'Understand Context',
      description: 'Drop a point and review nearby fascias to understand competitive context instantly',
      icon: MapPinned,
      screenshot: '/gapfinder/missing-brands.png',
      fallback: '/map-screenshot.png',
      color: 'purple',
      bullets: [
        'See neighboring operators',
        'Calculate distances to brands',
        'View store format types',
        'Assess competitive density'
      ]
    }
  ];

  return (
    <section className="relative py-16 md:py-24 bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-10 right-20 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-20 w-80 h-80 bg-cyan-300/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          className="mb-12 md:mb-16 max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-4 leading-tight">
            See exactly{' '}
            <span className="relative inline-block">
              <span className="relative z-10">where the gaps are</span>
              <span className="absolute inset-0 bg-cyan-200 transform -skew-y-1 rotate-1"></span>
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-gray-700 font-medium">
            Visual gap analysis powered by comprehensive UK retail data
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const colorClasses = feature.color === 'blue' ? {
              icon: 'from-blue-500 to-blue-600',
              border: 'border-blue-300',
              accent: 'from-blue-300/30',
            } : feature.color === 'violet' ? {
              icon: 'from-violet-500 to-purple-600',
              border: 'border-violet-300',
              accent: 'from-violet-300/30',
            } : {
              icon: 'from-purple-500 to-pink-600',
              border: 'border-purple-300',
              accent: 'from-purple-300/30',
            };

            return (
              <motion.div
                key={feature.id}
                className={`group relative bg-white rounded-3xl border-3 border-gray-200 hover:${colorClasses.border} hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 overflow-hidden ${
                  index === 1 ? 'lg:mt-8' : ''
                }`}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{
                  duration: 0.5,
                  delay: 0.2 + index * 0.15,
                  ease: "easeOut"
                }}
              >
                {/* Decorative corner gradient */}
                <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${colorClasses.accent} to-transparent rounded-bl-full`}></div>

                {/* Content */}
                <div className="relative p-6 md:p-8">
                  {/* Icon */}
                  <div className={`relative w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br ${colorClasses.icon} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 mb-6`}>
                    <Icon className="w-8 h-8 md:w-10 md:h-10 text-white relative z-10" />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-3">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-base md:text-lg text-gray-700 leading-relaxed font-medium mb-6">
                    {feature.description}
                  </p>

                  {/* Screenshot */}
                  <div className="mb-6 rounded-2xl overflow-hidden border-2 border-gray-200 shadow-lg">
                    <Image
                      src={feature.screenshot}
                      alt={`${feature.title} screenshot`}
                      width={600}
                      height={400}
                      className="w-full h-auto"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = feature.fallback;
                      }}
                    />
                  </div>

                  {/* Feature bullets */}
                  <ul className="space-y-3">
                    {feature.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm md:text-base text-gray-700 font-medium">
                        <svg className="w-6 h-6 flex-shrink-0 mt-0.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
