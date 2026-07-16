import { describe, it, expect } from 'vitest';
import { BM25 } from '../bm25';
import { chunkDocument, retrieveLexical, tokenize, formatCitation } from '../rag';
import { reviewFSRS, initializeFSRS } from '../fsrs';

describe('BM25', () => {
  const corpus = [
    'Machine learning is a subset of artificial intelligence focused on data.',
    'Spaced repetition improves long-term memory retention for students.',
    'The mitochondria is the powerhouse of the cell in biology.',
  ];

  it('ranks relevant documents higher', () => {
    const bm25 = new BM25(corpus);
    const results = bm25.search('spaced repetition memory', 2);
    expect(results[0].index).toBe(1);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('returns empty scores for unrelated queries', () => {
    const bm25 = new BM25(corpus);
    const results = bm25.search('quantum chromodynamics', 3);
    expect(results.every((r) => r.score === 0)).toBe(true);
  });
});

describe('RAG chunking', () => {
  it('splits long text with overlap', () => {
    const text = 'A'.repeat(2000);
    const chunks = chunkDocument(text, 900, 160);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(900);
  });

  it('tokenizes and filters stopwords', () => {
    const tokens = tokenize('The student is studying biology and chemistry');
    expect(tokens).not.toContain('the');
    expect(tokens).toContain('student');
    expect(tokens).toContain('biology');
  });

  it('retrieves lexical matches from corpus docs', () => {
    const docs = [
      { id: '1', docId: 'd1', docTitle: 'Notes', text: 'Photosynthesis converts light energy.', chunkIndex: 0 },
      { id: '2', docId: 'd1', docTitle: 'Notes', text: 'Cell division occurs in mitosis.', chunkIndex: 1 },
    ];
    const hits = retrieveLexical('photosynthesis light', docs, 1);
    expect(hits.length).toBe(1);
    expect(hits[0].text).toContain('Photosynthesis');
  });

  it('formats citations', () => {
    const cite = formatCitation({
      id: '1', docId: 'd1', docTitle: 'Biology Notes', chunkIndex: 2,
      snippet: 'test', locator: '¶3',
    });
    expect(cite).toBe('[Biology Notes ¶3]');
  });
});

describe('FSRS', () => {
  it('initializes with fsrs.js defaults', () => {
    const data = initializeFSRS();
    expect(data.stability).toBeGreaterThanOrEqual(0);
    expect(data.reps).toBe(0);
    expect(data.next_review).toBeInstanceOf(Date);
  });

  it('increases stability on good rating', () => {
    const initial = initializeFSRS();
    const reviewed = reviewFSRS(initial, 'good');
    expect(reviewed.stability).toBeGreaterThan(initial.stability);
    expect(reviewed.reps).toBe(1);
  });

  it('adjusts scheduling on again rating', () => {
    const warmed = reviewFSRS(initializeFSRS(), 'good');
    const reviewed = reviewFSRS(warmed, 'again');
    expect(reviewed.reps).toBeGreaterThan(warmed.reps);
    expect(reviewed.next_review.getTime()).not.toBe(warmed.next_review.getTime());
  });
});
