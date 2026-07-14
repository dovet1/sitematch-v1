import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RequirementForm } from '../components/RequirementForm'

export const dynamic = 'force-dynamic'

export default async function NewRequirementPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; brandName?: string }>
}) {
  await requireAdmin()
  const { brand } = await searchParams

  // Validate the preselected brand exists so a stale link can't inject a bad FK.
  let initialBrandId: string | undefined
  let initialBrandName: string | undefined
  if (brand) {
    const supabase = createAdminClient()
    const { data } = await supabase.from('brands').select('id, name').eq('id', brand).maybeSingle()
    const row = data as { id: string; name: string } | null
    if (row) {
      initialBrandId = row.id
      initialBrandName = row.name
    }
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-1">New requirement</h1>
          <p className="body-large text-muted-foreground">
            Curated occupier requirement for the unified workspace
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/requirements">← Back</Link>
        </Button>
      </div>

      <RequirementForm initialBrandId={initialBrandId} initialBrandName={initialBrandName} />
    </div>
  )
}
