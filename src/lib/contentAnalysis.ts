import { extractGlossary } from '../utils/nlp';
import { detectDocumentSections, splitStructuredParagraphs } from './textSegmentation';
import type { CourseOutline, CourseTopic, GlossaryEntry } from './courseTypes';

const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'have', 'has', 'been',
  'και', 'το', 'τα', 'η', 'οι', 'του', 'της', 'για', 'με', 'σε', 'που', 'να', 'είναι',
]);

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\w\u0370-\u03ff]+/g) ?? [];
}

function rakeScores(text: string): Map<string, number> {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const phraseScores = new Map<string, number>();
  const wordDegree = new Map<string, number>();
  const wordFreq = new Map<string, number>();

  for (const sentence of sentences) {
    const words = tokenize(sentence).filter((w) => w.length > 2 && !STOP.has(w));
    const phrases: string[][] = [[]];
    for (const w of words) {
      if (STOP.has(w)) {
        if (phrases[phrases.length - 1].length) phrases.push([]);
      } else {
        phrases[phrases.length - 1].push(w);
      }
    }
    for (const phrase of phrases) {
      if (phrase.length === 0) continue;
      const key = phrase.join(' ');
      for (const w of phrase) {
        wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
        wordDegree.set(w, (wordDegree.get(w) ?? 0) + phrase.length);
      }
      let score = 0;
      for (const w of phrase) {
        const f = wordFreq.get(w) ?? 1;
        score += (wordDegree.get(w) ?? 0) / f;
      }
      phraseScores.set(key, Math.max(phraseScores.get(key) ?? 0, score / phrase.length));
    }
  }
  return phraseScores;
}

function textRankScores(text: string, window = 4): Map<string, number> {
  const words = tokenize(text).filter((w) => w.length > 2 && !STOP.has(w));
  const graph = new Map<string, Set<string>>();
  for (let i = 0; i < words.length; i++) {
    if (!graph.has(words[i])) graph.set(words[i], new Set());
    for (let j = Math.max(0, i - window); j <= Math.min(words.length - 1, i + window); j++) {
      if (i !== j) {
        graph.get(words[i])!.add(words[j]);
        if (!graph.has(words[j])) graph.set(words[j], new Set());
        graph.get(words[j])!.add(words[i]);
      }
    }
  }
  const scores = new Map<string, number>();
  for (const n of graph.keys()) scores.set(n, 1);
  const d = 0.85;
  for (let iter = 0; iter < 30; iter++) {
    const next = new Map<string, number>();
    for (const [node, neighbors] of graph) {
      let sum = 0;
      for (const nb of neighbors) {
        const nbNeighbors = graph.get(nb);
        if (nbNeighbors && nbNeighbors.size) sum += (scores.get(nb) ?? 0) / nbNeighbors.size;
      }
      next.set(node, (1 - d) + d * sum);
    }
    for (const [k, v] of next) scores.set(k, v);
  }
  return scores;
}

export function rankKeyphrases(text: string, limit = 20): { phrase: string; score: number }[] {
  const rake = rakeScores(text);
  const tr = textRankScores(text);
  const combined = new Map<string, number>();
  const maxRake = Math.max(...rake.values(), 1);
  const maxTr = Math.max(...tr.values(), 1);

  for (const [phrase, score] of rake) {
    const words = phrase.split(' ');
    const trScore = words.reduce((s, w) => s + (tr.get(w) ?? 0), 0) / words.length;
    combined.set(phrase, 0.6 * (score / maxRake) + 0.4 * (trScore / maxTr));
  }
  for (const [word, score] of tr) {
    if (!combined.has(word)) combined.set(word, 0.4 * (score / maxTr));
  }

  return [...combined.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([phrase, score]) => ({ phrase, score }));
}

function extractDefinitions(text: string): GlossaryEntry[] {
  const defs: GlossaryEntry[] = [];
  const patterns = [
    /(?:^|\n)([A-ZΑ-Ω][\w\s-]{2,40})\s*(?:is|are|means|refers to|—|:)\s*([^\n.]{20,200})/gim,
    /(?:^|\n)([\w\s]{3,30})\s*:\s*([^\n.]{20,200})/gim,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      defs.push({ term: m[1].trim(), definition: m[2].trim() });
    }
  }
  const seen = new Set<string>();
  return defs.filter((d) => {
    const k = d.term.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 30);
}

export function analyzeContentToOutline(text: string, fileName?: string): CourseOutline {
  const sections = detectDocumentSections(text);
  const keyphrases = rankKeyphrases(text, 25);
  const glossaryFromDefs = extractDefinitions(text);
  const glossaryFromNlp = extractGlossary(text).slice(0, 10).map((g) => ({
    term: g.term,
    definition: `Key concept appearing ${g.count} times in source material.`,
  }));

  const glossaryMap = new Map<string, GlossaryEntry>();
  for (const g of [...glossaryFromDefs, ...glossaryFromNlp]) {
    glossaryMap.set(g.term.toLowerCase(), g);
  }
  const glossary = [...glossaryMap.values()].slice(0, 25);

  const sourceSections = sections.length >= 2 ? sections : splitStructuredParagraphs(text).map((body, i) => ({
    id: `p-${i}`,
    title: keyphrases[i]?.phrase ?? `Topic ${i + 1}`,
    body,
    kind: 'paragraph' as const,
    startOffset: 0,
  }));

  const topics: CourseTopic[] = sourceSections.slice(0, 12).map((sec, i) => {
    const kp = keyphrases[i]?.phrase ?? sec.title;
    const sentences = sec.body.match(/[^.!?]+[.!?]+/g) ?? [sec.body];
    return {
      id: `topic-${i}`,
      title: sec.title.slice(0, 100) || kp,
      description: sentences[0]?.trim().slice(0, 300) ?? sec.body.slice(0, 300),
      objectives: [
        `Understand ${kp}`,
        `Apply concepts from ${sec.title}`,
      ],
      durationMinutes: Math.min(45, Math.max(15, Math.ceil(sec.body.split(/\s+/).length / 150))),
    };
  });

  if (topics.length === 0) {
    topics.push({
      id: 'topic-0',
      title: fileName ?? 'Uploaded Material',
      description: text.slice(0, 300),
      objectives: ['Review uploaded content'],
      durationMinutes: 25,
    });
  }

  const prerequisites = keyphrases.slice(0, 3).map((k) => k.phrase);

  return {
    title: fileName?.replace(/\.[^.]+$/, '') ?? 'New Course',
    topics,
    glossary,
    prerequisites,
  };
}
