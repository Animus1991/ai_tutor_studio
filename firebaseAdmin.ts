import type { Firestore } from 'firebase-admin/firestore';

export interface TenantMetrics {
  platformAuditTotal: number;
  platformUsers7d: number;
  totalTasks: number;
  totalCourses: number;
  firestoreEnabled: boolean;
}

let db: Firestore | null | undefined;

export async function getAdminFirestore(): Promise<Firestore | null> {
  if (db !== undefined) return db;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    db = null;
    return null;
  }
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    if (getApps().length === 0) {
      initializeApp({ credential: cert(JSON.parse(json)) });
    }
    db = getFirestore();
    return db;
  } catch (err) {
    console.warn('[Memora] Firebase Admin init failed:', err);
    db = null;
    return null;
  }
}

export async function persistAuditToFirestore(event: Record<string, unknown>): Promise<void> {
  const firestore = await getAdminFirestore();
  if (!firestore || !event.id) return;
  await firestore.collection('platform_audit').doc(String(event.id)).set({
    ...event,
    storedAt: new Date().toISOString(),
  });
}

export async function fetchTenantMetricsFromFirestore(): Promise<TenantMetrics | null> {
  const firestore = await getAdminFirestore();
  if (!firestore) return null;

  const recentSnap = await firestore
    .collection('platform_audit')
    .orderBy('timestamp', 'desc')
    .limit(500)
    .get();

  const cutoff7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const users7d = new Set<string>();
  for (const doc of recentSnap.docs) {
    const data = doc.data();
    if (new Date(String(data.timestamp)).getTime() >= cutoff7d) {
      users7d.add(String(data.userId ?? 'unknown'));
    }
  }

  let totalTasks = 0;
  let totalCourses = 0;
  try {
    const tasks = await firestore.collectionGroup('tasks').count().get();
    totalTasks = tasks.data().count;
  } catch {
    /* collection group index may be missing */
  }
  try {
    const courses = await firestore.collectionGroup('courses').count().get();
    totalCourses = courses.data().count;
  } catch {
    /* collection group index may be missing */
  }

  return {
    platformAuditTotal: recentSnap.size,
    platformUsers7d: users7d.size,
    totalTasks,
    totalCourses,
    firestoreEnabled: true,
  };
}

export async function fetchPlatformAuditFromFirestore(limit = 100): Promise<Record<string, unknown>[]> {
  const firestore = await getAdminFirestore();
  if (!firestore) return [];
  const snap = await firestore
    .collection('platform_audit')
    .orderBy('timestamp', 'desc')
    .limit(Math.min(limit, 200))
    .get();
  return snap.docs.map((d) => d.data());
}
