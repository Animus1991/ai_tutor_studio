import { BM25 } from './bm25';
import { rankKeyphrases } from './keyphraseExtractor';
import { normalizeConcept, titleCasePhrase, splitSentences, contentTokens } from './nlpCore';
import { extractDefinitions } from './definitionMiner';
import { extractiveSummary } from './extractiveSummary';
import { detectDocumentSections, splitStructuredParagraphs } from './textSegmentation';
import type { Course, GlossaryEntry } from './courseTypes';

export interface Flashcard {
  front: string;
  back: string;
}

export interface ExtractedFormula {
  id: string;
  name: string;
  formula: string;
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

/**
 * Score how relevant a text chunk is to a concept (0–1).
 * Hybrid: substring match + BM25-style token overlap.
 */
export function conceptRelevanceScore(text: string, concept: string): number {
  const lower = text.toLowerCase();
  const words = contentTokens(concept);
  if (words.length === 0) return 0;
  const phrase = concept.toLowerCase();
  const phraseHit = phrase.length > 4 && lower.includes(phrase) ? 0.5 : 0;
  const textTokens = new Set(contentTokens(text));
  let hits = 0;
  for (const w of words) if (textTokens.has(w) || lower.includes(w)) hits += 1;
  return Math.min(1, (hits / words.length) * 0.7 + phraseHit);
}

export function buildFlashcards(text: string, concept: string, glossary: GlossaryEntry[]): Flashcard[] {
  const cards: Flashcard[] = [];
  const seen = new Set<string>();

  const add = (front: string, back: string) => {
    const f = front.trim(), b = back.trim();
    if (f.length < 2 || b.length < 8) return;
    const k = normalizeConcept(f);
    if (seen.has(k)) return;
    seen.add(k);
    cards.push({ front: f, back: b.slice(0, 280) });
  };

  // Glossary entries scoped to concept
  const scoped = glossary
    .filter((g) => conceptRelevanceScore(g.term + ' ' + g.definition, concept) > 0.15)
    .slice(0, 12);
  for (const g of scoped) add(g.term, g.definition);

  // Extract definitions from the relevant excerpt
  const paragraphs = splitStructuredParagraphs(text);
  const bm25 = new BM25(paragraphs.length ? paragraphs : [text]);
  const hits = bm25.search(concept, 3);
  const excerpt = hits.map((h) => paragraphs[h.index]).join('\n\n');
  for (const d of extractDefinitions(excerpt, 8)) add(d.term, d.definition);

  // Concept-relevant sentences
  const sentences = splitSentences(excerpt).filter(
    (s) => conceptRelevanceScore(s, concept) > 0.3,
  );
  for (const s of sentences.slice(0, 4)) {
    add(`What is true about ${concept}?`, s);
  }

  // Fallback: extractive summary
  if (cards.length === 0) {
    const summary = extractiveSummary(excerpt || text, 1, { biasTerms: [concept] })[0];
    if (summary) add(concept, summary);
  }

  return cards.slice(0, 16);
}

const COMPARE_PATTERNS: RegExp[] = [
  /\b(.{4,50}?)\s+(?:vs\.?|versus|compared to|unlike|whereas|while|in contrast to|differs from)\s+(.{4,80}?)[.;]/gi,
  /\b(.{4,50}?)\s+(?:ενώ|αντίθετα|σε αντίθεση|σε σύγκριση με|διαφέρει από)\s+(.{4,80}?)[.;]/gi,
];

export function extractComparisons(text: string, glossary: GlossaryEntry[], concept?: string): ComparisonRow[] {
  const excerpt = concept ? relevantExcerpt(text, concept) : text;
  const rows: ComparisonRow[] = [];
  const seen = new Set<string>();

  const push = (dim: string, a: string, b: string) => {
    const left = a.trim().slice(0, 100);
    const right = b.trim().slice(0, 100);
    if (left.length < 2 || right.length < 2) return;
    const k = `${dim}|${left}|${right}`;
    if (seen.has(k)) return;
    seen.add(k);
    rows.push({ left, right, dimension: dim || 'Comparison' });
  };

  // Sentence patterns (EN + EL)
  for (const re of COMPARE_PATTERNS) {
    re.lastIndex = 0;
    for (const m of excerpt.matchAll(re)) {
      push('Comparison', m[1]!, m[2]!);
      if (rows.length >= 6) return rows;
    }
  }

  // Glossary pairs co-occurring in same sentence
  const sentences = splitSentences(excerpt);
  const terms = concept
    ? glossary.filter((g) => conceptRelevanceScore(g.definition + g.term, concept) > 0.2).slice(0, 10)
    : glossary.slice(0, 10);
  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      const a = terms[i]!, b = terms[j]!;
      const shared = sentences.find(
        (s) => s.toLowerCase().includes(a.term.toLowerCase()) && s.toLowerCase().includes(b.term.toLowerCase()),
      );
      if (shared) push(`${a.term} vs ${b.term}`, a.definition.slice(0, 80), b.definition.slice(0, 80));
      if (rows.length >= 6) return rows;
    }
  }

  // Fallback: adjacent glossary pairs
  if (rows.length === 0 && glossary.length >= 2) {
    for (let i = 0; i < Math.min(glossary.length - 1, 3); i++) {
      push('Related concepts', glossary[i].term, glossary[i + 1].term);
    }
  }
  return rows;
}

