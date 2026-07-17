/**
 * PRODUCT_BLUEPRINT evidence principles — machine-readable tags for recommendations.
 * Every scheduler / agent recommendation should cite at least one principle id.
 */

export type EvidencePrincipleId =
  | 'retrieval'
  | 'spacing'
  | 'interleaving'
  | 'cognitive_load'
  | 'scaffolding'
  | 'dual_coding'
  | 'self_determination'
  | 'desirable_difficulties'
  | 'feynman'
  | 'irt_calibration';

export type EvidencePrinciple = {
  id: EvidencePrincipleId;
  title: string;
  titleEl: string;
  mechanism: string;
  primaryMetric: string;
  blueprintSection: '§1';
};

export const EVIDENCE_PRINCIPLES: readonly EvidencePrinciple[] = [
  {
    id: 'retrieval',
    title: 'Retrieval practice',
    titleEl: 'Εξάσκηση ανάκλησης',
    mechanism: 'Attempt-first recall before reveal; corrective feedback',
    primaryMetric: 'delayed unassisted recall',
    blueprintSection: '§1',
  },
  {
    id: 'spacing',
    title: 'Spacing / FSRS',
    titleEl: 'Διαστήματα / FSRS',
    mechanism: 'Versioned due dates with outcome-driven intervals',
    primaryMetric: 'recall per minute of review',
    blueprintSection: '§1',
  },
  {
    id: 'interleaving',
    title: 'Interleaving',
    titleEl: 'Εναλλαγή',
    mechanism: 'Mix confusable categories after initial acquisition',
    primaryMetric: 'discrimination / transfer',
    blueprintSection: '§1',
  },
  {
    id: 'cognitive_load',
    title: 'Cognitive load',
    titleEl: 'Γνωστικό φορτίο',
    mechanism: 'Bounded chunks, signaling, split-attention reduction',
    primaryMetric: 'error / latency / drop-off per chunk',
    blueprintSection: '§1',
  },
  {
    id: 'scaffolding',
    title: 'Scaffolding / ZPD',
    titleEl: 'Ικριώματα / ZPD',
    mechanism: 'Hint ladder with fading as competence rises',
    primaryMetric: 'independent performance / hint dependence',
    blueprintSection: '§1',
  },
  {
    id: 'dual_coding',
    title: 'Dual coding',
    titleEl: 'Διπλή κωδικοποίηση',
    mechanism: 'Concept maps / diagrams only for essential relations',
    primaryMetric: 'transfer + diagram comprehension',
    blueprintSection: '§1',
  },
  {
    id: 'self_determination',
    title: 'Self-determination',
    titleEl: 'Αυτοκαθορισμός',
    mechanism: 'Meaningful autonomy + competence feedback (no vanity streaks-as-science)',
    primaryMetric: 'persistence with wellbeing',
    blueprintSection: '§1',
  },
  {
    id: 'desirable_difficulties',
    title: 'Desirable difficulties',
    titleEl: 'Επιθυμητές δυσκολίες',
    mechanism: 'Spacing, generation, variable practice near ability',
    primaryMetric: 'delayed retention',
    blueprintSection: '§1',
  },
  {
    id: 'feynman',
    title: 'Feynman / self-explanation',
    titleEl: 'Feynman / αυτο-εξήγηση',
    mechanism: 'Explain-back with source-grounded gap detection',
    primaryMetric: 'rubric score + misconception repair',
    blueprintSection: '§1',
  },
  {
    id: 'irt_calibration',
    title: 'IRT calibration',
    titleEl: 'Βαθμονόμηση IRT',
    mechanism: 'Item difficulty near ability θ; confidence bands',
    primaryMetric: 'calibration bins / Brier-like error',
    blueprintSection: '§1',
  },
] as const;

export function getEvidencePrinciple(id: EvidencePrincipleId): EvidencePrinciple | undefined {
  return EVIDENCE_PRINCIPLES.find((p) => p.id === id);
}

/** Map joint-scheduler reason codes → blueprint principles. */
export function principlesForSchedulerReasons(reasons: string[]): EvidencePrincipleId[] {
  const out = new Set<EvidencePrincipleId>();
  for (const r of reasons) {
    switch (r) {
      case 'overdue':
        out.add('spacing');
        out.add('retrieval');
        break;
      case 'mastery_gap':
        out.add('retrieval');
        out.add('desirable_difficulties');
        break;
      case 'irt_match':
        out.add('irt_calibration');
        out.add('desirable_difficulties');
        break;
      case 'interleave_penalty':
        out.add('interleaving');
        break;
      default:
        break;
    }
  }
  if (out.size === 0) out.add('spacing');
  return [...out];
}

/** Human-readable “why this quiz now” line. */
export function explainWhyNow(reasons: string[], lang: 'en' | 'el' = 'en'): string {
  const ids = principlesForSchedulerReasons(reasons);
  const titles = ids
    .map((id) => getEvidencePrinciple(id))
    .filter(Boolean)
    .map((p) => (lang === 'el' ? p!.titleEl : p!.title));
  const reasonBits =
    lang === 'el'
      ? reasons
          .map((r) =>
            r === 'overdue'
              ? 'εκπρόθεσμο'
              : r === 'mastery_gap'
                ? 'κενό κατάκτησης'
                : r === 'irt_match'
                  ? 'ταιριάζει στο θ'
                  : r === 'interleave_penalty'
                    ? 'εναλλαγή τομέα'
                    : r,
          )
          .join(' · ')
      : reasons.join(' · ');
  return lang === 'el'
    ? `Γιατί τώρα: ${reasonBits || 'προγραμματισμός'} (${titles.join(', ')})`
    : `Why now: ${reasonBits || 'scheduled'} (${titles.join(', ')})`;
}
