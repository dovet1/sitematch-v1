import { createServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Building, MapPin, FileText, Phone, Mail, Calendar } from 'lucide-react'

interface Props {
  params: {
    id: string
  }
}

export default async function TestListingPage({ params }: Props) {
  const supabase = createServerClient()
  
  // Get the main listing data
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', params.id)
    .single()

  if (listingError || !listing) {
    notFound()
  }

  // Get all contacts for this listing
  const { data: contacts } = await supabase
    .from('listing_contacts')
    .select('*')
    .eq('listing_id', params.id)
    .order('is_primary_contact', { ascending: false })

  // Get all locations for this listing
  const { data: locations } = await supabase
    .from('listing_locations')
    .select('*')
    .eq('listing_id', params.id)

  // Get all file uploads for this listing
  const { data: files } = await supabase
    .from('file_uploads')
    .select('*')
    .eq('listing_id', params.id)
    .order('file_type')

  // Get all FAQs for this listing
  const { data: faqs } = await supabase
    .from('faqs')
    .select('*')
    .eq('listing_id', params.id)
    .order('display_order')

  // Get organization info
  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', listing.org_id)
    .single()

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Listing Test Page</h1>
        <p className="text-muted-foreground">ID: {params.id}</p>
      </div>

      <div className="grid gap-6">
        {/* Main Listing Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Listing Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">{listing.title || 'No Title'}</h3>
                <p className="text-sm text-muted-foreground mb-4">{listing.description || 'No description'}</p>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Status: {listing.status}</Badge>
                    {listing.is_nationwide && <Badge variant="outline">Nationwide</Badge>}
                  </div>
                  <p><strong>Company:</strong> {listing.title?.includes('Property Requirement - ') ? listing.title.replace('Property Requirement - ', '') : organization?.name || 'N/A'}</p>
                  <p><strong>Sector ID:</strong> {listing.sector_id || 'N/A'}</p>
                  <p><strong>Use Class ID:</strong> {listing.use_class_id || 'N/A'}</p>
                  <p><strong>Site Size:</strong> {listing.site_size_min || 'N/A'} - {listing.site_size_max || 'N/A'} sq ft</p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <p><strong>Created:</strong> {new Date(listing.created_at).toLocaleString()}</p>
                <p><strong>Updated:</strong> {new Date(listing.updated_at).toLocaleString()}</p>
                <p><strong>Created by:</strong> {listing.created_by}</p>
                {listing.logo_url && (
                  <div>
                    <strong>Logo:</strong>
                    <img src={listing.logo_url} alt="Logo" className="w-16 h-16 object-contain mt-1" />
                  </div>
                )}
                {listing.brochure_url && (
                  <div>
                    <strong>Brochure:</strong>
                    <a href={listing.brochure_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      View Brochure
                    </a>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Contacts ({1 + (contacts?.length || 0)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {/* Primary Contact from main listing */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{listing.contact_name}</h4>
                      <Badge variant="default">Primary Contact</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{listing.contact_title}</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {listing.contact_email}
                      </div>
                      {listing.contact_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {listing.contact_phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Additional Contacts from contacts table */}
              {contacts && contacts.length > 0 && contacts.map((contact) => (
                <div key={contact.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    {contact.headshot_url && (
                      <img 
                        src={contact.headshot_url} 
                        alt={contact.contact_name}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{contact.contact_name}</h4>
                        <Badge variant="outline">Additional Contact</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{contact.contact_title}</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {contact.contact_email}
                        </div>
                        {contact.contact_phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {contact.contact_phone}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Created: {new Date(contact.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Locations ({locations?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {locations && locations.length > 0 ? (
              <div className="grid gap-2">
                {locations.map((location) => (
                  <div key={location.id} className="border rounded p-3">
                    <p className="font-medium">{location.place_name}</p>
                    <p className="text-sm text-muted-foreground">Type: {location.type}</p>
                    {location.coordinates && (
                      <p className="text-sm text-muted-foreground">
                        Coordinates: {location.coordinates.lat}, {location.coordinates.lng}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                {listing.is_nationwide ? 'Nationwide coverage' : 'No specific locations'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Files */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Files ({files?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {files && files.length > 0 ? (
              <div className="grid gap-3">
                {files.map((file) => (
                  <div key={file.id} className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{file.file_name}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <Badge variant="outline">{file.file_type}</Badge>
                          <span>{file.bucket_name}</span>
                          <span>{(file.file_size / 1024 / 1024).toFixed(2)} MB</span>
                          <span>{file.mime_type}</span>
                        </div>
                      </div>
                      {file.file_type === 'headshot' && (
                        <img 
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket_name}/${file.file_path}`}
                          alt={file.file_name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Path: {file.file_path}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No files uploaded</p>
            )}
          </CardContent>
        </Card>

        {/* FAQs */}
        <Card>
          <CardHeader>
            <CardTitle>FAQs ({faqs?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {faqs && faqs.length > 0 ? (
              <div className="space-y-4">
                {faqs.map((faq) => (
                  <div key={faq.id} className="border rounded p-4">
                    <h4 className="font-semibold mb-2">{faq.question}</h4>
                    <p className="text-muted-foreground">{faq.answer}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Order: {faq.display_order}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No FAQs added</p>
            )}
          </CardContent>
        </Card>

        {/* Raw Data (for debugging) */}
        <Card>
          <CardHeader>
            <CardTitle>Raw Data (Debug)</CardTitle>
          </CardHeader>
          <CardContent>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium mb-2">Click to view raw JSON data</summary>
              <pre className="bg-muted p-4 rounded text-xs overflow-auto">
                {JSON.stringify({
                  listing,
                  contacts,
                  locations,
                  files,
                  faqs,
                  organization
                }, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}