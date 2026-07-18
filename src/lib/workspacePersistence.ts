/**
 * Workspace Persistence — save/load workspace state per progressKey.
 * Uses localStorage for lightweight session data and IndexedDB for larger payloads.
 */

import type { ConceptEngagement } from './workspaceConceptBus';
import type { WorkspaceToolId } from './workspaceNoteContent';
import { persistenceKeyForTool } from './workspaceToolRegistry';

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

const WORKSPACE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Purge workspace sessions older than Privacy TTL (90d). */
export function gcExpiredWorkspaceSessions(now = Date.now()): number {
  let removed = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { lastAccessed?: number };
        const last = Number(parsed.lastAccessed ?? 0);
        if (last > 0 && now - last > WORKSPACE_TTL_MS) {
          localStorage.removeItem(k);
          removed += 1;
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    /* ignore */
  }
  return removed;
}

export function saveWorkspaceSession(progressKey: string, state: WorkspaceSessionState): void {
  try {
    gcExpiredWorkspaceSessions();
    const json = JSON.stringify({ ...state, lastAccessed: Date.now() });
    localStorage.setItem(storageKey(progressKey), json);
  } catch {
    // Storage quota exceeded — silently fail
  }
}

export function loadWorkspaceSession(progressKey: string): WorkspaceSessionState | null {
  try {
    gcExpiredWorkspaceSessions();
    const json = localStorage.getItem(storageKey(progressKey));
    if (!json) return null;
    const state = JSON.parse(json) as WorkspaceSessionState;
    const last = Number(state.lastAccessed ?? 0);
    if (last > 0 && Date.now() - last > WORKSPACE_TTL_MS) {
      localStorage.removeItem(storageKey(progressKey));
      return null;
    }
    return state;
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
    localStorage.setItem(persistenceKeyForTool(progressKey, toolId), JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function loadToolState<T = unknown>(progressKey: string, toolId: WorkspaceToolId): T | null {
  try {
    const json =
      localStorage.getItem(persistenceKeyForTool(progressKey, toolId)) ??
      localStorage.getItem(`${storageKey(progressKey)}:tool:${toolId}`);
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
