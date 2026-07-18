import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetMatchQueueBusForTests,
  listMemoryDlq,
  matchQueueBusStats,
  writeMatchDlq,
} from './matchQueueBus.js';

describe('matchQueueBus', () => {
  beforeEach(() => {
    __resetMatchQueueBusForTests();
  });

  it('writes expired entries to memory DLQ', async () => {
    await writeMatchDlq(
      { uid: 'u1', topicKey: 'chem', durationMin: 25, status: 'waiting' },
      'expired',
      'queue TTL exceeded',
    );
    expect(listMemoryDlq()).toHaveLength(1);
    expect(listMemoryDlq()[0]?.reason).toBe('expired');
    expect(matchQueueBusStats().dlqWrites).toBe(1);
  });
});
