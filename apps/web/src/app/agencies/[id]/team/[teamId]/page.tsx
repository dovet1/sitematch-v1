'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building2,
  User,
  Mail,
  Phone,
  ExternalLink,
  ArrowLeft,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

interface TeamMember {
  id: string
  name: string
  title: string
  bio?: string
  email?: string
  phone?: string
  linkedin_url?: string
  headshot_url?: string
  display_order: number
  agency_id: string
}

interface Agency {
  id: string
  name: string
  classification?: string
  geographic_patch?: string
  status: string
}

interface TeamMemberWithAgency extends TeamMember {
  agency: Agency
}

export default function TeamMemberPage() {
  const params = useParams<{ id: string; teamId: string }>()
  const agencyId = params?.id as string
  const teamId = params?.teamId as string
  const [teamMember, setTeamMember] = useState<TeamMemberWithAgency | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTeamMember()
  }, [agencyId, teamId])

  const fetchTeamMember = async () => {
    try {
      const response = await fetch(`/api/agencies/${agencyId}/team/${teamId}/profile`)
      if (!response.ok) {
        throw new Error('Team member not found')
      }
      const result = await response.json()
      setTeamMember(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team member')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !teamMember) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Team member not found'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Breadcrumb */}
        <div className="mb-6">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link href="/agencies" className="hover:text-foreground">
              Agency Directory
            </Link>
            <span>/</span>
            <Link 
              href={`/agencies/${teamMember.agency.id}`} 
              className="hover:text-foreground"
            >
              {teamMember.agency.name}
            </Link>
            <span>/</span>
            <span className="text-foreground">{teamMember.name}</span>
          </nav>
        </div>

        {/* Back Button */}
        <div className="mb-6">
          <Button asChild variant="outline" size="sm">
            <Link href={`/agencies/${teamMember.agency.id}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {teamMember.agency.name}
            </Link>
          </Button>
        </div>

        {/* Team Member Profile */}
        <div className="grid gap-6">
          {/* Header */}
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-start gap-6">
                {/* Headshot */}
                <div className="flex-shrink-0">
                  {teamMember.headshot_url ? (
                    <div className="w-32 h-32 rounded-xl overflow-hidden bg-muted">
                      <Image
                        src={teamMember.headshot_url}
                        alt={`${teamMember.name} headshot`}
                        width={128}
                        height={128}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <User className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    {teamMember.name}
                  </h1>
                  <p className="text-xl text-muted-foreground mb-4">
                    {teamMember.title}
                  </p>
                  
                  {/* Agency Link */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                    <Building2 className="h-4 w-4" />
                    <Link 
                      href={`/agencies/${teamMember.agency.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {teamMember.agency.name}
                    </Link>
                    {teamMember.agency.geographic_patch && (
                      <>
                        <span>•</span>
                        <span>{teamMember.agency.geographic_patch}</span>
                      </>
                    )}
                  </div>

                  {/* Contact Actions */}
                  <div className="flex flex-wrap gap-3">
                    {teamMember.email && (
                      <Button asChild>
                        <a href={`mailto:${teamMember.email}`}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </a>
                      </Button>
                    )}
                    
                    {teamMember.phone && (
                      <Button asChild variant="outline">
                        <a href={`tel:${teamMember.phone}`}>
                          <Phone className="h-4 w-4 mr-2" />
                          Call Now
                        </a>
                      </Button>
                    )}
                    
                    {teamMember.linkedin_url && (
                      <Button asChild variant="outline">
                        <a 
                          href={teamMember.linkedin_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          LinkedIn
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bio */}
          {teamMember.bio && (
            <Card>
              <CardHeader>
                <CardTitle>About {teamMember.name.split(' ')[0]}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {teamMember.bio}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamMember.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <a 
                        href={`mailto:${teamMember.email}`}
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {teamMember.email}
                      </a>
                    </div>
                  </div>
                )}
                
                {teamMember.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <a 
                        href={`tel:${teamMember.phone}`}
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {teamMember.phone}
                      </a>
                    </div>
                  </div>
                )}
                
                {teamMember.linkedin_url && (
                  <div className="flex items-center gap-3">
                    <ExternalLink className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">LinkedIn</p>
                      <a 
                        href={teamMember.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        View LinkedIn Profile
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agency Information */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle>About {teamMember.agency.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {teamMember.name} is part of {teamMember.agency.name}
                {teamMember.agency.classification && ` specializing in ${teamMember.agency.classification.toLowerCase()} properties`}
                {teamMember.agency.geographic_patch && ` in ${teamMember.agency.geographic_patch}`}.
              </p>
              
              <Button asChild>
                <Link href={`/agencies/${teamMember.agency.id}`}>
                  <Building2 className="h-4 w-4 mr-2" />
                  View Agency Profile
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}