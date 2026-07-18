import { describe, expect, it, beforeEach } from 'vitest';
import {
  MEET_MIN_CONSENTS,
  meetDualConsentSatisfied,
  cooldownMsForAction,
  isUserOnCooldown,
  __resetSocialPolicyMemoryForTests,
} from './socialPolicy';

describe('socialPolicy server', () => {
  beforeEach(() => {
    __resetSocialPolicyMemoryForTests();
  });

  it('requires dual Meet consent', () => {
    expect(MEET_MIN_CONSENTS).toBe(2);
    expect(meetDualConsentSatisfied({})).toBe(false);
    expect(meetDualConsentSatisfied({ a: true })).toBe(false);
    expect(meetDualConsentSatisfied({ a: true, b: true })).toBe(true);
    expect(meetDualConsentSatisfied({ a: true, b: false }, ['a', 'b'])).toBe(false);
    expect(meetDualConsentSatisfied({ a: true, b: true }, ['a', 'b'])).toBe(true);
  });

  it('maps triage actions to cooldown windows', () => {
    expect(cooldownMsForAction('dismiss')).toBe(0);
    expect(cooldownMsForAction('warn')).toBe(0);
    expect(cooldownMsForAction('cooldown_1h')).toBe(60 * 60 * 1000);
    expect(cooldownMsForAction('cooldown_24h')).toBe(24 * 60 * 60 * 1000);
    expect(cooldownMsForAction('ban_surface')).toBeGreaterThan(cooldownMsForAction('cooldown_24h'));
  });

  it('starts with no cooldowns', () => {
    expect(isUserOnCooldown('u1', 'collab')).toBe(false);
  });
});
