import { requireAdmin } from '@/lib/auth'
import { AdminService } from '@/lib/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Users, Activity, FileCheck, AlertTriangle, Building2 } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboard() {
  await requireAdmin()
  
  const adminService = new AdminService()
  const stats = await adminService.getUserStats()
  const recentUsers = await adminService.getAllUsers()
  
  // Get moderation statistics
  const moderationStats = await adminService.getModerationStats().catch(() => ({
    pending: 0,
    approvedToday: 0,
    totalListings: 0
  }))

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="heading-1">Admin Dashboard</h1>
          <p className="body-large text-muted-foreground">System administration and user management</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="heading-2">{stats.total}</div>
            <p className="caption text-muted-foreground">
              {stats.admins} admin{stats.admins !== 1 ? 's' : ''}, {stats.occupiers} occupier{stats.occupiers !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Pending Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="heading-2 text-warning">{moderationStats.pending}</div>
            <p className="caption text-muted-foreground">Listings awaiting moderation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Approved Today</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="heading-2 text-success">{moderationStats.approvedToday}</div>
            <p className="caption text-muted-foreground">Listings approved today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="heading-2 text-success">Online</div>
            <p className="caption text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <Button asChild>
            <Link href="/admin/listings">Moderation Queue</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/agencies">
              <Building2 className="h-4 w-4 mr-2" />
              Agency Management
            </Link>
          </Button>
          <Button variant="outline" disabled>
            <span>Manage Users (Coming Soon)</span>
          </Button>
          <Button variant="outline" disabled>
            <span>Audit Trail (Coming Soon)</span>
          </Button>
        </CardContent>
      </Card>

      {/* Recent Users */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Users</CardTitle>
          <CardDescription>Latest user registrations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentUsers.slice(0, 5).map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="body-small font-medium text-primary">
                      {user.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="body-base font-medium">{user.email}</p>
                    <p className="body-small text-muted-foreground">
                      {user.role} • {user.org_id ? `Org: ${user.org_id.slice(0, 8)}...` : 'No organization'}
                    </p>
                  </div>
                </div>
                <div className="body-small text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}