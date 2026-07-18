import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetAgentBudgetsForTests,
  assertAgentRequestBudget,
  noteAgentLatency,
  agentBudgetSnapshot,
} from './agentBudgets.js';

describe('agentBudgets', () => {
  afterEach(() => {
    __resetAgentBudgetsForTests();
  });

  it('allows small histories', () => {
    expect(() =>
      assertAgentRequestBudget([{ role: 'user', content: 'hello' }]),
    ).not.toThrow();
  });

  it('rejects oversized message counts', () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      role: 'user',
      content: `m${i}`,
    }));
    expect(() => assertAgentRequestBudget(messages)).toThrow(/exceeds/);
    expect(agentBudgetSnapshot().breaches).toBeGreaterThan(0);
  });

  it('notes latency budget pressure', () => {
    const ok = noteAgentLatency(10, 'chat');
    expect(ok.withinBudget).toBe(true);
    const bad = noteAgentLatency(999_999, 'stream');
    expect(bad.withinBudget).toBe(false);
  });
});
