import {
  canReserveUsage,
  chargedUsage,
  DEFAULT_CLASSIFICATION_RESERVATION_USD,
  DEFAULT_INITIAL_STAGE_BUDGET_USD,
  DEFAULT_RESEARCH_RESERVATION_USD,
  DEFAULT_RESEARCH_STAGE_BUDGET_USD,
} from '../budget'
import { MAX_CLASSIFICATION_ATTEMPTS } from '../openrouter'

describe('planning AI budget', () => {
  const rows = [
    { stage: 'initial', status: 'complete' as const, reserved_usd: 1, actual_usd: 0.6 },
    { stage: 'web', status: 'reserved' as const, reserved_usd: 2, actual_usd: null },
    { stage: 'initial', status: 'failed' as const, reserved_usd: 4, actual_usd: null },
  ]

  it('charges actual completed cost, reservations, and no failed cost', () => {
    expect(rows.map(chargedUsage)).toEqual([0.6, 2, 0])
  })

  it('enforces both the total and per-stage ceilings', () => {
    expect(canReserveUsage({
      rows, stage: 'initial', reservationUsd: 0.4, monthlyBudgetUsd: 3, stageBudgetUsd: 1,
    })).toBe(true)
    expect(canReserveUsage({
      rows, stage: 'initial', reservationUsd: 0.5, monthlyBudgetUsd: 20, stageBudgetUsd: 1,
    })).toBe(false)
    expect(canReserveUsage({
      rows, stage: 'initial', reservationUsd: 0.5, monthlyBudgetUsd: 3, stageBudgetUsd: 20,
    })).toBe(false)
  })
})

describe('research reservation', () => {
  const MEASURED_REAL_RECORD_COST_USD = 0.0318534

  it('keeps a source-size safety margin over the measured two-call pass', () => {
    expect(DEFAULT_RESEARCH_RESERVATION_USD).toBeGreaterThan(MEASURED_REAL_RECORD_COST_USD * 3)
  })

  it('uses a separate stage envelope from initial classification', () => {
    expect(DEFAULT_RESEARCH_STAGE_BUDGET_USD).toBe(2)
    expect(DEFAULT_RESEARCH_RESERVATION_USD).toBeGreaterThan(DEFAULT_CLASSIFICATION_RESERVATION_USD)
  })
})


describe('classification reservation', () => {
  // A failed call is charged its full reservation, so the default must stay an upper bound
  // on a single call rather than drift down to the average.
  //
  // Re-measured 9 Sep 2026 when the default model changed to google/gemini-2.5-flash-lite:
  // 158 live records across two runs averaged $0.000214 a call. The worst case is taken as
  // roughly double the average rather than the observed maximum, because a two-run sample
  // cannot have seen the tail. The previous model (openai/gpt-oss-120b) ranged
  // $0.000109-$0.000787 and needed a 0.003 reservation.
  const OBSERVED_WORST_CALL_USD = 0.00043

  it('covers every billed attempt of one queue item, not just one call', () => {
    expect(DEFAULT_CLASSIFICATION_RESERVATION_USD)
      .toBeGreaterThan(OBSERVED_WORST_CALL_USD * MAX_CLASSIFICATION_ATTEMPTS)
  })

  it('no longer over-charges a failure by an order of magnitude', () => {
    expect(DEFAULT_CLASSIFICATION_RESERVATION_USD)
      .toBeLessThan(OBSERVED_WORST_CALL_USD * MAX_CLASSIFICATION_ATTEMPTS * 4)
  })

  it('leaves the initial stage budget room for thousands of successful calls', () => {
    const averageCall = 0.000252
    expect(DEFAULT_INITIAL_STAGE_BUDGET_USD / averageCall).toBeGreaterThan(5000)
  })
})
