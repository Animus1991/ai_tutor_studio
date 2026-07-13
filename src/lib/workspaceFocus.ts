/**
 * Workspace Focus Bus — cross-tool term highlighting.
 * When one tool focuses on a term, other tools can highlight it.
 */

import type { WorkspaceToolId } from './workspaceNoteContent';

export interface FocusEvent {
  term: string;
  highlight: boolean;
  originTool: WorkspaceToolId;
  timestamp: number;
}

let _currentFocus: FocusEvent | null = null;
const _listeners: Set<(focus: FocusEvent | null) => void> = new Set();

function notify() {
  for (const fn of _listeners) fn(_currentFocus);
}

export function emitFocus(term: string, originTool: WorkspaceToolId): void {
  _currentFocus = { term, highlight: true, originTool, timestamp: Date.now() };
  notify();
}

export function clearFocus(): void {
  _currentFocus = null;
  notify();
}

export function getCurrentFocus(): FocusEvent | null {
  return _currentFocus;
}

export function subscribeFocus(fn: (focus: FocusEvent | null) => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
