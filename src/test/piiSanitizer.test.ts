import { describe, expect, it } from "vitest";
import { detectAndSanitizePii } from "../lib/piiSanitizer";

describe("detectAndSanitizePii", () => {
  it("redacts every supported PII category and reports counts", () => {
    const result = detectAndSanitizePii(
      "Email jane@example.com, call (212) 555-0199, SSN 123-45-6789, card 4111 1111 1111 1111.",
    );

    expect(result.hasPii).toBe(true);
    expect(result.sanitizedText).not.toContain("jane@example.com");
    expect(result.sanitizedText).not.toContain("123-45-6789");
    expect(Object.fromEntries(result.flags.map(({ type, count }) => [type, count]))).toEqual({
      email: 1,
      phone: 1,
      ssn: 1,
      creditCard: 1,
    });
  });

  it("leaves ordinary study content unchanged", () => {
    const text = "Spaced repetition improves long-term memory.";
    expect(detectAndSanitizePii(text)).toEqual({
      hasPii: false,
      sanitizedText: text,
      flags: [],
    });
  });
});
