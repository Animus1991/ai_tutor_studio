import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetSessionTrustForTests,
  assertDeviceTrusted,
  assertSessionNotRevoked,
  registerTrustedDeviceHandler,
  revokeSessionsHandler,
} from './sessionTrust.js';
import { HttpError } from './security.js';

describe('sessionTrust', () => {
  const prevTrust = process.env.TRUST_DEVICES;

  beforeEach(() => {
    __resetSessionTrustForTests();
  });

  afterEach(() => {
    if (prevTrust === undefined) delete process.env.TRUST_DEVICES;
    else process.env.TRUST_DEVICES = prevTrust;
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

  it('enforces TRUST_DEVICES against registered device ids', async () => {
    process.env.TRUST_DEVICES = 'true';
    await expect(assertDeviceTrusted('u1', {})).rejects.toBeInstanceOf(HttpError);

    const res = {
      locals: { user: { uid: 'u1', claims: {} } },
      json: () => res,
      status: () => res,
    } as never;
    await registerTrustedDeviceHandler(
      { body: { deviceId: 'dev-abc', label: 'laptop' } } as never,
      res,
    );
    await expect(
      assertDeviceTrusted('u1', { device_id: 'dev-abc' }),
    ).resolves.toBeUndefined();
  });

  it('accepts X-Device-Id header when claim is absent', async () => {
    process.env.TRUST_DEVICES = 'true';
    const res = {
      locals: { user: { uid: 'u1', claims: {} } },
      json: () => res,
      status: () => res,
    } as never;
    await registerTrustedDeviceHandler(
      { body: { deviceId: 'header-dev', label: 'phone' } } as never,
      res,
    );
    await expect(assertDeviceTrusted('u1', {}, 'header-dev')).resolves.toBeUndefined();
    await expect(assertDeviceTrusted('u1', {}, 'other')).rejects.toBeInstanceOf(HttpError);
  });
});
