export function analyzeSourceQuality(text: string) {
  const words = text.trim().split(/\s+/).length;
  const chars = text.length;
  const uniqueWords = new Set(text.toLowerCase().match(/\b\w+\b/g) || []).size;

  // Simple density metric
  const density = Math.min(100, Math.round((uniqueWords / (words || 1)) * 100 * 1.5));
  
  // Readability (approximate Flesch-Kincaid based on char length)
  const readability = Math.min(100, Math.round((words / ((chars || 1) / 5)) * 100));

  // Overall quality
  const quality = Math.min(100, Math.round((density + readability) / 2));

  return {
    density,
    readability,
    quality,
    needsMoreMaterial: words < 50,
  };
}

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves",
  "also", "however", "therefore", "thus", "hence", "furthermore", "moreover", "still", "anyway", "besides", "instead", "meanwhile", "next", "then", "later", "earlier", "finally", "last", "first", "second", "third", "many", "much", "some", "several", "various", "multiple", "different", "similar", "certain", "particular", "specific", "general", "common", "usual", "regular", "normal", "typical", "standard", "basic", "main", "primary", "major", "minor", "significant", "important", "essential", "crucial", "critical", "key", "core", "fundamental", "vital", "necessary", "required", "needed", "useful", "helpful", "valuable", "beneficial", "effective", "efficient", "successful", "good", "bad", "better", "best", "worse", "worst", "great", "excellent", "terrible", "awful", "horrible", "wonderful", "amazing", "awesome", "fantastic", "incredible", "unbelievable", "interesting", "fascinating", "boring", "dull", "exciting", "thrilling"
]);

export function extractGlossary(text: string): { term: string; count: number }[] {
  // Tokenize and clean
  const tokens = (text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [])
    .filter(w => !STOP_WORDS.has(w));
  
  if (tokens.length === 0) return [];

  const graph: Record<string, Set<string>> = {};
  const windowSize = 4;

  // Build co-occurrence graph
  for (let i = 0; i < tokens.length; i++) {
    const w1 = tokens[i];
    if (!graph[w1]) graph[w1] = new Set();
    for (let j = Math.max(0, i - windowSize); j <= Math.min(tokens.length - 1, i + windowSize); j++) {
      if (i !== j) {
        const w2 = tokens[j];
        if (!graph[w2]) graph[w2] = new Set();
        graph[w1].add(w2);
        graph[w2].add(w1);
      }
    }
  }

  // TextRank iterative scoring
  const d = 0.85;
  const maxIterations = 20;
  const scores: Record<string, number> = {};
  for (const node in graph) scores[node] = 1.0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const newScores: Record<string, number> = {};
    for (const node in graph) {
      let sum = 0;
      for (const neighbor of graph[node]) {
        sum += scores[neighbor] / graph[neighbor].size;
      }
      newScores[node] = (1 - d) + d * sum;
    }
    Object.assign(scores, newScores);
  }

  // Find multi-word phrases based on adjacent high-scoring words
  const phraseScores: Record<string, number> = {};
  const phrases: Record<string, number> = {}; // keep track of raw frequencies
  
  for (let i = 0; i < tokens.length - 1; i++) {
    const w1 = tokens[i];
    const w2 = tokens[i+1];
    const phrase = `${w1} ${w2}`;
    phrases[phrase] = (phrases[phrase] || 0) + 1;
    phraseScores[phrase] = scores[w1] + scores[w2];
  }

  // Sort and combine single words and bigrams
  const sortedWords = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term, score]) => ({ term, count: Math.round(score * 10) }));
    
  const sortedBigrams = Object.entries(phraseScores)
    .sort((a, b) => b[1] - a[1])
    .filter(([phrase]) => phrases[phrase] > 1)
    .slice(0, 5)
    .map(([term, score]) => ({ term, count: Math.round(score * 10) }));

  const combined = [...sortedWords, ...sortedBigrams]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(({ term, count }) => ({ term, count }));

  return combined;
}
