'use client';

import { useState } from 'react';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "How does the free trial work?",
      answer: "Start with a 30-day free trial with full access to all features. Cancel anytime before the trial ends and you won't be charged.",
    },
    {
      question: "How are requirements verified?",
      answer: "We only accept listings from registered property agencies or the companies themselves that have genuine site requirements. Each submission is reviewed by our team before going live. If we need to confirm any details, we’ll contact the poster directly.",
    },
    {
      question: "Can I cancel my subscription?",
      answer: "Yes, you can cancel anytime from your account settings. Your access continues until the end of your billing period, and you won't be charged again.",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit and debit cards via Stripe. Subscriptions can be paid by bank transfer on request. Email rob@sitematcher.co.uk for an invoice.",
    },
    {
      question: "How do you make sure listed requirements are active?",
      answer: "We contact each listing poster at least once a quarter to confirm that their requirement is still current. If we don’t receive confirmation, the listing is removed from the site. In addition, we monitor property market news and act promptly if we learn information that affects any requirements.",
    },
  ];

  return (
    <section className="relative py-16 md:py-24 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-96 h-96 bg-indigo-300/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-violet-300/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        {/* Bold Header */}
        <motion.div
          className="text-center mb-12 md:mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="flex items-start gap-4 mb-6 justify-center">
          </div>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-4 md:mb-6 leading-tight">
            Frequently{' '}
            <span className="relative inline-block">
              <span className="relative z-10">Asked Questions</span>
              <span className="absolute inset-0 bg-indigo-200 transform -skew-y-1 rotate-1"></span>
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-gray-700 font-medium max-w-3xl mx-auto">
            Everything you need to know about SiteMatcher
          </p>
        </motion.div>

        {/* FAQ Accordion - Bolder */}
        <div className="space-y-4 md:space-y-5 mb-12 md:mb-16">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              className={`border-3 rounded-[1.5rem] overflow-hidden transition-all duration-500 ${
                openIndex === index
                  ? 'border-indigo-400 shadow-2xl bg-white/95 backdrop-blur-sm scale-[1.02]'
                  : 'border-gray-300 bg-white/90 hover:border-indigo-300 hover:shadow-xl'
              }`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.4,
                delay: index * 0.1,
                ease: "easeOut"
              }}
            >
              <button
                className="w-full p-6 md:p-8 text-left flex justify-between items-center hover:bg-indigo-50/50 transition-colors duration-300"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="text-lg md:text-xl font-black text-gray-900 pr-4">
                  {faq.question}
                </span>
                <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center ${
                  openIndex === index ? 'bg-indigo-600' : 'bg-indigo-100'
                } transition-all duration-300`}>
                  <ChevronDown
                    className={`w-5 h-5 md:w-6 md:h-6 ${
                      openIndex === index ? 'text-white' : 'text-indigo-600'
                    } flex-shrink-0 transition-transform duration-300 ${
                      openIndex === index ? 'transform rotate-180' : ''
                    }`}
                  />
                </div>
              </button>

              <div
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-6 md:px-8 pb-6 md:pb-8 pt-0">
                  <p className="text-base md:text-lg text-gray-700 leading-relaxed font-medium">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Contact CTA - Bolder */}
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        >
          <div className="relative bg-white/95 backdrop-blur-sm rounded-[2rem] p-8 md:p-12 border-4 border-indigo-200 shadow-2xl overflow-hidden">
            {/* Decorative gradient */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-200 to-violet-200 opacity-30 rounded-full blur-3xl"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl">
                  <MessageCircle className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-gray-900">
                  Still have questions?
                </h3>
              </div>
              <p className="text-base md:text-lg text-gray-700 font-medium mb-6 text-center">
                Our team is here to help. Get in touch and we'll respond within 24 hours.
              </p>
              <div className="flex justify-center">
                <a
                  href="mailto:rob@sitematcher.co.uk"
                  className="inline-flex items-center gap-3 px-8 py-4 text-lg md:text-xl font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  rob@sitematcher.co.uk
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
