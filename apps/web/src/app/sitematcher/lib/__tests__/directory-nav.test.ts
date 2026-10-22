import {
  directoryNavReducer,
  initialDirectoryNav,
  currentNode,
  type DirectoryNavState,
} from '../directory-nav'

const push = (s: DirectoryNavState, kind: 'brand' | 'agent', id: string) =>
  directoryNavReducer(s, { type: 'push', node: { kind, id } })
const back = (s: DirectoryNavState) => directoryNavReducer(s, { type: 'back' })

describe('directoryNavReducer', () => {
  it('starts at the grid', () => {
    expect(currentNode(initialDirectoryNav)).toBeNull()
    expect(initialDirectoryNav.tab).toBe('brands')
  })

  // The interaction a flat selectedBrandId/selectedAgentId pair cannot express: after
  // Brand B, "back" has to know it came from the agent, not the grid.
  it('walks Brand A -> Agent -> Brand B and back out in the right order', () => {
    let s = initialDirectoryNav
    s = push(s, 'brand', 'brand-a')
    s = push(s, 'agent', 'agent-1')
    s = push(s, 'brand', 'brand-b')
    expect(currentNode(s)).toEqual({ kind: 'brand', id: 'brand-b' })

    s = back(s)
    expect(currentNode(s)).toEqual({ kind: 'agent', id: 'agent-1' })

    s = back(s)
    expect(currentNode(s)).toEqual({ kind: 'brand', id: 'brand-a' })

    s = back(s)
    expect(currentNode(s)).toBeNull()
  })

  it('treats back at the grid as a no-op rather than throwing', () => {
    const s = back(initialDirectoryNav)
    expect(s).toBe(initialDirectoryNav)
    expect(currentNode(s)).toBeNull()
  })

  it('clears the stack when the tab changes', () => {
    let s = initialDirectoryNav
    s = push(s, 'brand', 'brand-a')
    s = push(s, 'agent', 'agent-1')

    s = directoryNavReducer(s, { type: 'setTab', tab: 'agents' })
    expect(s.tab).toBe('agents')
    expect(s.stack).toEqual([])
    expect(currentNode(s)).toBeNull()
  })

  it('does not clear the stack when the tab is set to its current value', () => {
    let s = push(initialDirectoryNav, 'brand', 'brand-a')
    const before = s
    s = directoryNavReducer(s, { type: 'setTab', tab: 'brands' })
    expect(s).toBe(before)
    expect(currentNode(s)).toEqual({ kind: 'brand', id: 'brand-a' })
  })

  it('supports revisiting the same brand deeper in the stack', () => {
    let s = initialDirectoryNav
    s = push(s, 'brand', 'brand-a')
    s = push(s, 'agent', 'agent-1')
    s = push(s, 'brand', 'brand-a')
    expect(s.stack).toHaveLength(3)
    s = back(s)
    expect(currentNode(s)).toEqual({ kind: 'agent', id: 'agent-1' })
  })

  it('does not mutate the previous state', () => {
    const a = push(initialDirectoryNav, 'brand', 'brand-a')
    const b = push(a, 'agent', 'agent-1')
    expect(a.stack).toHaveLength(1)
    expect(b.stack).toHaveLength(2)
  })
})
