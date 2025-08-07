'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How does SiteMatcher work?",
      answer: "SiteMatcher connects commercial property requirements with available spaces. Occupiers post their specific needs, our team reviews and verifies the requirements, then qualified landlords and agents contact them directly with suitable options."
    },
    {
      question: "Is SiteMatcher free to use?",
      answer: "Yes, posting requirements and searching for properties is completely free for occupiers. There are no hidden fees or subscription costs. Landlords and agents can browse requirements at no charge as well."
    },
    {
      question: "How do you protect my data and privacy?",
      answer: "We employ bank-level security measures and are fully GDPR compliant. Your personal information is never shared without permission, and all communications go through our secure platform. Contact details are only revealed to verified property professionals."
    },
    {
      question: "How quickly will I receive responses?",
      answer: "Most verified requirements receive their first response within 72 hours. High-demand locations and property types often see responses within 24 hours. Our approval process typically takes 1-2 business days."
    },
    {
      question: "What areas does SiteMatcher cover?",
      answer: "We cover all major UK cities and towns, with particularly strong coverage in London, Manchester, Birmingham, Leeds, Glasgow, and other metropolitan areas. Our network spans over 120 cities across Britain."
    },
    {
      question: "Do I need to create an account to post a requirement?",
      answer: "Yes, creating an account helps us verify your identity and ensures quality for all users. The registration process is quick and straightforward, requiring only basic business information and contact details."
    },
    {
      question: "What types of commercial property can I find?",
      answer: "We cover all commercial property types including offices, retail units, warehouses, industrial spaces, restaurants, hotels, leisure facilities, and specialist properties. From 100 sq ft to 100,000+ sq ft."
    },
    {
      question: "How do you ensure the quality of requirements and properties?",
      answer: "Every requirement undergoes manual review by our team before going live. We verify contact information, business details, and requirement specifics. This ensures landlords only see genuine, qualified opportunities."
    }
  ];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="faq py-20 bg-white">
      <div className="faq__container max-w-4xl mx-auto px-6">
        <h2 className="faq__title text-3xl font-bold text-gray-800 text-center mb-16">
          Frequently Asked Questions
        </h2>

        <div className="faq__list space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className={`faq__item border border-gray-200 rounded-2xl overflow-hidden transition-all duration-300 hover:border-violet-300 hover:shadow-md ${
                openIndex === index ? 'border-violet-500 shadow-lg shadow-violet-500/10' : ''
              }`}
            >
              <button
                className="faq__question w-full p-4 md:p-6 text-left bg-white hover:bg-gray-50 transition-colors duration-200 flex justify-between items-center"
                onClick={() => toggleFAQ(index)}
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
              >
                <span className="text-base md:text-lg font-semibold text-gray-800 pr-4">
                  {faq.question}
                </span>
                <ChevronDown 
                  className={`w-5 h-5 text-violet-600 flex-shrink-0 transition-transform duration-300 ${
                    openIndex === index ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              <div 
                id={`faq-answer-${index}`}
                className={`faq__answer overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="p-4 md:p-6 pt-0 bg-gray-50 border-t border-gray-100">
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="faq__contact mt-8 md:mt-12 text-center p-6 md:p-8 bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200">
          <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-3">
            Still have questions?
          </h3>
          <p className="text-sm md:text-base text-gray-600 mb-6">
            Our team is here to help. Get in touch and we'll respond within 24 hours.
          </p>
          <div className="flex justify-center">
            <a
              href="mailto:hello@sitematch.co.uk"
              className="inline-flex items-center justify-center px-6 py-3 bg-violet-600 text-white rounded-lg font-semibold hover:bg-violet-700 transition-colors duration-200 text-sm md:text-base"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .faq {
            padding: 48px 0;
          }
          
          .faq__title {
            font-size: 24px;
            margin-bottom: 32px;
          }
          
          .faq__question {
            padding: 20px;
            font-size: 16px;
          }
          
          .faq__answer {
            padding: 20px;
            padding-top: 0;
          }
          
          .faq__contact {
            padding: 24px;
            margin-top: 32px;
          }
        }
      `}</style>
    </section>
  );
}