/**
 * Client helpers for the platform moderation spine (`POST /api/moderate`).
 */
import { apiRequest } from './apiClient';
import { heuristicModerateText } from '../../server/matchModeratorHeuristics';

export type PlatformContentKind = 'chat' | 'notes' | 'goal' | 'collab' | 'agent' | 'upload_meta';

export type PlatformModerationResult = {
  allowed: boolean;
  category: string;
  reason: string;
  source: string;
  kind: PlatformContentKind;
};

/** Fast local preflight (always). Server adds Gemini when configured. */
export function localModerateText(text: string): { allowed: boolean; reason: string } {
  const v = heuristicModerateText(text);
  return { allowed: v.allowed, reason: v.reason };
}

export async function moderatePlatformText(
  text: string,
  kind: PlatformContentKind = 'chat',
): Promise<PlatformModerationResult> {
  const local = localModerateText(text);
  if (!local.allowed) {
    return {
      allowed: false,
      category: 'unsafe',
      reason: local.reason,
      source: 'heuristic',
      kind,
    };
  }

  try {
    const res = await apiRequest('/api/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 8000), kind }),
    });
    if (!res.ok) {
      // Fail closed only for explicit moderation rejections; network blips keep local allow.
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 400 && data.error) {
        return {
          allowed: false,
          category: 'unsafe',
          reason: data.error,
          source: 'server',
          kind,
        };
      }
      return { allowed: true, category: 'ok', reason: '', source: 'local', kind };
    }
    return (await res.json()) as PlatformModerationResult;
  } catch {
    return { allowed: true, category: 'ok', reason: '', source: 'local', kind };
  }
}
