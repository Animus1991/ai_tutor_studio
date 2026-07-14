import type { Course, UploadedFile } from './courseTypes';
import { gatherAnalyzedText } from './libraryStorage';
import {
  buildConceptMapFromCourse,
  buildDebateTreeFromNotes,
  buildFlashcards,
  buildFeynmanOutline,
  extractComparisons,
  extractFormulas,
  notesSupportEconomicsSandbox,
  relevantExcerpt,
  sandboxInsightFromNotes,
  type ComparisonRow,
  type ConceptEdge,
  type ConceptNode,
  type DebateNode,
  type Flashcard,
} from './noteContentExtractors';
import { detectDocumentSections } from './textSegmentation';
import { rankKeyphrases } from './contentAnalysis';

export type WorkspaceToolId =
  | 'concept-map'
  | 'sandbox'
  | 'leitner'
  | 'compare'
  | 'whiteboard'
  | 'feynman'
  | 'timer'
  | 'debate'
  | 'reader'
  | 'scratchpad'
  | 'source'
  | 'dashboard'
  | 'quiz';

export interface SourceIntelligence {
  score: number;
  band: 'weak' | 'moderate' | 'strong';
  bestTool: WorkspaceToolId;
  reason: string;
  strengths: string[];
  gaps: string[];
}

export interface WorkspaceNoteBundle {
  hasSource: boolean;
  sourceText: string;
  concept: string;
  course: Course | null;
  conceptMap: { nodes: ConceptNode[]; edges: ConceptEdge[] };
  flashcards: Flashcard[];
  comparisons: ComparisonRow[];
  formulas: import('./noteContentExtractors').ExtractedFormula[];
  feynman: { steps: string[]; gaps: string[] };
  debate: DebateNode[];
  readerExcerpt: string;
  sandboxInsight: string;
  economicsSandbox: boolean;
  sections: ReturnType<typeof detectDocumentSections>;
  sourceIntelligence: SourceIntelligence;
}

function scoreSourceIntelligence(
  text: string,
  bundle: Omit<WorkspaceNoteBundle, 'sourceIntelligence'>,
): SourceIntelligence {
  let score = 0;
  const strengths: string[] = [];
  const gaps: string[] = [];

  if (text.length > 500) { score += 20; strengths.push('Substantial source text'); }
  else gaps.push('Short source — upload more material');
  if (bundle.flashcards.length >= 5) { score += 15; strengths.push('Rich glossary for flashcards'); }
  if (bundle.formulas.length >= 2) { score += 15; strengths.push('Formulas detected'); }
  if (bundle.comparisons.length >= 1) { score += 10; strengths.push('Comparisons available'); }
  if (bundle.sections.length >= 2) { score += 15; strengths.push('Structured sections'); }
  if (bundle.conceptMap.nodes.length >= 3) { score += 10; strengths.push('Concept map populated'); }

  score = Math.min(100, score);
  const band = score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak';

  let bestTool: WorkspaceToolId = 'reader';
  if (bundle.flashcards.length >= 8) bestTool = 'leitner';
  else if (bundle.formulas.length >= 3) bestTool = 'scratchpad';
  else if (bundle.comparisons.length >= 2) bestTool = 'compare';
  else if (bundle.economicsSandbox) bestTool = 'sandbox';
  else if (bundle.debate.length >= 2) bestTool = 'debate';

  return {
    score,
    band,
    bestTool,
    reason: `Recommended: ${bestTool} based on source signals`,
    strengths,
    gaps,
  };
}

export function buildWorkspaceNoteBundle(
  files: UploadedFile[],
  course: Course | null,
  concept?: string,
): WorkspaceNoteBundle {
  const courseId = course?.id;
  const sourceText = gatherAnalyzedText(files, courseId);
  const hasSource = sourceText.length >= 80;
  const activeConcept = concept ?? course?.topics[0]?.title ?? 'Core Concept';

  const empty: WorkspaceNoteBundle = {
    hasSource: false,
    sourceText: '',
    concept: activeConcept,
    course,
    conceptMap: { nodes: [], edges: [] },
    flashcards: [],
    comparisons: [],
    formulas: [],
    feynman: { steps: [], gaps: [] },
    debate: [],
    readerExcerpt: '',
    sandboxInsight: '',
    economicsSandbox: false,
    sections: [],
    sourceIntelligence: {
      score: 0,
      band: 'weak',
      bestTool: 'reader',
      reason: 'Upload material to enable grounded tools',
      strengths: [],
      gaps: ['No source text available'],
    },
  };

  if (!hasSource || !course) return empty;

  const glossary = course.glossary;
  const partial = {
    hasSource: true,
    sourceText,
    concept: activeConcept,
    course,
    conceptMap: buildConceptMapFromCourse(course),
    flashcards: buildFlashcards(sourceText, activeConcept, glossary),
    comparisons: extractComparisons(sourceText, glossary),
    formulas: extractFormulas(sourceText, activeConcept),
    feynman: buildFeynmanOutline(sourceText, activeConcept),
    debate: buildDebateTreeFromNotes(sourceText, activeConcept),
    readerExcerpt: relevantExcerpt(sourceText, activeConcept),
    sandboxInsight: sandboxInsightFromNotes(sourceText, activeConcept),
    economicsSandbox: notesSupportEconomicsSandbox(sourceText),
    sections: detectDocumentSections(sourceText),
  };

  return {
    ...partial,
    sourceIntelligence: scoreSourceIntelligence(sourceText, partial),
  };
}

export function buildWorkspaceStepsFromNotes(bundle: WorkspaceNoteBundle): { id: string; title: string; kind: string }[] {
  if (!bundle.hasSource) return [];
  const steps: { id: string; title: string; kind: string }[] = [];

  if (bundle.sections.length >= 2) {
    const kinds = ['Core Concept', 'Deep Dive', 'Key Insight', 'Practice'];
    bundle.sections.slice(0, 6).forEach((sec, i) => {
      steps.push({ id: `step-${i}`, title: sec.title, kind: kinds[i % kinds.length] });
    });
  } else {
    const kps = rankKeyphrases(bundle.sourceText, 5);
    kps.forEach((k, i) => {
      steps.push({ id: `step-${i}`, title: k.phrase, kind: 'Key Insight' });
    });
  }
  steps.push({ id: 'quiz', title: 'Quiz', kind: 'Practice' });
  return steps;
}
