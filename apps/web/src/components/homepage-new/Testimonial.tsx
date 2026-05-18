import { RevealWrapper } from './RevealWrapper';

export function Testimonial() {
  return (
    <RevealWrapper>
      <section className="px-5 md:px-20 py-16 md:py-24 bg-sm-surface border-t border-b border-sm-border-soft">
        <div className="max-w-[980px] mx-auto text-center max-md:px-1">
          {/* Quote Mark */}
          <svg
            width="32"
            height="24"
            viewBox="0 0 32 24"
            className="mb-[22px] opacity-25 inline-block"
          >
            <path
              d="M0 24V14C0 6.5 4.5 1 12 0L13 4C8.5 5 6 8.5 6 13H12V24H0ZM18 24V14C18 6.5 22.5 1 30 0L31 4C26.5 5 24 8.5 24 13H30V24H18Z"
              fill="#171419"
            />
          </svg>

          {/* Quote */}
          <blockquote className="font-medium text-quote leading-[1.25] tracking-[-0.025em] m-0 text-sm-ink balance">
            With SiteMatcher I can see the market in seconds. Searching and filtering is straightforward, contacts are right there, and the flyers give me the detail when I need it. It is easily the fastest way I have found to spot real opportunities.
          </blockquote>

          {/* Author */}
          <div className="mt-7 flex items-center gap-3 justify-center font-normal text-sm">
            <div className="w-10 h-10 rounded-full bg-[#D9D2E4]" />
            <div className="text-left">
              <div className="font-semibold text-sm-ink">Karry Northfield</div>
              <div className="text-sm-ink3">Director Advisor · Voicemagic Shopworthy</div>
            </div>
          </div>
        </div>
      </section>
    </RevealWrapper>
  );
}
