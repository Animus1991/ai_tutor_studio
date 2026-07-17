import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptCommunityGuidelines,
  circleCollabRoomId,
  hasAcceptedCommunityGuidelines,
  isValidInviteEmail,
  normalizeEmail,
  REPORT_REASONS,
  KUDOS_KINDS,
} from '../lib/safeSocial';

describe('safeSocial', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  it('tracks community guidelines acceptance', () => {
    expect(hasAcceptedCommunityGuidelines()).toBe(false);
    acceptCommunityGuidelines();
    expect(hasAcceptedCommunityGuidelines()).toBe(true);
  });

  it('exposes closed enums for reports and kudos', () => {
    expect(REPORT_REASONS).toContain('harassment');
    expect(REPORT_REASONS).not.toContain('custom_free_text');
    expect(KUDOS_KINDS).toEqual(['helpful', 'clarify', 'encourage']);
  });

  it('normalizes and validates invite emails', () => {
    expect(normalizeEmail('  Ada@Uni.EDU ')).toBe('ada@uni.edu');
    expect(isValidInviteEmail('ada@uni.edu')).toBe(true);
    expect(isValidInviteEmail('not-an-email')).toBe(false);
    expect(isValidInviteEmail('a@b')).toBe(false);
  });

  it('builds deterministic circle room ids within Firestore id limits', () => {
    const id = circleCollabRoomId('abc123');
    expect(id).toBe('circle-abc123');
    expect(id.length).toBeLessThanOrEqual(64);
  });
});
