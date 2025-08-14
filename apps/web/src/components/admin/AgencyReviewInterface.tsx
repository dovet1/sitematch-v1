'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  Eye, 
  Clock,
  User,
  Calendar,
  AlertTriangle,
  MessageSquare,
  History,
  Building2,
  Users,
  MapPin,
  Globe,
  Mail,
  Phone
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

interface AgencyData {
  id: string
  name: string
  description: string | null
  website: string | null
  logo_url: string | null
  coverage_areas: string
  specialisms: string[]
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
  approved_at: string | null
  created_by: string
  creator_email: string
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

interface AgencyVersion {
  id: string
  version_number: number
  data: any
  status: 'pending' | 'approved' | 'rejected' | 'draft'
  admin_notes: string | null
  created_at: string
  created_by: string
  reviewed_at: string | null
  reviewed_by: string | null
}

interface AgencyReviewInterfaceProps {
  agency: AgencyData
  members: AgentMember[]
  versions: AgencyVersion[]
  currentVersion: AgencyVersion | null
}

const REJECTION_REASONS = [
  'Incomplete information',
  'Poor quality logo/images',
  'Inappropriate content',
  'Duplicate agency',
  'Invalid contact information',
  'Suspicious or fake business',
  'Custom reason'
]

export function AgencyReviewInterface({ 
  agency, 
  members, 
  versions, 
  currentVersion 
}: AgencyReviewInterfaceProps) {
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const router = useRouter()

  function getAgencyInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const handleApproval = async (action: 'approve' | 'reject') => {
    setIsProcessing(true)
    setMessage(null)

    try {
      const rejectionReason = action === 'reject' 
        ? (selectedReason === 'Custom reason' ? customReason : selectedReason)
        : null

      const response = await fetch(`/api/admin/agencies/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agencyId: agency.id,
          reason: rejectionReason,
          adminNotes: adminNotes.trim() || undefined
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${action} agency`)
      }

      setMessage({
        type: 'success',
        text: `Agency ${action === 'approve' ? 'approved' : 'rejected'} successfully!`
      })

      // Redirect back to admin dashboard after a delay
      setTimeout(() => {
        router.push('/admin/agencies')
      }, 2000)

    } catch (error) {
      console.error(`Error ${action}ing agency:`, error)
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : `Failed to ${action} agency`
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const canTakeAction = agency.status === 'pending' || agency.status === 'draft'
  const finalReason = selectedReason === 'Custom reason' ? customReason : selectedReason

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/agencies">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agency Review</h1>
            <p className="text-gray-600">Administrative review for {agency.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(agency.status)}>
            {agency.status}
          </Badge>
          <Link href={`/agents/${agency.id}`} target="_blank">
            <Button variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              Preview Public
            </Button>
          </Link>
        </div>
      </div>

      {/* Status Messages */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Agency Preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agency Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Agency Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Header with Logo */}
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  {agency.logo_url ? (
                    <Image
                      src={agency.logo_url}
                      alt={`${agency.name} logo`}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-semibold text-2xl">
                      {getAgencyInitials(agency.name)}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{agency.name}</h2>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {agency.creator_email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDistanceToNow(new Date(agency.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-4">
                {agency.description && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Description</Label>
                    <p className="mt-1 text-gray-900 whitespace-pre-wrap">{agency.description}</p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-gray-700">Coverage Areas</Label>
                  <div className="mt-1 flex items-center gap-1 text-gray-900">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    {agency.coverage_areas}
                  </div>
                </div>

                {agency.website && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Website</Label>
                    <div className="mt-1 flex items-center gap-1">
                      <Globe className="w-4 h-4 text-gray-500" />
                      <a 
                        href={agency.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {agency.website}
                      </a>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-gray-700">Specialisms</Label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {agency.specialisms.map((specialism, index) => (
                      <Badge key={index} variant="secondary">
                        {specialism}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="w-10 h-10 bg-gray-100 rounded-full overflow-hidden">
                      {member.headshot_url ? (
                        <Image
                          src={member.headshot_url}
                          alt={member.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 font-semibold">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{member.name}</h4>
                        <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                          {member.role}
                        </Badge>
                        {member.is_registered && (
                          <Badge variant="outline" className="text-xs">Registered</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {member.email}
                        </span>
                        {member.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {member.phone}
                          </span>
                        )}
                      </div>
                      {member.coverage_area && (
                        <p className="text-sm text-gray-600 mt-1">
                          <MapPin className="w-3 h-3 inline mr-1" />
                          {member.coverage_area}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Admin Actions */}
        <div className="space-y-6">
          {/* Admin Actions */}
          {canTakeAction && (
            <Card>
              <CardHeader>
                <CardTitle>Review Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Approve Button */}
                <Button
                  onClick={() => handleApproval('approve')}
                  disabled={isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {isProcessing ? 'Processing...' : 'Approve Agency'}
                </Button>

                {/* Rejection Section */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">
                    Rejection Reason (if rejecting)
                  </Label>
                  <select
                    value={selectedReason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select reason...</option>
                    {REJECTION_REASONS.map(reason => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>

                  {selectedReason === 'Custom reason' && (
                    <Textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Enter custom rejection reason..."
                      rows={2}
                    />
                  )}

                  <Button
                    onClick={() => handleApproval('reject')}
                    disabled={isProcessing || !finalReason}
                    variant="destructive"
                    className="w-full"
                    size="lg"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {isProcessing ? 'Processing...' : 'Reject Agency'}
                  </Button>
                </div>

                {/* Admin Notes */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Admin Notes (Internal)
                  </Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes about this review..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Admin Notes */}
          {agency.admin_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Previous Admin Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{agency.admin_notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Version History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {versions.map((version) => (
                  <div key={version.id} className="border-l-2 border-gray-200 pl-3 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">Version {version.version_number}</span>
                      <Badge className={getStatusColor(version.status)} size="sm">
                        {version.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">
                      {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                    </p>
                    {version.admin_notes && (
                      <p className="text-xs text-gray-700 mt-1 italic">
                        "{version.admin_notes}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quality Indicators */}
          <Card>
            <CardHeader>
              <CardTitle>Quality Check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Logo Quality</span>
                <Badge variant={agency.logo_url ? 'default' : 'secondary'}>
                  {agency.logo_url ? 'Has Logo' : 'No Logo'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Description</span>
                <Badge variant={agency.description ? 'default' : 'secondary'}>
                  {agency.description ? 'Complete' : 'Missing'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Team Size</span>
                <Badge variant={members.length > 0 ? 'default' : 'secondary'}>
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Website</span>
                <Badge variant={agency.website ? 'default' : 'secondary'}>
                  {agency.website ? 'Provided' : 'Not Provided'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}