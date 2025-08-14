import { requireAdmin } from '@/lib/auth'
import { AdminService } from '@/lib/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Shield, Users, Activity, FileCheck, AlertTriangle, Building2, Calendar } from 'lucide-react'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase'

export default async function AdminDashboard() {
  await requireAdmin()
  
  const adminService = new AdminService()
  const stats = await adminService.getUserStats()
  const allUsers = await adminService.getAllUsers()
  
  // Get moderation statistics
  const moderationStats = await adminService.getModerationStats().catch(() => ({
    pending: 0,
    approvedToday: 0,
    totalListings: 0
  }))

  // Get agency statistics
  const supabase = createServerClient()
  const { data: agencies } = await supabase
    .from('agencies')
    .select('id, status')

  // Get agencies with pending versions (the real pending count)
  const { data: pendingVersions } = await supabase
    .from('agency_versions')
    .select('agency_id')
    .eq('status', 'pending')

  const agencyStats = {
    pending: pendingVersions?.length || 0,
    total: agencies?.length || 0
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  function getRoleBadgeColor(role: string): string {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'occupier':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-600">Manage your platform content, agencies, and users</p>
        </div>

        {/* Three Main Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Listings Section */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                <FileCheck className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-xl text-slate-900">Listings</CardTitle>
              <CardDescription>Manage property listings and approvals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="font-medium text-amber-800">Pending Approval</span>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                    {moderationStats.pending}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                  <span className="font-medium text-green-800">Live Listings</span>
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    {moderationStats.totalListings - moderationStats.pending}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-medium text-slate-700">Archived</span>
                  <Badge variant="outline" className="border-slate-300">
                    0
                  </Badge>
                </div>
              </div>
              <Button asChild className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700">
                <Link href="/admin/listings">Manage Listings</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Agencies Section */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-xl text-slate-900">Agencies</CardTitle>
              <CardDescription>Review and manage agency registrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="font-medium text-amber-800">Pending Approval</span>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                    {agencyStats.pending}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                  <span className="font-medium text-green-800">All Agencies</span>
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    {agencyStats.total}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-medium text-slate-700">Archived</span>
                  <Badge variant="outline" className="border-slate-300">
                    0
                  </Badge>
                </div>
              </div>
              <Button asChild className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700">
                <Link href="/admin/agencies">Manage Agencies</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Users Section */}
          <Card className="group hover:shadow-lg transition-all duration-300 border-0 shadow-md bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300">
                <Users className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-xl text-slate-900">Users</CardTitle>
              <CardDescription>Manage user accounts and permissions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="font-medium text-blue-800">Total Users</span>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                    {allUsers.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                  <span className="font-medium text-red-800">Admins</span>
                  <Badge className="bg-red-100 text-red-800 border-red-300">
                    {allUsers.filter(u => u.role === 'admin').length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-medium text-slate-700">Occupiers</span>
                  <Badge variant="outline" className="border-slate-300">
                    {allUsers.filter(u => u.role === 'occupier').length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Management Detail */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>All registered users with their details and roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="grid grid-cols-4 gap-4 p-4 border-b bg-slate-50 font-medium text-sm text-slate-700">
                <div>Email Address</div>
                <div>Role</div>
                <div>Joined Date</div>
                <div>Organization</div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {allUsers.map((user) => (
                  <div key={user.id} className="grid grid-cols-4 gap-4 p-4 border-b last:border-b-0 text-sm hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-500 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-white">
                          {user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-slate-900">{user.email}</span>
                    </div>
                    <div>
                      <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                    </div>
                    <div className="text-slate-600">
                      {formatDate(user.created_at)}
                    </div>
                    <div className="text-slate-600">
                      {user.org_id ? `${user.org_id.slice(0, 8)}...` : 'None'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}