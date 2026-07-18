import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  grantContactsOptIn,
  hasContactsOptIn,
  isDemoContactEmail,
  revokeContactsOptIn,
} from '../contactsConsent';

describe('contactsConsent', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  it('defaults to no opt-in and toggles grant/revoke', () => {
    expect(hasContactsOptIn()).toBe(false);
    grantContactsOptIn();
    expect(hasContactsOptIn()).toBe(true);
    revokeContactsOptIn();
    expect(hasContactsOptIn()).toBe(false);
  });

  it('flags demo contact emails that must never enter room ACL', () => {
    expect(isDemoContactEmail('alice@example.com')).toBe(true);
    expect(isDemoContactEmail('you@demo.local')).toBe(true);
    expect(isDemoContactEmail('demo+buddy@school.edu')).toBe(true);
    expect(isDemoContactEmail('student@university.edu')).toBe(false);
  });
});