const FORMULA_LINE = /(?:^|\n)\s*(?:Formula|Τύπος|Equation|Expression)?\s*:?\s*([A-Za-zΑ-Ωα-ω][A-Za-zΑ-Ωα-ω0-9_²³*+\-/()=.,%Δ\s]{4,80}=[A-Za-zΑ-Ωα-ω0-9_²³*+\-/().,%Δ\s]{2,80})/gim;
const INLINE_MATH = /\\\[([^\\]+)\\\]|\\\(([^\\]+)\\\)|\$\$?([^$]+)\$\$?/g;
const MATH_EXPR = /([A-Za-zΑ-Ωα-ω][A-Za-zΑ-Ωα-ω0-9_²³*+\-/()=.,%Δ\s]*(?:=|≥|≤|≈|→)[A-Za-zΑ-Ωα-ω0-9_²³*+\-/().,%Δ\s]{2,80})/g;

export function extractFormulas(text: string, concept?: string, max = 8): ExtractedFormula[] {
  const excerpt = concept ? relevantExcerpt(text, concept) : text;
  const out: ExtractedFormula[] = [];
  const seen = new Set<string>();

  const add = (raw: string, label?: string) => {
    const formula = raw.replace(/\s+/g, ' ').trim();
    if (formula.length < 5 || formula.length > 120) return;
    if (!/[=≥≤≈→]/.test(formula) && !/\$|\\/.test(formula)) return;
    const k = normalizeConcept(formula);
    if (seen.has(k)) return;
    seen.add(k);
    const name = label?.trim() || formula.split(/[=≥≤≈→]/)[0]?.trim() || `Formula ${out.length + 1}`;
    out.push({ id: `nf-${out.length}`, name: name.slice(0, 48), formula });
  };

  for (const m of excerpt.matchAll(INLINE_MATH)) {
    const raw = m[1] ?? m[2] ?? m[3];
    if (raw) add(raw.trim(), 'LaTeX');
    if (out.length >= max) return out;
  }
  for (const m of excerpt.matchAll(FORMULA_LINE)) {
    add(m[1]!);
    if (out.length >= max) return out;
  }
  for (const m of excerpt.matchAll(MATH_EXPR)) {
    add(m[1]!);
    if (out.length >= max) return out;
  }
  for (const s of splitSentences(excerpt)) {
    if (!/[=≥≤≈]/.test(s) || s.length > 140) continue;
    const eq = s.match(/([A-Za-zΑ-Ω][A-Za-zΑ-Ω0-9_²³]*\s*[=≥≤≈]\s*[^.]{3,60})/);
    if (eq) add(eq[1]!, titleCasePhrase((concept ?? 'Key').toLowerCase()));
    if (out.length >= max) break;
  }
  return out;
}

/** Convert plain-text formula to best-effort LaTeX for rendering. */
export function formulaToLatex(formula: string): string {
  let out = formula.trim();
  if (out.startsWith('$') && out.endsWith('$')) return out.slice(1, -1);
  if (out.startsWith('\\(') && out.endsWith('\\)')) return out.slice(2, -2);
  const greek: Record<string, string> = {
    α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\epsilon',
    θ: '\\theta', λ: '\\lambda', μ: '\\mu', π: '\\pi', σ: '\\sigma',
    Δ: '\\Delta', Σ: '\\Sigma', Π: '\\Pi', Ω: '\\Omega',
  };
  out = out.replace(/[Α-Ωα-ω]/gu, (ch) => greek[ch] ?? ch);
  out = out.replace(/²/g, '^{2}').replace(/³/g, '^{3}');
  out = out.replace(/\b([A-Za-z0-9_{}\\]+)\s*\/\s*([A-Za-z0-9_{}\\]+)\b/g, '\\frac{$1}{$2}');
  out = out.replace(/\bsqrt\s*\(([^)]+)\)/gi, '\\sqrt{$1}');
  return out;
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

export function relevantExcerpt(text: string, concept: string, maxChars = 10000): string {
  if (!text.trim()) return '';

  // Short documents: score sections by concept relevance
  if (text.length < 1500) {
    const sections = detectDocumentSections(text);
    type Chunk = { body: string; score: number };
    const chunks: Chunk[] = [];
    if (sections.length > 0) {
      for (const s of sections) {
        const body = s.title ? `${s.title}\n\n${s.body}` : s.body;
        chunks.push({ body, score: conceptRelevanceScore(body, concept) });
      }
    } else {
      const paras = text.split(/\n{2,}/).filter((p) => p.trim().length > 40);
      for (const p of paras) chunks.push({ body: p.trim(), score: conceptRelevanceScore(p, concept) });
    }
    chunks.sort((a, b) => b.score - a.score);
    const picked: string[] = [];
    let len = 0;
    for (const c of chunks) {
      if (c.score < 0.1 && picked.length >= 2) break;
      if (len + c.body.length > maxChars) break;
      picked.push(c.body);
      len += c.body.length;
    }
    return picked.length > 0 ? picked.join('\n\n') : text.slice(0, maxChars);
  }

  // Larger inputs: BM25 over paragraphs, re-order by document position
  const paragraphs = splitStructuredParagraphs(text);
  if (paragraphs.length === 0) return text.slice(0, maxChars);
  const bm25 = new BM25(paragraphs);
  const k = Math.max(2, Math.min(10, Math.ceil(maxChars / 700)));
  const hits = bm25.search(concept, k);
  if (hits.length === 0) return text.slice(0, maxChars);
  // Re-order by original position for readable output
  const ordered = hits.slice().sort((a, b) => a.index - b.index);
  const picked: string[] = [];
  let len = 0;
  for (const h of ordered) {
    const body = paragraphs[h.index];
    if (len + body.length > maxChars) break;
    picked.push(body);
    len += body.length;
  }
  return picked.length > 0 ? picked.join('\n\n') : text.slice(0, maxChars);
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
