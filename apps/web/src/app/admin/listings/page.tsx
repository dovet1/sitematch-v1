import { requireAdmin } from '@/lib/auth'
import { AdminService } from '@/lib/admin'
import { ModerationQueue } from './components/ModerationQueue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileCheck, AlertTriangle, Archive, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic';

export default async function AdminListingsPage() {
  await requireAdmin()
  
  const adminService = new AdminService()
  const moderationStats = await adminService.getModerationStats().catch(() => ({
    pending: 0,
    approvedToday: 0,
    totalListings: 0
  }))
  const listings = await adminService.getAllListings().catch(() => [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-1">Moderation Queue</h1>
          <p className="body-large text-muted-foreground">Review and moderate listing submissions</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">← Back to Dashboard</Link>
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="body-base font-medium">Pending Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="heading-3 text-warning">{moderationStats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="body-base font-medium">Approved</CardTitle>
            <FileCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="heading-3 text-success">{listings.filter((l: any) => l.status === 'approved').length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="body-base font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="heading-3 text-destructive">{listings.filter((l: any) => l.status === 'rejected').length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="body-base font-medium">Archived</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="heading-3 text-muted-foreground">{listings.filter((l: any) => l.status === 'archived').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Moderation Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle>Listing Queue</CardTitle>
          <CardDescription>All submitted listings requiring moderation</CardDescription>
        </CardHeader>
        <CardContent>
          <ModerationQueue listings={listings} />
        </CardContent>
      </Card>
    </div>
  )
}