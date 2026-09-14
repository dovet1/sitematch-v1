export const DEFAULT_MONTHLY_LLM_BUDGET_USD = 20
export const DEFAULT_INITIAL_STAGE_BUDGET_USD = 2
// Charged verbatim when a classification fails, because the provider may already have
// billed for an invalid answer. It must stay an upper bound on one queue item, not an
// average -- and a queue item is now up to MAX_CLASSIFICATION_ATTEMPTS billed calls.
//
// Re-measured 9 Sep 2026 after moving to google/gemini-2.5-flash-lite: 158 live records
// across two runs cost $0.03379, or $0.000214 each, so three worst-case attempts are about
// $0.00064 -- but a two-run sample has not seen the tail, so the worst single call is taken
// as roughly double the average, putting a queue item at ~$0.00129. Set to 0.002 for
// headroom above that: the ceiling exists to be safe, not tight. The first attempt at this
// used 0.001 and the budget test correctly rejected it for not covering three attempts.
// The previous model needed 0.003; anthropic/claude-haiku-4.5, the fallback, measured
// $0.0054 a record and would need about 0.017.
export const DEFAULT_CLASSIFICATION_RESERVATION_USD = 0.002
export const DEFAULT_RESEARCH_STAGE_BUDGET_USD = 2
// Re-measured 9 Sep 2026 on scanned-form application RB2026/1058 with openai/gpt-5.2.
// PDF OCR, one web search and strict extraction used 11,010 input / 2,144 output tokens and
// cost $0.089675. That earlier measurement used a smaller extraction contract and
// supported the previous $0.10 reservation; it does not bound the expanded contract.
// Expanded site/party fields and longer documents require more structured-output room.
// Reserve more per item against the SAME $2 stage/$20 monthly budgets; this permits fewer
// concurrent items, not more spending. Settle the reservation to actual cost after success.
export const DEFAULT_RESEARCH_RESERVATION_USD = 0.2

export interface UsageRow {
  stage: string
  status: 'reserved' | 'complete' | 'failed'
  reserved_usd: number | string
  actual_usd: number | string | null
}

export function chargedUsage(row: UsageRow): number {
  if (row.status === 'failed') return 0
  if (row.status === 'complete' && row.actual_usd !== null) return Number(row.actual_usd)
  return Number(row.reserved_usd)
}

export function canReserveUsage(input: {
  rows: UsageRow[]
  stage: string
  reservationUsd: number
  monthlyBudgetUsd: number
  stageBudgetUsd: number
}): boolean {
  const total = input.rows.reduce((sum, row) => sum + chargedUsage(row), 0)
  const stageTotal = input.rows
    .filter((row) => row.stage === input.stage)
    .reduce((sum, row) => sum + chargedUsage(row), 0)
  return (
    total + input.reservationUsd <= input.monthlyBudgetUsd &&
    stageTotal + input.reservationUsd <= input.stageBudgetUsd
  )
}

export function configuredBudget(name: string, fallback: number): number {
  const parsed = Number(process.env[name])
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
