import { describe, expect, it } from 'vitest';
import { incompleteStages, SPINE_ADOPTION, spineAdoptionSummary } from './spineAdoption.js';

describe('spineAdoption', () => {
  it('covers surfaces 0–17', () => {
    expect(SPINE_ADOPTION.length).toBe(18);
    const ids = SPINE_ADOPTION.map((c) => c.id);
    for (let i = 0; i <= 17; i++) expect(ids).toContain(i);
  });

  it('summary lists incomplete stages without inventing wired gaps', () => {
    const summary = spineAdoptionSummary();
    expect(summary.pipeline).toContain('Auth → Validate');
    expect(summary.incomplete.length).toBeGreaterThan(0);
    for (const card of SPINE_ADOPTION) {
      const stages = incompleteStages(card);
      for (const s of stages) {
        expect(['partial', 'stub']).toContain(card.stages[s]);
      }
    }
  });
});
