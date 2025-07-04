import { requireAdmin } from '@/lib/auth'
import { AdminService } from '@/lib/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Plus } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

async function createOrganization(formData: FormData) {
  'use server'
  
  const name = formData.get('name') as string
  const type = formData.get('type') as 'occupier' | 'landlord' | 'agent'
  
  if (!name || !type) {
    throw new Error('Name and type are required')
  }
  
  try {
    const adminService = new AdminService()
    await adminService.createOrganization({ name, type })
    redirect('/admin/organizations?success=created')
  } catch (error) {
    console.error('Failed to create organization:', error)
    throw new Error('Failed to create organization')
  }
}

export default async function OrganizationsPage() {
  await requireAdmin()
  
  const adminService = new AdminService()
  const organizations = await adminService.getAllOrganizations()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Organizations</h1>
            <p className="text-muted-foreground">Manage organizations and their members</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin">← Back to Admin</Link>
        </Button>
      </div>

      {/* Create Organization Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Organization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createOrganization} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Enter organization name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select type...</option>
                  <option value="occupier">Occupier</option>
                  <option value="landlord">Landlord</option>
                  <option value="agent">Agent</option>
                </select>
              </div>
            </div>
            <Button type="submit">Create Organization</Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Organizations */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {organizations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No organizations found. Create one above to get started.
              </p>
            ) : (
              organizations.map((org) => (
                <div key={org.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {org.type}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(org.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}