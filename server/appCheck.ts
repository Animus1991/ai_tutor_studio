/**
 * Optional Firebase App Check verification.
 * Enforce with APP_CHECK_ENFORCE=true once site keys are configured.
 */
import type { RequestHandler } from 'express';
import { HttpError } from './security.js';

let appCheckReady: Promise<boolean> | null = null;

async function ensureAppCheck(): Promise<boolean> {
  if (!appCheckReady) {
    appCheckReady = (async () => {
      const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (!json) return false;
      try {
        const { initializeApp, cert, getApps } = await import('firebase-admin/app');
        if (getApps().length === 0) {
          initializeApp({ credential: cert(JSON.parse(json)) });
        }
        return true;
      } catch {
        return false;
      }
    })();
  }
  return appCheckReady;
}

export function createAppCheckMiddleware(enforce: boolean): RequestHandler {
  return async (req, res, next) => {
    const token = String(req.header('x-firebase-appcheck') ?? '').trim();
    if (!token) {
      if (enforce) {
        next(new HttpError(401, 'App Check token required'));
        return;
      }
      next();
      return;
    }

    const ready = await ensureAppCheck();
    if (!ready) {
      if (enforce) {
        next(new HttpError(503, 'App Check enforcement unavailable (Admin SDK)'));
        return;
      }
      next();
      return;
    }

    try {
      const { getAppCheck } = await import('firebase-admin/app-check');
      await getAppCheck().verifyToken(token);
      res.locals.appCheck = { verified: true };
      next();
    } catch {
      if (enforce) {
        next(new HttpError(401, 'Invalid App Check token'));
        return;
      }
      // Soft mode: ignore invalid tokens so preview keeps working
      next();
    }
  };
}
