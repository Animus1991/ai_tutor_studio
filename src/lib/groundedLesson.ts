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
  const set = buildQuizSetFromNotes(bundle);
  return set.length > 0 ? set[0] : null;
}

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
};

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Up to 4 glossary-based questions from course material. */
export function buildQuizSetFromNotes(bundle: WorkspaceNoteBundle): QuizQuestion[] {
  if (!bundle.hasSource || !bundle.course || bundle.course.glossary.length === 0) {
    return [];
  }

  const terms = bundle.course.glossary.slice(0, 4);
  return terms.map((term, idx) => {
    const distractors = bundle
      .course!.glossary.filter((g) => g.term !== term.term)
      .slice(0, 3)
      .map((g) => g.definition);
    const options = [term.definition, ...distractors].slice(0, 4);
    while (options.length < 4) options.push('None of the above');

    return {
      id: `quiz-${idx}-${term.term}`,
      question: `What is the definition of "${term.term}"?`,
      options,
      correctIndex: 0,
    };
  });
}

/** Shuffle options while tracking the correct answer index. */
export function shuffleQuizQuestion(question: QuizQuestion): QuizQuestion {
  const tagged = question.options.map((text, i) => ({
    text,
    isCorrect: i === question.correctIndex,
  }));
  const shuffled = shuffleArray(tagged);
  return {
    ...question,
    options: shuffled.map((o) => o.text),
    correctIndex: shuffled.findIndex((o) => o.isCorrect),
  };
}
