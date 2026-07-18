/**
 * Institution spine — pure helpers (DP aggregates, at-risk, domain tenancy).
 * Kept free of Express/Firestore for unit testing.
 */

export const DP_EPSILON_DEFAULT = 1.0;
export const DP_K_ANONYMITY = 5;

export type ProgressSignals = {
  userId: string;
  masteryPct: number;
  cardsDue: number;
  streak: number;
  studyMinutes: number;
  updatedAt?: string | null;
};

export type AtRiskReason = 'high_due' | 'low_mastery' | 'inactive' | 'low_streak';

export type AtRiskRow = {
  userId: string;
  score: number;
  reasons: AtRiskReason[];
  explain: string;
};

export type MasteryBucket = { label: string; min: number; max: number; count: number };

export type DpAggregateResult = {
  studentCount: number;
  /** Noisy average mastery (or null when suppressed). */
  avgMastery: number | null;
  /** Noisy total due (or null when suppressed). */
  totalDue: number | null;
  activeCount: number | null;
  suppressed: boolean;
  epsilon: number;
  kAnonymity: number;
  note: string;
};

/** Normalize school/email domain for class tenancy (no leading @). */
export function normalizeInstitutionDomain(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const d = raw
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9.-]/g, '');
  if (!d || !d.includes('.') || d.length > 120) return null;
  return d;
}

export function emailMatchesDomain(email: string, domain: string | null): boolean {
  if (!domain) return true;
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 0) return false;
  return e.slice(at + 1) === domain;
}

/** Laplace noise: scale = sensitivity / epsilon. */
export function laplaceNoise(scale: number, rand: () => number = Math.random): number {
  if (scale <= 0) return 0;
  const u = rand() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

/**
 * Differential-privacy style class aggregates.
 * Suppresses when n < k; otherwise adds Laplace noise to avg mastery / totals.
 */
export function computeDpAggregates(
  students: ProgressSignals[],
  opts?: { epsilon?: number; k?: number; rand?: () => number },
): DpAggregateResult {
  const epsilon = opts?.epsilon ?? DP_EPSILON_DEFAULT;
  const k = opts?.k ?? DP_K_ANONYMITY;
  const n = students.length;
  const base = {
    studentCount: n,
    epsilon,
    kAnonymity: k,
  };

  if (n < k) {
    return {
      ...base,
      avgMastery: null,
      totalDue: null,
      activeCount: null,
      suppressed: true,
      note: `Aggregates suppressed until ≥${k} students (k-anonymity).`,
    };
  }

  const sumMastery = students.reduce((a, s) => a + s.masteryPct, 0);
  const sumDue = students.reduce((a, s) => a + s.cardsDue, 0);
  const active = students.filter((s) => s.updatedAt).length;
  const avg = sumMastery / n;

  // Sensitivity: one student can shift avg by ≤100/n; due by ≤ max cards (cap 200).
  const avgScale = 100 / (n * epsilon);
  const dueScale = 200 / epsilon;
  const activeScale = 1 / epsilon;
  const rand = opts?.rand ?? Math.random;

  const noisyAvg = Math.max(0, Math.min(100, avg + laplaceNoise(avgScale, rand)));
  const noisyDue = Math.max(0, Math.round(sumDue + laplaceNoise(dueScale, rand)));
  const noisyActive = Math.max(0, Math.min(n, Math.round(active + laplaceNoise(activeScale, rand))));

  return {
    ...base,
    avgMastery: Math.round(noisyAvg * 10) / 10,
    totalDue: noisyDue,
    activeCount: noisyActive,
    suppressed: false,
    note: `Laplace noise ε=${epsilon}; not exact counts.`,
  };
}

/** Histogram of mastery for instructor dashboards (exact counts — teacher-only). */
export function masteryDistribution(students: ProgressSignals[]): MasteryBucket[] {
  const buckets: MasteryBucket[] = [
    { label: '0–39', min: 0, max: 39, count: 0 },
    { label: '40–54', min: 40, max: 54, count: 0 },
    { label: '55–69', min: 55, max: 69, count: 0 },
    { label: '70–84', min: 70, max: 84, count: 0 },
    { label: '85–100', min: 85, max: 100, count: 0 },
  ];
  for (const s of students) {
    const m = Math.max(0, Math.min(100, s.masteryPct));
    const b = buckets.find((x) => m >= x.min && m <= x.max);
    if (b) b.count += 1;
  }
  return buckets;
}

const INACTIVE_MS = 7 * 24 * 60 * 60 * 1000;

/** Explainable at-risk heuristics (no black-box scoreboard). */
export function computeAtRisk(
  students: ProgressSignals[],
  now = Date.now(),
): AtRiskRow[] {
  const rows: AtRiskRow[] = [];
  for (const s of students) {
    const reasons: AtRiskReason[] = [];
    let score = 0;
    if (s.cardsDue >= 10) {
      reasons.push('high_due');
      score += 3;
    } else if (s.cardsDue >= 5) {
      reasons.push('high_due');
      score += 1;
    }
    if (s.masteryPct > 0 && s.masteryPct < 50) {
      reasons.push('low_mastery');
      score += 3;
    } else if (s.masteryPct > 0 && s.masteryPct < 65) {
      reasons.push('low_mastery');
      score += 1;
    }
    const updated = s.updatedAt ? new Date(s.updatedAt).getTime() : 0;
    if (!updated || now - updated > INACTIVE_MS) {
      reasons.push('inactive');
      score += 2;
    }
    if (s.streak === 0 && s.masteryPct > 0) {
      reasons.push('low_streak');
      score += 1;
    }
    if (score === 0) continue;
    const explain = reasons
      .map((r) => {
        switch (r) {
          case 'high_due':
            return `${s.cardsDue} reviews due`;
          case 'low_mastery':
            return `mastery ${Math.round(s.masteryPct)}%`;
          case 'inactive':
            return 'no progress update in 7d';
          case 'low_streak':
            return 'streak reset';
          default:
            return r;
        }
      })
      .join(' · ');
    rows.push({ userId: s.userId, score, reasons, explain });
  }
  return rows.sort((a, b) => b.score - a.score);
}

/** Redact peer PII for student-facing class views. */
export function studentSafeSelfView(
  self: ProgressSignals & { name?: string; email?: string; subjects?: unknown[] },
): {
  userId: string;
  name: string;
  masteryPct: number;
  cardsDue: number;
  streak: number;
  studyMinutes: number;
  subjects: unknown[];
  updatedAt: string | null;
} {
  return {
    userId: self.userId,
    name: String(self.name ?? 'You'),
    masteryPct: self.masteryPct,
    cardsDue: self.cardsDue,
    streak: self.streak,
    studyMinutes: self.studyMinutes,
    subjects: Array.isArray(self.subjects) ? self.subjects : [],
    updatedAt: self.updatedAt ?? null,
  };
}
