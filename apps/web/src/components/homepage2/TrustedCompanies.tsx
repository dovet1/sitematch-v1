'use client';

import { useEffect, useRef, useState } from 'react';
import { TRUSTED_COMPANY_DOMAINS } from '@/config/trusted-companies';

interface Company {
  domain: string;
  logo: string;
}

export function TrustedCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load companies from config
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
    const companyData: Company[] = TRUSTED_COMPANY_DOMAINS.map(domain => ({
      domain,
      logo: token ? `https://img.logo.dev/${domain}?token=${token}` : ''
    }));
    setCompanies(companyData);
    setLoading(false);
  }, []);

  // Ensure client-side hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (loading || companies.length === 0) return null;

  return (
    <section className="py-12 md:py-16 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-center text-gray-900 mb-10 md:mb-12">
          Trusted by the biggest names in the industry
        </h2>

        <div
          className="relative overflow-hidden"
          style={{
            touchAction: 'pan-y',
            maxWidth: '100%',
            width: '100%'
          }}
        >
          <div
            className="flex gap-4 md:gap-8 px-6"
            style={{
              animation: companies.length > 0 ? `scroll-left ${companies.length * 4}s linear infinite` : 'none',
              transform: 'translateZ(0)',
              width: 'max-content',
              willChange: 'transform'
            }}
          >
            {[...companies, ...companies].map((company, index) => (
              <div
                key={`${company.domain}-${index}`}
                className="relative flex-shrink-0 w-32 h-20 md:w-40 md:h-24 bg-white rounded-2xl md:rounded-3xl shadow-lg border-2 border-blue-200 flex items-center justify-center"
              >
                <div className="flex items-center justify-center w-full h-full p-3 md:p-5">
                  <div className="w-full h-12 md:h-14 flex items-center justify-center">
                    <img
                      src={company.logo}
                      alt={`${company.domain} logo`}
                      className="max-w-full max-h-full object-contain"
                      style={{
                        height: '100%',
                        width: 'auto'
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const placeholder = target.nextElementSibling as HTMLElement;
                        if (placeholder) {
                          placeholder.style.display = 'flex';
                        }
                      }}
                    />
                    <div className="w-10 h-10 md:w-14 md:h-14 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center hidden shadow-lg">
                      <span className="text-white text-sm md:text-lg font-black">
                        {company.domain.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}
