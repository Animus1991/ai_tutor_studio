import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetSessionTrustForTests,
  assertSessionNotRevoked,
  revokeSessionsHandler,
} from './sessionTrust.js';
import { HttpError } from './security.js';

describe('sessionTrust', () => {
  beforeEach(() => {
    __resetSessionTrustForTests();
  });

  it('allows tokens when no revocation floor exists', async () => {
    await expect(
      assertSessionNotRevoked('u1', { auth_time: Math.floor(Date.now() / 1000) - 10 }),
    ).resolves.toBeUndefined();
  });

  it('rejects tokens older than revoke floor', async () => {
    const res = {
      locals: { user: { uid: 'u1', claims: {} } },
      json: () => res,
      status: () => res,
    } as never;
    await revokeSessionsHandler({ body: {} } as never, res);
    await expect(
      assertSessionNotRevoked('u1', { auth_time: Math.floor(Date.now() / 1000) - 60 }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
