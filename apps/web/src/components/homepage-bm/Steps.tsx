import { RevealWrapper } from '@/components/homepage-new/RevealWrapper'
import { VideoSlot } from '@/components/homepage-new/VideoSlot'
import { STEPS } from '@/data/homepage-bm/content'
import { Eyebrow, H2, NARROW, SECTION } from './ui'

export function Steps() {
  return (
    <section className={`${SECTION} !pt-[60px]`}>
      <div className={NARROW}>
        <RevealWrapper>
          <Eyebrow>How it works</Eyebrow>
          <h2 className={H2}>From vacant unit to first call.</h2>
        </RevealWrapper>
        <RevealWrapper>
          <div className="mt-12 grid grid-cols-3 gap-[18px] max-md:grid-cols-1 max-md:gap-3">
            {STEPS.map((s, i) => (
              <div key={s.t} className="flex flex-col gap-3.5 rounded-[18px] border border-sm-border bg-sm-surface p-7">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sm-ink font-mono text-[13px] text-white">{i + 1}</span>
                <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-sm-ink">{s.t}</h3>
                <p className="text-[15px] leading-[1.55] text-sm-ink2">{s.d}</p>
              </div>
            ))}
          </div>
        </RevealWrapper>
        <RevealWrapper>
          <div className="mt-7">
            {/* Asset needed: the Brand Matcher walkthrough (16:9). */}
            <VideoSlot label="Brand Matcher walkthrough" note="Entering a site, ranked list populating, revealing a contact" ratio="16/9" />
          </div>
        </RevealWrapper>
      </div>
    </section>
  )
}
