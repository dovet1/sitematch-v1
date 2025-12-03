'use client';

import { Button } from '@/components/ui/button';
import { Ruler, BarChart3, ArrowRight, Sparkles, Star } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import Image from 'next/image';
import { motion } from 'framer-motion';

export function ToolsShowcase() {
  const { user } = useAuth();

  const tools = [
    {
      id: 'sitesketcher',
      name: 'SiteSketcher',
      icon: Ruler,
      tagline: 'Visualize site potential instantly',
      description: 'Draw building footprints, calculate areas, plan parking - see if a site works before you commit. Perfect for quick feasibility studies.',
      features: [
        'Draw unlimited polygons and buildings',
        'Calculate areas and dimensions',
        'Add parking space overlays',
        '3D visualization mode',
        'Save and share sketches'
      ],
      freeFeatures: [
        'Draw up to 2 polygons',
        'Add up to 2 parking blocks',
        '3D mode access',
        'Location search'
      ],
      href: '/sitesketcher',
      screenshot: '/screenshots/sitesketcher-preview.png',
      color: 'blue'
    },
    {
      id: 'siteanalyser',
      name: 'SiteAnalyser',
      icon: BarChart3,
      tagline: 'Understand your catchment area',
      description: 'Analyze demographics, traffic patterns, and catchment data to understand who will walk through the door. Make data-driven site decisions.',
      features: [
        'Population and affluence analysis',
        'Traffic flow visualization',
        'Age demographics breakdown',
        'Ethnic diversity metrics',
        'Custom area selection'
      ],
      freeFeatures: [
        'View population scores',
        'See affluence metrics',
        'Traffic heatmap (preview)',
        'Select custom areas'
      ],
      href: '/new-dashboard/tools/site-demographer',
      screenshot: '/screenshots/siteanalyser-preview.png',
      color: 'violet'
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
        {/* Bold header */}
        <motion.div
          className="mb-12 md:mb-16 max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="flex items-start gap-4 mb-6 justify-center">
            <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl shadow-2xl flex items-center justify-center transform -rotate-3">
              <span className="text-3xl md:text-4xl font-black text-blue-600">#2</span>
            </div>
            <div className="text-center md:text-left">
              <div className="inline-block mb-2 px-3 py-1 bg-blue-100 rounded-full border-2 border-blue-300">
                <span className="text-xs md:text-sm font-bold text-blue-700 uppercase tracking-wider">Solution Two</span>
              </div>
            </div>
          </div>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-4 leading-tight text-center">
            Assess site viability in{' '}
            <span className="relative inline-block">
              <span className="relative z-10">minutes, not hours</span>
              <span className="absolute inset-0 bg-cyan-200 transform -skew-y-1 rotate-1"></span>
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-gray-700 font-medium text-center max-w-3xl mx-auto">
            Our growing toolkit helps you make faster, data-driven decisions
          </p>
        </motion.div>

        {/* Tools Grid - Bold design */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10 mb-16 md:mb-20">
          {tools.map((tool, index) => {
            const Icon = tool.icon;
            const colorClasses = (tool.color === 'blue' ? {
              badge: 'bg-blue-100 border-blue-300 text-blue-800',
              icon: 'from-blue-500 to-blue-600',
              button: 'from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700',
              accent: 'text-blue-600',
              highlight: 'bg-blue-200/60'
            } : {
              badge: 'bg-violet-100 border-violet-300 text-violet-800',
              icon: 'from-violet-500 to-purple-600',
              button: 'from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700',
              accent: 'text-violet-600',
              highlight: 'bg-violet-200/60'
            });

            return (
              <motion.div
                key={tool.id}
                className={`group relative bg-white rounded-3xl border-3 border-gray-200 hover:border-${tool.color}-300 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 overflow-hidden ${
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
                <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${colorClasses.icon} opacity-5 rounded-bl-full`}></div>

                {/* Tool Header */}
                <div className="relative p-6 md:p-8 pb-6">
                  <div className="flex items-start gap-4 mb-6">
                    <div className={`relative w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br ${colorClasses.icon} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                      <Icon className="w-8 h-8 md:w-10 md:h-10 text-white relative z-10" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">
                        {tool.name}
                      </h3>
                      <p className={`text-sm md:text-base font-bold ${colorClasses.accent}`}>
                        {tool.tagline}
                      </p>
                    </div>
                  </div>

                  <p className="text-base md:text-lg text-gray-700 leading-relaxed font-medium mb-6">
                    {tool.description}
                  </p>

                  {/* Free Features Badge */}
                  {!user && (
                    <div className={`inline-flex items-center gap-2 px-4 py-2 ${colorClasses.badge} border-2 rounded-full text-sm font-bold mb-5`}>
                      <Sparkles className="w-4 h-4" />
                      Try free with limited features
                    </div>
                  )}

                  {/* Features List - Bolder */}
                  <div className="space-y-2 mb-6">
                    <p className="text-base md:text-lg font-black text-gray-900 mb-4">
                      {user ? 'Key Features:' : 'Free features include:'}
                    </p>
                    <ul className="space-y-3">
                      {(user ? tool.features : tool.freeFeatures).slice(0, 4).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm md:text-base text-gray-700 font-medium">
                          <svg className={`w-6 h-6 flex-shrink-0 mt-0.5 ${colorClasses.accent}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Bold CTA */}
                <div className="px-6 md:px-8 pb-6 md:pb-8">
                  <Button
                    asChild
                    className={`w-full bg-gradient-to-r ${colorClasses.button} text-white font-black rounded-xl py-6 text-base md:text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300`}
                  >
                    <Link href={tool.href}>
                      {user ? `Open ${tool.name}` : `Try ${tool.name} Free`}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  {!user && (
                    <p className="text-center text-sm text-gray-600 font-semibold mt-4">
                      No sign-up required to try • Upgrade for full access
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Henry's Testimonial - Bold design */}
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
        >
          <div className="relative bg-white/95 backdrop-blur-sm rounded-[2.5rem] p-8 md:p-12 lg:p-16 border-4 border-white/60 shadow-2xl overflow-hidden">
            {/* Decorative gradient accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-300/30 via-blue-300/20 to-transparent rounded-full blur-3xl"></div>

            {/* Giant quotation mark */}
            <div className="absolute -top-6 -left-4 text-[16rem] md:text-[20rem] font-serif text-white/40 select-none pointer-events-none leading-none">"</div>

            <div className="relative z-10">
              {/* Stars - Bigger with glow */}
              <div className="flex gap-2 mb-6 md:mb-8 justify-center md:justify-start">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="relative">
                    <Star className="w-7 h-7 md:w-8 md:h-8 text-yellow-400 fill-current drop-shadow-lg" />
                    <Star className="absolute inset-0 w-7 h-7 md:w-8 md:h-8 text-yellow-300 fill-current blur-sm" />
                  </div>
                ))}
              </div>

              {/* Quote - Much larger and bolder */}
              <blockquote className="text-xl md:text-2xl lg:text-3xl text-gray-900 mb-8 md:mb-10 leading-relaxed font-bold text-center md:text-left">
                <span className="relative">
                  "SiteMatcher shows me who is active and exactly what they are looking for. I get contacts instantly, and if I want to test an idea,{' '}
                  <span className="relative inline-block">
                    <span className="relative z-10">SiteSketcher lets me draw a quick feasibility in minutes</span>
                    <span className="absolute inset-0 bg-cyan-200/60 transform -skew-y-1"></span>
                  </span>
                  . It is straightforward, simple, and saves a huge amount of time."
                </span>
              </blockquote>

              {/* Author - Larger */}
              <div className="flex items-center gap-5 md:gap-6 justify-center md:justify-start">
                <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden relative ring-4 ring-white shadow-2xl transform hover:scale-110 transition-transform duration-300">
                  <Image
                    src="/testimonials/henry-foreman.jpg"
                    alt="Henry Foreman"
                    width={96}
                    height={96}
                    className="object-cover"
                  />
                </div>
                <div className="text-center md:text-left">
                  <p className="font-black text-gray-900 text-xl md:text-2xl mb-1">Henry Foreman</p>
                  <p className="text-base md:text-lg font-bold text-blue-600">Partner</p>
                  <p className="text-sm md:text-base text-gray-600 font-medium">FMX Urban Property Advisory</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        {user && (
          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">
              Both tools are included with your subscription
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
