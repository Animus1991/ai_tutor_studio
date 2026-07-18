/**
 * Shared Firebase ID-token verification (HTTP middleware + Yjs WS).
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

export type VerifiedFirebaseUser = {
  uid: string;
  claims: JWTPayload;
};

export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
): Promise<VerifiedFirebaseUser> {
  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
    algorithms: ['RS256'],
  });
  if (!payload.sub) {
    throw new Error('Token does not contain a subject');
  }
  return { uid: payload.sub, claims: payload };
}

export function extractBearerToken(authorization: string | undefined): string | null {
  const m = authorization?.match(/^Bearer (.+)$/i);
  return m?.[1] ?? null;
}
