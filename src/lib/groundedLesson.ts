import type { WorkspaceNoteBundle } from './workspaceNoteContent';
import { splitStructuredParagraphs } from './textSegmentation';
import { BM25 } from './bm25';

export interface LessonStepContent {
  title: string;
  body: string;
  kind: string;
}

export function getNoteContentForLessonStep(
  bundle: WorkspaceNoteBundle,
  stepIndex: number,
  stepKind: string,
): LessonStepContent {
  if (!bundle.hasSource) {
    return { title: 'No source', body: 'Upload study material to see grounded lesson content.', kind: stepKind };
  }

  const paragraphs = splitStructuredParagraphs(bundle.sourceText);
  const section = bundle.sections[stepIndex];

  if (section) {
    const sentences = section.body.match(/[^.!?]+[.!?]+/g) ?? [section.body];
    let body = sentences.slice(0, 4).join(' ').trim();
    if (stepKind === 'Practice') body = `Practice: Summarize "${section.title}" in your own words.\n\n${sentences[0] ?? ''}`;
    if (stepKind === 'Core Concept') body = sentences[0] ?? section.body.slice(0, 400);
    return { title: section.title, body, kind: stepKind };
  }

  if (paragraphs.length > 0) {
    const bm25 = new BM25(paragraphs);
    const hits = bm25.search(bundle.concept, 2);
    const body = hits.map((h) => paragraphs[h.index]).join('\n\n').slice(0, 800);
    return { title: bundle.concept, body: body || paragraphs[stepIndex % paragraphs.length], kind: stepKind };
  }

  return {
    title: bundle.concept,
    body: bundle.sourceText.slice(0, 600),
    kind: stepKind,
  };
}

export function buildQuizFromNotes(bundle: WorkspaceNoteBundle): {
  question: string;
  options: string[];
  correctIndex: number;
} | null {
  if (!bundle.hasSource || !bundle.course || bundle.course.glossary.length === 0) return null;

  const term = bundle.course.glossary[0];
  const distractors = bundle.course.glossary.slice(1, 4).map((g) => g.definition);
  const options = [term.definition, ...distractors].slice(0, 4);
  while (options.length < 4) options.push('None of the above');

  return {
    question: `What is the definition of "${term.term}"?`,
    options,
    correctIndex: 0,
  };
}
