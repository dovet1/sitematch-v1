import { requireAdmin } from '@/lib/auth'
import { AdminService } from '@/lib/admin'
import { ListingReview } from './components/ListingReview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface ListingReviewPageProps {
  params: Promise<{ id: string }>
}

export default async function ListingReviewPage({ params }: ListingReviewPageProps) {
  await requireAdmin()

  const { id } = await params

  const adminService = new AdminService()
  const listing = await adminService.getListingById(id).catch(() => null)
  
  if (!listing) {
    notFound()
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/listings">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Queue
            </Link>
          </Button>
          <div>
            <h1 className="heading-1">Listing Review</h1>
            <p className="body-large text-muted-foreground">
              Review and moderate listing submission
            </p>
          </div>
        </div>
      </div>

      {/* Listing Review Component */}
      <ListingReview listing={listing} />
    </div>
  )
}