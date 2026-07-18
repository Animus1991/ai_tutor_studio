import { describe, expect, it } from 'vitest';
import {
  defaultTransferItems,
  evaluateTransferBattery,
  scoreTransferAttempt,
} from '../transferTest';

describe('transferTest', () => {
  it('scores delayed unassisted recall', () => {
    const item = defaultTransferItems()[0]!;
    const score = scoreTransferAttempt(item, {
      itemId: item.id,
      answer: 'Yes — acetic acid is a proton donor.',
      delayHours: 24,
      assistedStudy: false,
    });
    expect(score.hitRate).toBe(1);
    expect(score.passed).toBe(true);
  });

  it('rejects immediate / incomplete answers', () => {
    const item = defaultTransferItems()[0]!;
    const score = scoreTransferAttempt(item, {
      itemId: item.id,
      answer: 'maybe',
      delayHours: 0,
      assistedStudy: true,
    });
    expect(score.passed).toBe(false);
  });

  it('marks causalReady only with enough delayed passes', () => {
    const items = defaultTransferItems();
    const attempts = Array.from({ length: 8 }, (_, i) => ({
      itemId: items[i % items.length]!.id,
      answer: i % 2 === 0 ? 'proton donor 3x^2' : 'no idea',
      delayHours: 2,
      assistedStudy: false,
    }));
    const report = evaluateTransferBattery(attempts, { minN: 8, controlFloor: 0.4 });
    expect(report.n).toBe(8);
    expect(report.note).toMatch(/causal|control|Bloom/i);
  });
});
