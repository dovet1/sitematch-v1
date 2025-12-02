'use client';

import { CheckCircle, TrendingUp, Award, Star } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';

export function DatabaseDifferentiators() {

  const differentiators = [
    {
      emoji: '🎯',
      icon: CheckCircle,
      title: 'Bang up to date',
      stat: '50% verified in last 30 days',
      description: 'We verify our listings at least quarterly. Half of our requirements were confirmed active within the last month. No more chasing dead leads.',
      color: 'from-green-500 to-emerald-600'
    },
    {
      emoji: '📊',
      icon: TrendingUp,
      title: 'Largest in the UK',
      stat: '700+ listings • 7,500+ locations',
      description: 'The largest directory of verified site requirements on the UK market. We are constantly growing, with new requirements added weekly.',
      color: 'from-blue-500 to-cyan-600'
    },
    {
      emoji: '👔',
      icon: Award,
      title: 'Founders who get it',
      stat: 'Led by industry veterans',
      description: 'Our CEO, Rob Lithgow, has been an Acquisitions Director for Aldi, Lidl and M&S for over a decade. We know what property professionals care about.',
      color: 'from-violet-500 to-purple-600'
    }
  ];

  return (
    <section className="relative py-16 md:py-24 overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-blue-600">
      {/* Decorative background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* How we help - Transition title */}
        <motion.div
          className="text-center mb-12 md:mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-3 md:mb-4">
            How we help
          </h2>
          <div className="w-24 h-1.5 bg-white mx-auto rounded-full"></div>
        </motion.div>

        {/* Bold header with number badge */}
        <motion.div
          className="mb-12 md:mb-16 max-w-4xl"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
        >
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl shadow-2xl flex items-center justify-center transform rotate-3">
              <span className="text-3xl md:text-4xl font-black text-violet-600">#1</span>
            </div>
            <div>
              <div className="inline-block mb-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                <span className="text-xs md:text-sm font-bold text-white uppercase tracking-wider">Solution One</span>
              </div>
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-3 leading-tight">
                SiteMatcher - The UK's most trusted directory
              </h2>
              <p className="text-lg md:text-2xl text-violet-100 font-medium">
                What makes our database different
              </p>
            </div>
          </div>
        </motion.div>

        {/* Differentiator Cards - Bold asymmetric design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 mb-16 md:mb-20">
          {differentiators.map((diff, index) => {
            const Icon = diff.icon;
            return (
              <motion.div
                key={index}
                className={`group relative ${
                  index === 1 ? 'md:mt-12' : index === 2 ? 'md:mt-6' : ''
                }`}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{
                  duration: 0.5,
                  delay: 0.4 + index * 0.15,
                  ease: "easeOut"
                }}
              >
                {/* Giant emoji background */}
                <div className="absolute -top-8 -right-8 text-9xl md:text-[12rem] opacity-10 group-hover:opacity-20 transition-opacity duration-500 select-none pointer-events-none">
                  {diff.emoji}
                </div>

                {/* Card */}
                <div className="relative bg-white/95 backdrop-blur-sm rounded-3xl p-6 md:p-8 border-2 border-white/50 shadow-2xl hover:shadow-violet-500/20 hover:scale-105 transition-all duration-500 overflow-hidden">
                  {/* Colored accent bar */}
                  <div className={`absolute top-0 left-0 w-2 h-full bg-gradient-to-b ${diff.color}`}></div>

                  {/* Icon with bold emoji */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`relative w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br ${diff.color} rounded-2xl flex items-center justify-center shadow-xl transform group-hover:rotate-6 group-hover:scale-110 transition-all duration-500`}>
                      <Icon className="w-8 h-8 md:w-10 md:h-10 text-white relative z-10" />
                    </div>
                    <span className="text-5xl md:text-6xl transform group-hover:scale-125 transition-transform duration-300">
                      {diff.emoji}
                    </span>
                  </div>

                  {/* Title with underline accent */}
                  <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-3 relative inline-block">
                    {diff.title}
                    <span className={`absolute -bottom-1 left-0 w-full h-3 bg-gradient-to-r ${diff.color} opacity-30 transform -skew-x-12`}></span>
                  </h3>

                  {/* Stat - HUGE and bold */}
                  <p className={`text-xl md:text-2xl lg:text-3xl font-black bg-gradient-to-r ${diff.color} bg-clip-text text-transparent mb-4 md:mb-5`}>
                    {diff.stat}
                  </p>

                  {/* Description */}
                  <p className="text-base md:text-lg text-gray-700 leading-relaxed font-medium">
                    {diff.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Kerry's Testimonial - Bold dramatic design */}
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.85, ease: "easeOut" }}
        >
          <div className="relative bg-white/95 backdrop-blur-sm rounded-[2.5rem] p-8 md:p-12 lg:p-16 border-4 border-white/60 shadow-2xl overflow-hidden">
            {/* Decorative gradient accent in corner */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-yellow-300/30 via-orange-300/20 to-transparent rounded-full blur-3xl"></div>

            {/* Giant quotation mark background */}
            <div className="absolute -top-6 -left-4 text-[16rem] md:text-[20rem] font-serif text-white/40 select-none pointer-events-none leading-none">"</div>

            <div className="relative z-10">
              {/* Stars - BIGGER and more prominent */}
              <div className="flex gap-2 mb-6 md:mb-8 justify-center md:justify-start">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="relative">
                    <Star className="w-7 h-7 md:w-8 md:h-8 text-yellow-400 fill-current drop-shadow-lg" />
                    <Star className="absolute inset-0 w-7 h-7 md:w-8 md:h-8 text-yellow-300 fill-current blur-sm" />
                  </div>
                ))}
              </div>

              {/* Quote - MUCH larger and bolder */}
              <blockquote className="text-xl md:text-2xl lg:text-3xl text-gray-900 mb-8 md:mb-10 leading-relaxed font-bold text-center md:text-left">
                <span className="relative">
                  "With SiteMatcher I can see the market in seconds. Searching and filtering is straightforward, contacts are right there, and the flyers give me the detail when I need it.{' '}
                  <span className="relative inline-block">
                    <span className="relative z-10">It is easily the fastest way</span>
                    <span className="absolute inset-0 bg-yellow-200/60 transform -skew-y-1"></span>
                  </span>
                  {' '}I have found to spot real opportunities."
                </span>
              </blockquote>

              {/* Author - Larger and more prominent */}
              <div className="flex items-center gap-5 md:gap-6 justify-center md:justify-start">
                <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden relative ring-4 ring-white shadow-2xl transform hover:scale-110 transition-transform duration-300">
                  <Image
                    src="/testimonials/kerry-northfold.jpg"
                    alt="Kerry Northfold"
                    width={96}
                    height={96}
                    className="object-cover"
                  />
                </div>
                <div className="text-center md:text-left">
                  <p className="font-black text-gray-900 text-xl md:text-2xl mb-1">Kerry Northfold</p>
                  <p className="text-base md:text-lg font-bold text-violet-600">Director & Advisor</p>
                  <p className="text-sm md:text-base text-gray-600 font-medium">Vedra Property Group & PMA</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
