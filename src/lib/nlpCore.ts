/**
 * Core NLP primitives shared across content analysis modules.
 */

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}''-]*/gu;
export { WORD_RE };

export const STOPWORDS = new Set([
  'the','and','for','with','that','this','from','are','was','were','have','has','been',
  'but','not','you','all','can','had','her','one','our','out','get','his','how',
  'its','may','new','now','old','see','way','who','did','let','say','she','too','use',
  'about','after','being','could','every','their','these','those','which','would',
  'there','will','more','when','than','very','what','just','also','into','over',
  'some','then','them','each','only','such','like','other','make','many','well',
  'should','where','και','το','τα','η','οι','του','της','για','με','σε','που',
  'να','είναι','στο','στη','στην','στον','ένα','μια','αυτό','αυτή','αυτός',
  'από','ως','ότι','δεν','θα','έχει','μου','σου','τους','μας','σας','κάθε',
  'πολύ','αλλά','αν',
]);

export const PHRASE_BREAKERS = new Set([
  'where','when','which','who','whom','whose','whether','while','because',
  'however','therefore','thus','hence','also','such','using','used','use',
  'given','within','between','among','through','via','into','provides',
  'provide','how','why','what','very',
  'όπου','όταν','οποίο','οποία','οποίος','επειδή','ώστε','καθώς','επίσης',
]);

export function isContentWord(w: string): boolean {
  return w.length >= 2 && !STOPWORDS.has(w) && !PHRASE_BREAKERS.has(w) && !/^\d+$/.test(w);
}

export function contentTokens(text: string, cap = 20000): string[] {
  const out: string[] = [];
  for (const m of text.toLowerCase().matchAll(WORD_RE)) {
    const w = m[0]!.replace(/^[-'']+|[-'']+$/g, '');
    if (w.length >= 3 && isContentWord(w)) out.push(w);
    if (out.length >= cap) break;
  }
  return out;
}

export function stemLite(word: string): string {
  let w = word.toLowerCase();
  if (/[a-z]/.test(w)) {
    if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`;
    else if (/(sses|shes|ches|xes|zes)$/.test(w)) w = w.slice(0, -2);
    else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) w = w.slice(0, -1);
    if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
    else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  } else {
    w = w.replace(/(ς|ν|ου|ων|ας|ες|οι|η|ης|α)$/u,
      (mt) => (w.length - mt.length >= 3 ? '' : mt));
  }
  return w;
}

export function normalizeConcept(phrase: string): string {
  return phrase.toLowerCase().split(/\s+/).map(stemLite).filter(Boolean).join(' ');
}

export function titleCasePhrase(phrase: string): string {
  return phrase.split(/\s+/)
    .map((w) => w.length <= 2 && !/^\d/.test(w)
      ? w.toUpperCase()
      : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function splitSentences(text: string): string[] {
  const n = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  if (!n) return [];
  const parts = n.split(/(?<=[.!?;·])\s+(?=[""'([]?[\p{Lu}\p{N}])/u);
  return parts.map((s) => s.trim()).filter((s) => s.length >= 12 && /[\p{L}]/u.test(s));
}
