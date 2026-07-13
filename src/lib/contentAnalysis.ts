/**
 * Content analysis engine (v2) — orchestrates NLP primitives into course outlines.
 * Deterministic, offline, dependency-free. Falls back gracefully when LLM unavailable.
 */

import { detectDocumentSections, splitStructuredParagraphs } from './textSegmentation';
import type { CourseOutline, CourseTopic, GlossaryEntry } from './courseTypes';
import { normalizeConcept, titleCasePhrase, splitSentences, WORD_RE } from './nlpCore';
import { rankKeyphrases } from './keyphraseExtractor';
import { extractDefinitions, extractAcronyms, buildObjectives } from './definitionMiner';
import { extractiveSummary } from './extractiveSummary';
import { inferSubject, estimateDifficulty } from './subjectClassifier';

// Re-export sub-modules for backward compatibility
export { rankKeyphrases, type Keyphrase } from './keyphraseExtractor';
export { extractDefinitions as extractDefinitionsV2, extractAcronyms, buildObjectives } from './definitionMiner';
export { extractiveSummary, type SummaryOptions } from './extractiveSummary';
export { inferSubject, estimateDifficulty } from './subjectClassifier';
export { stemLite, normalizeConcept, titleCasePhrase, splitSentences } from './nlpCore';

/* Old inline implementations removed — now delegated to:
 *   nlpCore.ts, keyphraseExtractor.ts, definitionMiner.ts,
 *   extractiveSummary.ts, subjectClassifier.ts
 */

export function analyzeContentToOutline(text: string, fileName?: string): CourseOutline {
  const clean = (text ?? '').trim();
  if (clean.length < 200) {
    return {
      title: fileName?.replace(/\.[^.]+$/, '') ?? 'New Course',
      topics: [{ id: 'topic-0', title: fileName ?? 'Uploaded Material', description: clean.slice(0, 300), objectives: ['Review uploaded content'], durationMinutes: 25 }],
      glossary: [],
      prerequisites: [],
    };
  }

  const isGreek = /[\u0370-\u03ff]{20,}/.test(clean);
  const subject = inferSubject(clean);
  const sections = detectDocumentSections(clean);
  const allKeyphrases = rankKeyphrases(clean, 25);

  // Build topics from sections or keyphrase clustering
  const sourceSections = sections.length >= 3
    ? sections
    : splitStructuredParagraphs(clean).map((body, i) => ({
        id: `p-${i}`, title: allKeyphrases[i]?.phrase ?? `Topic ${i + 1}`,
        body, kind: 'paragraph' as const, startOffset: 0,
      }));

  const topics: CourseTopic[] = sourceSections.slice(0, 10).map((sec, i) => {
    const kp = rankKeyphrases(sec.body, 6, sec.title);
    const concepts = kp.map((k) => titleCasePhrase(k.phrase)).slice(0, 5);
    const difficulty = estimateDifficulty(sec.body);
    const summary = extractiveSummary(sec.body, 1, {
      biasTerms: [sec.title, ...concepts.slice(0, 2)],
      leadBias: 0.18, mmrLambda: 0.7,
    })[0];
    const wc = (sec.body.match(WORD_RE) ?? []).length;

    return {
      id: `topic-${i}`,
      title: titleCasePhrase(sec.title.toLowerCase()).slice(0, 100) || concepts[0] || `Topic ${i + 1}`,
      description: (summary?.slice(0, 200) ?? '') || sec.body.slice(0, 200),
      objectives: buildObjectives(concepts.length > 0 ? concepts : [sec.title], isGreek, difficulty),
      durationMinutes: Math.min(45, Math.max(8, Math.round((wc / 130) * 6))),
    };
  });

  if (topics.length === 0) {
    topics.push({ id: 'topic-0', title: fileName ?? 'Uploaded Material', description: clean.slice(0, 300), objectives: ['Review uploaded content'], durationMinutes: 25 });
  }

  // Build glossary from definitions + acronyms + top keyphrases
  const glossaryMap = new Map<string, GlossaryEntry>();
  for (const g of extractDefinitions(clean, 20)) glossaryMap.set(normalizeConcept(g.term), g);
  for (const g of extractAcronyms(clean)) glossaryMap.set(normalizeConcept(g.term), g);
  if (glossaryMap.size < 8) {
    const sentences = splitSentences(clean);
    for (const { phrase } of allKeyphrases) {
      if (glossaryMap.size >= 14) break;
      if (phrase.split(/\s+/).length > 2) continue;
      const display = titleCasePhrase(phrase);
      const ctx = sentences.find((s) => s.toLowerCase().includes(phrase));
      glossaryMap.set(normalizeConcept(phrase), {
        term: display,
        definition: ctx ? ctx.slice(0, 220) : `${display} — a key concept from your material.`,
      });
    }
  }

  const title = deriveTitle(clean, fileName, subject);

  return {
    title,
    topics,
    glossary: [...glossaryMap.values()].slice(0, 25),
    prerequisites: allKeyphrases.slice(0, 3).map((k) => titleCasePhrase(k.phrase)),
  };
}

function deriveTitle(text: string, fileName: string | undefined, subject: string): string {
  const fromFile = fileName?.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  if (fromFile && fromFile.length >= 4 && !/^untitled/i.test(fromFile)) {
    return titleCasePhrase(fromFile.toLowerCase());
  }
  const top = rankKeyphrases(text, 1)[0];
  if (top) return `${subject}: ${titleCasePhrase(top.phrase)}`;
  return `${subject} Study Course`;
}
