import { describe, expect, it } from 'vitest';
import {
  SURFACE_CAPABILITIES,
  surfaceAllows,
  meetDualConsentSatisfied,
  circleToMatchPath,
  parseMatchBridgeQuery,
  socialPolicySnapshot,
  isValidReportReason,
  isValidTriageAction,
} from '../lib/socialPolicy';

describe('socialPolicy client', () => {
  it('exposes capability matrix without public discovery', () => {
    expect(surfaceAllows('circles', 'invite')).toBe(true);
    expect(surfaceAllows('circles', 'match_bridge')).toBe(true);
    expect(surfaceAllows('match', 'meet')).toBe(true);
    expect(surfaceAllows('collab', 'kudos')).toBe(true);
    expect(SURFACE_CAPABILITIES.circles).not.toContain('chat');
  });

  it('enforces dual Meet consent helper', () => {
    expect(meetDualConsentSatisfied({ a: true })).toBe(false);
    expect(meetDualConsentSatisfied({ a: true, b: true })).toBe(true);
  });

  it('builds Circle → Match bridge URLs', () => {
    const path = circleToMatchPath('Organic Chem', 'c1');
    expect(path.startsWith('/match?')).toBe(true);
    const parsed = parseMatchBridgeQuery(path.split('?')[1] ?? '');
    expect(parsed.topic).toBe('Organic Chem');
    expect(parsed.fromCircle).toBe(true);
    expect(parsed.circleId).toBe('c1');
  });

  it('snapshots policy with guidelines + closed report enums', () => {
    const snap = socialPolicySnapshot('match');
    expect(snap.inviteOnly).toBe(true);
    expect(snap.noPublicDiscovery).toBe(true);
    expect(snap.meetDualConsent).toBe(true);
    expect(snap.peerDisplay).toBe('Buddy-####');
    expect(isValidReportReason('harassment')).toBe(true);
    expect(isValidReportReason('custom')).toBe(false);
    expect(isValidTriageAction('cooldown_1h')).toBe(true);
    expect(isValidTriageAction('shadowban')).toBe(false);
  });
});
