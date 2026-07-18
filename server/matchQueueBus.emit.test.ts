import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetMatchQueueBusForTests,
  emitMatchBusEvent,
  matchQueueBusStats,
} from './matchQueueBus.js';

describe('emitMatchBusEvent', () => {
  const prev = process.env.MATCH_PUBSUB_TOPIC;

  beforeEach(() => {
    __resetMatchQueueBusForTests();
    process.env.MATCH_PUBSUB_TOPIC = 'memora-match-test';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.MATCH_PUBSUB_TOPIC;
    else process.env.MATCH_PUBSUB_TOPIC = prev;
    __resetMatchQueueBusForTests();
  });

  it('increments published counter on enqueue bus emit', async () => {
    await emitMatchBusEvent('enqueue', { uid: 'u1', topicKey: 'chem' });
    expect(matchQueueBusStats().published).toBeGreaterThanOrEqual(1);
    expect(matchQueueBusStats().mode).toBe('pubsub');
  });
});
