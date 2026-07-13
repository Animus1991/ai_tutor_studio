/**
 * Definition + acronym mining from raw text.
 */

import { normalizeConcept, titleCasePhrase, splitSentences } from './nlpCore';
import type { GlossaryEntry } from './courseTypes';

const DEF_PATTERNS: RegExp[] = [
  /^(.{2,60}?)\s+(?:is|are|refers to|is defined as|means|is called|describes|denotes)\s+(.{15,240})/i,
  /^(.{2,60}?)\s+(?:είναι|ορίζεται ως|σημαίνει|ονομάζεται|καλείται|αναφέρεται σε|περιγράφει)\s+(.{15,240})/i,
];

function cleanTerm(raw: string): string {
  let t = raw.trim()
    .replace(/^[""'(]+|[""')]+$/g, '')
    .replace(/^[•\-–—*·\d.)\s]+/, '');
  const am = t.match(/\b(?:a|an|the|ένα|μια|ένας|το|η|ο)\b\s+(.+)$/i);
  if (am?.[1] && am[1].split(/\s+/).length <= 4) t = am[1];
  return t.trim();
}

function looksLikeTerm(term: string): boolean {
  const words = term.trim().split(/\s+/);
  if (words.length === 0 || words.length > 6) return false;
  if (term.length < 3 || term.length > 60) return false;
  return /[\p{L}]/u.test(term);
}

export function extractDefinitions(text: string, max = 30): GlossaryEntry[] {
  const sentences = splitSentences(text);
  const out: GlossaryEntry[] = [];
  const seen = new Set<string>();

  const add = (term: string, definition: string) => {
    const t = cleanTerm(term);
    const dfn = definition.trim().replace(/\s+/g, ' ');
    if (!looksLikeTerm(t)) return;
    const k = normalizeConcept(t);
    if (!k || seen.has(k) || dfn.length < 12) return;
    seen.add(k);
    out.push({ term: t, definition: dfn.slice(0, 240) });
  };

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(/^\s*([^:]{3,60}):\s+(.{15,240})$/);
    if (m && looksLikeTerm(m[1]!) && m[1]!.split(/\s+/).length <= 6)
      add(m[1]!, m[2]!);
    if (out.length >= max) return out;
  }

  for (const s of sentences) {
    for (const re of DEF_PATTERNS) {
      const m = s.match(re);
      if (m && m[1]) { add(m[1], s); break; }
    }
    if (out.length >= max) break;
  }
  return out;
}

export function extractAcronyms(text: string): GlossaryEntry[] {
  const out: GlossaryEntry[] = [];
  const seen = new Set<string>();
  const push = (acronym: string, full: string) => {
    const a = acronym.trim();
    const f = full.trim().replace(/\s+/g, ' ');
    if (a.length < 2 || a.length > 7 || f.length < 4 || seen.has(a)) return;
    const initials = f.split(/\s+/)
      .map((w) => w[0]?.toUpperCase() ?? '').join('');
    if (!initials.includes(a[0]!.toUpperCase())) return;
    seen.add(a);
    out.push({
      term: a,
      definition: `${titleCasePhrase(f.toLowerCase())} (abbreviation).`,
    });
  };
  for (const m of text.matchAll(
    /([\p{Lu}][\p{L}]+(?:\s+[\p{L}]+){0,4})\s*\(([\p{Lu}]{2,7})\)/gu,
  )) push(m[2]!, m[1]!);
  for (const m of text.matchAll(
    /\b([\p{Lu}]{2,7})\s*\(([^)]{4,60})\)/gu,
  )) push(m[1]!, m[2]!);
  return out.slice(0, 12);
}

/* ------------------------------------------------------------------ */
/* Bloom-aware objective synthesis                                     */
/* ------------------------------------------------------------------ */

type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

const BLOOM_LADDER: Record<string, BloomLevel[]> = {
  beginner: ['remember', 'understand', 'apply'],
  intermediate: ['understand', 'apply', 'analyze', 'evaluate'],
  advanced: ['apply', 'analyze', 'evaluate', 'create'],
};

const BLOOM_TPL: Record<BloomLevel, { en: string; el: string }[]> = {
  remember: [
    { en: 'Define {{c}} in your own words.', el: 'Όρισε «{{c}}» με δικά σου λόγια.' },
  ],
  understand: [
    { en: 'Explain why {{c}} matters.', el: 'Εξήγησε γιατί το «{{c}}» έχει σημασία.' },
  ],
  apply: [
    { en: 'Apply {{c}} to a worked example.', el: 'Εφάρμοσε «{{c}}» σε παράδειγμα.' },
  ],
  analyze: [
    { en: 'Compare {{c}} with {{c2}}.', el: 'Σύγκρινε «{{c}}» με «{{c2}}».' },
  ],
  evaluate: [
    { en: 'Evaluate when {{c}} fails.', el: 'Αξιολόγησε πότε «{{c}}» αποτυγχάνει.' },
  ],
  create: [
    { en: 'Design a scenario combining {{c}} and {{c2}}.', el: 'Σχεδίασε σενάριο με «{{c}}» και «{{c2}}».' },
  ],
};

export function buildObjectives(
  concepts: string[],
  isGreek: boolean,
  difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
): string[] {
  if (concepts.length === 0) return [];
  const ladder = BLOOM_LADDER[difficulty] ?? BLOOM_LADDER.intermediate!;
  const objectives: string[] = [];
  const used = new Set<string>();

  ladder.forEach((level, idx) => {
    const focus = concepts.find((c) => !used.has(c)) ?? concepts[idx % concepts.length]!;
    used.add(focus);
    const support = concepts.find((c) => c !== focus && !used.has(c))
      ?? concepts[(idx + 1) % concepts.length] ?? focus;
    const choices = BLOOM_TPL[level]!;
    const t = choices[idx % choices.length]!;
    const tpl = isGreek ? t.el : t.en;
    objectives.push(tpl.replace('{{c}}', focus).replace('{{c2}}', support));
  });
  return objectives;
}

