'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { VideoLightbox } from '@/components/VideoLightbox';
import Image from 'next/image';
import { motion } from 'framer-motion';

export function GapFinderVideoSection() {
  const [showVideoLightbox, setShowVideoLightbox] = useState(false);

  // YouTube video ID for demo (using homepage demo as placeholder)
  const DEMO_VIDEO_ID = 'KBOKzYEdPm0';

  return (
    <>
      <section className="relative py-16 md:py-20 bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            className="text-center mb-8 md:mb-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
              See GapFinder in action
            </h2>
            <p className="text-lg md:text-xl text-gray-700 font-medium">
              Watch how property teams use GapFinder to identify opportunities
            </p>
          </motion.div>

          <motion.div
            className="relative group cursor-pointer"
            onClick={() => setShowVideoLightbox(true)}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          >
            {/* Decorative accent behind video */}
            <div className="absolute top-4 left-4 w-full h-full bg-gradient-to-br from-blue-200 to-cyan-200 rounded-3xl transform -rotate-2"></div>

            <div className="relative bg-white rounded-3xl shadow-2xl p-3 md:p-4 border-4 border-blue-200 transform group-hover:scale-[1.02] transition-transform duration-500">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-100">
                {/* Video thumbnail */}
                <Image
                  src="/gapfinder/map-markers.png"
                  alt="GapFinder demo video thumbnail"
                  width={1200}
                  height={675}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/map-screenshot.png';
                  }}
                />

                {/* Play button overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600/30 to-purple-600/30 flex items-center justify-center group-hover:from-violet-600/40 group-hover:to-purple-600/40 transition-colors duration-300">
                  <div className="relative">
                    {/* Pulsing ring */}
                    <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-20"></div>

                    {/* Play button */}
                    <div className="relative bg-white rounded-full p-6 md:p-8 shadow-2xl group-hover:scale-110 transition-transform duration-300">
                      <Play className="w-10 h-10 md:w-14 md:h-14 text-violet-600 fill-current" />
                    </div>
                  </div>
                </div>

                {/* Duration badge */}
                <div className="absolute bottom-4 right-4 bg-black/80 text-white px-3 py-1 rounded-lg text-sm font-bold">
                  2:30
                </div>
              </div>
            </div>

            {/* Floating stat cards */}
            <div className="hidden md:block absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl p-4 border-2 border-violet-200 transform group-hover:scale-110 transition-transform duration-300">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-black text-gray-900">3,500+</p>
                  <p className="text-xs font-bold text-gray-600">Brands tracked</p>
                </div>
              </div>
            </div>

            <div className="hidden md:block absolute -top-6 -right-6 bg-white rounded-xl shadow-xl p-4 border-2 border-blue-200 transform group-hover:scale-110 transition-transform duration-300">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-black text-gray-900">10K+</p>
                  <p className="text-xs font-bold text-gray-600">Locations analyzed</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <VideoLightbox
        isOpen={showVideoLightbox}
        onClose={() => setShowVideoLightbox(false)}
        videoId={DEMO_VIDEO_ID}
        title="GapFinder Product Demo"
      />
    </>
  );
}
