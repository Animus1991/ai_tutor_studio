import { describe, expect, it } from 'vitest';
import {
  buddyDisplayName,
  emailDomain,
  formatCountdown,
  isValidDomainFilter,
  isValidMatchDuration,
  normalizeTopicKey,
  secondsRemaining,
} from '../lib/studyMatch';
import {
  buddyDisplayName as serverBuddy,
  domainsCompatible,
  emailDomain as serverDomain,
  normalizeTopicKey as serverTopic,
  type QueueEntry,
} from '../../server/studyMatch';

describe('studyMatch client helpers', () => {
  it('normalizes topic keys stably', () => {
    expect(normalizeTopicKey('  Organic Chem!  ')).toBe('organic-chem');
    expect(normalizeTopicKey('Οργανική')).toBeTruthy();
  });

  it('validates durations and domains', () => {
    expect(isValidMatchDuration(25)).toBe(true);
    expect(isValidMatchDuration(12)).toBe(false);
    expect(emailDomain('Ada@Uni.EDU')).toBe('uni.edu');
    expect(isValidDomainFilter('uni.edu', 'ada@uni.edu')).toBe(true);
    expect(isValidDomainFilter('mit.edu', 'ada@uni.edu')).toBe(false);
    expect(isValidDomainFilter('', 'ada@uni.edu')).toBe(true);
  });

  it('formats countdown and remaining time', () => {
    expect(formatCountdown(125)).toBe('02:05');
    const ends = new Date(Date.now() + 90_000).toISOString();
    expect(secondsRemaining(ends)).toBeGreaterThan(80);
    expect(secondsRemaining(ends)).toBeLessThanOrEqual(90);
  });

  it('never exposes raw uid as display name', () => {
    const name = buddyDisplayName('abcdef123');
    expect(name.startsWith('Buddy-')).toBe(true);
    expect(name).not.toContain('abcdef');
  });
});

describe('studyMatch server matching rules', () => {
  const base = (over: Partial<QueueEntry>): QueueEntry => ({
    uid: 'u1',
    email: 'a@uni.edu',
    topicKey: 'organic-chem',
    topicLabel: 'Organic Chem',
    durationMin: 25,
    domainFilter: '',
    status: 'waiting',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    sessionId: null,
    ...over,
  });

  it('aligns topic normalization with client', () => {
    expect(serverTopic('Organic Chem')).toBe(normalizeTopicKey('Organic Chem'));
    expect(serverDomain('x@School.Edu')).toBe('school.edu');
    expect(serverBuddy('uid-1')).toMatch(/^Buddy-\d{4}$/);
  });

  it('enforces optional school domain filter symmetrically', () => {
    const open = base({ uid: 'a', email: 'a@uni.edu', domainFilter: '' });
    const filtered = base({ uid: 'b', email: 'b@uni.edu', domainFilter: 'uni.edu' });
    const outsider = base({ uid: 'c', email: 'c@other.edu', domainFilter: '' });
    const wrongFilter = base({
      uid: 'd',
      email: 'd@uni.edu',
      domainFilter: 'mit.edu',
    });

    expect(domainsCompatible(open, filtered)).toBe(true);
    expect(domainsCompatible(filtered, outsider)).toBe(false);
    expect(domainsCompatible(open, outsider)).toBe(true);
    expect(domainsCompatible(wrongFilter, filtered)).toBe(false);
  });
});
