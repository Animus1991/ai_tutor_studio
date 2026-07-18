import { describe, expect, it } from 'vitest';
import {
  debateCountersToScore01,
  defaultPrinciples,
  feynmanGapsToScore01,
  scoreToMasteryDelta,
} from '../pedagogyWriteback';

describe('pedagogyWriteback', () => {
  it('maps feynman gaps to score and mastery delta', () => {
    expect(feynmanGapsToScore01(0)).toBeGreaterThan(0.9);
    expect(feynmanGapsToScore01(5)).toBeLessThan(0.3);
    expect(scoreToMasteryDelta('feynman', 1)).toBe(10);
    expect(defaultPrinciples('feynman')).toContain('feynman');
  });

  it('credits debate counters modestly', () => {
    expect(debateCountersToScore01(0)).toBeCloseTo(0.35);
    expect(debateCountersToScore01(3)).toBeGreaterThan(0.5);
    expect(scoreToMasteryDelta('debate', 0.8)).toBeGreaterThanOrEqual(4);
  });
});
