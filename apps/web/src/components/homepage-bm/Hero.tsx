'use client'

import { useAuth } from '@/contexts/auth-context'
import { RevealWrapper } from '@/components/homepage-new/RevealWrapper'
import { SiteSearch } from './SiteSearch'
import { SampleReport } from './SampleReport'

export function Hero() {
  const { user } = useAuth()
  return (
    <section className="px-10 pt-20 text-center max-md:px-5 max-md:pt-12">
      <RevealWrapper>
        <h1 className="mx-auto mt-[18px] max-w-[1100px] text-[clamp(40px,6.8vw,92px)] font-semibold leading-[0.98] tracking-[-0.04em] text-sm-ink [text-wrap:balance]">
          Securing a commercial occupier?
          <br />
          <em className="font-medium text-sm-violet-deep">Know who to call.</em>
        </h1>
        <p className="mx-auto mt-6 max-w-[640px] text-[clamp(16px,1.6vw,20px)] leading-[1.5] text-sm-ink2 [text-wrap:pretty]">
          See a list of brands suited to your site, using brand presence, acquisition signals, demographic matches,
          financials and typical or required site size - and who to contact.
        </p>
        <SiteSearch />
        {!user && <div className="mt-3.5 text-[13px] text-sm-ink3">Try it free for 14 days.</div>}
      </RevealWrapper>
      <RevealWrapper>
        <SampleReport />
      </RevealWrapper>
    </section>
  )
}
