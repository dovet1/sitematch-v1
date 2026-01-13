import { requireAdmin } from '@/lib/auth'
import { AdminService } from '@/lib/admin'
import { AllListingsTable } from './components/AllListingsTable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, CheckCircle2, XCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function AllListingsPage() {
  await requireAdmin()

  const adminService = new AdminService()
  const listings = await adminService.getAllListings().catch(() => [])

  // Calculate stats
  const totalListings = listings.length
  const verifiedListings = listings.filter((l: any) => l.verified_at).length
  const unverifiedListings = totalListings - verifiedListings
  const approvedListings = listings.filter((l: any) => l.status === 'approved').length

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-1">All Listings</h1>
          <p className="body-large text-muted-foreground">
            Manage verification dates for all listings
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">← Back to Dashboard</Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="body-base font-medium">Total Listings</CardTitle>
            <Database className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="heading-3 text-primary">{totalListings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="body-base font-medium">Verified</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="heading-3 text-success">{verifiedListings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalListings > 0 ? Math.round((verifiedListings / totalListings) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="body-base font-medium">Unverified</CardTitle>
            <XCircle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="heading-3 text-warning">{unverifiedListings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Need verification
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="body-base font-medium">Approved</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="heading-3">{approvedListings}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active listings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* All Listings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Listing Management</CardTitle>
          <CardDescription>
            Search, filter, and update verification dates for all listings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AllListingsTable listings={listings} />
        </CardContent>
      </Card>
    </div>
  )
}
