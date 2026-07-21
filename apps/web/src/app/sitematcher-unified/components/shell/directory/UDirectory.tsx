'use client'

import { useMemo, useReducer, useRef, useCallback } from 'react'
import { ChevronRight, Search, Loader2, AlertCircle } from 'lucide-react'
import {
  directoryNavReducer,
  initialDirectoryNav,
  currentNode,
} from '../../../lib/directory-nav'
import { useDirectoryLists, useDirectoryProfile } from '../../../lib/hooks/useDirectory'
import { UBrandCards, UAgentCards, UTeamCards } from './UDirectoryGrid'
import { UBrandProfile } from './UBrandProfile'
import { UAgentProfile } from './UAgentProfile'
import { UKicker } from './UDirectoryPrimitives'
import type { DirectoryTab } from '../../../types/unified-workspace'

const TABS: { id: DirectoryTab; label: string }[] = [
  { id: 'brands', label: 'Brands' },
  { id: 'agents', label: 'Agents' },
  { id: 'inhouse', label: 'In-house teams' },
]

function matches(haystack: (string | null | undefined)[], q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return haystack.some((h) => h && h.toLowerCase().includes(needle))
}

export function UDirectory() {
  const [nav, dispatch] = useReducer(directoryNavReducer, initialDirectoryNav)
  const [query, setQuery] = useReducer((_: string, q: string) => q, '')
  const scrollRef = useRef<HTMLDivElement>(null)

  const node = currentNode(nav)
  const { brands, agents, inHouse, truncated, loading, error } = useDirectoryLists()
  const { brandProfile, agentProfile, loading: profileLoading, error: profileError } =
    useDirectoryProfile(node)

  // Every stack transition returns to the top. Landing on a profile at the scroll offset
  // of the grid card you clicked is disorienting.
  const toTop = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [])

  const openBrand = useCallback(
    (id: string) => {
      dispatch({ type: 'push', node: { kind: 'brand', id } })
      toTop()
    },
    [toTop]
  )
  const openAgent = useCallback(
    (id: string) => {
      dispatch({ type: 'push', node: { kind: 'agent', id } })
      toTop()
    },
    [toTop]
  )
  const back = useCallback(() => {
    dispatch({ type: 'back' })
    toTop()
  }, [toTop])
  const setTab = useCallback(
    (tab: DirectoryTab) => {
      dispatch({ type: 'setTab', tab })
      setQuery('')
      toTop()
    },
    [toTop]
  )

  const filteredBrands = useMemo(
    () => brands.filter((b) => matches([b.name, b.category], query)),
    [brands, query]
  )
  const filteredAgents = useMemo(
    () => agents.filter((a) => matches([a.name, a.firm, a.title, a.region, a.focus], query)),
    [agents, query]
  )
  const filteredTeam = useMemo(
    () => inHouse.filter((p) => matches([p.name, p.title, p.brandName], query)),
    [inHouse, query]
  )

  const counts: Record<DirectoryTab, number> = {
    brands: brands.length,
    agents: agents.length,
    inhouse: inHouse.length,
  }

  const crumbName =
    node?.kind === 'brand' ? brandProfile?.brand.name : node?.kind === 'agent' ? agentProfile?.agent.name : null

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-sm-bg">
      <div className="mx-auto w-full max-w-[1480px] px-7 py-5">
        {node ? (
          <>
            <div className="mb-3.5 flex items-center gap-3">
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sm-border bg-sm-surface px-2.5 py-1.5 text-[12px] font-medium text-sm-ink2 transition-colors hover:text-sm-ink"
              >
                <ChevronRight size={14} className="rotate-180" />
                Back
              </button>
              <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-sm-ink3">
                Directory
                <ChevronRight size={11} />
                {node.kind === 'brand' ? 'Brands' : 'Agents'}
                {crumbName && (
                  <>
                    <ChevronRight size={11} />
                    <b className="text-sm-ink">{crumbName}</b>
                  </>
                )}
              </span>
            </div>

            {profileError ? (
              <ErrorState message={profileError} />
            ) : profileLoading || (!brandProfile && !agentProfile) ? (
              <LoadingState />
            ) : node.kind === 'brand' && brandProfile ? (
              <UBrandProfile data={brandProfile} onOpenAgent={openAgent} />
            ) : agentProfile ? (
              <UAgentProfile data={agentProfile} onOpenBrand={openBrand} />
            ) : null}
          </>
        ) : (
          <>
            <header className="mb-5">
              <UKicker className="!text-sm-violet-deep">Directory</UKicker>
              <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-0.7px] text-sm-ink">
                Brands, teams &amp; agents
              </h1>
              <p className="mt-1.5 max-w-[520px] text-[12.5px] leading-[1.6] text-sm-ink2">
                Browse everyone in the market and see how they connect — a brand&apos;s in-house
                expansion team, the agents acting for them, and their live store estate and
                requirements.
              </p>
            </header>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-sm-border bg-sm-surface p-0.5">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-pressed={nav.tab === t.id}
                    className={
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150 ' +
                      (nav.tab === t.id
                        ? 'bg-sm-ink text-white'
                        : 'text-sm-ink3 hover:text-sm-ink2')
                    }
                  >
                    {t.label}
                    <span
                      className={
                        'font-mono text-[10px] ' +
                        (nav.tab === t.id ? 'text-white/60' : 'text-sm-ink4')
                      }
                    >
                      {counts[t.id]}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm-ink4"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${nav.tab === 'inhouse' ? 'teams' : nav.tab}...`}
                  className="w-[240px] rounded-lg border border-sm-border bg-sm-surface py-1.5 pl-8 pr-3 text-[12.5px] text-sm-ink placeholder:text-sm-ink4 focus:border-sm-violet focus:outline-none"
                />
              </div>
            </div>

            {/* A cap that bites is surfaced, not hidden — client-side search cannot find
                a record the server omitted. */}
            {truncated && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-sm-border bg-sm-surface px-3 py-2 text-[12px] text-sm-ink2">
                <AlertCircle size={14} className="flex-shrink-0 text-sm-ink3" />
                Showing a capped subset of the directory — some records are not listed, so
                search may not find everything.
              </div>
            )}

            {error ? (
              <ErrorState message={error} />
            ) : loading ? (
              <LoadingState />
            ) : nav.tab === 'brands' ? (
              filteredBrands.length ? (
                <UBrandCards brands={filteredBrands} onOpen={openBrand} />
              ) : (
                <EmptyState query={query} noun="brands" />
              )
            ) : nav.tab === 'agents' ? (
              filteredAgents.length ? (
                <UAgentCards agents={filteredAgents} onOpen={openAgent} />
              ) : (
                <EmptyState query={query} noun="agents" />
              )
            ) : filteredTeam.length ? (
              <UTeamCards team={filteredTeam} onOpenBrand={openBrand} />
            ) : (
              <EmptyState query={query} noun="team members" />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm-ink3">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-[12.5px]">Loading directory…</span>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <AlertCircle size={20} className="text-sm-ink3" />
      <span className="text-[13px] font-medium text-sm-ink">Couldn&apos;t load the directory</span>
      <span className="text-[12px] text-sm-ink3">{message}</span>
    </div>
  )
}

function EmptyState({ query, noun }: { query: string; noun: string }) {
  return (
    <div className="py-20 text-center text-[12.5px] text-sm-ink3">
      {query ? `No ${noun} match “${query}”.` : `No ${noun} in the directory yet.`}
    </div>
  )
}
