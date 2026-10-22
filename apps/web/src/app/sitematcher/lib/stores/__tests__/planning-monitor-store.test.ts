import type { MonitorRow } from '@/lib/planning-monitor/types'
import { usePlanningMonitorStore, type PlanningStack } from '../planning-monitor-store'

const row = (key: string) => ({ key, applicationId: key, developmentId: null } as unknown as MonitorRow)

const stack = (keys: string[]): PlanningStack => ({
  id: 's1',
  pick: { cellKey: '1:2', lngLat: [-1.6, 53.8], count: keys.length, zoom: 18, highlights: null },
  items: keys.map((key) => ({ type: 'row', row: row(key) })),
  more: false,
  error: null,
})

describe('stacked pin state', () => {
  beforeEach(() => usePlanningMonitorStore.getState().reset())

  it('keeps the stack while one of its applications is open, and returns to it', () => {
    const store = usePlanningMonitorStore.getState()
    store.openStack(stack(['a', 'b']))
    store.select(row('a'))
    expect(usePlanningMonitorStore.getState().stack?.id).toBe('s1')
    usePlanningMonitorStore.getState().backToStack()
    expect(usePlanningMonitorStore.getState().selected).toBeNull()
    expect(usePlanningMonitorStore.getState().stack?.id).toBe('s1')
  })

  it('drops the stack when something else is opened or the selection is cleared', () => {
    usePlanningMonitorStore.getState().openStack(stack(['a', 'b']))
    usePlanningMonitorStore.getState().select(row('z'))
    expect(usePlanningMonitorStore.getState().stack).toBeNull()

    usePlanningMonitorStore.getState().openStack(stack(['a', 'b']))
    usePlanningMonitorStore.getState().select(row('a'))
    usePlanningMonitorStore.getState().select(null)
    expect(usePlanningMonitorStore.getState().stack).toBeNull()
  })

  it('ignores answers for a stack that has since been replaced', () => {
    usePlanningMonitorStore.getState().openStack({ ...stack([]), items: null })
    usePlanningMonitorStore.getState().setStackItems('old', [{ type: 'row', row: row('x') }], false)
    expect(usePlanningMonitorStore.getState().stack?.items).toBeNull()
    usePlanningMonitorStore.getState().setStackError('s1', 'Nope')
    expect(usePlanningMonitorStore.getState().stack).toMatchObject({ items: [], error: 'Nope' })
  })
})
