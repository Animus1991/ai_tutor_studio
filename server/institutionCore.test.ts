import { describe, expect, it } from 'vitest';
import {
  computeAtRisk,
  computeDpAggregates,
  emailMatchesDomain,
  masteryDistribution,
  normalizeInstitutionDomain,
  studentSafeSelfView,
} from './institutionCore';

describe('institutionCore', () => {
  it('normalizes institution domains', () => {
    expect(normalizeInstitutionDomain(' @Uni.EDU ')).toBe('uni.edu');
    expect(normalizeInstitutionDomain('notadomain')).toBeNull();
    expect(normalizeInstitutionDomain('')).toBeNull();
  });

  it('matches emails to domain tenancy', () => {
    expect(emailMatchesDomain('ada@uni.edu', 'uni.edu')).toBe(true);
    expect(emailMatchesDomain('ada@other.edu', 'uni.edu')).toBe(false);
    expect(emailMatchesDomain('ada@uni.edu', null)).toBe(true);
  });

  it('suppresses DP aggregates under k-anonymity', () => {
    const small = computeDpAggregates(
      [
        { userId: 'a', masteryPct: 80, cardsDue: 2, streak: 1, studyMinutes: 10 },
        { userId: 'b', masteryPct: 60, cardsDue: 4, streak: 0, studyMinutes: 5 },
      ],
      { k: 5, rand: () => 0.25 },
    );
    expect(small.suppressed).toBe(true);
    expect(small.avgMastery).toBeNull();
  });

  it('emits noisy DP aggregates when n ≥ k', () => {
    const students = Array.from({ length: 6 }, (_, i) => ({
      userId: `u${i}`,
      masteryPct: 70,
      cardsDue: 3,
      streak: 1,
      studyMinutes: 20,
      updatedAt: new Date().toISOString(),
    }));
    const agg = computeDpAggregates(students, { k: 5, epsilon: 1, rand: () => 0.25 });
    expect(agg.suppressed).toBe(false);
    expect(agg.avgMastery).not.toBeNull();
    expect(agg.epsilon).toBe(1);
  });

  it('builds mastery distribution buckets', () => {
    const dist = masteryDistribution([
      { userId: 'a', masteryPct: 90, cardsDue: 0, streak: 1, studyMinutes: 1 },
      { userId: 'b', masteryPct: 40, cardsDue: 0, streak: 1, studyMinutes: 1 },
      { userId: 'c', masteryPct: 55, cardsDue: 0, streak: 1, studyMinutes: 1 },
    ]);
    expect(dist.find((b) => b.label === '85–100')?.count).toBe(1);
    expect(dist.find((b) => b.label === '40–54')?.count).toBe(1);
  });

  it('flags at-risk with explainable reasons', () => {
    const rows = computeAtRisk(
      [
        {
          userId: 'risk',
          masteryPct: 40,
          cardsDue: 12,
          streak: 0,
          studyMinutes: 0,
          updatedAt: null,
        },
        {
          userId: 'ok',
          masteryPct: 88,
          cardsDue: 1,
          streak: 5,
          studyMinutes: 40,
          updatedAt: new Date().toISOString(),
        },
      ],
      Date.now(),
    );
    expect(rows.some((r) => r.userId === 'risk')).toBe(true);
    expect(rows.find((r) => r.userId === 'risk')?.reasons).toContain('high_due');
    expect(rows.find((r) => r.userId === 'risk')?.explain.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.userId === 'ok')).toBe(false);
  });

  it('student-safe view never invents classmate emails', () => {
    const v = studentSafeSelfView({
      userId: 'me',
      name: 'Ada',
      email: 'ada@uni.edu',
      masteryPct: 70,
      cardsDue: 2,
      streak: 1,
      studyMinutes: 10,
      subjects: [],
    });
    expect(v).not.toHaveProperty('email');
    expect(v.name).toBe('Ada');
  });
});
