import { LOGOS } from '@/data/homepage-new/constants';
import { RevealWrapper } from './RevealWrapper';

export function TrustedBy() {
  return (
    <RevealWrapper>
      <section className="px-5 md:px-20 pt-[100px] pb-[60px]">
        <p className="text-center font-normal text-[13px] tracking-[0.4px] text-sm-ink3 uppercase m-0">
          Trusted by the biggest names in UK commercial property
        </p>

        <div className="mt-[30px] grid grid-cols-8 gap-0 border-t border-b border-sm-border-soft max-md:grid-cols-2">
          {LOGOS.map((logo, i) => (
            <div
              key={i}
              className="px-2 py-[26px] font-medium text-[15px] text-sm-ink3 tracking-[-0.2px] flex items-center justify-center border-l border-sm-border-soft first:border-l-0 max-md:text-sm max-md:py-[18px] max-md:border-l-0 max-md:odd:border-r max-md:odd:border-sm-border-soft max-md:[&:not(:nth-last-child(-n+2))]:border-b max-md:[&:not(:nth-last-child(-n+2))]:border-sm-border-soft"
            >
              {logo}
            </div>
          ))}
        </div>
      </section>
    </RevealWrapper>
  );
}
