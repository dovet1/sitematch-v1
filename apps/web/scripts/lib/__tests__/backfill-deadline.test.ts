import { backfillDeadlineReached } from '../backfill-deadline'
const cutoff='2026-09-30T23:00:00Z'
it('stops at midnight London time including an already-running batch',()=>{
 expect(backfillDeadlineReached(cutoff,Date.parse('2026-09-30T22:59:59Z'))).toBe(false)
 expect(backfillDeadlineReached(cutoff,Date.parse(cutoff))).toBe(true)
 expect(backfillDeadlineReached(cutoff,Date.parse('2026-10-01T00:00:00Z'))).toBe(true)
})
it('rejects an invalid deadline',()=>{expect(()=>backfillDeadlineReached('September')).toThrow()})
it('preserves manual runs without a cutoff',()=>{expect(backfillDeadlineReached(undefined)).toBe(false)})
