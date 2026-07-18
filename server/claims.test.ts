import { describe, expect, it } from 'vitest';
import { assertBreakGlassApprover } from './claims.js';
import { HttpError } from './security.js';

describe('claims break-glass two-person rule', () => {
  it('allows a different admin to approve', () => {
    expect(() => assertBreakGlassApprover('admin-a', 'admin-b')).not.toThrow();
  });

  it('rejects self-approval', () => {
    try {
      assertBreakGlassApprover('admin-a', 'admin-a');
      expect.unreachable('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(403);
      expect(String((error as HttpError).message)).toMatch(/Two-person rule/i);
    }
  });

  it('rejects missing ids', () => {
    expect(() => assertBreakGlassApprover('', 'admin-b')).toThrow(HttpError);
  });
});
