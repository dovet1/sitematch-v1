// Directory navigation stack.
//
// The design's core interaction is Brand A -> Agent -> Brand B -> back -> Agent -> back ->
// Brand A. A flat pair of `selectedBrandId` / `selectedAgentId` fields cannot express it:
// going back from Brand B has no way to know whether it arrived from the agent or the grid.
// A stack does, and it is a pure reducer so the whole graph traversal is unit-testable
// without mounting the view.

import type { DirectoryNode, DirectoryTab } from '../types/unified-workspace'

export interface DirectoryNavState {
  tab: DirectoryTab
  stack: DirectoryNode[]
}

export type DirectoryNavAction =
  | { type: 'push'; node: DirectoryNode }
  | { type: 'back' }
  | { type: 'setTab'; tab: DirectoryTab }
  | { type: 'reset' }

export const initialDirectoryNav: DirectoryNavState = { tab: 'brands', stack: [] }

export function directoryNavReducer(
  state: DirectoryNavState,
  action: DirectoryNavAction
): DirectoryNavState {
  switch (action.type) {
    case 'push':
      return { ...state, stack: [...state.stack, action.node] }
    case 'back':
      // Popping an empty stack is a no-op rather than an error: the back control is hidden
      // at the grid, but a double-click should not throw.
      return state.stack.length === 0 ? state : { ...state, stack: state.stack.slice(0, -1) }
    case 'setTab':
      // Changing tab clears the stack — a brand profile reached from Brands should not
      // survive a switch to Agents.
      return state.tab === action.tab ? state : { tab: action.tab, stack: [] }
    case 'reset':
      return { ...state, stack: [] }
    default:
      return state
  }
}

// The node currently being displayed; null means the grid.
export function currentNode(state: DirectoryNavState): DirectoryNode | null {
  return state.stack.length > 0 ? state.stack[state.stack.length - 1] : null
}
