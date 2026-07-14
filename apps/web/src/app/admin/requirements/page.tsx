import { requireAdmin } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RequirementsAdmin } from './components/RequirementsAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminRequirementsPage() {
  await requireAdmin()

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-1">Requirements</h1>
          <p className="body-large text-muted-foreground">
            Curated occupier requirements shown on the unified workspace
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/requirements/new">+ New requirement</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin">← Back to Dashboard</Link>
          </Button>
        </div>
      </div>

      <RequirementsAdmin />
    </div>
  )
}
