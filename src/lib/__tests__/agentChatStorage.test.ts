import { describe, it, expect, beforeEach, vi } from 'vitest';

const memory = new Map<string, unknown>();

vi.mock('localforage', () => ({
  default: {
    getItem: (key: string) => Promise.resolve(memory.get(key) ?? null),
    setItem: (key: string, value: unknown) => {
      memory.set(key, value);
      return Promise.resolve(value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
      return Promise.resolve();
    },
    clear: () => {
      memory.clear();
      return Promise.resolve();
    },
  },
}));

import {
  saveAgentMessages,
  loadAgentMessages,
  saveAgentMode,
  loadAgentMode,
  clearAgentMessages,
} from '../agentChatStorage';

describe('agentChatStorage', () => {
  beforeEach(() => {
    memory.clear();
  });

  it('persists and loads messages per mode and scope', async () => {
    const msgs = [{ id: '1', role: 'user' as const, content: 'Hello' }];
    await saveAgentMessages('socratic', true, msgs);
    const loaded = await loadAgentMessages('socratic', true);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].content).toBe('Hello');

    const other = await loadAgentMessages('quiz', true);
    expect(other).toHaveLength(0);
  });

  it('persists active mode', async () => {
    await saveAgentMode('feynman');
    expect(await loadAgentMode()).toBe('feynman');
  });

  it('clears messages for a mode', async () => {
    await saveAgentMessages('direct', false, [
      { id: 'a', role: 'model', content: 'Hi' },
    ]);
    await clearAgentMessages('direct', false);
    expect(await loadAgentMessages('direct', false)).toHaveLength(0);
  });
});
