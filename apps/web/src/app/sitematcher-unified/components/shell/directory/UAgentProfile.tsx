'use client'

import { Mail, Phone, Linkedin } from 'lucide-react'
import { UPersonAvatar, UKicker, UPanel, UPanelHeader } from './UDirectoryPrimitives'
import { UBrandCards } from './UDirectoryGrid'
import type { DirectoryAgentProfile } from '../../../types/unified-workspace'

// Agent profile. The "brands they represent" list is the reverse side of brand_agents —
// the whole reason the edge is a normalised table rather than free text, and the leg that
// closes the Brand -> Agent -> Brand loop.
export function UAgentProfile({
  data,
  onOpenBrand,
}: {
  data: DirectoryAgentProfile
  onOpenBrand: (brandId: string) => void
}) {
  const { agent, brands } = data

  return (
    <div className="flex flex-col gap-3.5">
      <UPanel className="flex flex-wrap items-center gap-4 p-4">
        <UPersonAvatar id={agent.id} name={agent.name} size={54} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[21px] font-semibold tracking-[-0.5px] text-sm-ink">
            {agent.name}
          </h2>
          <div className="mt-1 text-[13px] text-sm-ink2">
            {agent.title}
            {agent.title && agent.firm ? ' · ' : ''}
            {agent.firm && <strong className="font-semibold text-sm-ink">{agent.firm}</strong>}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-4">
            {agent.email && (
              <a
                href={`mailto:${agent.email}`}
                className="inline-flex items-center gap-2 font-mono text-[11px] text-sm-ink2 transition-colors hover:text-sm-violet"
              >
                <Mail size={13} className="text-sm-ink4" />
                {agent.email}
              </a>
            )}
            {agent.phone && (
              <a
                href={`tel:${agent.phone}`}
                className="inline-flex items-center gap-2 font-mono text-[11px] text-sm-ink2 transition-colors hover:text-sm-violet"
              >
                <Phone size={13} className="text-sm-ink4" />
                {agent.phone}
              </a>
            )}
            {agent.linkedinUrl && (
              <a
                href={agent.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[12px] text-sm-ink2 transition-colors hover:text-sm-violet"
              >
                <Linkedin size={13} className="text-sm-ink4" />
                LinkedIn profile
              </a>
            )}
          </div>
        </div>

        <div className="hidden items-start gap-7 border-l border-sm-border-soft pl-6 sm:flex">
          <div>
            <div className="text-[22px] font-semibold leading-none text-sm-ink">
              {agent.brandCount}
            </div>
            <UKicker className="mt-1.5 block">Brands</UKicker>
          </div>
          {agent.region && (
            <div>
              <div className="text-[15px] font-semibold leading-none text-sm-ink">{agent.region}</div>
              <UKicker className="mt-1.5 block">Region</UKicker>
            </div>
          )}
          {agent.focus && (
            <div>
              <div className="text-[15px] font-semibold leading-none text-sm-ink">{agent.focus}</div>
              <UKicker className="mt-1.5 block">Focus</UKicker>
            </div>
          )}
        </div>
      </UPanel>

      <UPanel>
        <UPanelHeader
          title="Brands represented"
          right={<span className="font-mono text-[10px] text-sm-ink3">{brands.length}</span>}
        />
        <div className="p-4 pt-3">
          {brands.length === 0 ? (
            <p className="text-[12.5px] text-sm-ink3">
              This agent isn&apos;t linked to any brands yet.
            </p>
          ) : (
            <UBrandCards brands={brands} onOpen={onOpenBrand} />
          )}
        </div>
      </UPanel>
    </div>
  )
}
