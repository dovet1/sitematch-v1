import { RevealWrapper } from '@/components/homepage-new/RevealWrapper'
import { SiteSearch } from './SiteSearch'
import { NARROW, SECTION } from './ui'

export function FinalCta() {
  return (
    <section className={`${SECTION} !pt-0`}>
      <RevealWrapper>
        <div className={`${NARROW} rounded-[24px] bg-sm-ink p-[clamp(40px,6vw,80px)] text-center text-white max-md:rounded-[18px]`}>
          <h2 className="text-[clamp(30px,4.4vw,56px)] font-semibold leading-[1.02] tracking-[-0.035em] [text-wrap:balance]">
            Your next tenant is <em className="font-medium text-[#B9A0FF]">already on the list.</em>
          </h2>
          <SiteSearch dark />
        </div>
      </RevealWrapper>
    </section>
  )
}
