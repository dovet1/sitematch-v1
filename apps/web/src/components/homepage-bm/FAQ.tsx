'use client'

import { useState } from 'react'
import { RevealWrapper } from '@/components/homepage-new/RevealWrapper'
import { FAQItem } from '@/components/homepage-new/FAQItem'
import { FAQS } from '@/data/homepage-bm/content'
import { Eyebrow, SECTION } from './ui'

export function FAQ() {
  const [open, setOpen] = useState(0)
  return (
    <RevealWrapper>
      <section className={SECTION}>
        <div className="mx-auto max-w-[880px]">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mb-9 mt-4 text-[clamp(30px,3.8vw,48px)] font-semibold leading-[1.02] tracking-[-0.035em] text-sm-ink [text-wrap:balance]">
            Questions agents ask us.
          </h2>
          {FAQS.map((f, i) => (
            <FAQItem key={f.q} question={f.q} answer={f.a} isOpen={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </div>
      </section>
    </RevealWrapper>
  )
}
