import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_TOOLS,
  getWorkspaceTool,
  persistenceKeyForTool,
} from '../lib/workspaceToolRegistry';
import {
  getConceptEventLog,
  noteConceptActivity,
  resetConceptBus,
  subscribeConceptEvents,
} from '../lib/workspaceConceptBus';

describe('workspaceToolRegistry', () => {
  it('registers all 13 tools with pedagogy + a11y + persistence', () => {
    expect(WORKSPACE_TOOLS).toHaveLength(13);
    for (const t of WORKSPACE_TOOLS) {
      expect(t.persistenceKey).toMatch(/^tool:/);
      expect(t.stateSchema.type).toBe('object');
      expect(t.pedagogyIntent).toBeTruthy();
      expect(t.evidencePrinciples.length).toBeGreaterThan(0);
      expect(t.a11y.ariaLabel).toBeTruthy();
      expect(typeof t.a11y.reducedMotionSafe).toBe('boolean');
    }
  });

  it('builds stable persistence keys', () => {
    const key = persistenceKeyForTool('course-1', 'quiz');
    expect(key).toContain('course-1');
    expect(key).toContain('tool:quiz');
    expect(getWorkspaceTool('quiz')?.evidencePrinciples).toContain('retrieval');
  });
});

describe('workspaceConceptBus typed event log', () => {
  it('appends typed events on activity', () => {
    resetConceptBus();
    const seen: string[] = [];
    const unsub = subscribeConceptEvents((e) => seen.push(e.signal));
    noteConceptActivity('acids', 'quiz', 'quiz-wrong', { itemId: 'q1' });
    noteConceptActivity('acids', 'feynman', 'explained');
    unsub();
    const log = getConceptEventLog();
    expect(log.length).toBe(2);
    expect(log[0].signal).toBe('quiz-wrong');
    expect(log[0].meta).toEqual({ itemId: 'q1' });
    expect(seen).toEqual(['quiz-wrong', 'explained']);
  });
});
