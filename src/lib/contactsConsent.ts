/**
 * Explicit Contacts opt-in — never mix demo mocks into ACL emails without consent.
 */
const CONSENT_KEY = 'memora-contacts-opt-in-v1';

export function hasContactsOptIn(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function grantContactsOptIn(): void {
  try {
    localStorage.setItem(CONSENT_KEY, '1');
    localStorage.setItem(`${CONSENT_KEY}:at`, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function revokeContactsOptIn(): void {
  try {
    localStorage.removeItem(CONSENT_KEY);
    localStorage.removeItem(`${CONSENT_KEY}:at`);
  } catch {
    /* ignore */
  }
}

/** Demo contact emails must never be written to Firestore room ACL. */
export function isDemoContactEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return (
    e.endsWith('@example.com') ||
    e.endsWith('@demo.local') ||
    e.includes('demo+') ||
    e === 'you@demo.local'
  );
}
