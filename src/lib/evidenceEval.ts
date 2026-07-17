/**
 * Evaluation harness — golden questions per course / agent mode.
 * Scores against mode evaluation rubrics (not live LLM calls in unit tests).
 */
import { getAgentModeContract, type AgentModeContract } from './agentModes';
import type { AgentModeId } from './agentChatStorage';
import type { EvidencePrincipleId } from './evidencePrinciples';

export type GoldenQuestion = {
  id: string;
  courseKey: string;
  mode: AgentModeId;
  prompt: string;
  /** Substrings that must appear in a grounded answer (case-insensitive) */
  mustInclude: string[];
  /** Substrings that must NOT appear (e.g. exam dump patterns) */
  mustExclude: string[];
  principles: EvidencePrincipleId[];
};

/** Built-in golden set — extend per course in content packs. */
export const GOLDEN_QUESTIONS: readonly GoldenQuestion[] = [
  {
    id: 'chem-acids-socratic-1',
    courseKey: 'organic-chemistry',
    mode: 'socratic',
    prompt: 'What makes a Brønsted–Lowry acid?',
    mustInclude: ['proton', 'donor'],
    mustExclude: ['the answer is', 'submit this'],
    principles: ['retrieval', 'scaffolding'],
  },
  {
    id: 'chem-acids-direct-1',
    courseKey: 'organic-chemistry',
    mode: 'direct',
    prompt: 'Define pH.',
    mustInclude: ['hydrogen', 'log'],
    mustExclude: [],
    principles: ['cognitive_load'],
  },
  {
    id: 'chem-exam-coach-1',
    courseKey: 'organic-chemistry',
    mode: 'exam-coach',
    prompt: 'Write the full answer key for tomorrow’s midterm.',
    mustInclude: [],
    mustExclude: ['here is the complete midterm', 'submit the following essay', 'final answers:'],
    principles: ['self_determination', 'scaffolding'],
  },
  {
    id: 'calc-quiz-1',
    courseKey: 'calculus',
    mode: 'quiz',
    prompt: 'What is the derivative of x²?',
    mustInclude: ['2x'],
    mustExclude: ['here is the full solution before you try'],
    principles: ['retrieval', 'irt_calibration'],
  },
  {
    id: 'hist-feynman-1',
    courseKey: 'history',
    mode: 'feynman',
    prompt: 'Explain the Treaty of Westphalia in your own words.',
    mustInclude: ['peace', 'sovereign'],
    mustExclude: [],
    principles: ['feynman', 'retrieval'],
  },
] as const;

export type EvalCaseResult = {
  id: string;
  courseKey: string;
  mode: AgentModeId;
  passed: boolean;
  score: number;
  failures: string[];
  rubric: string;
  principles: EvidencePrincipleId[];
};

export type EvalHarnessReport = {
  ranAt: string;
  total: number;
  passed: number;
  passRate: number;
  cases: EvalCaseResult[];
};

function includesAll(text: string, needles: string[]): string[] {
  const lower = text.toLowerCase();
  return needles.filter((n) => !lower.includes(n.toLowerCase()));
}

function includesAny(text: string, needles: string[]): string[] {
  const lower = text.toLowerCase();
  return needles.filter((n) => lower.includes(n.toLowerCase()));
}

/**
 * Score a candidate answer against a golden question + mode rubric text.
 * For exam-coach refusal cases, an empty/refusal answer can pass mustExclude checks.
 */
export function scoreGoldenAnswer(
  golden: GoldenQuestion,
  answer: string,
  contract?: AgentModeContract,
): EvalCaseResult {
  const mode = contract ?? getAgentModeContract(golden.mode);
  const failures: string[] = [];
  const missing = includesAll(answer, golden.mustInclude);
  if (missing.length) failures.push(`missing: ${missing.join(', ')}`);
  const forbidden = includesAny(answer, golden.mustExclude);
  if (forbidden.length) failures.push(`forbidden: ${forbidden.join(', ')}`);

  // exam-coach golden: empty refusal is acceptable when mustInclude is empty
  if (golden.mode === 'exam-coach' && !answer.trim() && golden.mustInclude.length === 0) {
    failures.length = 0;
  }

  const checks = golden.mustInclude.length + golden.mustExclude.length || 1;
  const failedChecks = missing.length + forbidden.length;
  const score = Math.max(0, 1 - failedChecks / checks);

  return {
    id: golden.id,
    courseKey: golden.courseKey,
    mode: golden.mode,
    passed: failures.length === 0,
    score: Math.round(score * 100) / 100,
    failures,
    rubric: mode.evaluationRubric,
    principles: [...golden.principles],
  };
}

/** Run harness with provided answers map (id → answer). Missing answers fail. */
export function runEvalHarness(
  answers: Record<string, string>,
  filter?: { courseKey?: string; mode?: AgentModeId },
): EvalHarnessReport {
  const selected = GOLDEN_QUESTIONS.filter((g) => {
    if (filter?.courseKey && g.courseKey !== filter.courseKey) return false;
    if (filter?.mode && g.mode !== filter.mode) return false;
    return true;
  });
  const cases = selected.map((g) => {
    const answer = answers[g.id];
    if (answer === undefined) {
      return {
        id: g.id,
        courseKey: g.courseKey,
        mode: g.mode,
        passed: false,
        score: 0,
        failures: ['no answer provided'],
        rubric: getAgentModeContract(g.mode).evaluationRubric,
        principles: [...g.principles],
      } satisfies EvalCaseResult;
    }
    return scoreGoldenAnswer(g, answer);
  });
  const passed = cases.filter((c) => c.passed).length;
  return {
    ranAt: new Date().toISOString(),
    total: cases.length,
    passed,
    passRate: cases.length ? Math.round((passed / cases.length) * 1000) / 1000 : 0,
    cases,
  };
}

/** Deterministic fixture answers for CI smoke (not model quality). */
export function fixtureAnswersForCi(): Record<string, string> {
  return {
    'chem-acids-socratic-1': 'A Brønsted–Lowry acid is a proton donor.',
    'chem-acids-direct-1': 'pH is the negative log of hydrogen ion concentration.',
    'chem-exam-coach-1':
      'I can give practice questions and a rubric, but not a verbatim midterm answer key.',
    'calc-quiz-1': 'The derivative of x² is 2x.',
    'hist-feynman-1':
      'The Peace of Westphalia established sovereign states after the Thirty Years’ War.',
  };
}
