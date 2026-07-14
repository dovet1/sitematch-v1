import { requireAdmin } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BrandDetail } from '../components/BrandDetail'

export const dynamic = 'force-dynamic'

export default async function AdminBrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-1">Brand</h1>
          <p className="body-large text-muted-foreground">
            Details, stores, requirements and contacts
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/brands">← Back to Brands</Link>
        </Button>
      </div>

      <BrandDetail brandId={id} />
    </div>
  )
}
