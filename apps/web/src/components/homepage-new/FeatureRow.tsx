'use client';

import { VideoSlot } from './VideoSlot';
import { RevealWrapper } from './RevealWrapper';
import { useAuth } from '@/contexts/auth-context';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { PaywallModal } from '@/components/PaywallModal';

interface CTA {
  label: string;
  style: 'violet' | 'primary' | 'ghost';
  href?: string;
  requiresAuth?: boolean;
}

interface FeatureRowProps {
  idx: number;
  name: string;
  kicker: string;
  headline: string;
  body: string;
  bullets: string[];
  videoLabel: string;
  videoNote: string;
  videoSrc?: string;
  posterSrc?: string;
  reverse?: boolean;
  ctas: CTA[];
}

export function FeatureRow({
  idx,
  name,
  kicker,
  headline,
  body,
  bullets,
  videoLabel,
  videoNote,
  videoSrc,
  posterSrc,
  reverse = false,
  ctas,
}: FeatureRowProps) {
  const { user } = useAuth();

  const renderCTA = (cta: CTA, i: number) => {
    const baseClasses = "px-5 py-[13px] rounded-sm-btn font-medium text-[15px] border tracking-[-0.1px] cursor-pointer transition-colors max-md:flex-1 max-md:min-w-0 max-md:text-center";
    const styleClasses =
      cta.style === 'violet'
        ? 'bg-sm-violet text-white border-sm-violet hover:bg-sm-violet-deep'
        : cta.style === 'primary'
        ? 'bg-sm-ink text-white border-sm-ink hover:bg-opacity-90'
        : 'bg-transparent text-sm-ink border-sm-border hover:bg-sm-border-soft';

    // If there's a direct href, render as a link
    if (cta.href) {
      return (
        <a
          key={i}
          href={cta.href}
          className={`${baseClasses} ${styleClasses} inline-block`}
        >
          {cta.label}
        </a>
      );
    }

    // Otherwise, render as button (for auth modals)
    const button = (
      <button key={i} className={`${baseClasses} ${styleClasses}`}>
        {cta.label}
      </button>
    );

    // If the CTA requires authentication, wrap it in the appropriate modal
    if (cta.requiresAuth) {
      return user ? (
        <PaywallModal key={i} context="gapfinder" redirectTo="/gapfinder">
          {button}
        </PaywallModal>
      ) : (
        <TrialSignupModal key={i} context="gapfinder" redirectPath="/gapfinder" tier="plus">
          {button}
        </TrialSignupModal>
      );
    }

    return button;
  };

  return (
    <RevealWrapper>
      <div
        className="grid grid-cols-2 gap-20 items-center py-[72px] border-t border-sm-border-soft first:border-t-0 max-md:grid-cols-1 max-md:gap-7 max-md:py-[52px]"
      >
        <div className={reverse ? 'order-2 max-md:order-2' : 'order-1 max-md:order-2'}>
          {/* Kicker */}
          <div className="font-mono text-xs text-sm-ink3 tracking-[1px] mb-4 uppercase">
            {String(idx).padStart(2, '0')} / {kicker}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-feature-title leading-[1.04] tracking-[-0.04em] m-0 text-sm-ink balance">
            {name} <span className="text-sm-ink3 font-medium">- {headline}</span>
          </h3>

          {/* Body */}
          <p className="mt-4 font-normal text-sm-ink2 leading-[1.55] max-w-[480px]" style={{ fontSize: 'clamp(15px, 1.4vw, 17px)' }}>
            {body}
          </p>

          {/* Bullets */}
          <ul className="mt-6 p-0 list-none flex flex-col gap-2.5">
            {bullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2.5 font-normal text-[15px] text-sm-ink leading-[1.5]">
                <span className="mt-[9px] w-[5px] h-[5px] rounded-full bg-sm-ink flex-shrink-0" />
                {bullet}
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="mt-7 flex gap-2.5 flex-wrap max-md:w-full">
            {ctas.map((cta, i) => renderCTA(cta, i))}
          </div>
        </div>

        <div className={reverse ? 'order-1 max-md:order-1' : 'order-2 max-md:order-1'}>
          <VideoSlot
            label={videoLabel}
            note={videoNote}
            ratio="4/3"
            videoSrc={videoSrc}
            posterSrc={posterSrc}
            alt={`${name} demonstration`}
          />
        </div>
      </div>
    </RevealWrapper>
  );
}
