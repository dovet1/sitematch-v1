'use client';

import { Search, Eye, Mail, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { TrialSignupModal } from '@/components/TrialSignupModal';

export function BrowseRequirements() {
  const steps = [
    {
      icon: Search,
      title: 'Sign up for free trial',
      description: 'Get 30 days free access to our curated requirement directory with no commitment.',
      gradient: 'from-violet-400 to-violet-600',
    },
    {
      icon: Eye,
      title: 'View verified requirements',
      description: 'Browse thousands of verified requirements across the UK and Ireland.',
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      icon: Mail,
      title: 'Contact requirement owners',
      description: 'Connect directly with requirement owners to discuss opportunities.',
      gradient: 'from-purple-500 to-purple-700',
    },
  ];

  return (
    <section className="browse-requirements relative py-24 bg-white overflow-hidden">
      {/* Decorative background elements - subtle */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -right-20 w-96 h-96 bg-violet-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -left-20 w-96 h-96 bg-purple-100/40 rounded-full blur-3xl" />
      </div>

      <div className="browse-requirements__container max-w-6xl mx-auto px-6 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 backdrop-blur-sm rounded-full border border-violet-200 shadow-sm mb-6">
            <Sparkles className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-semibold text-violet-600">30 Days Free Trial</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Browse requirements
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Access our curated directory of property requirements from verified companies
          </p>
        </div>

        {/* Horizontal Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {steps.map((step, index) => {
            const Icon = step.icon;

            return (
              <div key={index} className="relative group">
                {/* Premium card with light theme */}
                <div className="relative h-full p-8 bg-gradient-to-br from-white to-violet-50/30 rounded-3xl border-2 border-violet-200 shadow-lg hover:shadow-2xl hover:border-violet-300 transition-all duration-300 hover:-translate-y-2">
                  {/* Step number - top right */}
                  <div className="absolute top-6 right-6 w-8 h-8 bg-gradient-to-br from-violet-600 to-purple-700 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {index + 1}
                  </div>

                  {/* Icon with subtle glow */}
                  <div className="relative mb-6">
                    <div className={`w-20 h-20 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-10 h-10 text-white" />
                    </div>
                    {/* Subtle glow effect */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${step.gradient} rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-300`} />
                  </div>

                  {/* Content */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-violet-600 transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-base text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {/* Connector arrow for desktop */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                      <ArrowRight className="w-6 h-6 text-violet-400" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <TrialSignupModal context="search" redirectPath="/search">
            <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white px-10 py-6 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              Start free trial
            </Button>
          </TrialSignupModal>

          <Button
            asChild
            variant="outline"
            className="border-2 border-violet-300 text-violet-700 hover:bg-violet-50 hover:border-violet-400 px-10 py-6 text-lg font-semibold rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-105"
          >
            <Link href="/pricing">
              View pricing
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
