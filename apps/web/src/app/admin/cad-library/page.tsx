import { requireAdmin } from '@/lib/auth'
import { CadLibraryClient } from './CadLibraryClient'

export const dynamic = 'force-dynamic'

export default async function AdminCadLibraryPage() {
  await requireAdmin()
  return <CadLibraryClient />
}
