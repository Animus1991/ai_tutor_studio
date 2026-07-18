import { beforeEach, describe, expect, it } from 'vitest';
import { __test__, type QueueEntry } from './studyMatch.js';
import { scoreMatchCandidate } from './studyMatchCore.js';

function entry(uid: string, topic: string, createdOffsetMs = 0): QueueEntry {
  const now = Date.now() + createdOffsetMs;
  return {
    uid,
    email: `${uid}@uni.edu`,
    topicKey: topic,
    topicLabel: topic,
    durationMin: 25,
    domainFilter: '',
    flexibility: 'prefer_topic',
    vibe: 'balanced',
    energy: 'focused',
    sessionGoal: '',
    status: 'waiting',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 60_000).toISOString(),
    sessionId: null,
  };
}

describe('studyMatch chaos / concurrency stress', () => {
  beforeEach(() => {
    __test__.memoryQueue.clear();
    __test__.memorySessions.clear();
    __test__.memoryBlocks.clear();
    __test__.memoryCooldowns.clear();
    __test__.matchMetrics.matchesTotal = 0;
  });

  it('pairs many concurrent same-topic candidates without duplicate membership', async () => {
    const n = 40;
    const people = Array.from({ length: n }, (_, i) => entry(`u${i}`, 'organic-chem', i));
    const pairs: Array<ReturnType<typeof __test__.pairUsers>> = [];
    for (let i = 0; i + 1 < people.length; i += 2) {
      pairs.push(__test__.pairUsers(null, people[i], people[i + 1]));
    }
    const sessions = await Promise.all(pairs);
    const memberIds = sessions.flatMap((s) => s.memberIds);
    expect(new Set(memberIds).size).toBe(n);
    expect(sessions).toHaveLength(n / 2);
    expect(__test__.matchMetrics.matchesTotal).toBe(n / 2);
  });

  it('scoring stays bounded under burst of candidates', () => {
    const scores = Array.from({ length: 500 }, (_, i) =>
      scoreMatchCandidate({
        entrantTopicKey: 'calculus',
        otherTopicKey: i % 3 === 0 ? 'calculus' : 'biology',
        entrantFlexibility: 'prefer_topic',
        otherFlexibility: 'prefer_topic',
        entrantVibe: 'balanced',
        otherVibe: i % 2 === 0 ? 'balanced' : 'quiet',
        createdAt: new Date(Date.now() - i * 1000).toISOString(),
      }),
    );
    expect(scores.every((s) => Number.isFinite(s))).toBe(true);
    expect(Math.max(...scores)).toBeGreaterThan(0);
  });
});
