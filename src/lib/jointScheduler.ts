/**
 * Joint scheduler: FSRS due pressure × mastery gap × interleaving constraints.
 * Pure helpers — Tasks / Dashboard call these to order review work.
 */

export type SchedulableItem = {
  id: string;
  domainKey: string;
  /** ISO or Date — FSRS/next review */
  dueAt: string | Date | null | undefined;
  /** 0–1 mastery/retrievability estimate (higher = stronger) */
  mastery?: number;
  /** IRT difficulty (−3…3) if known */
  difficulty?: number;
  /** Ability θ for learner in domain */
  abilityTheta?: number;
  lastDomainKeyReviewed?: string;
};

export type ScheduledItem = SchedulableItem & {
  score: number;
  reasons: string[];
};

function duePressure(dueAt: string | Date | null | undefined, now: number): number {
  if (!dueAt) return 0.2;
  const t = dueAt instanceof Date ? dueAt.getTime() : new Date(dueAt).getTime();
  if (Number.isNaN(t)) return 0.2;
  const hours = (now - t) / 3_600_000;
  if (hours >= 0) return Math.min(3, 1 + hours / 24); // overdue boost
  return Math.max(0.05, 1 / (1 + Math.abs(hours) / 24)); // upcoming
}

function masteryGap(mastery?: number): number {
  if (mastery === undefined) return 0.5;
  return Math.max(0, 1 - Math.min(1, Math.max(0, mastery)));
}

function exposureFit(difficulty?: number, theta?: number): number {
  if (difficulty === undefined || theta === undefined) return 0.5;
  // Prefer items near ability (not too easy / hard)
  const delta = Math.abs(difficulty - theta);
  return Math.max(0.1, 1 - delta / 3);
}

/**
 * Rank review items. Interleaving: slight penalty for same domain as last reviewed.
 */
export function rankReviewQueue(
  items: SchedulableItem[],
  opts: { now?: number; lastDomainKey?: string; limit?: number } = {},
): ScheduledItem[] {
  const now = opts.now ?? Date.now();
  const last = opts.lastDomainKey;
  const ranked = items.map((item) => {
    const reasons: string[] = [];
    const due = duePressure(item.dueAt, now);
    const gap = masteryGap(item.mastery);
    const fit = exposureFit(item.difficulty, item.abilityTheta);
    let score = due * 0.5 + gap * 0.35 + fit * 0.15;
    if (last && item.domainKey === last) {
      score *= 0.85;
      reasons.push('interleave_penalty');
    }
    if (due > 1) reasons.push('overdue');
    if (gap > 0.6) reasons.push('mastery_gap');
    if (fit > 0.7) reasons.push('irt_match');
    return { ...item, score, reasons };
  });
  ranked.sort((a, b) => b.score - a.score);
  return opts.limit ? ranked.slice(0, opts.limit) : ranked;
}

export function filterDueItems(
  items: SchedulableItem[],
  now = Date.now(),
): SchedulableItem[] {
  return items.filter((item) => {
    if (!item.dueAt) return false;
    const t = item.dueAt instanceof Date ? item.dueAt.getTime() : new Date(item.dueAt).getTime();
    return !Number.isNaN(t) && t <= now;
  });
}
