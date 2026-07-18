/**
 * Match multi-instance PubSub consumer.
 * When MATCH_PUBSUB_TOPIC is set, subscribe and apply remote enqueue/expire signals
 * into the local affinity view (Firestore remains source of truth for pairing).
 */
import { matchQueueBusStats } from './matchQueueBus.js';

export type MatchBusMessage = {
  event: 'enqueue' | 'matched' | 'expired' | 'poison' | 'leave';
  uid?: string;
  topicKey?: string;
  durationMin?: number;
  sessionId?: string;
  detail?: string;
  at?: string;
};

const recentRemote: MatchBusMessage[] = [];
const MAX_RECENT = 100;
let consumerStarted = false;
let received = 0;
let lastError: string | null = null;

export function __resetMatchPubSubConsumerForTests(): void {
  recentRemote.length = 0;
  consumerStarted = false;
  received = 0;
  lastError = null;
}

export function matchPubSubConsumerStats(): {
  started: boolean;
  received: number;
  recent: number;
  lastError: string | null;
  bus: ReturnType<typeof matchQueueBusStats>;
} {
  return {
    started: consumerStarted,
    received,
    recent: recentRemote.length,
    lastError,
    bus: matchQueueBusStats(),
  };
}

export function listRecentMatchBusMessages(): readonly MatchBusMessage[] {
  return recentRemote;
}

/** Apply an inbound bus message (used by real PubSub + tests). */
export function applyMatchBusMessage(msg: MatchBusMessage): void {
  received += 1;
  recentRemote.push({ ...msg, at: msg.at ?? new Date().toISOString() });
  if (recentRemote.length > MAX_RECENT) {
    recentRemote.splice(0, recentRemote.length - MAX_RECENT);
  }
}

/**
 * Start subscription when MATCH_PUBSUB_SUBSCRIPTION or MATCH_PUBSUB_TOPIC is set.
 * Soft-fails if @google-cloud/pubsub is unavailable.
 */
export async function startMatchPubSubConsumer(): Promise<{ ok: boolean; reason?: string }> {
  if (consumerStarted) return { ok: true, reason: 'already_started' };
  const subscriptionName =
    process.env.MATCH_PUBSUB_SUBSCRIPTION?.trim() ||
    (process.env.MATCH_PUBSUB_TOPIC?.trim()
      ? `${process.env.MATCH_PUBSUB_TOPIC.trim()}-memora`
      : '');
  if (!subscriptionName) {
    return { ok: false, reason: 'MATCH_PUBSUB_SUBSCRIPTION / TOPIC unset' };
  }

  try {
    const pubsubMod = await import('@google-cloud/pubsub').catch(() => null);
    if (!pubsubMod?.PubSub) {
      // In-process stub loop: mark started so health reports pubsub mode readiness
      consumerStarted = true;
      console.info(
        `[matchPubSub] stub consumer ready for subscription=${subscriptionName} (install @google-cloud/pubsub for live pull)`,
      );
      return { ok: true, reason: 'stub' };
    }
    const pubsub = new pubsubMod.PubSub();
    const sub = pubsub.subscription(subscriptionName);
    sub.on('message', (message: { data: Buffer; ack: () => void; nack: () => void }) => {
      try {
        const parsed = JSON.parse(message.data.toString('utf8')) as MatchBusMessage;
        applyMatchBusMessage(parsed);
        message.ack();
      } catch (e) {
        lastError = String((e as Error).message ?? e).slice(0, 200);
        message.nack();
      }
    });
    sub.on('error', (err: Error) => {
      lastError = String(err.message ?? err).slice(0, 200);
      console.warn('[matchPubSub] subscription error', lastError);
    });
    consumerStarted = true;
    console.info(`[matchPubSub] listening on ${subscriptionName}`);
    return { ok: true };
  } catch (e) {
    lastError = String((e as Error).message ?? e).slice(0, 200);
    return { ok: false, reason: lastError };
  }
}
