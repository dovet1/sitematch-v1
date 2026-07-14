import { requireAdmin } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BrandsAdmin } from './components/BrandsAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminBrandsPage() {
  await requireAdmin()

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-1">Brands</h1>
          <p className="body-large text-muted-foreground">
            Store estates, requirements and contacts behind the unified workspace
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">← Back to Dashboard</Link>
        </Button>
      </div>

      <BrandsAdmin />
    </div>
  )
}
