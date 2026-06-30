export interface TextAnalysis {
  wordCount: number;
  readingTimeMinutes: number;
  readabilityScore: number;
  densityScore: number;
  keywords: { term: string; count: number }[];
}

export function analyzeText(text: string): TextAnalysis {
  if (!text || text.trim().length === 0) return { wordCount: 0, readingTimeMinutes: 0, readabilityScore: 0, densityScore: 0, keywords: [] };
  
  const words: string[] = text.toLowerCase().match(/\b\w+\b/g) || [];
  const wordCount = words.length;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  // Basic Readability (Flesch heuristic simplified)
  const avgWordsPerSentence = wordCount / Math.max(1, sentences.length);
  const readabilityScore = Math.max(0, Math.min(100, 100 - (avgWordsPerSentence - 15) * 2));
  
  // Basic Density (Unique words ratio)
  const uniqueWords = new Set(words);
  const densityScore = Math.max(0, Math.min(100, (uniqueWords.size / Math.max(1, wordCount)) * 150));

  // Common stopwords
  const stopwords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'in', 'of', 'for', 'with', 'as', 'by', 'this', 'that', 'it', 'are', 'be', 'from', 'or', 'an', 'was', 'were', 'will', 'would', 'could', 'should', 'have', 'has', 'had', 'what', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'don', 'should', 'now', 'their', 'they', 'we', 'our', 'you', 'your'
  ]);
  
  const wordFreq: Record<string, number> = {};
  words.forEach(w => {
    if (w.length > 3 && !stopwords.has(w)) {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
  });

  const keywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term, count]) => ({ term, count }));

  return {
    wordCount,
    readingTimeMinutes: Math.ceil(wordCount / 200), // ~200 wpm average reading speed
    readabilityScore: Math.round(readabilityScore),
    densityScore: Math.round(densityScore),
    keywords
  };
}
