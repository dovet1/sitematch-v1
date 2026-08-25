// One place for tier presentation, shared by the map (fill/line colours), the list (chips) and
// the detail header — so a parcel reads the same everywhere. These are ordered signal tiers, NOT
// a suitability verdict.

import type { SiteTier } from '@/lib/site-matching/tiering'

export interface TierStyle {
  /** Hex for the map fill/line + the list chip dot. */
  color: string
  /** Tailwind classes for a small chip (bg + text + border). */
  chip: string
  label: string
  short: string
}

export const TIER_STYLES: Record<SiteTier, TierStyle> = {
  strong: {
    color: '#7033FF',
    chip: 'bg-sm-violet/10 text-sm-violet-deep border-sm-violet/30',
    label: 'Strong parcel signal',
    short: 'Strong',
  },
  potential: {
    color: '#2563EB',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
    label: 'Potential',
    short: 'Potential',
  },
  review: {
    color: '#F59E0B',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'Worth reviewing',
    short: 'Review',
  },
  unlikely: {
    color: '#94A3B8',
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
    label: 'Unlikely',
    short: 'Unlikely',
  },
}

export const TIER_ORDER: SiteTier[] = ['strong', 'potential', 'review', 'unlikely']
