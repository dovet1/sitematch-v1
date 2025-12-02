'use client';

import { Button } from '@/components/ui/button';
import { Ruler, BarChart3, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';

export function ToolsShowcase() {
  const { user } = useAuth();

  const tools = [
    {
      id: 'sitesketcher',
      name: 'SiteSketcher',
      icon: Ruler,
      tagline: 'Visualize site potential instantly',
      description: 'Draw building footprints, add parking layouts, and assess site capacity with our intuitive mapping tool. Perfect for quick feasibility studies.',
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
      description: 'Analyze demographics, traffic patterns, and population data for any location. Make data-driven decisions about site selection.',
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
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full border border-blue-200 mb-4">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Professional Tools</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Powerful tools for property professionals
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Evaluate sites, analyze demographics, and make informed decisions with our suite of professional tools.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const colorClasses = {
              blue: {
                badge: 'bg-blue-50 border-blue-200 text-blue-700',
                icon: 'from-blue-500 to-blue-600',
                button: 'bg-blue-600 hover:bg-blue-700 border-blue-600',
                accent: 'text-blue-600'
              },
              violet: {
                badge: 'bg-violet-50 border-violet-200 text-violet-700',
                icon: 'from-violet-500 to-violet-600',
                button: 'bg-violet-600 hover:bg-violet-700 border-violet-600',
                accent: 'text-violet-600'
              }
            }[tool.color];

            return (
              <div
                key={tool.id}
                className="group bg-white rounded-2xl border-2 border-gray-200 hover:border-gray-300 hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Tool Header */}
                <div className="p-8 pb-6">
                  <div className="flex items-start gap-4 mb-6">
                    <div className={`w-14 h-14 bg-gradient-to-br ${colorClasses.icon} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-gray-900 mb-1">
                        {tool.name}
                      </h3>
                      <p className={`text-sm font-medium ${colorClasses.accent}`}>
                        {tool.tagline}
                      </p>
                    </div>
                  </div>

                  <p className="text-gray-600 leading-relaxed mb-6">
                    {tool.description}
                  </p>

                  {/* Free Features Badge */}
                  {!user && (
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 ${colorClasses.badge} border rounded-full text-xs font-semibold mb-4`}>
                      <Sparkles className="w-3 h-3" />
                      Try free with limited features
                    </div>
                  )}

                  {/* Features List */}
                  <div className="space-y-2 mb-6">
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      {user ? 'Key Features:' : 'Free features include:'}
                    </p>
                    <ul className="space-y-2">
                      {(user ? tool.features : tool.freeFeatures).slice(0, 4).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                          <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${colorClasses.accent}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTA */}
                <div className="px-8 pb-8">
                  <Button
                    asChild
                    className={`w-full ${colorClasses.button} text-white font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-lg`}
                  >
                    <Link href={tool.href}>
                      {user ? `Open ${tool.name}` : `Try ${tool.name} Free`}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  {!user && (
                    <p className="text-center text-xs text-gray-500 mt-3">
                      No sign-up required to try • Upgrade for full access
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

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
