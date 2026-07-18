/**
 * Workspace Concept Bus — cross-tool engagement + typed append-only event log.
 */

import type { WorkspaceToolId } from './workspaceNoteContent';

export type ConceptSignal =
  | 'focus'
  | 'read'
  | 'mapped'
  | 'noted'
  | 'annotated'
  | 'explained'
  | 'simulated'
  | 'quiz-correct'
  | 'quiz-wrong'
  | 'leitner-easy'
  | 'leitner-hard';

/** Typed event envelope for the concept bus log. */
export type ConceptBusEvent = {
  id: string;
  ts: number;
  concept: string;
  tool: WorkspaceToolId;
  signal: ConceptSignal;
  meta?: Record<string, unknown>;
};

const STRUGGLE_SIGNALS: ConceptSignal[] = ['quiz-wrong', 'leitner-hard'];
const MASTERY_SIGNALS: ConceptSignal[] = ['quiz-correct', 'leitner-easy', 'explained'];
const EVENT_LOG_MAX = 500;

export interface ConceptEngagement {
  concept: string;
  tools: WorkspaceToolId[];
  signals: { signal: ConceptSignal; tool: WorkspaceToolId; ts: number }[];
  struggleScore: number; // -1 (struggling) to +1 (mastered)
  lastSeen: number;
}

export interface ConceptBusState {
  entries: Map<string, ConceptEngagement>;
  eventLog: ConceptBusEvent[];
}

function createEmptyBusState(): ConceptBusState {
  return { entries: new Map(), eventLog: [] };
}

let _busState: ConceptBusState = createEmptyBusState();
const _listeners: Set<(state: ConceptBusState) => void> = new Set();
const _eventListeners: Set<(event: ConceptBusEvent) => void> = new Set();

function notify() {
  for (const fn of _listeners) fn(_busState);
}

function appendEvent(event: ConceptBusEvent): void {
  _busState.eventLog.push(event);
  if (_busState.eventLog.length > EVENT_LOG_MAX) {
    _busState.eventLog = _busState.eventLog.slice(-EVENT_LOG_MAX);
  }
  for (const fn of _eventListeners) fn(event);
}

export function noteConceptActivity(
  concept: string,
  tool: WorkspaceToolId,
  signal: ConceptSignal,
  meta?: Record<string, unknown>,
): void {
  const key = concept.toLowerCase().trim();
  if (!key) return;

  let entry = _busState.entries.get(key);
  if (!entry) {
    entry = { concept: key, tools: [], signals: [], struggleScore: 0, lastSeen: 0 };
    _busState.entries.set(key, entry);
  }

  if (!entry.tools.includes(tool)) entry.tools.push(tool);
  const ts = Date.now();
  entry.signals.push({ signal, tool, ts });
  entry.lastSeen = ts;

  let delta = 0;
  if (STRUGGLE_SIGNALS.includes(signal)) delta = -0.2;
  else if (MASTERY_SIGNALS.includes(signal)) delta = 0.15;

  entry.struggleScore = Math.max(-1, Math.min(1, entry.struggleScore + delta));

  appendEvent({
    id: `cbe_${ts.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    ts,
    concept: key,
    tool,
    signal,
    meta,
  });
  notify();
}

/** Read-only typed event log (newest last). */
export function getConceptEventLog(limit = 100): ConceptBusEvent[] {
  return _busState.eventLog.slice(-limit);
}

export function subscribeConceptEvents(fn: (event: ConceptBusEvent) => void): () => void {
  _eventListeners.add(fn);
  return () => {
    _eventListeners.delete(fn);
  };
}

export function getConceptEngagement(concept: string): ConceptEngagement | undefined {
  return _busState.entries.get(concept.toLowerCase().trim());
}

export function getAllConceptEngagements(): ConceptEngagement[] {
  return Array.from(_busState.entries.values());
}

export function getStrugglingConcepts(threshold = -0.3): ConceptEngagement[] {
  return getAllConceptEngagements().filter((e) => e.struggleScore <= threshold);
}

export function getMasteredConcepts(threshold = 0.5): ConceptEngagement[] {
  return getAllConceptEngagements().filter((e) => e.struggleScore >= threshold);
}

export function getConceptsStudiedInTool(tool: WorkspaceToolId): ConceptEngagement[] {
  return getAllConceptEngagements().filter((e) => e.tools.includes(tool));
}

export function getConceptsNotYetStudiedIn(tool: WorkspaceToolId): ConceptEngagement[] {
  return getAllConceptEngagements().filter((e) => !e.tools.includes(tool));
}

export function subscribeConceptBus(fn: (state: ConceptBusState) => void): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function resetConceptBus(): void {
  _busState = createEmptyBusState();
  notify();
}

export function loadConceptBus(serialized: Record<string, ConceptEngagement>): void {
  _busState = createEmptyBusState();
  for (const [key, entry] of Object.entries(serialized)) {
    _busState.entries.set(key, entry);
  }
  notify();
}

export function serializeConceptBus(): Record<string, ConceptEngagement> {
  const result: Record<string, ConceptEngagement> = {};
  for (const [key, entry] of _busState.entries) {
    result[key] = entry;
  }
  return result;
}
