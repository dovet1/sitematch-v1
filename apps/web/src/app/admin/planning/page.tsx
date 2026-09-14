import { requireAdmin } from '@/lib/auth'
import PlanningReview from './planning-review'
export const dynamic = 'force-dynamic'
export default async function PlanningReviewPage() {
  await requireAdmin()
  return <PlanningReview />
}
