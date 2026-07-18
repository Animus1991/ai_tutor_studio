import { describe, expect, it } from 'vitest';
import { assessGroundedness, overlapScore } from '../ragGrounding';
import { looksLikeExamAnswerDump } from '../agentModes';

describe('ragGrounding', () => {
  it('scores lexical overlap', () => {
    expect(overlapScore('mitochondria produce ATP energy', 'ATP is produced in mitochondria')).toBeGreaterThan(0.2);
  });

  it('flags ungrounded long answers without citations', () => {
    const v = assessGroundedness({
      answer:
        'Dragons breathe fire across distant galaxies while spaceships harvest mythic crystals for teleportation rituals unrelated to chemistry.',
      excerpt: 'Organic chemistry covers alkanes alkenes and aromatic rings with resonance.',
    });
    expect(v.grounded).toBe(false);
  });

  it('allows general tutoring without document context', () => {
    expect(assessGroundedness({ answer: 'Hello' }).grounded).toBe(true);
  });
});

describe('exam-coach dump detector', () => {
  it('detects submit-ready dumps', () => {
    expect(
      looksLikeExamAnswerDump(
        `${'x'.repeat(200)} Here is the complete essay: ${'word '.repeat(80)}`,
      ),
    ).toBe(true);
    expect(looksLikeExamAnswerDump('Try outlining your argument first.')).toBe(false);
  });
});
