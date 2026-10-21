import { RevealWrapper } from '@/components/homepage-new/RevealWrapper'
import { SIGNALS } from '@/data/homepage-bm/content'
import { Eyebrow, H2, NARROW, SECTION } from './ui'

export function Signals() {
  return (
    <section className={`${SECTION} !pb-10`}>
      <div className={NARROW}>
        <RevealWrapper>
          <Eyebrow>How brands are ranked</Eyebrow>
          <h2 className={H2}>Five signals, one ranked list.</h2>
          <p className="mt-[18px] max-w-[620px] text-[clamp(16px,1.5vw,18px)] leading-[1.55] text-sm-ink2 [text-wrap:pretty]">
            Every brand gets a fit score for your site. You can see exactly which signals pushed it up the list.
          </p>
        </RevealWrapper>
        <RevealWrapper>
          <div className="mt-12 grid grid-cols-5 border-t border-sm-border max-md:grid-cols-1">
            {SIGNALS.map((s, i) => (
              <div
                key={s.k}
                className={
                  'pb-2 pr-[22px] pt-7 max-md:border-b max-md:border-sm-border-soft max-md:px-0 max-md:py-6 ' +
                  (i > 0 ? 'border-l border-sm-border-soft pl-[22px] max-md:border-l-0' : '')
                }
              >
                <div className="font-mono text-[12px] tracking-[0.6px] text-sm-violet-deep">{s.k}</div>
                <h3 className="mt-3.5 text-[22px] font-semibold tracking-[-0.02em] text-sm-ink">{s.t}</h3>
                <p className="mt-2.5 text-[15px] leading-[1.55] text-sm-ink2 [text-wrap:pretty]">{s.d}</p>
              </div>
            ))}
          </div>
        </RevealWrapper>
      </div>
    </section>
  )
}
