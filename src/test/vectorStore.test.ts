import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/apiClient", () => ({
  apiRequest: vi.fn(),
}));

import { chunkText, cosineSimilarity } from "../lib/vectorStore";

describe("cosineSimilarity", () => {
  it("returns expected values for aligned and orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns zero for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe("chunkText", () => {
  it("creates overlapping character chunks for long passages", () => {
    const text = "a".repeat(120);
    const chunks = chunkText(text, 60, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toHaveLength(60);
  });

  it("returns no chunk for blank input", () => {
    expect(chunkText("   ", 10, 2)).toEqual([]);
  });
});
