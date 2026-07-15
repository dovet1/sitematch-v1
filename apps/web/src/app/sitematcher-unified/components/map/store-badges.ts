import { getClearbitLogoUrl } from '@/lib/clearbit-logo'
import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import type { NearbyStore } from '../../lib/services/gaps-service'

// Store pins are HTML markers (brand logo badges), not a GeoJSON layer. Shared
// between the Assess pins (UnifiedMap) and the find-gaps clustered pins.
export const STORE_BADGE_SIZE = 32
export const STORE_BADGE_SHADOW = '0 0 0 2px #2A6FDB,0 1px 3px rgba(0,0,0,0.3)'
export const STORE_BADGE_SHADOW_HL = '0 0 0 3px #7033FF,0 2px 8px rgba(0,0,0,0.45)'

function storeInitial(store: NearbyStore): string {
  const src = store.brand_name || store.name || '?'
  return src.trim().charAt(0).toUpperCase() || '?'
}

// Renders the brand-initial fallback badge into an existing badge element.
function renderInitialBadge(el: HTMLElement, store: NearbyStore) {
  const span = document.createElement('span')
  span.textContent = storeInitial(store)
  span.style.cssText =
    'display:flex;align-items:center;justify-content:center;width:100%;height:100%;' +
    'background:#2A6FDB;color:#fff;font-weight:600;font-size:13px;'
  el.replaceChildren(span)
}

// Renders an <img> that walks the source list on error (logo.dev → logo_url),
// falling back to the initial badge once every source has failed to load.
function renderLogoImg(el: HTMLElement, store: NearbyStore, sources: string[]) {
  let idx = 0
  const img = document.createElement('img')
  img.alt = ''
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#fff;'
  img.onerror = () => {
    idx += 1
    if (idx < sources.length) img.src = sources[idx]
    else renderInitialBadge(el, store)
  }
  img.src = sources[0]
  el.replaceChildren(img)
}

// Populates a badge element with the store's logo, by priority:
// logo.dev (from brand domain) → uploaded logo_url → brand-initial badge.
export function populateStoreBadge(el: HTMLElement, store: NearbyStore) {
  const sources: string[] = []
  // getClearbitLogoUrl returns null when the token is missing or the domain is
  // invalid — guard for that and continue down the fallback chain.
  const logoDev = store.logo_domain ? getClearbitLogoUrl(store.logo_domain, 64) : null
  if (logoDev) sources.push(logoDev)
  if (store.logo_url) sources.push(store.logo_url)
  if (sources.length > 0) renderLogoImg(el, store, sources)
  else renderInitialBadge(el, store)
}

export function buildStoreBadge(store: NearbyStore): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    `width:${STORE_BADGE_SIZE}px;height:${STORE_BADGE_SIZE}px;border-radius:50%;` +
    `overflow:hidden;background:#fff;box-shadow:${STORE_BADGE_SHADOW};` +
    'transition:opacity 120ms ease,box-shadow 120ms ease;' +
    'pointer-events:auto;cursor:pointer;'
  // Clicking a store pin opens the present-brand detail modal. Stop propagation
  // so it doesn't fall through to the map's Assess-pin drop handler.
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    useWorkspaceStore.getState().setBrandInfoId(store.brand_id)
  })
  populateStoreBadge(el, store)
  return el
}

export function applyStoreBadgeHighlight(
  el: HTMLElement,
  store: NearbyStore | undefined,
  hoveredBrandId: string | null
) {
  if (!hoveredBrandId) {
    el.style.opacity = '1'
    el.style.boxShadow = STORE_BADGE_SHADOW
    el.style.zIndex = ''
    return
  }
  if (store?.brand_id === hoveredBrandId) {
    el.style.opacity = '1'
    el.style.boxShadow = STORE_BADGE_SHADOW_HL
    el.style.zIndex = '2'
  } else {
    el.style.opacity = '0.35'
    el.style.boxShadow = STORE_BADGE_SHADOW
    el.style.zIndex = ''
  }
}

// Whether the visual inputs of a store changed (needs a badge rebuild).
export function storeVisualChanged(a: NearbyStore, b: NearbyStore): boolean {
  return (
    a.logo_domain !== b.logo_domain ||
    a.logo_url !== b.logo_url ||
    a.brand_name !== b.brand_name ||
    a.name !== b.name
  )
}
