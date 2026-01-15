'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight, MapPin, FileText, Ruler } from 'lucide-react';

export function ToolsTab() {
  const router = useRouter();

  const tools = [
    {
      id: 'site-sketcher',
      title: 'SiteSketcher',
      description: 'Draw and measure site boundaries with aerial imagery',
      icon: Ruler,
      stats: 'Sketch sites, calculate areas, plan parking',
      gradient: 'from-blue-500 to-cyan-600',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      onClick: () => {
        const hasVisited = localStorage.getItem('sitesketcher-visited');
        if (!hasVisited) {
          router.push('/sitesketcher?welcome=true');
        } else {
          router.push('/sitesketcher');
        }
      },
    },
    {
      id: 'site-demographer',
      title: 'SiteAnalyser',
      description: 'Analyse demographics for any UK location',
      icon: Users,
      stats: 'Population, households, age profiles & more',
      gradient: 'from-violet-500 to-purple-600',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      onClick: () => router.push('/new-dashboard/tools/site-demographer'),
    },
    {
      id: 'brochure-generator',
      title: 'SiteBrochure',
      description: 'Generate professional requirement brochures',
      icon: FileText,
      stats: 'Create branded PDF brochures in minutes',
      gradient: 'from-orange-500 to-red-600',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      onClick: () => router.push('/new-dashboard/brochures'),
      comingSoon: true,
    },
  ];

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900">Tools</h1>
          <p className="text-gray-600 mt-2 text-base sm:text-lg font-medium">
            Powerful tools to help you analyse sites
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isComingSoon = tool.comingSoon;
            return (
              <Card
                key={tool.id}
                className={`group relative overflow-hidden border-3 rounded-2xl sm:rounded-3xl ${
                  isComingSoon
                    ? 'border-gray-200 opacity-60 cursor-not-allowed'
                    : 'border-violet-200 hover:border-violet-400 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2'
                }`}
              >
                {/* Coming Soon Badge */}
                {isComingSoon && (
                  <div className="absolute top-4 right-4 bg-gray-600 text-white text-xs font-bold px-3 py-1 rounded-full z-10">
                    Coming Soon
                  </div>
                )}

                {/* Gradient border effect on hover */}
                {!isComingSoon && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                )}

                <div className="relative p-6 sm:p-8 space-y-4 sm:space-y-5">
                  {/* Icon */}
                  <div className={`inline-flex p-3 sm:p-4 rounded-xl sm:rounded-2xl ${
                    isComingSoon ? 'bg-gray-100' : tool.iconBg
                  } shadow-lg ${!isComingSoon && 'group-hover:scale-110'} transition-transform duration-300`}>
                    <Icon className={`h-6 w-6 sm:h-8 sm:w-8 ${
                      isComingSoon ? 'text-gray-400' : tool.iconColor
                    }`} />
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <h3 className={`text-xl sm:text-2xl font-black ${
                      isComingSoon ? 'text-gray-500' : 'text-gray-900'
                    }`}>
                      {tool.title}
                    </h3>
                    <p className={`text-sm sm:text-base font-medium ${
                      isComingSoon ? 'text-gray-400' : 'text-gray-600'
                    }`}>{tool.description}</p>
                  </div>

                  {/* Stats */}
                  <div className={`flex items-center gap-2 text-xs sm:text-sm font-medium ${
                    isComingSoon ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{tool.stats}</span>
                  </div>

                  {/* CTA Button */}
                  <Button
                    onClick={isComingSoon ? undefined : tool.onClick}
                    disabled={isComingSoon}
                    className={`w-full font-black rounded-xl py-5 sm:py-6 text-base sm:text-lg ${
                      isComingSoon
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : `bg-gradient-to-r ${tool.gradient} hover:opacity-90 text-white group-hover:shadow-xl transition-all duration-300`
                    }`}
                  >
                    {isComingSoon ? 'Coming Soon' : 'Launch Tool'}
                    {!isComingSoon && (
                      <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-2 transition-transform duration-300" />
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Coming Soon Message */}
        <div className="mt-8 sm:mt-12 p-6 sm:p-8 bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl sm:rounded-3xl border-3 border-violet-200 shadow-lg">
          <p className="text-sm sm:text-base text-gray-700 text-center font-medium">
            More tools coming soon! We're constantly building new features to help you make better property decisions.
          </p>
        </div>
      </div>
    </>
  );
}
