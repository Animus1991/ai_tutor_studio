/**
 * Subject classification + difficulty estimation from raw text.
 */

import { WORD_RE, splitSentences } from './nlpCore';

const SUBJECT_LEXICON: { subject: string; terms: string[] }[] = [
  { subject: 'Economics', terms: ['supply','demand','elasticity','monopoly','oligopoly','market','price','cournot','bertrand','utility','gdp','inflation','equilibrium','welfare','ζήτηση','προσφορά','αγορά','τιμή'] },
  { subject: 'Programming', terms: ['function','variable','array','loop','class','python','pandas','numpy','algorithm','compiler','syntax','object','method','recursion','συνάρτηση','μεταβλητή','αλγόριθμος'] },
  { subject: 'Statistics', terms: ['probability','distribution','variance','regression','hypothesis','sample','mean','median','correlation','bayes','πιθανότητα','κατανομή','διασπορά'] },
  { subject: 'Mathematics', terms: ['theorem','integral','derivative','matrix','vector','equation','limit','proof','polynomial','ολοκλήρωμα','παράγωγος','εξίσωση','θεώρημα'] },
  { subject: 'Physics', terms: ['force','energy','velocity','momentum','quantum','mass','acceleration','electron','wave','particle','δύναμη','ενέργεια','ταχύτητα'] },
  { subject: 'Chemistry', terms: ['molecule','atom','reaction','bond','acid','compound','ion','oxidation','mole','μόριο','άτομο','αντίδραση'] },
  { subject: 'Biology', terms: ['cell','protein','dna','gene','enzyme','organism','evolution','membrane','mitochondria','tissue','κύτταρο','γονίδιο','πρωτεΐνη'] },
  { subject: 'Philosophy', terms: ['ethics','epistemology','metaphysics','argument','truth','morality','logic','existence','knowledge','ηθική','γνώση','επιχείρημα'] },
  { subject: 'History', terms: ['war','empire','revolution','century','treaty','dynasty','civilization','colonial','πόλεμος','αυτοκρατορία','επανάσταση'] },
  { subject: 'Psychology', terms: ['behavior','cognition','memory','perception','emotion','conditioning','personality','stimulus','συμπεριφορά','μνήμη','αντίληψη'] },
  { subject: 'Law', terms: ['contract','liability','statute','tort','plaintiff','jurisdiction','defendant','legislation','νόμος','σύμβαση','ευθύνη'] },
  { subject: 'Medicine', terms: ['patient','diagnosis','symptom','treatment','disease','clinical','therapy','syndrome','ασθενής','διάγνωση','σύμπτωμα'] },
];

export function inferSubject(text: string): string {
  const lower = text.toLowerCase();
  const scored = SUBJECT_LEXICON.map(({ subject, terms }) => {
    let uniqueHits = 0;
    for (const term of terms) {
      const re = new RegExp(
        `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i',
      );
      if (re.test(lower)) uniqueHits += 1;
    }
    return { subject, uniqueHits };
  }).sort((a, b) => b.uniqueHits - a.uniqueHits);

  const best = scored[0];
  const runnerUp = scored[1];
  if (!best || best.uniqueHits < 2) return 'General Studies';
  if (runnerUp && best.uniqueHits === runnerUp.uniqueHits) return 'General Studies';
  return best.subject;
}

export function estimateDifficulty(
  text: string,
): 'beginner' | 'intermediate' | 'advanced' {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 'intermediate';
  const words: string[] = text.match(WORD_RE) ?? [];
  const avgSentenceWords = words.length / sentences.length;
  const longWordRatio = words.filter((w) => w.length >= 9).length
    / Math.max(1, words.length);
  const formulaDensity =
    (text.match(/[=∑∫∂√≤≥≠→±×÷]|\b\d+\.\d+\b/g)?.length ?? 0)
    / Math.max(1, sentences.length);

  let score = 0;
  if (avgSentenceWords > 24) score += 2;
  else if (avgSentenceWords > 17) score += 1;
  if (longWordRatio > 0.22) score += 2;
  else if (longWordRatio > 0.14) score += 1;
  if (formulaDensity > 0.4) score += 1;

  if (score >= 4) return 'advanced';
  if (score >= 2) return 'intermediate';
  return 'beginner';
}
