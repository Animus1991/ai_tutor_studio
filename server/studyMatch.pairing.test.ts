import { beforeEach, describe, expect, it } from 'vitest';
import { __test__, type QueueEntry } from './studyMatch';

describe('studyMatch in-memory pairing', () => {
  beforeEach(() => {
    __test__.memoryQueue.clear();
    __test__.memorySessions.clear();
    __test__.memoryBlocks.clear();
    __test__.memoryCooldowns.clear();
    __test__.matchMetrics.matchesTotal = 0;
    __test__.matchMetrics.reportsTotal = 0;
    __test__.matchMetrics.leavesTotal = 0;
    __test__.matchMetrics.meetCreatedTotal = 0;
  });

  it('pairs two waiting users on the same topic and duration', async () => {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const a: QueueEntry = {
      uid: 'u-alice',
      email: 'alice@uni.edu',
      topicKey: 'organic-chem',
      topicLabel: 'Organic Chem',
      durationMin: 25,
      domainFilter: '',
      status: 'waiting',
      createdAt: now,
      expiresAt,
      sessionId: null,
    };
    const b: QueueEntry = {
      ...a,
      uid: 'u-bob',
      email: 'bob@uni.edu',
      createdAt: new Date(Date.now() + 10).toISOString(),
    };

    const session = await __test__.pairUsers(null, a, b);
    expect(session.memberIds).toEqual(['u-alice', 'u-bob']);
    expect(session.topicKey).toBe('organic-chem');
    expect(session.pomodoro.phase).toBe('focus');
    expect(session.notesVersion).toBe(0);
    expect(__test__.memorySessions.has(session.id)).toBe(true);
    expect(__test__.matchMetrics.matchesTotal).toBeGreaterThan(0);

    // Privacy: emails exist server-side but buddy labels are opaque
    expect(__test__.buddyDisplayName('u-bob')).toMatch(/^Buddy-\d{4}$/);
  });

  it('stores report cooldown timestamps', async () => {
    const until = new Date(Date.now() + 60_000).toISOString();
    await __test__.setCooldown(null, 'u-alice', until);
    expect(__test__.memoryCooldowns.get('u-alice')).toBe(until);
  });
});
