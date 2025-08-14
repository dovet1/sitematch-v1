'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Building2, 
  MapPin, 
  Globe, 
  Mail, 
  Phone, 
  Settings,
  Users,
  Calendar,
  Star,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { ContactModal } from './ContactModal'

interface AgencyData {
  id: string
  name: string
  description: string | null
  website: string | null
  logo_url: string | null
  coverage_areas: string
  specialisms: string[]
  status: string
  created_at: string
  approved_at: string | null
}

interface AgentMember {
  user_id: string | null
  email: string
  name: string
  phone: string | null
  coverage_area: string | null
  headshot_url: string | null
  role: 'admin' | 'member'
  is_registered: boolean
  joined_at: string | null
}

interface AgencyDetailProps {
  agency: AgencyData
  members: AgentMember[]
  isUserMember: boolean
  userRole?: 'admin' | 'member'
}

export function AgencyDetail({ agency, members, isUserMember, userRole }: AgencyDetailProps) {
  const [showContactModal, setShowContactModal] = useState(false)

  function getAgencyInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  function getSpecialismColor(specialism: string): string {
    const colorMap: Record<string, string> = {
      'Office': 'bg-blue-50 text-blue-700 border-blue-200',
      'Retail': 'bg-green-50 text-green-700 border-green-200',
      'Industrial': 'bg-orange-50 text-orange-700 border-orange-200',
      'Warehouse': 'bg-purple-50 text-purple-700 border-purple-200',
      'Land': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'Mixed Use': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'Healthcare': 'bg-red-50 text-red-700 border-red-200',
      'Education': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'Hospitality': 'bg-pink-50 text-pink-700 border-pink-200',
      'Leisure': 'bg-cyan-50 text-cyan-700 border-cyan-200',
      'Investment': 'bg-amber-50 text-amber-700 border-amber-200',
      'Development': 'bg-lime-50 text-lime-700 border-lime-200',
      'Agricultural': 'bg-green-50 text-green-700 border-green-200',
      'Residential': 'bg-rose-50 text-rose-700 border-rose-200',
      'Student Accommodation': 'bg-teal-50 text-teal-700 border-teal-200'
    }
    return colorMap[specialism] || 'bg-gray-50 text-gray-700 border-gray-200'
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long'
    })
  }

  // Filter members to show registered ones first, then by role
  const registeredMembers = members.filter(m => m.is_registered)
  const unregisteredMembers = members.filter(m => !m.is_registered)
  const displayMembers = [...registeredMembers, ...unregisteredMembers]

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-violet-50 via-white to-blue-50 py-16 sm:py-24">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, rgb(99, 102, 241) 1px, transparent 1px)`,
              backgroundSize: '32px 32px'
            }} />
          </div>

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              {/* Agency Logo */}
              <div className="flex justify-center mb-8">
                <div className="w-32 h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-2xl">
                  {agency.logo_url ? (
                    <Image
                      src={agency.logo_url}
                      alt={`${agency.name} logo`}
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-4xl">
                      {getAgencyInitials(agency.name)}
                    </span>
                  )}
                </div>
              </div>

              {/* Agency Name */}
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
                {agency.name}
              </h1>

              {/* Coverage Areas */}
              <div className="flex items-center justify-center text-lg text-gray-600 mb-6">
                <MapPin className="w-5 h-5 mr-2 text-violet-600" />
                <span>{agency.coverage_areas}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button 
                  size="lg" 
                  onClick={() => setShowContactModal(true)}
                  className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-8 py-3 text-lg font-semibold shadow-lg"
                >
                  <Mail className="w-5 h-5 mr-2" />
                  Contact Agency
                </Button>

                {agency.website && (
                  <Button 
                    variant="outline" 
                    size="lg"
                    asChild
                    className="border-2 px-8 py-3 text-lg"
                  >
                    <a href={agency.website} target="_blank" rel="noopener noreferrer">
                      <Globe className="w-5 h-5 mr-2" />
                      Visit Website
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </a>
                  </Button>
                )}

                {/* Admin Edit Button */}
                {isUserMember && userRole === 'admin' && (
                  <Link href="/agents/settings">
                    <Button variant="outline" size="lg" className="border-2 px-6 py-3">
                      <Settings className="w-5 h-5 mr-2" />
                      Manage Agency
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Main Content Column */}
            <div className="lg:col-span-2 space-y-12">
              {/* About Section */}
              {agency.description && (
                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">About {agency.name}</h2>
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {agency.description}
                      </p>
                    </CardContent>
                  </Card>
                </section>
              )}

              {/* Team Section */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Our Team</h2>
                  <span className="text-sm text-gray-500">{displayMembers.length} members</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {displayMembers.map((member, index) => (
                    <Card key={index} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-4">
                          {/* Member Photo */}
                          <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full overflow-hidden flex-shrink-0">
                            {member.headshot_url ? (
                              <Image
                                src={member.headshot_url}
                                alt={member.name}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600 font-semibold">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Member Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900 truncate">{member.name}</h3>
                              {member.role === 'admin' && (
                                <Badge className="bg-violet-100 text-violet-800 text-xs">
                                  <Star className="w-3 h-3 mr-1" />
                                  Admin
                                </Badge>
                              )}
                            </div>
                            
                            {member.coverage_area && (
                              <div className="flex items-center text-sm text-gray-600 mb-2">
                                <MapPin className="w-3 h-3 mr-1" />
                                <span className="truncate">{member.coverage_area}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-4 text-sm">
                              {member.phone && (
                                <a 
                                  href={`tel:${member.phone}`}
                                  className="flex items-center text-violet-600 hover:text-violet-800"
                                >
                                  <Phone className="w-3 h-3 mr-1" />
                                  <span>Call</span>
                                </a>
                              )}
                              <a 
                                href={`mailto:${member.email}`}
                                className="flex items-center text-violet-600 hover:text-violet-800"
                              >
                                <Mail className="w-3 h-3 mr-1" />
                                <span>Email</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Listings Section - Placeholder for Story 18.4 */}
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Properties</h2>
                <Card>
                  <CardContent className="p-8 text-center">
                    <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">Property listings will be displayed here</p>
                    <p className="text-sm text-gray-500">
                      This feature will be available after Story 18.4 implementation
                    </p>
                  </CardContent>
                </Card>
              </section>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              {/* Specialisms */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Our Specialisms</h3>
                  <div className="flex flex-wrap gap-2">
                    {agency.specialisms.map((specialism, index) => (
                      <Badge 
                        key={index} 
                        className={`text-xs font-medium px-3 py-1 border ${getSpecialismColor(specialism)}`}
                      >
                        {specialism}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Facts */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Quick Facts</h3>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <Users className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-600">{displayMembers.length} team members</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-600">Established {formatDate(agency.created_at)}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <MapPin className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-gray-600">{agency.coverage_areas}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Card */}
              <Card className="bg-gradient-to-br from-violet-50 to-blue-50 border-violet-200">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Get in Touch</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Ready to work with {agency.name}? Contact us today to discuss your property needs.
                  </p>
                  <Button 
                    onClick={() => setShowContactModal(true)}
                    className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      <ContactModal
        agency={agency}
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />
    </>
  )
}