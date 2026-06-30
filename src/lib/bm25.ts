export class BM25 {
  private k1: number;
  private b: number;
  private docLengths: number[];
  private docFrequencies: Record<string, number>;
  private termFrequencies: Record<string, number>[];
  private avgDocLength: number;
  private chunks: string[];

  constructor(chunks: string[], k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.chunks = chunks;
    this.docLengths = [];
    this.docFrequencies = {};
    this.termFrequencies = [];

    let totalLength = 0;

    chunks.forEach((chunk, idx) => {
      const words = this.tokenize(chunk);
      const docLen = words.length;
      this.docLengths.push(docLen);
      totalLength += docLen;

      const tf: Record<string, number> = {};
      const uniqueWords = new Set<string>();

      words.forEach(word => {
        tf[word] = (tf[word] || 0) + 1;
        uniqueWords.add(word);
      });

      this.termFrequencies.push(tf);

      uniqueWords.forEach(word => {
        this.docFrequencies[word] = (this.docFrequencies[word] || 0) + 1;
      });
    });

    this.avgDocLength = chunks.length > 0 ? totalLength / chunks.length : 0;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0);
  }

  private idf(word: string): number {
    const n = this.chunks.length;
    const df = this.docFrequencies[word] || 0;
    // Standard BM25 IDF formula
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  public search(query: string, topK: number = 3): { chunk: string; score: number; index: number }[] {
    const queryWords = this.tokenize(query);
    const scores = this.chunks.map((chunk, idx) => {
      let score = 0;
      const docLen = this.docLengths[idx];
      const tf = this.termFrequencies[idx];

      queryWords.forEach(word => {
        if (!tf[word]) return;
        const termFreq = tf[word];
        const idfScore = this.idf(word);
        
        const num = termFreq * (this.k1 + 1);
        const den = termFreq + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
        
        score += idfScore * (num / den);
      });

      return { chunk, score, index: idx };
    });

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

export function createDocumentChunks(text: string): string[] {
  return text.split(/\n\s*\n/).filter(c => c.trim().length > 50);
}
