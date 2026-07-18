import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('deviceTrust', () => {
  beforeEach(() => {
    vi.resetModules();
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
    vi.stubGlobal('crypto', { randomUUID: () => 'test-device-uuid-0001' });
  });

  it('creates a stable device id', async () => {
    const { getOrCreateDeviceId } = await import('../deviceTrust');
    const a = getOrCreateDeviceId();
    const b = getOrCreateDeviceId();
    expect(a).toBe('test-device-uuid-0001');
    expect(b).toBe(a);
  });
});
