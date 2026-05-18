'use client';

import { useEffect, useState } from 'react';
import { RevealWrapper } from './RevealWrapper';
import { TRUSTED_COMPANY_DOMAINS } from '@/config/trusted-companies';

interface Company {
  domain: string;
  logo: string;
}

export function TrustedBy() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading || companies.length === 0) return null;

  return (
    <RevealWrapper>
      <section className="px-5 md:px-20 pt-[100px] pb-[60px]">
        <p className="text-center font-normal text-[13px] tracking-[0.4px] text-sm-ink3 uppercase m-0">
          Trusted by the biggest names in UK commercial property
        </p>

        <div className="mt-[30px] relative overflow-hidden border-t border-b border-sm-border-soft">
          <div
            className="flex"
            style={{
              animation: `scroll-left ${companies.length * 4}s linear infinite`,
              transform: 'translateZ(0)',
              width: 'max-content',
              willChange: 'transform'
            }}
          >
            {[...companies, ...companies].map((company, index) => (
              <div
                key={`${company.domain}-${index}`}
                className="flex-shrink-0 px-6 py-[26px] flex items-center justify-center border-l border-sm-border-soft first:border-l-0"
                style={{ minWidth: '180px' }}
              >
                <div className="w-full h-12 flex items-center justify-center">
                  <img
                    src={company.logo}
                    alt={`${company.domain} logo`}
                    className="max-w-full max-h-full object-contain opacity-40 grayscale hover:opacity-60 hover:grayscale-0 transition-all duration-300"
                    style={{
                      height: '100%',
                      width: 'auto',
                      filter: 'brightness(0.8) contrast(0.9)'
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
                  <div className="w-10 h-10 bg-sm-ink3 rounded-lg flex items-center justify-center hidden">
                    <span className="text-white text-sm font-semibold">
                      {company.domain.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
    </RevealWrapper>
  );
}
