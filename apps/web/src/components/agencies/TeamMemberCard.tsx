'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, Mail, Phone, Linkedin, User, Edit, Trash2, MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  isEdit?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function TeamMemberCard({ 
  member, 
  isMobile = false,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  isEdit = false,
  onEdit,
  onDelete
}: TeamMemberCardProps) {
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

  // Mobile Option 2 Design: Horizontal layout with progressive disclosure
  if (isMobile) {
    return (
      <div className="border border-slate-200 rounded-lg bg-white">
        {/* Main Content Row */}
        <div className="p-4">
          <div className="flex items-center gap-3">
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

            {/* Name & Title */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-base truncate">{member.name}</h3>
              <p className="text-sm text-slate-600 truncate">{member.title}</p>
            </div>

            {/* Context Menu (Edit Mode) - Clean single button */}
            {isEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                    aria-label="More options"
                  >
                    <MoreVertical className="h-5 w-5 text-slate-600" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      onEdit?.()
                    }}
                    className="flex items-center gap-3 py-2.5 cursor-pointer"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit Member</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      if (canMoveUp && onMoveUp) {
                        onMoveUp()
                      }
                    }}
                    disabled={!canMoveUp}
                    className="flex items-center gap-3 py-2.5 cursor-pointer"
                  >
                    <ChevronUp className="h-4 w-4" />
                    <span>Move Up</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      if (canMoveDown && onMoveDown) {
                        onMoveDown()
                      }
                    }}
                    disabled={!canMoveDown}
                    className="flex items-center gap-3 py-2.5 cursor-pointer"
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span>Move Down</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault()
                      onDelete?.()
                    }}
                    className="flex items-center gap-3 py-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Contact Pills Row */}
          {(member.email || member.phone || member.linkedin_url) && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500 font-medium">Contact:</span>
                {member.email && (
                  <button
                    onClick={handleEmailClick}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                    Email
                  </button>
                )}
                {member.phone && (
                  <button
                    onClick={handlePhoneClick}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
                  >
                    <Phone className="w-3 h-3" />
                    Call
                  </button>
                )}
                {member.linkedin_url && (
                  <button
                    onClick={handleLinkedInClick}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
                  >
                    <Linkedin className="w-3 h-3" />
                    LinkedIn
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Bio (if exists) */}
          {member.bio && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">{member.bio}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Desktop Version (existing expandable design)
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