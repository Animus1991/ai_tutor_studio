/**
 * Reader Learning Heatmap — flags reader sections that mention concepts
 * the learner is currently struggling with (per the workspace concept bus),
 * so the Reader can visually surface weak spots worth revisiting.
 */
import { getStrugglingConcepts, type ConceptEngagement } from './workspaceConceptBus';

export type ReaderHeatLevel = 'none' | 'low' | 'medium' | 'high';

export interface SectionHeat {
  level: ReaderHeatLevel;
  concepts: string[];
}

function levelForScore(score: number): ReaderHeatLevel {
  if (score <= 0) return 'none';
  if (score < 0.7) return 'low';
  if (score < 1.5) return 'medium';
  return 'high';
}

export function computeSectionHeat(
  title: string,
  body: string,
  struggling: ConceptEngagement[] = getStrugglingConcepts(),
): SectionHeat {
  if (struggling.length === 0) return { level: 'none', concepts: [] };
  const haystack = `${title} ${body}`.toLowerCase();
  const hits = struggling.filter((c) => c.concept.length >= 3 && haystack.includes(c.concept));
  if (hits.length === 0) return { level: 'none', concepts: [] };
  const score = hits.reduce((sum, c) => sum + Math.abs(c.struggleScore), 0);
  return { level: levelForScore(score), concepts: hits.map((c) => c.concept) };
}

export function readerHeatLevelClass(level: ReaderHeatLevel): string {
  switch (level) {
    case 'high':
      return 'border-l-4 border-rose-500 bg-rose-50/50 dark:bg-rose-900/10';
    case 'medium':
      return 'border-l-4 border-amber-500 bg-amber-50/40 dark:bg-amber-900/10';
    case 'low':
      return 'border-l-4 border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-900/5';
    default:
      return '';
  }
}
