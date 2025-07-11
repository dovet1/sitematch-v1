'use client';

import { Award, Shield, TrendingUp, Users, CheckCircle, Star, MapPin, Clock } from 'lucide-react';

export function TrustAndSocialProof() {
  const stats = [
    {
      icon: Users,
      value: '2,500+',
      label: 'Active Users',
      description: 'Property professionals using SiteMatch',
    },
    {
      icon: CheckCircle,
      value: '850+',
      label: 'Successful Matches',
      description: 'Requirements connected to properties',
    },
    {
      icon: MapPin,
      value: '120+',
      label: 'UK Cities',
      description: 'Nationwide coverage across Britain',
    },
    {
      icon: Clock,
      value: '72hrs',
      label: 'Average Response',
      description: 'Time from listing to first contact',
    },
  ];

  const trustIndicators = [
    {
      icon: Shield,
      title: 'Verified Users',
      description: 'All users undergo identity verification',
    },
    {
      icon: Award,
      title: 'Quality Assured',
      description: 'Manual review of all requirements',
    },
    {
      icon: TrendingUp,
      title: 'Growing Network',
      description: 'Expanding community of professionals',
    },
    {
      icon: Star,
      title: 'Trusted Platform',
      description: '4.8/5 average user satisfaction',
    },
  ];

  return (
    <section className="trust-social-proof py-20 bg-white">
      <div className="trust-social-proof__container max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="trust-social-proof__title text-3xl font-bold text-gray-800 mb-4">
            Trusted by Property Professionals
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Join thousands of landlords, agents, and occupiers who trust SiteMatch to connect 
            property opportunities with requirements efficiently and securely.
          </p>
        </div>

        {/* Key Statistics */}
        <div className="trust-social-proof__stats grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div 
                key={index} 
                className="trust-social-proof__stat text-center p-6 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100 hover:border-violet-200 transition-all duration-300 hover:scale-105"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <div className="trust-social-proof__stat-value text-3xl font-bold text-gray-800 mb-2">
                  {stat.value}
                </div>
                <div className="trust-social-proof__stat-label text-lg font-semibold text-gray-700 mb-2">
                  {stat.label}
                </div>
                <div className="trust-social-proof__stat-description text-sm text-gray-600 leading-relaxed">
                  {stat.description}
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust Indicators */}
        <div className="trust-social-proof__indicators grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {trustIndicators.map((indicator, index) => {
            const Icon = indicator.icon;
            return (
              <div 
                key={index} 
                className="trust-social-proof__indicator text-center p-6 rounded-xl border border-gray-200 hover:border-violet-300 hover:shadow-md transition-all duration-300"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl mb-4">
                  <Icon className="w-6 h-6 text-violet-600" />
                </div>
                <h3 className="trust-social-proof__indicator-title text-lg font-semibold text-gray-800 mb-2">
                  {indicator.title}
                </h3>
                <p className="trust-social-proof__indicator-description text-sm text-gray-600 leading-relaxed">
                  {indicator.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Security and Privacy Notice */}
        <div className="trust-social-proof__security mt-16 text-center p-8 bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl border border-gray-200">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-3">
            Your Data is Secure
          </h3>
          <p className="text-gray-600 max-w-2xl mx-auto leading-relaxed">
            We employ bank-level security measures, GDPR compliance, and strict data protection 
            protocols to ensure your information remains private and secure at all times.
          </p>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .trust-social-proof {
            padding: 48px 0;
          }
          
          .trust-social-proof__title {
            font-size: 24px;
            margin-bottom: 16px;
          }
          
          .trust-social-proof__stats {
            gap: 16px;
          }
          
          .trust-social-proof__stat {
            padding: 20px;
          }
          
          .trust-social-proof__stat-value {
            font-size: 24px;
          }
          
          .trust-social-proof__indicators {
            gap: 16px;
          }
          
          .trust-social-proof__indicator {
            padding: 20px;
          }
        }
      `}</style>
    </section>
  );
}