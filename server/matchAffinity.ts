/**
 * Match regional / instance sticky affinity.
 * Single-process: local queue is authoritative.
 * Multi-instance: clients pin to INSTANCE_ID via X-Match-Affinity header / cookie
 * until PubSub / shared Firestore queue is the sole source of truth.
 */
import { createHash, randomBytes } from 'crypto';
import type { Request, Response } from 'express';

const INSTANCE_ID =
  process.env.INSTANCE_ID?.trim() ||
  process.env.HOSTNAME?.trim() ||
  `local-${randomBytes(4).toString('hex')}`;

const REGION = process.env.MATCH_REGION?.trim() || process.env.FLY_REGION?.trim() || 'local';

/** Soft sticky TTL advertised to clients (ms). */
export const MATCH_AFFINITY_TTL_MS = 15 * 60_000;

export type MatchAffinity = {
  instanceId: string;
  region: string;
  /** Opaque token binding uid → preferred instance (not a secret). */
  token: string;
  expiresAt: string;
  mode: 'local' | 'sticky' | 'pubsub';
};

function affinityMode(): MatchAffinity['mode'] {
  if (process.env.MATCH_PUBSUB_TOPIC?.trim()) return 'pubsub';
  if (process.env.MATCH_STICKY === 'true' || process.env.INSTANCE_ID?.trim()) return 'sticky';
  return 'local';
}

export function getMatchInstanceId(): string {
  return INSTANCE_ID;
}

export function getMatchRegion(): string {
  return REGION;
}

export function buildMatchAffinity(uid: string): MatchAffinity {
  const expiresAt = new Date(Date.now() + MATCH_AFFINITY_TTL_MS).toISOString();
  const token = createHash('sha256')
    .update(`${INSTANCE_ID}:${uid}:${expiresAt.slice(0, 16)}`)
    .digest('hex')
    .slice(0, 24);
  return {
    instanceId: INSTANCE_ID,
    region: REGION,
    token,
    expiresAt,
    mode: affinityMode(),
  };
}

/**
 * When sticky mode is on and client sends a different affinity instance,
 * respond with 409 + redirect hint so the load balancer / client can re-home.
 */
export function assertMatchAffinity(req: Request, res: Response, uid: string): MatchAffinity {
  const affinity = buildMatchAffinity(uid);
  const clientInstance = String(
    req.header('x-match-affinity') ?? req.body?.affinityInstanceId ?? '',
  )
    .trim()
    .slice(0, 128);

  if (
    affinity.mode === 'sticky' &&
    clientInstance &&
    clientInstance !== affinity.instanceId &&
    process.env.MATCH_AFFINITY_STRICT === 'true'
  ) {
    res.setHeader('X-Match-Affinity-Redirect', clientInstance);
    const err = new Error(
      `Match queue sticky mismatch — retry on instance ${clientInstance}`,
    );
    (err as Error & { status: number; affinity: MatchAffinity }).status = 409;
    (err as Error & { affinity: MatchAffinity }).affinity = affinity;
    throw err;
  }

  res.setHeader('X-Match-Affinity', affinity.instanceId);
  res.setHeader('X-Match-Region', affinity.region);
  res.setHeader('X-Match-Affinity-Token', affinity.token);
  return affinity;
}

export function matchAffinityHealth(): {
  instanceId: string;
  region: string;
  mode: MatchAffinity['mode'];
} {
  return {
    instanceId: INSTANCE_ID,
    region: REGION,
    mode: affinityMode(),
  };
}
