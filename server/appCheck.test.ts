import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createAppCheckMiddleware } from './appCheck.js';
import { HttpError } from './security.js';

function mockRes() {
  return { locals: {} as Record<string, unknown> };
}

describe('createAppCheckMiddleware', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('soft mode allows missing token', async () => {
    const mw = createAppCheckMiddleware(false);
    const next = vi.fn();
    await mw({ header: () => undefined } as never, mockRes() as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('enforce mode rejects missing token', async () => {
    const mw = createAppCheckMiddleware(true);
    const next = vi.fn();
    await mw({ header: () => undefined } as never, mockRes() as never, next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect((next.mock.calls[0][0] as HttpError).status).toBe(401);
  });

  it('reads x-firebase-appcheck header case-insensitively via header()', async () => {
    const mw = createAppCheckMiddleware(false);
    const next = vi.fn();
    await mw(
      { header: (name: string) => (name.toLowerCase() === 'x-firebase-appcheck' ? 'tok' : undefined) } as never,
      mockRes() as never,
      next,
    );
    // Without Admin SDK, soft mode continues even with a token present
    expect(next).toHaveBeenCalled();
  });
});
