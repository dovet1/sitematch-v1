import { requireAdmin } from '@/lib/auth'
import PlanningCompletion from './planning-completion'
export const dynamic = 'force-dynamic'
export default async function PlanningCompletionPage() {
  await requireAdmin()
  return <PlanningCompletion />
}
