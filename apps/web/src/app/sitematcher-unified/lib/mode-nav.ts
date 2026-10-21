import { MapPin, Search, PenTool, ClipboardList, Store, BookUser } from 'lucide-react'
import type { WorkspaceMode } from '../types/unified-workspace'

/**
 * Everything the rail, its hover cards and the mode chooser say about each mode, in rail order.
 * Copy is final from the mode-navigation design handoff.
 */
export interface ModeNavEntry {
  id: WorkspaceMode
  /** Short label under the rail icon. */
  railLabel: string
  /** Full mode name, used for the hover card and accessible labels. */
  name: string
  /** Hover-card description. */
  description: string
  chooserTitle: string
  chooserBody: string
  chooserCta: string
  Icon: typeof MapPin
}

export const MODE_NAV: ModeNavEntry[] = [
  {
    id: 'brand-matcher',
    railLabel: 'Match',
    name: 'Brand matcher',
    description:
      'See which brands might be a good fit for a site, and who to call at each brand.',
    chooserTitle: 'Match brands to a site',
    chooserBody: 'See which brands might fit a given site, and who to call at each.',
    chooserCta: 'Brand matcher',
    Icon: Store,
  },
  {
    id: 'assess',
    railLabel: 'Assess',
    name: 'Assess area',
    description:
      'Click the map to see brands present and missing, catchment demographics and planning applications nearby.',
    chooserTitle: 'Assess an area',
    chooserBody:
      'Click the map to see brands present and missing, catchment demographics and planning nearby.',
    chooserCta: 'Assess area',
    Icon: MapPin,
  },
  {
    id: 'find',
    railLabel: 'Gaps',
    name: 'Find gaps',
    description: 'Quickly identify towns or retail centres where brands exist, or don’t.',
    chooserTitle: 'Find gaps for a brand',
    chooserBody: 'Identify towns and retail centres where a brand trades, or doesn’t yet.',
    chooserCta: 'Find gaps',
    Icon: Search,
  },
  {
    id: 'sketch',
    railLabel: 'Sketch',
    name: 'SiteSketcher',
    description: 'Quickly sketch out a site on the map, including parking.',
    chooserTitle: 'Sketch a site',
    chooserBody: 'Draw a site layout on the map, including parking.',
    chooserCta: 'SiteSketcher',
    Icon: PenTool,
  },
  {
    id: 'planning',
    railLabel: 'Planning',
    name: 'Planning monitor',
    description: 'See planning alerts across the whole UK and in your patch.',
    chooserTitle: 'Watch planning',
    chooserBody: 'See planning alerts across the whole UK and in your patch.',
    chooserCta: 'Planning monitor',
    Icon: ClipboardList,
  },
  {
    id: 'directory',
    railLabel: 'Directory',
    name: 'Directory',
    description:
      'Brands, their contacts, store estates, and any linked requirements or agents acting for them.',
    chooserTitle: 'Look up a brand',
    chooserBody: 'Browse brands, their contacts, store estates, requirements and agents.',
    chooserCta: 'Directory',
    Icon: BookUser,
  },
]

/** Modes offered to this user: Planning and Brand Matcher are behind their own flags. */
export function availableModes(flags: { planning: boolean; brandMatcher: boolean }): ModeNavEntry[] {
  return MODE_NAV.filter(
    (m) =>
      (m.id !== 'planning' || flags.planning) && (m.id !== 'brand-matcher' || flags.brandMatcher)
  )
}

// Browser-side keys. The "don't show" preference lives on the account (user_metadata); the
// localStorage copy is only a fallback for when saving it to the account fails.
export const DONT_SHOW_KEY = 'sm-modenav-dontshow'
export const LAST_MODE_KEY = 'sm-last-mode'

function safeGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

function safeSet(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value == null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    // Private windows and blocked storage: the preference just won't stick locally.
  }
}

export const readLocalDontShow = () => safeGet(() => localStorage, DONT_SHOW_KEY) === '1'
export const writeLocalDontShow = (on: boolean) => safeSet(() => localStorage, DONT_SHOW_KEY, on ? '1' : null)
export const readLastMode = () => safeGet(() => localStorage, LAST_MODE_KEY) as WorkspaceMode | null
export const writeLastMode = (mode: WorkspaceMode) => safeSet(() => localStorage, LAST_MODE_KEY, mode)

/**
 * Whether the chooser opens when the workspace loads: on every visit, except when the user has
 * opted out or a deep link already says where to go.
 */
export function shouldOpenChooserOnLoad(input: { dontShow: boolean; hasDeepLink: boolean }): boolean {
  return !input.dontShow && !input.hasDeepLink
}

/** The mode to start in: the last one used, if it is still offered, else Assess. */
export function initialMode(last: WorkspaceMode | null, offered: ModeNavEntry[]): WorkspaceMode {
  return last && offered.some((m) => m.id === last) ? last : 'assess'
}
