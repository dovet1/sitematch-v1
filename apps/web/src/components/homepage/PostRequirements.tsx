'use client';

import { FileText, Shield, CheckCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AuthChoiceModal } from '@/components/auth/auth-choice-modal';
import { useAuth } from '@/contexts/auth-context';

export function PostRequirements() {
  const { user } = useAuth();

  const steps = [
    {
      icon: FileText,
      title: 'Add your requirements',
      description: 'Complete your requirement listing in less than 2 minutes—completely free, no strings attached.',
      gradient: 'from-orange-400 to-orange-600',
    },
    {
      icon: Shield,
      title: 'Review and verification',
      description: 'Your requirement is reviewed and verified by our team to ensure quality and accuracy.',
      gradient: 'from-orange-500 to-orange-600',
    },
    {
      icon: CheckCircle,
      title: 'Added to directory',
      description: 'Requirements are added to our curated directory and emailed to our active community of property professionals.',
      gradient: 'from-orange-600 to-orange-700',
    },
  ];

  return (
    <section className="post-requirements relative py-24 bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-20 w-96 h-96 bg-orange-100/40 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-orange-100/40 rounded-full blur-3xl" />
      </div>

      <div className="post-requirements__container max-w-6xl mx-auto px-6 relative">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-orange-200 shadow-sm mb-6">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-orange-600">100% Free</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            Post requirements <span className="text-orange-500">(for free!)</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Let property professionals find you—post your requirements at no cost
          </p>
        </div>

        {/* Vertical Steps */}
        <div className="post-requirements__steps max-w-3xl mx-auto mb-12 space-y-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === steps.length - 1;

            return (
              <div key={index} className="relative group">
                {/* Connector line */}
                {!isLast && (
                  <div className="absolute left-[31px] top-[76px] w-1 h-[calc(100%+24px)] bg-gradient-to-b from-orange-300 via-orange-200 to-violet-200 opacity-40" />
                )}

                {/* Step card */}
                <div className="relative flex items-start gap-6 p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  {/* Icon with gradient background */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-16 h-16 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    {/* Step number badge */}
                    <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-violet-600 to-purple-700 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                      {index + 1}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors">
                      {step.title}
                    </h3>
                    <p className="text-base text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center">
          {!user ? (
            <AuthChoiceModal
              redirectTo="/occupier/create-listing-quick"
              title="Sign in to post requirements"
              description="Access your account to create and manage property listings"
            >
              <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-10 py-6 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                Post Your Requirement - Free
              </Button>
            </AuthChoiceModal>
          ) : (
            <Button
              asChild
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-10 py-6 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
            >
              <Link href="/occupier/create-listing-quick">
                Post Your Requirement - Free
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
