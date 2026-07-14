import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  type UserCredential,
} from "firebase/auth";
import { auth } from "./firebase";

let isSigningIn = false;
let cachedAccessToken: string | null = null;

/** getRedirectResult() is single-use — share one promise (React StrictMode calls twice). */
let redirectResultPromise: Promise<{
  user: User;
  accessToken: string | null;
} | null> | null = null;

export function getAuthErrorCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

/** User dismissed the flow — only trust when not on a broken localhost popup. */
export function isCancelledAuthError(err: unknown): boolean {
  const code = getAuthErrorCode(err);
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  );
}

export function describeAuthError(err: unknown): string {
  const code = getAuthErrorCode(err);
  switch (code) {
    case 'auth/unauthorized-domain':
      return 'Το domain δεν είναι εξουσιοδοτημένο. Firebase Console → Authentication → Settings → Authorized domains → πρόσθεσε μόνο: localhost (χωρίς http ή port). Επίσης Google Cloud → Credentials → OAuth client → Authorized JavaScript origins → http://localhost:3010';
    case 'auth/popup-blocked':
      return 'Ο browser μπλόκαρε το popup. Επίτρεψε popups για localhost ή δοκίμασε ξανά (θα γίνει redirect).';
    case 'auth/operation-not-allowed':
      return 'Το Google sign-in δεν είναι ενεργό. Firebase Console → Authentication → Sign-in method → Google → Enable';
    case 'auth/popup-closed-by-user':
      return 'Η σύνδεση Google διακόπηκε. Αν δεν το έκλεισες εσύ: πρόσθεσε localhost στα Authorized domains και Enable Google provider στο Firebase.';
    default:
      return code
        ? `Google sign-in απέτυχε (${code})`
        : 'Google sign-in απέτυχε';
  }
}

function preferRedirectSignIn(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function createGoogleProvider(includeClassroomScope = false): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (includeClassroomScope) {
    provider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');
  }
  return provider;
}

function sessionFromCredential(result: UserCredential): {
  user: User;
  accessToken: string | null;
} {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  cachedAccessToken = credential?.accessToken ?? null;
  return { user: result.user, accessToken: cachedAccessToken };
}

/** Call once on app load to finish signInWithRedirect round-trip. */
export function completeGoogleRedirectSignIn(): Promise<{
  user: User;
  accessToken: string | null;
} | null> {
  if (!redirectResultPromise) {
    redirectResultPromise = (async () => {
      try {
        isSigningIn = true;
        const result = await getRedirectResult(auth);
        try {
          sessionStorage.removeItem('memora_google_signin_pending');
        } catch {
          /* ignore */
        }
        if (!result) return null;
        return sessionFromCredential(result);
      } catch (error: unknown) {
        console.error('Redirect sign-in error:', error);
        throw error;
      } finally {
        isSigningIn = false;
      }
    })();
  }
  return redirectResultPromise;
}

export type AuthBootstrapCallbacks = {
  onRedirectSuccess?: (session: {
    user: User;
    accessToken: string | null;
  }) => void;
  onRedirectError?: (error: unknown) => void;
  onAuthSuccess?: (user: User, token: string) => void;
  onAuthFailure?: () => void;
};

type AuthListener = AuthBootstrapCallbacks;
const authListeners = new Set<AuthListener>();
let authBootstrapPromise: Promise<void> | null = null;
let authStateUnsub: (() => void) | null = null;

function notifyAuthSuccess(user: User, token: string) {
  for (const listener of authListeners) {
    listener.onAuthSuccess?.(user, token);
  }
}

function notifyAuthFailure() {
  if (isSigningIn) return;
  for (const listener of authListeners) {
    listener.onAuthFailure?.();
  }
}

async function ensureAuthBootstrap(): Promise<void> {
  if (authBootstrapPromise) return authBootstrapPromise;

  authBootstrapPromise = (async () => {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }

    if (!authStateUnsub) {
      authStateUnsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          void user.getIdToken().then((idToken) => {
            notifyAuthSuccess(user, idToken);
          });
        } else {
          cachedAccessToken = null;
          notifyAuthFailure();
        }
      });
    }
  })();

  return authBootstrapPromise;
}

/**
 * One-shot auth bootstrap: redirect result → authStateReady → listener.
 * Avoids login-loop from StrictMode double getRedirectResult or early null user.
 */
export async function bootstrapAuth(
  callbacks: AuthBootstrapCallbacks,
): Promise<() => void> {
  authListeners.add(callbacks);

  try {
    const redirectSession = await completeGoogleRedirectSignIn();
    if (redirectSession) {
      callbacks.onRedirectSuccess?.(redirectSession);
    }
  } catch (error) {
    callbacks.onRedirectError?.(error);
  }

  await ensureAuthBootstrap();

  const user = auth.currentUser;
  if (user) {
    const idToken = await user.getIdToken();
    callbacks.onAuthSuccess?.(user, idToken);
  } else if (!isSigningIn) {
    callbacks.onAuthFailure?.();
  }

  return () => {
    authListeners.delete(callbacks);
  };
}

/** @deprecated Use bootstrapAuth — kept for tests */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
) => {
  let unsubscribe = () => {};
  void bootstrapAuth({ onAuthSuccess, onAuthFailure }).then((unsub) => {
    unsubscribe = unsub;
  });
  return () => unsubscribe();
};

/**
 * Google sign-in. On localhost uses full-page redirect (reliable vs popup/CSP).
 * Returns null when redirect started (page will reload).
 */
export const googleSignIn = async (opts?: {
  includeClassroomScope?: boolean;
}): Promise<{
  user: User;
  accessToken: string | null;
} | null> => {
  const provider = createGoogleProvider(opts?.includeClassroomScope ?? false);

  try {
    isSigningIn = true;

    if (preferRedirectSignIn()) {
      try {
        sessionStorage.setItem('memora_google_signin_pending', '1');
      } catch {
        /* ignore */
      }
      await signInWithRedirect(auth, provider);
      return null;
    }

    const result = await signInWithPopup(auth, provider);
    return sessionFromCredential(result);
  } catch (error: unknown) {
    if (!isCancelledAuthError(error)) {
      console.error("Sign in error:", error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/** Re-auth with Classroom scope (Library import). */
export const googleSignInForClassroom = () =>
  googleSignIn({ includeClassroomScope: true });

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
