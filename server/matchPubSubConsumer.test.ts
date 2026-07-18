import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetMatchPubSubConsumerForTests,
  applyMatchBusMessage,
  listRecentMatchBusMessages,
  matchPubSubConsumerStats,
  startMatchPubSubConsumer,
} from './matchPubSubConsumer.js';

describe('matchPubSubConsumer', () => {
  beforeEach(() => {
    __resetMatchPubSubConsumerForTests();
    delete process.env.MATCH_PUBSUB_TOPIC;
    delete process.env.MATCH_PUBSUB_SUBSCRIPTION;
  });

  it('records inbound bus messages', () => {
    applyMatchBusMessage({ event: 'enqueue', uid: 'u1', topicKey: 'chem' });
    expect(listRecentMatchBusMessages()).toHaveLength(1);
    expect(matchPubSubConsumerStats().received).toBe(1);
  });

  it('soft-fails when pubsub env unset', async () => {
    const r = await startMatchPubSubConsumer();
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/unset/i);
  });

  it('starts stub consumer when topic set without SDK', async () => {
    process.env.MATCH_PUBSUB_TOPIC = 'memora-match-test';
    const r = await startMatchPubSubConsumer();
    expect(r.ok).toBe(true);
    expect(matchPubSubConsumerStats().started).toBe(true);
  });
});
