import { Check } from './icons/Check';
import { Dash } from './icons/Dash';
import { PRICING } from '@/data/homepage-new/constants';

type Tier = 'free' | 'pro' | 'plus';
type Period = 'monthly' | 'annual';

interface PricingCardProps {
  tier: Tier;
  period: Period;
  featured?: boolean;
  onCtaClick?: () => void;
  ctaElement?: React.ReactNode;
}

export function PricingCard({ tier, period, featured = false, onCtaClick, ctaElement }: PricingCardProps) {
  const p = PRICING[tier] as any; // Type assertion needed for optional properties
  const pr = p[period];

  const bgColor = featured ? 'bg-sm-ink' : 'bg-sm-surface';
  const borderClass = featured ? '' : 'border border-sm-border';
  const textColor = featured ? 'text-white' : 'text-sm-ink';
  const secondaryColor = featured ? 'text-white/65' : 'text-sm-ink3';

  return (
    <div
      className={`rounded-sm-card p-8 flex flex-col relative max-md:p-[26px] ${bgColor} ${borderClass} ${textColor}`}
    >
      {/* Badge */}
      {p.badge && (
        <div className="absolute top-[-12px] left-8 px-3 py-1.5 rounded-full bg-sm-violet text-white font-semibold text-xs tracking-[0.2px]">
          {p.badge}
        </div>
      )}

      {/* Header */}
      <div>
        <div className="font-semibold text-lg">{p.name}</div>
        <div className={`text-sm mt-0.5 ${secondaryColor}`}>{p.audience}</div>
      </div>

      {/* Pricing */}
      <div className="mt-[26px] min-h-[92px]">
        {pr.strike && (
          <div className="flex items-center gap-2.5 mb-1">
            <span className={`line-through text-base ${featured ? 'text-white/45' : 'text-sm-ink3'}`}>
              {pr.strike}
            </span>
            <span className={`text-[11px] font-semibold px-[7px] py-[2px] rounded ${
              featured ? 'bg-white/15 text-white' : 'bg-sm-violet-tint text-sm-violet-deep'
            }`}>
              {pr.discount}
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-1">
          <span className="font-semibold text-[46px] leading-none tracking-[-0.035em]">{pr.price}</span>
          <span className={`text-[15px] ${secondaryColor}`}>{pr.suffix}</span>
        </div>
        {pr.footnote && (
          <div className={`text-xs mt-1.5 leading-[1.45] ${featured ? 'text-white/55' : 'text-sm-ink3'}`}>
            {pr.footnote}
          </div>
        )}
      </div>

      {/* CTA */}
      {ctaElement ? ctaElement : (
        <button
          onClick={onCtaClick}
          className={`mt-5 px-5 py-[13px] rounded-sm-btn font-medium text-[15px] border tracking-[-0.1px] transition-colors ${
            featured
              ? 'bg-sm-violet text-white border-sm-violet hover:bg-sm-violet-deep'
              : p.ctaStyle === 'outline'
              ? 'bg-transparent text-sm-ink border-sm-border hover:bg-sm-border-soft'
              : 'bg-sm-ink text-white border-sm-ink hover:bg-opacity-90'
          }`}
        >
          {p.cta}
        </button>
      )}

      {/* Intro */}
      {p.intro && (
        <div className={`mt-[22px] text-[13px] font-medium ${featured ? 'text-white/70' : 'text-sm-ink3'}`}>
          {p.intro}
        </div>
      )}

      {/* Callout */}
      {p.callout && (
        <div className="mt-3.5 p-3.5 rounded-[10px] bg-[rgba(124,58,237,0.20)] border border-[rgba(124,58,237,0.30)]">
          <div className="font-semibold text-[13px]">◆ {p.callout.title}</div>
          <div className="text-xs text-white/75 mt-1 leading-[1.45]">{p.callout.body}</div>
        </div>
      )}

      {/* Features */}
      <ul className="mt-4 p-0 list-none flex flex-col gap-2.5">
        {p.features.map((f: any, i: number) => (
          <li
            key={i}
            className={`flex items-center gap-2.5 text-sm ${
              f.on
                ? featured
                  ? 'text-white'
                  : 'text-sm-ink'
                : featured
                ? 'text-white/40 line-through'
                : 'text-sm-ink3 line-through'
            }`}
          >
            {f.on ? (
              <Check size={14} color={featured ? 'white' : '#7033FF'} />
            ) : (
              <Dash size={14} color={featured ? 'rgba(255,255,255,0.4)' : '#7C7588'} />
            )}
            {f.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
