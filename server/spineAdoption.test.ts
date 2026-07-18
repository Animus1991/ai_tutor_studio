import { describe, expect, it } from 'vitest';
import { incompleteStages, SPINE_ADOPTION, spineAdoptionSummary } from './spineAdoption.js';

describe('spineAdoption', () => {
  it('covers surfaces 0–17', () => {
    expect(SPINE_ADOPTION.length).toBe(18);
    const ids = SPINE_ADOPTION.map((c) => c.id);
    for (let i = 0; i <= 17; i++) expect(ids).toContain(i);
  });

  it('summary lists only true partial/stub stages', () => {
    const summary = spineAdoptionSummary();
    expect(summary.pipeline).toContain('Auth → Validate');
    for (const card of SPINE_ADOPTION) {
      const stages = incompleteStages(card);
      for (const s of stages) {
        expect(['partial', 'stub']).toContain(card.stages[s]);
      }
    }
    // Core learning + social surfaces should be fully wired after spine closeout
    const wiredIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
    for (const id of wiredIds) {
      const card = SPINE_ADOPTION.find((c) => c.id === id);
      expect(card).toBeTruthy();
      expect(incompleteStages(card!)).toEqual([]);
    }
  });
});
