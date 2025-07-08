'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { 
  CheckCircle, 
  XCircle, 
  Archive, 
  Building, 
  MapPin, 
  FileText, 
  Users, 
  Phone, 
  Mail, 
  Globe,
  Download,
  AlertCircle,
  Clock,
  Edit
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ListingStatus } from '@/types/listings'
import { REJECTION_REASONS } from '@/types/listings'

interface ListingReviewProps {
  listing: any // Full listing data from AdminService
}

export function ListingReview({ listing }: ListingReviewProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRejectionReason, setSelectedRejectionReason] = useState('')
  const [customRejectionReason, setCustomRejectionReason] = useState('')
  const router = useRouter()

  const handleStatusUpdate = async (status: 'approved' | 'rejected' | 'archived') => {
    setIsLoading(true)
    try {
      const requestBody: any = { status }
      
      if (status === 'rejected') {
        const reason = selectedRejectionReason === 'other' ? customRejectionReason : selectedRejectionReason
        if (!reason) {
          alert('Please select a rejection reason')
          setIsLoading(false)
          return
        }
        requestBody.reason = reason
      }

      const response = await fetch(`/api/listings/${listing.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        router.push('/admin/listings')
        router.refresh()
      } else {
        const errorData = await response.json()
        console.error('Failed to update listing status:', errorData)
        alert(`Failed to update status: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error updating listing status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Status and Quick Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Listing Status</CardTitle>
              <StatusBadge status={listing.status} />
            </div>
            <div className="flex gap-2">
              {listing.status === 'pending' && (
                <>
                  <Button 
                    onClick={() => handleStatusUpdate('approved')}
                    disabled={isLoading}
                    className="bg-success hover:bg-success/90"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button 
                    onClick={() => handleStatusUpdate('rejected')}
                    disabled={isLoading}
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </>
              )}
              {(listing.status === 'approved' || listing.status === 'rejected') && (
                <Button 
                  onClick={() => handleStatusUpdate('archived')}
                  disabled={isLoading}
                  variant="outline"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {listing.status === 'pending' && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason (if rejecting)</Label>
              <Select value={selectedRejectionReason} onValueChange={setSelectedRejectionReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rejection reason..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REJECTION_REASONS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRejectionReason === 'other' && (
              <div className="space-y-2">
                <Label htmlFor="custom-reason">Custom Rejection Reason</Label>
                <Textarea
                  id="custom-reason"
                  placeholder="Please specify the rejection reason..."
                  value={customRejectionReason}
                  onChange={(e) => setCustomRejectionReason(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Company Name</Label>
              <p className="text-sm">{listing.company_name || 'Not provided'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Submitted By</Label>
              <p className="text-sm">{listing.users?.email || 'Unknown'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Submission Date</Label>
              <p className="text-sm">
                {new Date(listing.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
              <p className="text-sm">
                {new Date(listing.updated_at).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listing Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Listing Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Sector</Label>
              <p className="text-sm">{listing.sectors?.name || 'Not specified'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Use Class</Label>
              <p className="text-sm">{listing.use_classes?.code ? `${listing.use_classes.code} - ${listing.use_classes.name}` : 'Not specified'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Site Size Range</Label>
              <p className="text-sm">
                {listing.site_size_min && listing.site_size_max ? 
                  `${listing.site_size_min.toLocaleString()} - ${listing.site_size_max.toLocaleString()} sq ft` :
                  listing.site_size_min ? 
                    `${listing.site_size_min.toLocaleString()}+ sq ft` :
                    'Not specified'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary Contact */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Primary Contact
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                <p className="text-sm">{listing.contact_name || 'Not provided'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Title</Label>
                <p className="text-sm">{listing.contact_title || 'Not provided'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                <p className="text-sm">{listing.contact_email || 'Not provided'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                <p className="text-sm">{listing.contact_phone || 'Not provided'}</p>
              </div>
            </div>
          </div>

          {/* Primary Contact from separate field */}
          {listing.primary_contact && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Primary Contact (from contacts table)
              </h4>
              <div className="flex items-start gap-4 p-3 bg-muted rounded-lg">
                {listing.primary_contact.headshot_url && (
                  <div className="flex-shrink-0">
                    <img 
                      src={listing.primary_contact.headshot_url} 
                      alt={`${listing.primary_contact.contact_name} headshot`}
                      className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                  </div>
                )}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                    <p className="text-sm font-medium">{listing.primary_contact.contact_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Title</Label>
                    <p className="text-sm">{listing.primary_contact.contact_title || 'Not provided'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <p className="text-sm">{listing.primary_contact.contact_email || 'Not provided'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                    <p className="text-sm">{listing.primary_contact.contact_phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Contacts */}
          {listing.additional_contacts && listing.additional_contacts.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Additional Contacts
              </h4>
              <div className="space-y-4">
                {listing.additional_contacts.map((contact: any, index: number) => (
                  <div key={index} className="flex items-start gap-4 p-3 bg-muted rounded-lg">
                    {/* Headshot next to contact info */}
                    {contact.headshot_url && (
                      <div className="flex-shrink-0">
                        <img 
                          src={contact.headshot_url} 
                          alt={`${contact.contact_name} headshot`}
                          className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm"
                        />
                      </div>
                    )}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                        <p className="text-sm font-medium">{contact.contact_name || 'Not provided'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Title</Label>
                        <p className="text-sm">{contact.contact_title || 'Not provided'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                        <p className="text-sm">{contact.contact_email || 'Not provided'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Phone</Label>
                        <p className="text-sm">{contact.contact_phone || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Nationwide indicator - determined by lack of specific locations */}
          {(!listing.locations || listing.locations.length === 0) ? (
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Globe className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Nationwide Search</p>
                <p className="text-sm text-blue-700">This listing is open to locations across the entire country</p>
              </div>
            </div>
          ) : listing.locations && listing.locations.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-3">Specific Preferred Locations:</p>
              {listing.locations.map((location: any, index: number) => (
                <div key={location.id || index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-base">
                      {location.location_name || location.place_name || 'Location name not available'}
                    </p>
                    {location.formatted_address && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {location.formatted_address}
                      </p>
                    )}
                    {location.region && (
                      <p className="text-sm text-muted-foreground">
                        {location.region}{location.country && `, ${location.country}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {location.location_type || location.type || 'preferred'}
                    </Badge>
                    {location.coordinates && (
                      <Badge variant="secondary" className="text-xs">
                        {Array.isArray(location.coordinates) 
                          ? `${location.coordinates[1]?.toFixed(4)}, ${location.coordinates[0]?.toFixed(4)}`
                          : location.coordinates.lat && location.coordinates.lng
                          ? `${location.coordinates.lat.toFixed(4)}, ${location.coordinates.lng.toFixed(4)}`
                          : 'Coordinates available'
                        }
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <MapPin className="h-5 w-5 text-gray-500" />
              <div>
                <p className="font-medium text-gray-700">No Location Preferences Specified</p>
                <p className="text-sm text-gray-600">No specific locations or nationwide preference indicated</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supporting Documents */}
      {(listing.brochure_url || listing.logo_url || (listing.company_logos && listing.company_logos.length > 0) || (listing.listing_documents && listing.listing_documents.length > 0) || (listing.media_files && listing.media_files.length > 0) || (listing.all_files && listing.all_files.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Supporting Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Company Logo Section */}
            {(listing.logo_url || (listing.company_logos && listing.company_logos.length > 0)) && (
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="text-lg">🏢</span>
                  Company Logo
                </h4>
                <div className="space-y-2">
                  {listing.logo_url && (
                    <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 flex-1">
                        <img 
                          src={listing.logo_url} 
                          alt="Company Logo"
                          className="w-12 h-12 object-contain bg-white rounded border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                            if (nextElement) {
                              nextElement.style.display = 'block';
                            }
                          }}
                        />
                        <Globe className="h-4 w-4 hidden" />
                        <span className="font-medium">Company Logo</span>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <a href={listing.logo_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          View
                        </a>
                      </Button>
                    </div>
                  )}
                  {listing.company_logos && listing.company_logos.map((logo: any, index: number) => (
                    <div key={logo.id} className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 flex-1">
                        <img 
                          src={logo.file_url} 
                          alt={logo.file_name || 'Company Logo'}
                          className="w-12 h-12 object-contain bg-white rounded border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                            if (nextElement) {
                              nextElement.style.display = 'block';
                            }
                          }}
                        />
                        <Globe className="h-4 w-4 hidden" />
                        <span className="font-medium">{logo.file_name || 'Company Logo'}</span>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <a href={logo.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          View
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Company Brochure Section */}
            {listing.brochure_url && (
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="text-lg">📄</span>
                  Company Brochure
                </h4>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileText className="h-4 w-4" />
                  <span className="flex-1 font-medium">Company Brochure</span>
                  <Button size="sm" variant="outline" asChild>
                    <a href={listing.brochure_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {/* Site Plan Documents Section */}
            {listing.listing_documents && listing.listing_documents.filter((doc: any) => ['sitePlan', 'site_plan'].includes(doc.document_type)).length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="text-lg">📐</span>
                  Site Plan
                </h4>
                <div className="space-y-2">
                  {listing.listing_documents.filter((doc: any) => ['sitePlan', 'site_plan'].includes(doc.document_type)).map((doc: any, index: number) => (
                    <div key={doc.id} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <FileText className="h-4 w-4" />
                      <span className="flex-1">{doc.file_name || 'Site Plan Document'}</span>
                      <Button size="sm" variant="outline" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fit-Out Documents Section */}
            {listing.listing_documents && listing.listing_documents.filter((doc: any) => ['fitOut', 'fit_out'].includes(doc.document_type)).length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="text-lg">🔨</span>
                  Fit-Out
                </h4>
                <div className="space-y-2">
                  {listing.listing_documents.filter((doc: any) => ['fitOut', 'fit_out'].includes(doc.document_type)).map((doc: any, index: number) => (
                    <div key={doc.id} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <FileText className="h-4 w-4" />
                      <span className="flex-1">{doc.file_name || 'Fit-Out Document'}</span>
                      <Button size="sm" variant="outline" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other Documents Section */}
            {listing.listing_documents && listing.listing_documents.filter((doc: any) => !['sitePlan', 'site_plan', 'fitOut', 'fit_out', 'brochure'].includes(doc.document_type)).length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="text-lg">📎</span>
                  Other Documents
                </h4>
                <div className="space-y-2">
                  {listing.listing_documents.filter((doc: any) => !['sitePlan', 'site_plan', 'fitOut', 'fit_out', 'brochure'].includes(doc.document_type)).map((doc: any, index: number) => {
                    const getDocumentLabel = (type: string) => {
                      return type.charAt(0).toUpperCase() + type.slice(1);
                    };
                    
                    return (
                      <div key={doc.id} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <FileText className="h-4 w-4" />
                        <span className="flex-1">{doc.file_name || `${getDocumentLabel(doc.document_type)} Document`}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {getDocumentLabel(doc.document_type)}
                          </Badge>
                          <Button size="sm" variant="outline" asChild>
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Media Files Section */}
            {listing.media_files && listing.media_files.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="text-lg">🎬</span>
                  Media Files
                </h4>
                <div className="space-y-2">
                  {listing.media_files.map((media: any, index: number) => (
                    <div key={media.id} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <FileText className="h-4 w-4" />
                      <span className="flex-1">{media.file_name || `Media File`}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {media.file_type}
                        </Badge>
                        <Button size="sm" variant="outline" asChild>
                          <a href={media.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fallback: Show all files if organized sections are empty */}
            {(!listing.logo_url && !listing.brochure_url && (!listing.company_logos || listing.company_logos.length === 0) && (!listing.listing_documents || listing.listing_documents.length === 0) && (!listing.media_files || listing.media_files.length === 0)) && listing.all_files && listing.all_files.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <span className="text-lg">📁</span>
                  All Uploaded Files
                </h4>
                <div className="space-y-2">
                  {listing.all_files
                    .filter((file: any) => file.file_type !== 'headshot') // Exclude headshots as they're shown with contacts
                    .map((file: any, index: number) => {
                    const getFileIcon = (type: string) => {
                      switch (type) {
                        case 'logo': return '🏢';
                        case 'brochure': return '📄';
                        case 'sitePlan': return '📐';
                        case 'fitOut': return '🔨';
                        case 'headshot': return '👤';
                        default: return '📎';
                      }
                    };
                    
                    const getFileLabel = (type: string) => {
                      switch (type) {
                        case 'sitePlan': return 'Site Plan';
                        case 'fitOut': return 'Fit-Out';
                        case 'headshot': return 'Headshot';
                        default: return type.charAt(0).toUpperCase() + type.slice(1);
                      }
                    };
                    
                    const fileUrl = `https://***REMOVED***.supabase.co/storage/v1/object/public/${file.bucket_name}/${file.file_path}`;
                    
                    return (
                      <div key={file.id} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                        <span className="text-lg">{getFileIcon(file.file_type)}</span>
                        <div className="flex-1">
                          <div className="font-medium">{file.file_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {getFileLabel(file.file_type)} • {Math.round(file.file_size / 1024)}KB
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {getFileLabel(file.file_type)}
                          </Badge>
                          <Button size="sm" variant="outline" asChild>
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* FAQs */}
      {listing.faqs && listing.faqs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {listing.faqs.map((faq: any, index: number) => (
                <div key={faq.id} className="space-y-2">
                  <div className="font-medium text-sm">{faq.question}</div>
                  <div className="text-sm text-muted-foreground">{faq.answer}</div>
                  {index < listing.faqs.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Debug Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Raw Listing Data</Label>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96">
                {JSON.stringify(listing, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Moderation Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="admin-notes">Internal Notes (visible to admins only)</Label>
            <Textarea
              id="admin-notes"
              placeholder="Add any internal notes about this listing..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: ListingStatus }) {
  const statusConfig = {
    pending: {
      color: 'bg-warning text-warning-foreground',
      icon: Clock,
      label: 'Under Review'
    },
    approved: {
      color: 'bg-success text-success-foreground',
      icon: CheckCircle,
      label: 'Published'
    },
    rejected: {
      color: 'bg-destructive text-destructive-foreground',
      icon: XCircle,
      label: 'Needs Changes'
    },
    archived: {
      color: 'bg-muted text-muted-foreground',
      icon: Archive,
      label: 'Archived'
    },
    draft: {
      color: 'bg-muted text-muted-foreground',
      icon: Edit,
      label: 'Draft'
    }
  }

  const config = statusConfig[status] || statusConfig.draft
  const Icon = config.icon

  return (
    <Badge variant="secondary" className={`${config.color} flex items-center gap-1 w-fit`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}