'use client';

import { Filter, Download, MapPin, GitCompare, Database } from 'lucide-react';
import { motion } from 'framer-motion';
import { AutoplayMedia } from './AutoplayMedia';

interface Capability {
  id: string;
  title: string;
  description: string;
  videoPath: string;
  icon: any;
  accentColor: 'violet' | 'blue' | 'purple' | 'cyan' | 'pink';
  bullets: string[];
}

const capabilities: Capability[] = [
  {
    id: 'quick-filtering',
    title: 'Quick Filtering',
    description: 'Quickly find suitable locations using our intuitive filters. Set population thresholds, affluence metrics, and custom catchment areas to identify the perfect markets for your brand.',
    videoPath: '/gapfinder/gf_landing_vids/select_filters.mp4',
    icon: Filter,
    accentColor: 'violet',
    bullets: [
      'Filter by population size',
      'Set custom catchment areas',
      'Sort by affluence metrics',
      'Instant results visualization',
    ],
  },
  {
    id: 'csv-export',
    title: 'CSV Export',
    description: 'Export locations to a CSV file for sharing with colleagues. Download comprehensive data including coordinates, demographics, and brand presence for offline analysis and reporting.',
    videoPath: '/gapfinder/gf_landing_vids/select_filters.mp4',
    icon: Download,
    accentColor: 'blue',
    bullets: [
      'Export filtered locations',
      'Include demographic data',
      'Share with team members',
      'Import into analysis tools',
    ],
  },
  {
    id: 'brand-presence',
    title: 'Brand Presence Analysis',
    description: 'See which brands are present or missing from a selected area. Visualize market saturation and identify white space opportunities with our comprehensive brand database.',
    videoPath: '/gapfinder/gf_landing_vids/select_filters.mp4',
    icon: MapPin,
    accentColor: 'purple',
    bullets: [
      'Track 3,500+ brands',
      'Identify market gaps',
      'View competitor density',
      'Analyze category coverage',
    ],
  },
  {
    id: 'area-comparison',
    title: 'Area Comparison',
    description: 'Compare two areas to identify missing brands. Side-by-side analysis reveals opportunities by showing which operators are present in one market but absent in another.',
    videoPath: '/gapfinder/gf_landing_vids/select_filters.mp4',
    icon: GitCompare,
    accentColor: 'cyan',
    bullets: [
      'Compare locations side-by-side',
      'Identify unique brands',
      'Spot expansion opportunities',
      'Export comparison results',
    ],
  },
  {
    id: 'requirements-overlay',
    title: 'Requirements Overlay',
    description: 'Overlay our unique database of verified, curated requirements. See which retailers are actively seeking locations in your target markets, giving you critical intelligence for property acquisition.',
    videoPath: '/gapfinder/gf_landing_vids/select_filters.mp4',
    icon: Database,
    accentColor: 'pink',
    bullets: [
      'Verified requirement data',
      'Updated daily',
      'See active searches',
      'Contact details included',
    ],
  },
];

const colorConfig = {
  violet: {
    gradient: 'from-violet-500 to-purple-600',
    bg: 'from-violet-50 to-purple-50',
    border: 'border-violet-300',
    text: 'text-violet-700',
  },
  blue: {
    gradient: 'from-blue-500 to-cyan-600',
    bg: 'from-blue-50 to-cyan-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
  },
  purple: {
    gradient: 'from-purple-500 to-pink-600',
    bg: 'from-purple-50 to-pink-50',
    border: 'border-purple-300',
    text: 'text-purple-700',
  },
  cyan: {
    gradient: 'from-cyan-500 to-blue-500',
    bg: 'from-cyan-50 to-blue-50',
    border: 'border-cyan-300',
    text: 'text-cyan-700',
  },
  pink: {
    gradient: 'from-pink-500 to-purple-600',
    bg: 'from-pink-50 to-purple-50',
    border: 'border-pink-300',
    text: 'text-pink-700',
  },
};

export function GapFinderCapabilitiesShowcase() {
  return (
    <section className="relative">
      {capabilities.map((capability, index) => {
        const Icon = capability.icon;
        const colors = colorConfig[capability.accentColor];
        const isEven = index % 2 === 0;

        return (
          <div
            key={capability.id}
            className={`relative py-16 md:py-20 lg:py-24 overflow-hidden ${
              isEven ? `bg-gradient-to-br ${colors.bg}` : 'bg-white'
            }`}
          >
            {/* Decorative background blobs */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className={`absolute ${
                  isEven ? 'top-10 right-10' : 'bottom-10 left-10'
                } w-96 h-96 bg-gradient-to-br ${colors.gradient} opacity-10 rounded-full blur-3xl`}
              />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
              <div
                className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center ${
                  isEven ? '' : 'lg:flex-row-reverse'
                }`}
              >
                {/* Media Column */}
                <motion.div
                  className={`relative ${isEven ? 'lg:order-1' : 'lg:order-2'}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  {/* Decorative accent behind video */}
                  <div
                    className={`absolute top-4 ${
                      isEven ? 'right-4' : 'left-4'
                    } w-full h-full bg-gradient-to-br ${colors.gradient} opacity-20 rounded-3xl transform ${
                      isEven ? 'rotate-3' : '-rotate-3'
                    }`}
                  />

                  {/* Video container */}
                  <div className={`relative bg-white rounded-3xl shadow-2xl p-3 md:p-4 border-4 ${colors.border}`}>
                    <div className="aspect-[1770/1080] rounded-2xl overflow-hidden bg-slate-50 ring-2 ring-gray-100">
                      <AutoplayMedia
                        videoSrc={capability.videoPath}
                        alt={`${capability.title} demonstration`}
                        priority={index === 0}
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Content Column */}
                <motion.div
                  className={`${isEven ? 'lg:order-2' : 'lg:order-1'}`}
                  initial={{ opacity: 0, y: 60 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  {/* Icon */}
                  <div
                    className={`relative w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br ${colors.gradient} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl mb-6 transform hover:scale-110 hover:rotate-3 transition-all duration-300`}
                  >
                    <Icon className="w-8 h-8 md:w-10 md:h-10 text-white relative z-10" />
                  </div>

                  {/* Title */}
                  <h3 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4 leading-tight">
                    {capability.title}
                  </h3>

                  {/* Description */}
                  <p className="text-lg md:text-xl text-gray-700 leading-relaxed font-medium mb-6">
                    {capability.description}
                  </p>

                  {/* Feature bullets */}
                  <ul className="space-y-3">
                    {capability.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-base md:text-lg text-gray-700 font-medium">
                        <svg className="w-6 h-6 flex-shrink-0 mt-0.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
