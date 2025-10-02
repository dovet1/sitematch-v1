'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "How does the free trial work?",
      answer: "Start with a 30-day free trial with full access to all features. Cancel anytime before the trial ends and you won't be charged.",
    },
    {
      question: "How are requirements verified?",
      answer: "Every requirement is manually reviewed by our team. We verify company details, contact information, and ensure the requirement is genuine before publishing.",
    },
    {
      question: "Can I cancel my subscription?",
      answer: "Yes, you can cancel anytime from your account settings. Your access continues until the end of your billing period, and you won't be charged again.",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit and debit cards via Stripe. Subscriptions can be paid by bank transfer on request. Email tom@sitematcher.co.uk for an invoice.",
    },
    {
      question: "Is there a setup fee?",
      answer: "No setup fees, no hidden charges. You only pay the monthly or annual subscription fee.",
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Everything you need to know about SiteMatcher
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`border rounded-2xl overflow-hidden transition-all duration-300 ${
                openIndex === index
                  ? 'border-violet-300 shadow-lg bg-white'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <button
                className="w-full p-6 text-left flex justify-between items-center hover:bg-gray-50 transition-colors duration-200"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="text-lg font-semibold text-gray-900 pr-4">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-violet-600 flex-shrink-0 transition-transform duration-300 ${
                    openIndex === index ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-6 pb-6 pt-0">
                  <p className="text-gray-600 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center p-8 bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200">
          <h3 className="text-xl font-bold text-gray-900 mb-3">
            Still have questions?
          </h3>
          <p className="text-gray-600 mb-4">
            Our team is here to help. Get in touch and we'll respond within 24 hours.
          </p>
          <a
            href="mailto:tom@sitematcher.co.uk"
            className="inline-flex items-center gap-2 text-lg font-semibold text-violet-600 hover:text-violet-700 transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            tom@sitematcher.co.uk
          </a>
        </div>
      </div>
    </section>
  );
}
