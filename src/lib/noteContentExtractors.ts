import { BM25 } from './bm25';
import { rankKeyphrases } from './contentAnalysis';
import { detectDocumentSections, splitStructuredParagraphs } from './textSegmentation';
import type { Course, GlossaryEntry } from './courseTypes';

export interface Flashcard {
  question: string;
  answer: string;
}

export interface ComparisonRow {
  left: string;
  right: string;
  dimension: string;
}

export interface ConceptNode {
  id: string;
  label: string;
  group: number;
}

export interface ConceptEdge {
  source: string;
  target: string;
  relation: 'prerequisite' | 'related' | 'contrasts';
}

export interface DebateNode {
  id: string;
  claim: string;
  support: string[];
  counter: string[];
}

export function buildFlashcards(text: string, glossary: GlossaryEntry[]): Flashcard[] {
  const cards: Flashcard[] = [];
  for (const g of glossary.slice(0, 15)) {
    cards.push({ question: `What is ${g.term}?`, answer: g.definition });
  }
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  for (const s of sentences.slice(0, 5)) {
    if (s.length > 40 && s.length < 200) {
      cards.push({ question: 'Explain:', answer: s.trim() });
    }
  }
  return cards.slice(0, 20);
}

export function extractComparisons(text: string, glossary: GlossaryEntry[]): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const vsPattern = /([A-ZΑ-Ω][\w\s]{2,30})\s+(?:vs\.?|versus|compared to|έναντι)\s+([A-ZΑ-Ω][\w\s]{2,30})/gi;
  let m: RegExpExecArray | null;
  while ((m = vsPattern.exec(text)) !== null) {
    rows.push({ left: m[1].trim(), right: m[2].trim(), dimension: 'Comparison' });
  }
  if (rows.length === 0 && glossary.length >= 2) {
    for (let i = 0; i < Math.min(glossary.length - 1, 3); i++) {
      rows.push({
        left: glossary[i].term,
        right: glossary[i + 1].term,
        dimension: 'Related concepts',
      });
    }
  }
  return rows;
}

export function extractFormulas(text: string): string[] {
  const formulas: string[] = [];
  const patterns = [
    /[a-zA-Z]\s*=\s*[^.\n]{3,60}/g,
    /\\frac\{[^}]+\}\{[^}]+\}/g,
    /[a-zA-Z]\^\d+/g,
  ];
  for (const re of patterns) {
    const matches = text.match(re) ?? [];
    formulas.push(...matches.map((f) => f.trim()));
  }
  return [...new Set(formulas)].slice(0, 20);
}

export function buildConceptMapFromCourse(course: Course): { nodes: ConceptNode[]; edges: ConceptEdge[] } {
  const nodes: ConceptNode[] = course.topics.map((t, i) => ({
    id: t.id,
    label: t.title,
    group: (i % 5) + 1,
  }));
  for (const g of course.glossary.slice(0, 8)) {
    nodes.push({ id: `g-${g.term}`, label: g.term, group: 6 });
  }
  const edges: ConceptEdge[] = [];
  for (let i = 1; i < course.topics.length; i++) {
    edges.push({
      source: course.topics[i - 1].id,
      target: course.topics[i].id,
      relation: 'prerequisite',
    });
  }
  for (const p of course.prerequisites.slice(0, 3)) {
    const target = course.topics[0]?.id;
    if (target) edges.push({ source: `g-${p}`, target, relation: 'prerequisite' });
  }
  return { nodes, edges };
}

export function buildFeynmanOutline(text: string, concept: string): { steps: string[]; gaps: string[] } {
  const sections = detectDocumentSections(text);
  const relevant = sections.find((s) =>
    s.body.toLowerCase().includes(concept.toLowerCase()) || s.title.toLowerCase().includes(concept.toLowerCase()),
  );
  const body = relevant?.body ?? text.slice(0, 1500);
  const sentences = body.match(/[^.!?]+[.!?]+/g) ?? [body];
  return {
    steps: [
      `Explain "${concept}" in simple terms`,
      'Use an analogy from everyday life',
      'Identify the core mechanism',
      'Check against source material',
    ],
    gaps: sentences.slice(1, 4).map((s) => `Key point you should cover: ${s.trim().slice(0, 120)}`),
  };
}

export function buildDebateTreeFromNotes(text: string, concept: string): DebateNode[] {
  const paragraphs = splitStructuredParagraphs(text);
  const bm25 = new BM25(paragraphs.length ? paragraphs : [text]);
  const hits = bm25.search(concept, 3);
  return hits.map((h, i) => ({
    id: `debate-${i}`,
    claim: paragraphs[h.index]?.slice(0, 150) ?? concept,
    support: [`Evidence from paragraph ${h.index + 1}`],
    counter: ['Consider alternative interpretations', 'What assumptions are being made?'],
  }));
}

export function relevantExcerpt(text: string, query: string, topK = 3): string {
  const paragraphs = splitStructuredParagraphs(text);
  if (paragraphs.length === 0) return text.slice(0, 1200);
  const bm25 = new BM25(paragraphs);
  return bm25.search(query, topK).map((h) => paragraphs[h.index]).join('\n\n');
}

export function sandboxInsightFromNotes(text: string, concept: string): string {
  const kps = rankKeyphrases(text, 5);
  const related = kps.filter((k) => k.phrase.toLowerCase().includes(concept.toLowerCase().split(' ')[0]));
  if (related.length) return `Adjusting parameters around "${related[0].phrase}" — sensitivity is high in this region of the notes.`;
  return `Explore how changing variables affects "${concept}" based on your source material.`;
}

export function notesSupportEconomicsSandbox(text: string): boolean {
  return /\b(price|demand|supply|cost|revenue|market|equilibrium|elasticity|μονοπώλιο|cournot|bertrand)\b/i.test(text);
}
