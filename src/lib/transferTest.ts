/**
 * Transfer-test engine — delayed unassisted recall vs study condition.
 * Causal gate helper: do not claim efficacy until transferScore improves
 * vs active control (see docs/INSTITUTIONAL_GATES.md).
 */
import type { EvidencePrincipleId } from './evidencePrinciples';

export type TransferItem = {
  id: string;
  domainKey: string;
  /** Studied with assistance (worked example / hint) */
  studiedPrompt: string;
  /** Delayed unassisted probe (different surface form) */
  transferPrompt: string;
  mustInclude: string[];
  principles: EvidencePrincipleId[];
};

export type TransferAttempt = {
  itemId: string;
  answer: string;
  /** Hours since study exposure */
  delayHours: number;
  assistedStudy: boolean;
};

export type TransferScore = {
  itemId: string;
  hitRate: number;
  passed: boolean;
  delayHours: number;
  principles: EvidencePrincipleId[];
};

export type TransferReport = {
  n: number;
  meanHitRate: number;
  passRate: number;
  /** True only when enough samples and passRate beats controlFloor */
  causalReady: boolean;
  scores: TransferScore[];
  note: string;
};

const DEFAULT_ITEMS: readonly TransferItem[] = [
  {
    id: 'chem-transfer-1',
    domainKey: 'organic-chemistry',
    studiedPrompt: 'Worked example: classify HCl as a Brønsted acid.',
    transferPrompt: 'Is acetic acid a proton donor? Explain briefly.',
    mustInclude: ['proton', 'donor'],
    principles: ['retrieval', 'desirable_difficulties'],
  },
  {
    id: 'calc-transfer-1',
    domainKey: 'calculus',
    studiedPrompt: 'Worked example: d/dx of x² is 2x.',
    transferPrompt: 'What is the derivative of x³?',
    mustInclude: ['3x'],
    principles: ['retrieval', 'spacing'],
  },
];

export function scoreTransferAttempt(
  item: TransferItem,
  attempt: TransferAttempt,
): TransferScore {
  const lower = attempt.answer.toLowerCase();
  const hits = item.mustInclude.filter((s) => lower.includes(s.toLowerCase()));
  const hitRate = item.mustInclude.length
    ? hits.length / item.mustInclude.length
    : 0;
  return {
    itemId: item.id,
    hitRate: Math.round(hitRate * 1000) / 1000,
    passed: hitRate >= 0.67 && attempt.delayHours >= 1,
    delayHours: attempt.delayHours,
    principles: [...item.principles],
  };
}

/**
 * Aggregate transfer scores. `controlFloor` is the minimum passRate before
 * any efficacy claim is allowed (default 0.55 — active-control placeholder).
 */
export function evaluateTransferBattery(
  attempts: TransferAttempt[],
  opts?: { items?: readonly TransferItem[]; controlFloor?: number; minN?: number },
): TransferReport {
  const items = opts?.items ?? DEFAULT_ITEMS;
  const byId = new Map(items.map((i) => [i.id, i]));
  const scores: TransferScore[] = [];
  for (const a of attempts) {
    const item = byId.get(a.itemId);
    if (!item) continue;
    scores.push(scoreTransferAttempt(item, a));
  }
  const n = scores.length;
  const meanHitRate = n
    ? Math.round((scores.reduce((s, x) => s + x.hitRate, 0) / n) * 1000) / 1000
    : 0;
  const passRate = n
    ? Math.round((scores.filter((s) => s.passed).length / n) * 1000) / 1000
    : 0;
  const minN = opts?.minN ?? 8;
  const controlFloor = opts?.controlFloor ?? 0.55;
  const causalReady = n >= minN && passRate >= controlFloor;
  return {
    n,
    meanHitRate,
    passRate,
    causalReady,
    scores,
    note: causalReady
      ? 'Transfer battery meets minimum N and control floor — eligible for pre-registered comparison.'
      : 'Not causal-ready: need more delayed unassisted attempts or higher pass rate vs control floor. No Bloom-2σ claims.',
  };
}

export function defaultTransferItems(): readonly TransferItem[] {
  return DEFAULT_ITEMS;
}
