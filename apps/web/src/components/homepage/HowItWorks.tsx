'use client';

import { Search, FileText, Users, CheckCircle } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      icon: Search,
      title: 'Search & Discover',
      description: 'Use our advanced search to find commercial property requirements that match your portfolio or interests.',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: FileText,
      title: 'Review Details',
      description: 'Access comprehensive requirement details including location, size, use class, and specific business needs.',
      color: 'bg-green-50 text-green-600',
    },
    {
      icon: Users,
      title: 'Connect Directly',
      description: 'Contact requirement listers directly through secure contact details and start meaningful conversations.',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      icon: CheckCircle,
      title: 'Close Deals',
      description: 'Work together to finalize arrangements and create successful property matches that benefit everyone.',
      color: 'bg-orange-50 text-orange-600',
    },
  ];

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="heading-2 font-bold text-foreground mb-4">
            How SiteMatch Works
          </h2>
          <p className="body-large text-muted-foreground max-w-2xl mx-auto">
            Our simple 4-step process connects property opportunities with requirements efficiently and transparently.
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                {/* Connector Line (hidden on mobile, visible on lg+) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-border z-0" />
                )}
                
                <div className="relative bg-background rounded-lg p-6 shadow-sm border border-border hover:shadow-md transition-shadow">
                  {/* Step Number */}
                  <div className="absolute -top-3 -left-3 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${step.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="heading-4 font-semibold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="body-small text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="body-large text-muted-foreground mb-6">
            Ready to get started?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#hero-search"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Start Searching
            </a>
            <a
              href="/occupier/create-listing?fresh=true"
              className="inline-flex items-center justify-center px-6 py-3 border border-border text-foreground rounded-lg font-medium hover:bg-accent transition-colors"
            >
              Post a Requirement
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}