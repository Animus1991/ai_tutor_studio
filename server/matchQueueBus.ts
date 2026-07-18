/**
 * Match queue bus — DLQ for expired/poison entries + optional PubSub publish.
 * When MATCH_PUBSUB_TOPIC is set, events are best-effort published for multi-instance.
 * Firestore (or memory DLQ) remains the durable poison sink.
 */
import { getAdminFirestore } from '../firebaseAdmin.js';

export type MatchBusEvent =
  | 'enqueue'
  | 'matched'
  | 'expired'
  | 'poison'
  | 'leave';

export type MatchDlqRecord = {
  uid: string;
  topicKey: string;
  durationMin: number;
  reason: MatchBusEvent;
  detail: string;
  entry: Record<string, unknown>;
  at: string;
  expireAt: string;
};

const memoryDlq: MatchDlqRecord[] = [];
const MAX_MEMORY_DLQ = 200;
const DLQ_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let published = 0;
let dlqWrites = 0;

export function __resetMatchQueueBusForTests(): void {
  memoryDlq.length = 0;
  published = 0;
  dlqWrites = 0;
}

export function matchQueueBusStats(): {
  mode: 'local' | 'sticky' | 'pubsub';
  dlqSize: number;
  published: number;
  dlqWrites: number;
  topic: string | null;
} {
  const topic = process.env.MATCH_PUBSUB_TOPIC?.trim() || null;
  let mode: 'local' | 'sticky' | 'pubsub' = 'local';
  if (topic) mode = 'pubsub';
  else if (process.env.MATCH_STICKY === 'true' || process.env.INSTANCE_ID?.trim()) mode = 'sticky';
  return {
    mode,
    dlqSize: memoryDlq.length,
    published,
    dlqWrites,
    topic,
  };
}

async function publishPubSub(event: MatchBusEvent, payload: Record<string, unknown>): Promise<void> {
  const topicName = process.env.MATCH_PUBSUB_TOPIC?.trim();
  if (!topicName) return;
  try {
    // Dynamic import — package may be transitive only; fail soft.
    const pubsubMod = await import('@google-cloud/pubsub').catch(() => null);
    if (!pubsubMod?.PubSub) {
      // Fallback: audit-style log for ops without hard dependency
      console.info('[matchQueueBus] pubsub stub', event, payload.uid ?? payload.sessionId);
      published += 1;
      return;
    }
    const pubsub = new pubsubMod.PubSub();
    await pubsub.topic(topicName).publishMessage({
      json: { event, ...payload, at: new Date().toISOString() },
    });
    published += 1;
  } catch (e) {
    console.warn('[matchQueueBus] publish failed', (e as Error).message);
  }
}

/** Write an expired/poison queue entry to DLQ and emit bus event. */
export async function writeMatchDlq(entry: {
  uid: string;
  topicKey?: string;
  durationMin?: number;
  [k: string]: unknown;
}, reason: MatchBusEvent, detail: string): Promise<void> {
  const record: MatchDlqRecord = {
    uid: String(entry.uid),
    topicKey: String(entry.topicKey ?? 'unknown'),
    durationMin: Number(entry.durationMin ?? 0),
    reason,
    detail: detail.slice(0, 300),
    entry: { ...entry },
    at: new Date().toISOString(),
    expireAt: new Date(Date.now() + DLQ_TTL_MS).toISOString(),
  };
  memoryDlq.push(record);
  if (memoryDlq.length > MAX_MEMORY_DLQ) memoryDlq.splice(0, memoryDlq.length - MAX_MEMORY_DLQ);
  dlqWrites += 1;

  const db = await getAdminFirestore();
  if (db) {
    try {
      await db.collection('matchQueueDlq').add(record);
    } catch {
      /* best-effort */
    }
  }

  void publishPubSub(reason, {
    uid: record.uid,
    topicKey: record.topicKey,
    durationMin: record.durationMin,
    detail: record.detail,
  });
}

export async function emitMatchBusEvent(
  event: MatchBusEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  void publishPubSub(event, payload);
}

export function listMemoryDlq(): readonly MatchDlqRecord[] {
  return memoryDlq;
}
