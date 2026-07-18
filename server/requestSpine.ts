/**
 * Cross-cutting request spine: trace IDs, idempotency, lightweight contracts.
 */
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './security.js';

export type JsonSchemaPrimitive = 'string' | 'number' | 'boolean' | 'object' | 'array';

export type FieldContract = {
  type: JsonSchemaPrimitive;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: readonly (string | number)[];
};

export type ObjectContract = Record<string, FieldContract>;

/** Minimal runtime validator (Zod-free) for critical API bodies. */
export function validateObject(
  body: unknown,
  contract: ObjectContract,
  label = 'body',
): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, `${label} must be an object`);
  }
  const src = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(contract)) {
    const value = src[key];
    if (value === undefined || value === null) {
      if (rule.required) throw new HttpError(400, `${key} is required`);
      continue;
    }
    switch (rule.type) {
      case 'string': {
        if (typeof value !== 'string') throw new HttpError(400, `${key} must be a string`);
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          throw new HttpError(413, `${key} exceeds ${rule.maxLength} characters`);
        }
        if (rule.enum && !rule.enum.includes(value)) {
          throw new HttpError(400, `${key} has an invalid value`);
        }
        out[key] = value;
        break;
      }
      case 'number': {
        const n = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(n)) throw new HttpError(400, `${key} must be a number`);
        if (rule.min !== undefined && n < rule.min) {
          throw new HttpError(400, `${key} must be ≥ ${rule.min}`);
        }
        if (rule.max !== undefined && n > rule.max) {
          throw new HttpError(400, `${key} must be ≤ ${rule.max}`);
        }
        if (rule.enum && !rule.enum.includes(n)) {
          throw new HttpError(400, `${key} has an invalid value`);
        }
        out[key] = n;
        break;
      }
      case 'boolean': {
        if (typeof value !== 'boolean') throw new HttpError(400, `${key} must be a boolean`);
        out[key] = value;
        break;
      }
      case 'object': {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new HttpError(400, `${key} must be an object`);
        }
        out[key] = value;
        break;
      }
      case 'array': {
        if (!Array.isArray(value)) throw new HttpError(400, `${key} must be an array`);
        out[key] = value;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

export function createTraceMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const incoming = String(req.header('x-request-id') ?? '').trim().slice(0, 64);
    const traceId = incoming || randomUUID();
    res.locals.traceId = traceId;
    res.setHeader('X-Request-Id', traceId);
    next();
  };
}

type IdempotencyEntry = {
  status: number;
  body: unknown;
  expiresAt: number;
};

const idempotencyStore = new Map<string, IdempotencyEntry>();
const IDEMPOTENCY_TTL_MS = 15 * 60_000;

function purgeIdempotency(now = Date.now()) {
  for (const [k, v] of idempotencyStore) {
    if (v.expiresAt <= now) idempotencyStore.delete(k);
  }
}

/**
 * For mutating /api routes: honor Idempotency-Key and replay prior success body.
 */
export function createIdempotencyMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      next();
      return;
    }
    if (!req.path.startsWith('/api/')) {
      next();
      return;
    }
    const key = String(req.header('idempotency-key') ?? '').trim().slice(0, 128);
    if (!key) {
      next();
      return;
    }
    const uid = (res.locals.user as { uid?: string } | undefined)?.uid ?? 'anon';
    const composite = `${req.method}:${req.path}:${uid}:${key}`;
    purgeIdempotency();
    const hit = idempotencyStore.get(composite);
    if (hit && hit.expiresAt > Date.now()) {
      res.setHeader('Idempotency-Replayed', 'true');
      res.status(hit.status).json(hit.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const status = res.statusCode || 200;
      if (status >= 200 && status < 300) {
        idempotencyStore.set(composite, {
          status,
          body,
          expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
        });
      }
      return originalJson(body);
    }) as Response['json'];

    next();
  };
}

export function extractAgentUserTexts(messages: unknown): string[] {
  if (!Array.isArray(messages)) return [];
  const texts: string[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const role = String((msg as { role?: string }).role ?? '');
    if (role && role !== 'user') continue;
    const parts = (msg as { parts?: unknown }).parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (p && typeof p === 'object' && typeof (p as { text?: string }).text === 'string') {
          texts.push(String((p as { text: string }).text));
        }
      }
    }
    if (typeof (msg as { text?: string }).text === 'string') {
      texts.push(String((msg as { text: string }).text));
    }
  }
  return texts;
}

export const __test__ = {
  idempotencyStore,
  purgeIdempotency,
};
