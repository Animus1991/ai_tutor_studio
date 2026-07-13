/**
 * Workspace Persistence — save/load workspace state per progressKey.
 * Uses localStorage for lightweight session data and IndexedDB for larger payloads.
 */

import type { ConceptEngagement } from './workspaceConceptBus';
import type { WorkspaceToolId } from './workspaceNoteContent';

const STORAGE_PREFIX = 'synapse:workspace:';

export interface WorkspaceSessionState {
  courseId: string;
  activeTool: WorkspaceToolId;
  stepIndex: number;
  conceptBus: Record<string, ConceptEngagement>;
  timerElapsed: number;
  lastAccessed: number;
  toolStates: Record<string, unknown>;
}

function storageKey(progressKey: string): string {
  return `${STORAGE_PREFIX}${progressKey}`;
}

export function saveWorkspaceSession(progressKey: string, state: WorkspaceSessionState): void {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(storageKey(progressKey), json);
  } catch {
    // Storage quota exceeded — silently fail
  }
}

export function loadWorkspaceSession(progressKey: string): WorkspaceSessionState | null {
  try {
    const json = localStorage.getItem(storageKey(progressKey));
    if (!json) return null;
    return JSON.parse(json) as WorkspaceSessionState;
  } catch {
    return null;
  }
}

export function deleteWorkspaceSession(progressKey: string): void {
  localStorage.removeItem(storageKey(progressKey));
}

export function saveConceptBus(progressKey: string, bus: Record<string, ConceptEngagement>): void {
  try {
    localStorage.setItem(`${storageKey(progressKey)}:bus`, JSON.stringify(bus));
  } catch {
    // Silently fail
  }
}

export function loadConceptBus(progressKey: string): Record<string, ConceptEngagement> | null {
  try {
    const json = localStorage.getItem(`${storageKey(progressKey)}:bus`);
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function saveToolState(progressKey: string, toolId: WorkspaceToolId, state: unknown): void {
  try {
    localStorage.setItem(`${storageKey(progressKey)}:tool:${toolId}`, JSON.stringify(state));
  } catch {
    // Silently fail
  }
}

export function loadToolState<T = unknown>(progressKey: string, toolId: WorkspaceToolId): T | null {
  try {
    const json = localStorage.getItem(`${storageKey(progressKey)}:tool:${toolId}`);
    if (!json) return null;
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function listWorkspaceSessions(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX) && !key.includes(':bus') && !key.includes(':tool:')) {
      keys.push(key.slice(STORAGE_PREFIX.length));
    }
  }
  return keys;
}
