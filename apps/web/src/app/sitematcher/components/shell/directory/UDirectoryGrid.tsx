'use client'

import { UBrandAvatar, UPersonAvatar, UKicker } from './UDirectoryPrimitives'
import type {
  DirectoryAgentSummary,
  DirectoryBrandCard,
  DirectoryTeamMember,
} from '../../../types/unified-workspace'

// Responsive card grid: repeat(auto-fill, minmax(215px, 1fr)), gap 14 (design handoff).
function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid gap-3.5"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))' }}
    >
      {children}
    </div>
  )
}

function Card({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[15px] border border-sm-border bg-sm-surface p-3.5 text-left shadow-[0_1px_2px_rgba(23,20,25,.03)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-8px_rgba(23,20,25,.18)]"
    >
      {children}
    </button>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <div className="text-[19px] font-semibold leading-none text-sm-ink">{value}</div>
      <UKicker className="mt-1 block">{label}</UKicker>
    </div>
  )
}

export function UBrandCards({
  brands,
  onOpen,
}: {
  brands: DirectoryBrandCard[]
  onOpen: (id: string) => void
}) {
  return (
    <Grid>
      {brands.map((b) => (
        <Card key={b.id} onClick={() => onOpen(b.id)}>
          <div className="flex items-start gap-2.5">
            <UBrandAvatar id={b.id} name={b.name} logoUrl={b.logoUrl} domain={b.domain} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold text-sm-ink">{b.name}</div>
              {b.category && (
                <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-sm-ink3">
                  {b.category}
                </div>
              )}
            </div>
          </div>

          {/*
            Status kicker. There is no expansion_status column, so this is a derived binary:
            an active requirement, or nothing on file. The design's "Selective"/"Growing"
            states have no data source and are deliberately not rendered.
          */}
          <div className="mt-2.5 rounded-md bg-sm-bg px-2 py-1">
            {b.hasActiveRequirement ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.09em] text-[#15803D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                Actively acquiring
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono text-[8.5px] font-bold uppercase tracking-[0.09em] text-sm-ink4">
                <span className="h-1.5 w-1.5 rounded-full bg-sm-ink4" />
                No requirement on file
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat value={b.storeCount.toLocaleString()} label="UK stores" />
            <Stat value={b.inHouseCount} label="In-house" />
            <Stat value={b.agentCount} label="Agents" />
          </div>
        </Card>
      ))}
    </Grid>
  )
}

export function UAgentCards({
  agents,
  onOpen,
}: {
  agents: DirectoryAgentSummary[]
  onOpen: (id: string) => void
}) {
  return (
    <Grid>
      {agents.map((a) => (
        <Card key={a.id} onClick={() => onOpen(a.id)}>
          <div className="flex items-start gap-2.5">
            <UPersonAvatar id={a.id} name={a.name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold text-sm-ink">{a.name}</div>
              {a.firm && (
                <div className="mt-0.5 truncate text-[11.5px] text-sm-ink3">{a.firm}</div>
              )}
            </div>
          </div>

          {a.title && (
            <p className="mt-2.5 line-clamp-2 text-[11.5px] leading-snug text-sm-ink2">{a.title}</p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat value={a.brandCount} label="Brands" />
            {a.region && (
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold leading-none text-sm-ink">
                  {a.region}
                </div>
                <UKicker className="mt-1 block">Region</UKicker>
              </div>
            )}
          </div>
        </Card>
      ))}
    </Grid>
  )
}

export function UTeamCards({
  team,
  onOpenBrand,
}: {
  team: DirectoryTeamMember[]
  onOpenBrand: (brandId: string) => void
}) {
  return (
    <Grid>
      {team.map((p) => (
        <Card key={p.id} onClick={() => onOpenBrand(p.brandId)}>
          <div className="flex items-start gap-2.5">
            <UPersonAvatar id={p.id} name={p.name || p.brandName} size={40} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold text-sm-ink">
                {p.name || 'Unnamed contact'}
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-sm-ink3">{p.brandName}</div>
            </div>
          </div>
          {p.title && (
            <p className="mt-2.5 line-clamp-2 text-[11.5px] leading-snug text-sm-ink2">{p.title}</p>
          )}
        </Card>
      ))}
    </Grid>
  )
}
