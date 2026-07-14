import { requireAdmin } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RequirementForm } from '../components/RequirementForm'

export const dynamic = 'force-dynamic'

export default async function EditRequirementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-1">Edit requirement</h1>
          <p className="body-large text-muted-foreground">
            Curated occupier requirement for the unified workspace
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/requirements">← Back</Link>
        </Button>
      </div>

      <RequirementForm requirementId={id} />
    </div>
  )
}
