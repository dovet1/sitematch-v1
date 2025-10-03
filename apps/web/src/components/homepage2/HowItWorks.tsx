'use client';

import { UserPlus, Search, Mail } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      number: 1,
      icon: UserPlus,
      title: 'Sign up for free trial',
      description: 'Start your 30-day free trial in under 30 seconds. Cancel anytime.',
    },
    {
      number: 2,
      icon: Search,
      title: 'Browse verified requirements',
      description: 'Search thousands of commercial property requirements filtered by location, size, and use class.',
    },
    {
      number: 3,
      icon: Mail,
      title: 'Connect directly',
      description: 'Contact requirement owners directly with one click. No forms, no waiting.',
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Get started in 3 simple steps
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            From signup to your first connection in less than 5 minutes
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative">
                {/* Card with subtle background */}
                <div className="bg-gradient-to-br from-violet-50 to-purple-50/30 rounded-2xl p-8 h-full border border-violet-100 hover:border-violet-200 transition-all duration-300 hover:shadow-lg">
                  {/* Icon with number badge */}
                  <div className="relative inline-flex mb-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    {/* Number badge */}
                    <div className="absolute -top-2 -right-2 w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                      <span className="text-sm font-bold text-white">{step.number}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
