'use client';

import { Target, Users, Clock, Shield, Zap, TrendingUp } from 'lucide-react';

export function Benefits() {
  const benefits = [
    {
      icon: Target,
      title: 'Curated requirements',
      description: 'Every requirement is manually reviewed and verified before publication.',
    },
    {
      icon: Users,
      title: 'Free exposure',
      description: 'List your requirements at no cost and get discovered by agents, landlords, and property experts across the market.',
    },
    {
      icon: Clock,
      title: 'Save time',
      description: 'Up-to-date requirements, with smart filters and an interactive map to help you find the right fit for your site quickly.',
    },
    {
      icon: Shield,
      title: 'Exclusive network',
      description: 'Access requirements not available on other portals. Have new requirements delivered straight to your inbox.',
    },
    {
      icon: Zap,
      title: 'Assess sites faster',
      description: 'Use SiteSketcher to get quick, clear insights into whether a site is viable for your needs.',
    },
    {
      icon: TrendingUp,
      title: 'Showcase your agency',
      description: 'Add your agency to the directory and link it directly to the requirements you’re managing, making it easy for landlords and occupiers to connect with you.',
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-br from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Why property professionals choose SiteMatcher
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Focus on closing deals, not finding them
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="group relative bg-white rounded-2xl p-8 border border-gray-200 hover:border-violet-300 hover:shadow-xl transition-all duration-300"
              >
                {/* Icon */}
                <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
