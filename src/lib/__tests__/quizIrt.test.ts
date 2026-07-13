import { describe, it, expect } from 'vitest';
import {
  probabilityCorrect,
  estimateQuizDifficulty,
  targetQuizDifficulty,
  updateQuizAbility,
  buildQuizIrtDisplay,
  buildQuizIrtConfidenceBand,
  formatQuizIrtForLearner,
} from '../quizIrt';

describe('quizIrt', () => {
  describe('probabilityCorrect', () => {
    it('returns 0.5 when ability equals difficulty', () => {
      expect(probabilityCorrect(1, 1)).toBeCloseTo(0.5);
    });

    it('returns > 0.5 when ability > difficulty', () => {
      expect(probabilityCorrect(2, 1)).toBeGreaterThan(0.5);
    });

    it('returns < 0.5 when ability < difficulty', () => {
      expect(probabilityCorrect(0, 1)).toBeLessThan(0.5);
    });

    it('clamps between 0 and 1', () => {
      const high = probabilityCorrect(10, -10);
      const low = probabilityCorrect(-10, 10);
      expect(high).toBeLessThanOrEqual(1);
      expect(high).toBeGreaterThan(0.99);
      expect(low).toBeGreaterThanOrEqual(0);
      expect(low).toBeLessThan(0.01);
    });
  });

  describe('estimateQuizDifficulty', () => {
    it('returns higher difficulty for more options', () => {
      expect(estimateQuizDifficulty(5)).toBeGreaterThan(estimateQuizDifficulty(3));
    });

    it('returns 1.0 for 4 options (standard MCQ)', () => {
      expect(estimateQuizDifficulty(4)).toBe(1.0);
    });
  });

  describe('targetQuizDifficulty', () => {
    it('returns higher target for higher ability', () => {
      const low = targetQuizDifficulty(0, 50);
      const high = targetQuizDifficulty(2, 50);
      expect(high).toBeGreaterThan(low);
    });

    it('blends concept mastery into target', () => {
      const weakMastery = targetQuizDifficulty(0, 20);
      const strongMastery = targetQuizDifficulty(0, 80);
      expect(strongMastery).toBeGreaterThan(weakMastery);
    });
  });

  describe('updateQuizAbility', () => {
    const baseState = { ability: 0, responses: 0, correct: 0, lastUpdated: '' };

    it('increases ability on correct answer', () => {
      const next = updateQuizAbility(baseState, 1.0, true);
      expect(next.ability).toBeGreaterThan(0);
      expect(next.correct).toBe(1);
      expect(next.responses).toBe(1);
    });

    it('decreases ability on incorrect answer', () => {
      const next = updateQuizAbility(baseState, 1.0, false);
      expect(next.ability).toBeLessThan(0);
      expect(next.correct).toBe(0);
      expect(next.responses).toBe(1);
    });

    it('clamps ability to [-3, 3]', () => {
      let state = { ability: 2.9, responses: 10, correct: 10, lastUpdated: '' };
      for (let i = 0; i < 20; i++) {
        state = updateQuizAbility(state, 0.5, true);
      }
      expect(state.ability).toBeLessThanOrEqual(3);

      state = { ability: -2.9, responses: 10, correct: 0, lastUpdated: '' };
      for (let i = 0; i < 20; i++) {
        state = updateQuizAbility(state, 2.0, false);
      }
      expect(state.ability).toBeGreaterThanOrEqual(-3);
    });

    it('uses higher learning rate for early responses', () => {
      const earlyCorrect = updateQuizAbility(baseState, 1.0, true);
      const laterCorrect = updateQuizAbility(
        { ability: 0, responses: 10, correct: 5, lastUpdated: '' },
        1.0,
        true,
      );
      expect(Math.abs(earlyCorrect.ability)).toBeGreaterThan(Math.abs(laterCorrect.ability));
    });
  });

  describe('buildQuizIrtDisplay', () => {
    it('returns correct structure', () => {
      const display = buildQuizIrtDisplay(4, 0.5, 60);
      expect(display).toHaveProperty('ability', 0.5);
      expect(display).toHaveProperty('difficulty');
      expect(display).toHaveProperty('targetDifficulty');
      expect(display).toHaveProperty('passProbability');
      expect(display.passProbability).toBeGreaterThan(0);
      expect(display.passProbability).toBeLessThan(1);
    });
  });

  describe('buildQuizIrtConfidenceBand', () => {
    it('returns unknown tier with 0 responses', () => {
      const irt = buildQuizIrtDisplay(4, 0);
      const band = buildQuizIrtConfidenceBand(irt, 0, false);
      expect(band.tier).toBe('unknown');
      expect(band.highPct - band.lowPct).toBe(50); // margin=25, so range=50
    });

    it('narrows confidence band with more responses', () => {
      const irt = buildQuizIrtDisplay(4, 0);
      const cold = buildQuizIrtConfidenceBand(irt, 0, false);
      const warm = buildQuizIrtConfidenceBand(irt, 10, false);
      expect(warm.highPct - warm.lowPct).toBeLessThan(cold.highPct - cold.lowPct);
    });

    it('returns correct labels for Greek', () => {
      const irt = buildQuizIrtDisplay(4, 1.5);
      const band = buildQuizIrtConfidenceBand(irt, 5, true);
      expect(band.rangeLabel).toContain('εκτιμώμενη επιτυχία');
    });
  });

  describe('formatQuizIrtForLearner', () => {
    it('returns unknown readiness with 0 responses', () => {
      const irt = buildQuizIrtDisplay(4, 0);
      const copy = formatQuizIrtForLearner(irt, false, 0);
      expect(copy.readinessLabel).toContain('Unknown');
      expect(copy.hint).toBeTruthy();
    });

    it('returns good readiness for high ability', () => {
      const irt = buildQuizIrtDisplay(4, 1.5);
      const copy = formatQuizIrtForLearner(irt, false, 5);
      expect(copy.readinessLabel).toContain('Good');
    });

    it('returns Greek labels when isGreek=true', () => {
      const irt = buildQuizIrtDisplay(4, 0);
      const copy = formatQuizIrtForLearner(irt, true, 0);
      expect(copy.readinessLabel).toContain('Ετοιμότητα');
      expect(copy.probabilityLabel).toContain('Πιθανότητα');
    });
  });
});
