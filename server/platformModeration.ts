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
  moderateMatchImage,
  type ModerationVerdict,
} from './matchModerator.js';

export type PlatformContentKind =
  | 'chat'
  | 'notes'
  | 'goal'
  | 'collab'
  | 'agent'
  | 'upload_meta'
  | 'board'
  | 'image';

export type { ModerationVerdict };
export {
  heuristicModerateText,
  moderateMatchContent as moderatePlatformContent,
  moderateMatchImage,
};

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
  const kindRaw = String(req.body?.kind ?? 'chat') as PlatformContentKind;
  const allowedKinds: PlatformContentKind[] = [
    'chat',
    'notes',
    'goal',
    'collab',
    'agent',
    'upload_meta',
    'board',
    'image',
  ];
  const kind = allowedKinds.includes(kindRaw) ? kindRaw : 'chat';

  // Multimodal image path (base64) — Study Match attachments
  const imageBase64 = typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64 : '';
  if (kind === 'image' || imageBase64) {
    if (!imageBase64) throw new HttpError(400, 'imageBase64 is required for image moderation');
    if (imageBase64.length > 6_000_000) throw new HttpError(413, 'imageBase64 exceeds limit');
    const mime = String(req.body?.mimeType ?? 'image/jpeg').slice(0, 80);
    const buffer = Buffer.from(imageBase64, 'base64');
    const verdict = await moderateMatchImage(buffer, mime);
    // Caption text, if present, must also pass
    const caption = String(req.body?.text ?? '').trim();
    if (caption && verdict.allowed) {
      const textVerdict = await moderatePlatformText(caption, 'chat');
      if (!textVerdict.allowed) {
        res.json({
          allowed: false,
          category: textVerdict.category,
          reason: textVerdict.reason,
          source: textVerdict.source,
          kind: 'image',
        });
        return;
      }
    }
    res.json({
      allowed: verdict.allowed,
      category: verdict.category,
      reason: verdict.reason,
      source: verdict.source,
      kind: 'image',
    });
    return;
  }

  const text = String(req.body?.text ?? '');
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
