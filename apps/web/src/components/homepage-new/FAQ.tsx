'use client';

import { useState } from 'react';
import { FAQItem } from './FAQItem';
import { RevealWrapper } from './RevealWrapper';
import { FAQS } from '@/data/homepage-new/constants';

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number>(0);

  return (
    <RevealWrapper>
      <section className="px-5 md:px-20 py-16 md:py-24">
        <div className="max-w-[880px] mx-auto">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[1.4px] text-sm-ink3 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-sm-violet" />
            FAQ
          </div>

          {/* Heading */}
          <h2 className="font-semibold text-faq-h2 leading-[1.04] tracking-[-0.035em] mt-4 mb-9 text-sm-ink balance">
            Everything you need to know.
          </h2>

          {/* FAQ Items */}
          <div>
            {FAQS.map((faq, i) => (
              <FAQItem
                key={i}
                question={faq.q}
                answer={faq.a}
                isOpen={openIdx === i}
                onToggle={() => setOpenIdx(openIdx === i ? -1 : i)}
              />
            ))}
          </div>

          {/* Contact Card */}
          <div className="mt-8 p-6 bg-sm-surface rounded-sm-menu border border-sm-border flex items-center justify-between gap-5 flex-wrap">
            <div>
              <div className="font-semibold text-[17px] text-sm-ink">Still have questions?</div>
              <div className="font-normal text-sm text-sm-ink2 mt-0.5">
                Our team is here to help. We'll get back within 24 hours.
              </div>
            </div>
            <a
              href="mailto:hello@sitematcher.co.uk"
              className="flex-shrink-0 px-5 py-[13px] rounded-sm-btn bg-sm-violet text-white font-medium text-[15px] border border-sm-violet tracking-[-0.1px] hover:bg-sm-violet-deep transition-colors no-underline"
            >
              hello@sitematcher.co.uk
            </a>
          </div>
        </div>
      </section>
    </RevealWrapper>
  );
}
