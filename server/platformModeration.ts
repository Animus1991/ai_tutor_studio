/**
 * Platform content moderation spine.
 * Shared by Study Match, Collab pre-checks, and future Agent/notes gates.
 */
import type { Request, Response } from 'express';
import { HttpError } from './security.js';
import { getAuthUser } from './authz.js';
import {
  heuristicModerateText,
  moderateMatchContent,
  type ModerationVerdict,
} from './matchModerator.js';

export type PlatformContentKind = 'chat' | 'notes' | 'goal' | 'collab' | 'agent' | 'upload_meta';

export type { ModerationVerdict };
export { heuristicModerateText, moderateMatchContent as moderatePlatformContent };

/** Map surface kind → moderator content type. */
function toMatchKind(kind: PlatformContentKind): 'chat' | 'notes' | 'goal' {
  if (kind === 'notes' || kind === 'goal') return kind;
  return 'chat';
}

export async function moderatePlatformText(
  text: string,
  kind: PlatformContentKind = 'chat',
): Promise<ModerationVerdict> {
  return moderateMatchContent(text, toMatchKind(kind));
}

/**
 * POST /api/moderate
 * Body: { text: string, kind?: PlatformContentKind }
 * Auth required when REQUIRE_API_AUTH — still useful as a client preflight.
 */
export async function moderateContentHandler(req: Request, res: Response): Promise<void> {
  // Prefer authenticated callers; allow anonymous only when middleware did not require auth.
  if (res.locals.user) {
    getAuthUser(res);
  }
  const text = String(req.body?.text ?? '');
  const kindRaw = String(req.body?.kind ?? 'chat') as PlatformContentKind;
  const allowedKinds: PlatformContentKind[] = [
    'chat',
    'notes',
    'goal',
    'collab',
    'agent',
    'upload_meta',
  ];
  const kind = allowedKinds.includes(kindRaw) ? kindRaw : 'chat';
  if (!text.trim()) {
    throw new HttpError(400, 'text is required');
  }
  if (text.length > 8000) {
    throw new HttpError(413, 'text exceeds limit');
  }
  const verdict = await moderatePlatformText(text, kind);
  res.json({
    allowed: verdict.allowed,
    category: verdict.category,
    reason: verdict.reason,
    source: verdict.source,
    kind,
  });
}
