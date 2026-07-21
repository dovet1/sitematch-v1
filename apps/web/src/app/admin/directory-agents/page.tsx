import { requireAdmin } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DirectoryAgentsAdmin } from './components/DirectoryAgentsAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminDirectoryAgentsPage() {
  await requireAdmin()

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-1">Directory agents</h1>
          <p className="body-large text-muted-foreground">
            Agency firms and their people, as shown in the SiteMatcher directory. Attach them to
            brands from each brand&apos;s Agents tab.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Not to be confused with <strong>Agency Management</strong>, which manages the older
        agency records attached to listings. These two are separate datasets.
      </p>

      <DirectoryAgentsAdmin />
    </div>
  )
}
