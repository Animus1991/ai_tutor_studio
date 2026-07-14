import { describe, expect, it } from 'vitest';
import { buildDemoCorpusDocs } from '../demoCorpus';
import { retrieveLexical, assembleRetrieval } from '../rag';

describe('demo offline RAG corpus', () => {
  it('indexes Cournot/Bertrand demo text', () => {
    const corpus = buildDemoCorpusDocs();
    expect(corpus.length).toBeGreaterThan(0);
    expect(corpus.some((c) => /cournot/i.test(c.text))).toBe(true);
  });

  it('retrieves Cournot vs Bertrand from built-in demo corpus', () => {
    const corpus = buildDemoCorpusDocs();
    const hits = retrieveLexical(
      'Explain Cournot vs Bertrand competition',
      corpus,
      3,
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].text.toLowerCase()).toMatch(/cournot/);
    const assembled = assembleRetrieval(hits);
    expect(assembled.excerpt.length).toBeGreaterThan(50);
  });
});
