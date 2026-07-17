import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_PRINCIPLES,
  explainWhyNow,
  principlesForSchedulerReasons,
} from '../lib/evidencePrinciples';
import { computeCalibration } from '../lib/calibration';
import {
  fixtureAnswersForCi,
  runEvalHarness,
  scoreGoldenAnswer,
  GOLDEN_QUESTIONS,
} from '../lib/evidenceEval';

describe('evidencePrinciples', () => {
  it('catalogs PRODUCT_BLUEPRINT §1 principles', () => {
    expect(EVIDENCE_PRINCIPLES.length).toBeGreaterThanOrEqual(8);
    expect(EVIDENCE_PRINCIPLES.every((p) => p.blueprintSection === '§1')).toBe(true);
  });

  it('maps scheduler reasons to principles', () => {
    const ids = principlesForSchedulerReasons(['overdue', 'interleave_penalty']);
    expect(ids).toContain('spacing');
    expect(ids).toContain('interleaving');
  });

  it('explains why-now in EN/EL', () => {
    const en = explainWhyNow(['mastery_gap'], 'en');
    const el = explainWhyNow(['mastery_gap'], 'el');
    expect(en).toMatch(/Why now/);
    expect(el).toMatch(/Γιατί τώρα/);
  });
});

describe('calibration', () => {
  it('computes bins, MACE, and Brier', () => {
    const report = computeCalibration([
      { predicted: 0.9, actual: 1 },
      { predicted: 0.9, actual: 1 },
      { predicted: 0.1, actual: 0 },
      { predicted: 0.5, actual: 1 },
    ]);
    expect(report.n).toBe(4);
    expect(report.brier).not.toBeNull();
    expect(report.bins.some((b) => b.count > 0)).toBe(true);
  });
});

describe('evidenceEval harness', () => {
  it('passes CI fixture answers', () => {
    const report = runEvalHarness(fixtureAnswersForCi());
    expect(report.total).toBe(GOLDEN_QUESTIONS.length);
    expect(report.passed).toBe(report.total);
    expect(report.passRate).toBe(1);
  });

  it('fails when required content is missing', () => {
    const g = GOLDEN_QUESTIONS.find((q) => q.id === 'calc-quiz-1')!;
    const r = scoreGoldenAnswer(g, 'I do not know');
    expect(r.passed).toBe(false);
    expect(r.failures.some((f) => f.startsWith('missing'))).toBe(true);
  });

  it('tags cases with evidence principles', () => {
    const report = runEvalHarness(fixtureAnswersForCi(), { courseKey: 'organic-chemistry' });
    expect(report.cases.every((c) => c.principles.length > 0)).toBe(true);
  });
});
