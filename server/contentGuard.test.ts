import { describe, expect, it } from 'vitest';
import {
  assertUploadAllowed,
  enforceExtractBudgets,
  sniffMime,
  MAX_EXTRACT_CHARS,
} from './contentGuard.js';
import { HttpError } from './security.js';

describe('contentGuard', () => {
  it('sniffs PDF and PNG magic bytes', () => {
    const pdf = Buffer.from('%PDF-1.4 rest');
    expect(sniffMime(pdf)).toBe('application/pdf');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(sniffMime(png)).toBe('image/png');
  });

  it('rejects MIME mismatch for declared PDF', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(() => assertUploadAllowed(png, 'application/pdf', 'ingest')).toThrow(HttpError);
  });

  it('allows text ingest', () => {
    const text = Buffer.from('Hello study notes\nsecond line');
    const r = assertUploadAllowed(text, 'text/plain', 'ingest');
    expect(r.mime).toContain('text');
  });

  it('enforces extract char budget', () => {
    const big = 'x'.repeat(MAX_EXTRACT_CHARS + 100);
    const r = enforceExtractBudgets(big);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBe(MAX_EXTRACT_CHARS);
  });

  it('rejects excessive page counts', () => {
    expect(() => enforceExtractBudgets('hi', { pageCount: 9999 })).toThrow(HttpError);
  });
});
