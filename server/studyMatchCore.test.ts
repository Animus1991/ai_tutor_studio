import { describe, expect, it } from 'vitest';
import {
  canonicalTopicKey,
  createRateLimiter,
  isPeerOnline,
  isSafeMatchChat,
  normalizeTopicKey,
  buildInitialPomodoro,
  startBreakPhase,
  shouldEmitMidpointCheckIn,
  isInCooldown,
  PRESENCE_ONLINE_MS,
  REPORT_COOLDOWN_MS,
} from './studyMatchCore';

describe('studyMatchCore', () => {
  it('canonicalizes topic synonyms', () => {
    expect(canonicalTopicKey('Organic Chemistry')).toBe('organic-chem');
    expect(canonicalTopicKey('org chem')).toBe('organic-chem');
    expect(canonicalTopicKey('Calc 1')).toBe('calculus');
    expect(normalizeTopicKey('  Linear Algebra! ')).toBe('linear-algebra');
    expect(canonicalTopicKey('Linear Algebra')).toBe('lin-alg');
  });

  it('builds pomodoro focus then break phases', () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    const focus = buildInitialPomodoro(25, now);
    expect(focus.phase).toBe('focus');
    expect(focus.focusMin).toBe(25);
    expect(new Date(focus.phaseEndsAt).getTime()).toBe(now.getTime() + 25 * 60_000);

    const br = startBreakPhase(focus, new Date('2026-07-17T12:25:00.000Z'));
    expect(br.phase).toBe('break');
    expect(br.breakMin).toBe(5);
  });

  it('filters unsafe off-platform contact chat', () => {
    expect(isSafeMatchChat('Can you explain resonance?').ok).toBe(true);
    expect(isSafeMatchChat('add me on whatsapp').ok).toBe(false);
    expect(isSafeMatchChat('call me at 6912345678 please').ok).toBe(false);
  });

  it('rate-limits sliding windows', () => {
    const lim = createRateLimiter(3, 1000);
    expect(lim.allow('u', 1000)).toBe(true);
    expect(lim.allow('u', 1001)).toBe(true);
    expect(lim.allow('u', 1002)).toBe(true);
    expect(lim.allow('u', 1003)).toBe(false);
    expect(lim.allow('u', 2200)).toBe(true);
  });

  it('detects peer presence window', () => {
    const now = Date.now();
    expect(isPeerOnline(new Date(now - 5_000).toISOString(), now)).toBe(true);
    expect(isPeerOnline(new Date(now - PRESENCE_ONLINE_MS - 1).toISOString(), now)).toBe(false);
  });

  it('emits midpoint check-in once', () => {
    const startedAt = '2026-07-17T12:00:00.000Z';
    const endsAt = '2026-07-17T12:20:00.000Z';
    const before = Date.parse('2026-07-17T12:05:00.000Z');
    const after = Date.parse('2026-07-17T12:11:00.000Z');
    expect(shouldEmitMidpointCheckIn({ startedAt, endsAt, midpointSent: false, now: before })).toBe(
      false,
    );
    expect(shouldEmitMidpointCheckIn({ startedAt, endsAt, midpointSent: false, now: after })).toBe(
      true,
    );
    expect(shouldEmitMidpointCheckIn({ startedAt, endsAt, midpointSent: true, now: after })).toBe(
      false,
    );
  });

  it('tracks report rematch cooldown', () => {
    const until = new Date(Date.now() + REPORT_COOLDOWN_MS).toISOString();
    expect(isInCooldown(until)).toBe(true);
    expect(isInCooldown(new Date(Date.now() - 1000).toISOString())).toBe(false);
  });
});
