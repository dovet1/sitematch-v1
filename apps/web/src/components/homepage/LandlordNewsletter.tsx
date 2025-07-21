'use client';

import { useState } from 'react';
import { Search, Mail, Building, MapPin, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandlordNewsletter() {
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const userTypeOptions = [
    { label: 'Agent', value: 'agent' },
    { label: 'Investor', value: 'investor' },
    { label: 'Landlord', value: 'landlord' },
    { label: 'Vendor', value: 'vendor' }
  ];

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          persona: userType
        }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        setEmail('');
        setUserType('');
        setTimeout(() => setIsSubscribed(false), 5000);
      } else {
        throw new Error('Failed to subscribe');
      }
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      alert('Failed to subscribe. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="landlord-section py-20 bg-white" style={{ overflowX: 'hidden', maxWidth: '100vw', margin: 0, padding: '80px 0' }}>
      <div className="landlord-section__container w-full max-w-7xl" style={{ margin: '0 auto', paddingLeft: '24px', paddingRight: '24px' }}>
        <div className="text-center mb-16">
          <h2 className="landlord-section__title text-3xl font-bold text-gray-800 mb-4">
            Are You a Landlord?
          </h2>
          <p className="landlord-section__subtitle text-lg text-gray-600 max-w-3xl mx-auto">
            Connect with quality tenants actively seeking commercial space. Browse verified 
            requirements or stay updated with new opportunities in your area.
          </p>
        </div>

        <div className="landlord-section__content flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-4xl items-center justify-center" style={{ margin: '0 auto', width: '100%' }}>
          {/* Search Requirements Option */}
          <div className="landlord-section__option landlord-section__option--search bg-gradient-to-br from-violet-600 to-purple-700 rounded-3xl p-10 text-center text-white md:hover:scale-105 transition-all duration-300 shadow-xl">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-2xl mb-6 backdrop-blur-sm">
              <Search className="w-10 h-10 text-white" />
            </div>
            
            <h3 className="landlord-section__option-title text-2xl font-bold mb-4">
              Search Requirements Now
            </h3>
            <p className="landlord-section__option-description text-lg mb-6 opacity-90 leading-relaxed">
              Browse hundreds of verified commercial property requirements from businesses 
              actively seeking space. Find tenants for your properties today.
            </p>

            <div className="space-y-3 mb-8 text-left">
              {[
                'Instant access to verified requirements',
                'Direct contact with decision-makers',
                'Filter by location, size, and property type',
                'No fees or hidden costs'
              ].map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                  <span className="text-sm">{benefit}</span>
                </div>
              ))}
            </div>

            <Button 
              asChild 
              className="bg-white text-violet-700 hover:bg-gray-50 px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <a href="/search">
                Start Searching Requirements
              </a>
            </Button>
          </div>

          {/* Newsletter Signup Option */}
          <div className="landlord-section__option bg-gray-50 rounded-3xl p-10 text-center border-2 border-transparent md:hover:border-violet-300 md:hover:shadow-lg transition-all duration-300">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-2xl mb-6">
              <Mail className="w-10 h-10 text-orange-600" />
            </div>
            
            <h3 className="landlord-section__option-title text-2xl font-bold text-gray-800 mb-4">
              Join Our Newsletter
            </h3>
            <p className="landlord-section__option-description text-lg text-gray-600 mb-6 leading-relaxed">
              Get weekly updates on new requirements matching your property portfolio. 
              Stay ahead of the market with exclusive insights.
            </p>

            {isSubscribed ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-3" />
                <h4 className="font-semibold text-green-800 mb-2">Successfully Subscribed!</h4>
                <p className="text-sm text-green-600">You'll receive your first update within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 text-left">
                    What best describes you?
                  </label>
                  <div className="space-y-2">
                    {userTypeOptions.map((option) => (
                      <label key={option.value} className="flex items-center text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="userType"
                          value={option.value}
                          checked={userType === option.value}
                          onChange={(e) => setUserType(e.target.value)}
                          required
                          disabled={isSubmitting}
                          className="mr-3 text-violet-600 focus:ring-violet-500 disabled:opacity-50"
                        />
                        <span className="text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-gray-500 text-left">
                  <label className="flex items-start gap-2">
                    <input type="checkbox" required disabled={isSubmitting} className="mt-1" />
                    <span>
                      I agree to receive marketing emails and acknowledge the{' '}
                      <a href="/privacy" className="text-violet-600 hover:underline">
                        privacy policy
                      </a>
                    </span>
                  </label>
                </div>

                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 text-lg font-semibold rounded-xl transition-colors duration-200"
                >
                  {isSubmitting ? 'Subscribing...' : 'Subscribe to Newsletter'}
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Additional Benefits */}
        <div className="mt-12 md:mt-16 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                icon: Building,
                title: 'Quality Tenants',
                description: 'All requirements are verified and reviewed for authenticity'
              },
              {
                icon: MapPin,
                title: 'Nationwide Coverage',
                description: 'Requirements from businesses across all UK regions'
              },
              {
                icon: CheckCircle,
                title: 'Free to Use',
                description: 'No fees for landlords to search or contact occupiers'
              }
            ].map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div key={index} className="text-center p-4">
                  <div className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-violet-100 rounded-xl mb-3 md:mb-4">
                    <Icon className="w-5 h-5 md:w-6 md:h-6 text-violet-600" />
                  </div>
                  <h4 className="font-semibold text-gray-800 mb-2 text-sm md:text-base">{benefit.title}</h4>
                  <p className="text-xs md:text-sm text-gray-600">{benefit.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .landlord-section {
          position: relative;
          width: 100%;
        }
        
        .landlord-section__container {
          margin-left: auto;
          margin-right: auto;
        }
        
        .landlord-section__content {
          display: flex;
          margin-left: auto;
          margin-right: auto;
          position: relative;
          left: 0;
          right: 0;
        }
        
        .landlord-section__option {
          flex: 1;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }
        
        @media (max-width: 1024px) {
          .landlord-section__content {
            flex-direction: column;
            gap: 24px;
            max-width: 100% !important;
            align-items: center;
          }
        }
        
        @media (max-width: 768px) {
          .landlord-section {
            padding: 48px 0;
          }
          
          .landlord-section__container {
            padding-left: 16px !important;
            padding-right: 16px !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }
          
          .landlord-section__title {
            font-size: 24px;
            margin-bottom: 16px;
          }
          
          .landlord-section__option {
            padding: 24px 16px;
            margin: 0 !important;
            max-width: 100% !important;
          }
          
          .landlord-section__content {
            gap: 20px;
            max-width: 100% !important;
            width: 100% !important;
            justify-items: center;
            align-items: center;
            margin-left: auto;
            margin-right: auto;
          }
        }
      `}</style>
    </section>
  );
}