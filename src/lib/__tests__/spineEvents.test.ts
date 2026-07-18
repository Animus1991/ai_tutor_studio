import { describe, expect, it } from 'vitest';
import { privacyExpireAt } from '../spineEvents';

describe('spineEvents', () => {
  it('privacyExpireAt is ~90 days ahead', () => {
    const iso = privacyExpireAt(90);
    const delta = Date.parse(iso) - Date.now();
    expect(delta).toBeGreaterThan(80 * 24 * 60 * 60 * 1000);
    expect(delta).toBeLessThan(100 * 24 * 60 * 60 * 1000);
  });
});
