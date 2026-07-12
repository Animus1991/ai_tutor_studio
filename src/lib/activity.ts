import { auth, db } from "./firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, Timestamp } from "firebase/firestore";
import {
  appendDemoActivity,
  isDemoModeActive,
  loadDemoActivities,
  type DemoActivity,
} from "./demoStorage";

export async function logActivity(title: string, type: 'study' | 'upload' | 'collab' | 'task' | 'other') {
  if (isDemoModeActive()) {
    await appendDemoActivity(title, type);
    return;
  }
  if (!auth.currentUser) return;
  try {
    await addDoc(collection(db, "users", auth.currentUser.uid, "activityLogs"), {
      title,
      type,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Failed to log activity", err);
  }
}

function demoActivityToLog(a: DemoActivity) {
  return {
    id: a.id,
    title: a.title,
    type: a.type,
    timestamp: Timestamp.fromDate(new Date(a.timestamp)),
  };
}

export async function getRecentActivity(limitCount = 10): Promise<{id: string, title: string, type: string, timestamp: Timestamp}[]> {
  if (isDemoModeActive()) {
    const activities = await loadDemoActivities();
    return activities
      .slice(0, limitCount)
      .map(demoActivityToLog);
  }
  if (!auth.currentUser) return [];
  try {
    const q = query(
      collection(db, "users", auth.currentUser.uid, "activityLogs"),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    const docs = snap.docs.slice(0, limitCount).map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp as Timestamp,
      title: doc.data().title as string,
      type: doc.data().type as string
    }));
    return docs;
  } catch (err) {
    console.error("Failed to get recent activity", err);
    return [];
  }
}

export async function calculateStreak(): Promise<number> {
  const logs = await getRecentActivity(100);
  const dates = logs
    .map(log => {
      const ts = log.timestamp;
      return ts ? ts.toDate().toISOString().split('T')[0] : null;
    })
    .filter(Boolean) as string[];

  if (dates.length === 0) return isDemoModeActive() ? 5 : 0;

  const uniqueDates = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  let streak = 0;

  const today = new Date();
  today.setHours(0,0,0,0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const firstDate = new Date(uniqueDates[0] + "T00:00:00");

  if (firstDate < yesterday) return 0;

  let currentDate = new Date(uniqueDates[0] + "T00:00:00");
  for (let i = 0; i < uniqueDates.length; i++) {
    const d = new Date(uniqueDates[i] + "T00:00:00");
    if (d.getTime() === currentDate.getTime()) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
