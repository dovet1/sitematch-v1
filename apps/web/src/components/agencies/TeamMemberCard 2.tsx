'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, Mail, Phone, Linkedin, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TeamMember {
  id: string
  name: string
  title: string
  bio?: string
  email?: string
  phone?: string
  linkedin_url?: string
  headshot_url?: string
}

interface TeamMemberCardProps {
  member: TeamMember
  isMobile?: boolean
}

export function TeamMemberCard({ member, isMobile = false }: TeamMemberCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleEmailClick = () => {
    if (member.email) {
      window.location.href = `mailto:${member.email}`
    }
  }

  const handlePhoneClick = () => {
    if (member.phone) {
      if (isMobile) {
        window.location.href = `tel:${member.phone}`
      } else {
        navigator.clipboard.writeText(member.phone)
        // You might want to add a toast notification here
      }
    }
  }

  const handleLinkedInClick = () => {
    if (member.linkedin_url) {
      window.open(member.linkedin_url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-white hover:shadow-md transition-all duration-300">
      {/* Always Visible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-slate-50/50 transition-colors"
        aria-expanded={isExpanded}
        aria-label={`View details for ${member.name}`}
      >
        {/* Headshot */}
        <div className="flex-shrink-0">
          {member.headshot_url ? (
            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
              <Image
                src={member.headshot_url}
                alt={`${member.name} headshot`}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <User className="w-6 h-6 text-slate-500" />
            </div>
          )}
        </div>

        {/* Basic Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-base">{member.name}</h3>
          <p className="text-sm text-slate-600">{member.title}</p>
        </div>

        {/* Expand Icon */}
        <ChevronDown 
          className={cn(
            "w-5 h-5 text-slate-400 transition-transform duration-300",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Expandable Content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isExpanded ? (isMobile ? "max-h-[600px]" : "max-h-96") : "max-h-0"
        )}
      >
        <div className={cn(
          "px-4 pb-4 pt-0 border-t border-slate-100",
          isMobile ? "flex flex-col space-y-4" : "space-y-4"
        )}>
          {/* Contact Actions - Show first on mobile for better accessibility */}
          <div className={cn(
            "flex gap-2 pt-4",
            isMobile ? "flex-row order-1" : "flex-row flex-wrap order-2"
          )}>
            {member.email && (
              <button
                onClick={handleEmailClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </button>
            )}
            
            {member.phone && (
              <button
                onClick={handlePhoneClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{isMobile ? 'Call' : 'Phone'}</span>
              </button>
            )}
            
            {member.linkedin_url && (
              <button
                onClick={handleLinkedInClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
              >
                <Linkedin className="w-3.5 h-3.5" />
                <span>LinkedIn</span>
              </button>
            )}
          </div>

          {/* Bio - Show after buttons on mobile, with scroll if needed */}
          {member.bio && (
            <div className={cn(
              isMobile ? "order-2 max-h-48 overflow-y-auto" : "order-1"
            )}>
              <p className="text-sm text-slate-700 leading-relaxed">{member.bio}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}