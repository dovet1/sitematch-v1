'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight, MapPin } from 'lucide-react';

export function ToolsTab() {
  const router = useRouter();

  const tools = [
    {
      id: 'site-demographer',
      title: 'SiteDemographer',
      description: 'Analyze demographics for any UK location',
      icon: Users,
      stats: 'Population, households, age profiles & more',
      gradient: 'from-violet-500 to-purple-600',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      onClick: () => router.push('/new-dashboard/tools/site-demographer'),
    },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tools</h1>
          <p className="text-gray-500 mt-1">
            Powerful tools to help you analyze and understand property markets
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card
                key={tool.id}
                className="group relative overflow-hidden border border-gray-200 hover:border-violet-300 transition-all duration-300 hover:shadow-lg"
              >
                {/* Gradient border effect on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                <div className="relative p-6 space-y-4">
                  {/* Icon */}
                  <div className={`inline-flex p-3 rounded-lg ${tool.iconBg}`}>
                    <Icon className={`h-6 w-6 ${tool.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {tool.title}
                    </h3>
                    <p className="text-sm text-gray-600">{tool.description}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{tool.stats}</span>
                  </div>

                  {/* CTA Button */}
                  <Button
                    onClick={tool.onClick}
                    className={`w-full bg-gradient-to-r ${tool.gradient} hover:opacity-90 text-white group-hover:shadow-md transition-all duration-300`}
                  >
                    Launch Tool
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Coming Soon Message */}
        <div className="mt-12 p-6 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border border-violet-100">
          <p className="text-sm text-gray-600 text-center">
            More tools coming soon! We're constantly building new features to help you make better property decisions.
          </p>
        </div>
      </div>
    </>
  );
}
