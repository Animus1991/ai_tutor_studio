import { describe, expect, it } from 'vitest';
import { filterDueItems, rankReviewQueue } from '../jointScheduler';

describe('jointScheduler', () => {
  const now = Date.parse('2026-07-17T12:00:00.000Z');

  it('boosts overdue items and applies interleaving penalty', () => {
    const ranked = rankReviewQueue(
      [
        {
          id: 'a',
          domainKey: 'chem',
          dueAt: '2026-07-16T12:00:00.000Z',
          mastery: 0.2,
        },
        {
          id: 'b',
          domainKey: 'chem',
          dueAt: '2026-07-18T12:00:00.000Z',
          mastery: 0.9,
        },
        {
          id: 'c',
          domainKey: 'calc',
          dueAt: '2026-07-16T10:00:00.000Z',
          mastery: 0.3,
        },
      ],
      { now, lastDomainKey: 'chem' },
    );
    expect(ranked[0].id).toBe('c');
    expect(ranked.find((r) => r.id === 'a')?.reasons).toContain('interleave_penalty');
  });

  it('filters due items', () => {
    const due = filterDueItems(
      [
        { id: '1', domainKey: 'x', dueAt: '2026-07-17T11:00:00.000Z' },
        { id: '2', domainKey: 'x', dueAt: '2026-07-17T13:00:00.000Z' },
      ],
      now,
    );
    expect(due.map((d) => d.id)).toEqual(['1']);
  });
});
