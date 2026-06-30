// Regex patterns for detecting common PII types
const piiPatterns = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
  ssn: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g
};

export interface PiiDetectionResult {
  hasPii: boolean;
  sanitizedText: string;
  flags: {
    type: string;
    count: number;
  }[];
}

export function detectAndSanitizePii(text: string): PiiDetectionResult {
  let sanitizedText = text;
  const flags: { type: string; count: number }[] = [];
  let hasPii = false;

  for (const [type, pattern] of Object.entries(piiPatterns)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      hasPii = true;
      flags.push({ type, count: matches.length });
      sanitizedText = sanitizedText.replace(pattern, `[REDACTED ${type.toUpperCase()}]`);
    }
  }

  return {
    hasPii,
    sanitizedText,
    flags
  };
}
