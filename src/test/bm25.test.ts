import { describe, expect, it } from "vitest";
import { BM25, createDocumentChunks } from "../lib/bm25";

describe("BM25", () => {
  it("ranks the chunk containing the query terms first", () => {
    const chunks = [
      "Photosynthesis converts light energy into chemical energy in plants.",
      "Spaced repetition schedules reviews at increasing intervals.",
      "The mitochondrion produces ATP through cellular respiration.",
    ];

    const results = new BM25(chunks).search("light energy plants", 2);

    expect(results).toHaveLength(2);
    expect(results[0].index).toBe(0);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("handles empty corpora without invalid scores", () => {
    expect(new BM25([]).search("anything")).toEqual([]);
  });
});

describe("createDocumentChunks", () => {
  it("keeps substantial paragraphs and drops empty or tiny fragments", () => {
    const longParagraph = "A".repeat(60);
    expect(createDocumentChunks(`short\n\n${longParagraph}\n\n`)).toEqual([
      longParagraph,
    ]);
  });
});
