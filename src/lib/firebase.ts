import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export const app = initializeApp(firebaseConfig);

const firestoreDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
const firestoreSettings = {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
};

export const db = firestoreDatabaseId
  ? initializeFirestore(app, firestoreSettings, firestoreDatabaseId)
  : initializeFirestore(app, firestoreSettings);

export const auth = getAuth(app);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
  provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  provider.addScope('https://www.googleapis.com/auth/gmail.send');
  provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
  provider.addScope('https://www.googleapis.com/auth/documents');
  provider.addScope('https://www.googleapis.com/auth/presentations');
  provider.addScope('https://www.googleapis.com/auth/tasks');
  provider.addScope('https://www.googleapis.com/auth/chat.spaces');
  provider.addScope('https://www.googleapis.com/auth/forms.body');
  provider.addScope('https://www.googleapis.com/auth/keep');
  provider.addScope('https://www.googleapis.com/auth/keep.readonly');
  provider.addScope('https://www.googleapis.com/auth/meetings.space.created');
  provider.addScope('https://www.googleapis.com/auth/meetings.space.readonly');
  provider.addScope('https://www.googleapis.com/auth/meetings.space.settings');
  provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.addons.student');
  provider.addScope('https://www.googleapis.com/auth/classroom.addons.teacher');
  provider.addScope('https://www.googleapis.com/auth/classroom.announcements');
  provider.addScope('https://www.googleapis.com/auth/classroom.announcements.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.courses');
  provider.addScope('https://www.googleapis.com/auth/classroom.courses.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.coursework.me');
  provider.addScope('https://www.googleapis.com/auth/classroom.coursework.me.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.coursework.students');
  provider.addScope('https://www.googleapis.com/auth/classroom.coursework.students.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.courseworkmaterials');
  provider.addScope('https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.guardianlinks.me.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.guardianlinks.students');
  provider.addScope('https://www.googleapis.com/auth/classroom.guardianlinks.students.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.profile.emails');
  provider.addScope('https://www.googleapis.com/auth/classroom.profile.photos');
  provider.addScope('https://www.googleapis.com/auth/classroom.push-notifications');
  provider.addScope('https://www.googleapis.com/auth/classroom.rosters');
  provider.addScope('https://www.googleapis.com/auth/classroom.rosters.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.student-submissions.me.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.student-submissions.students.readonly');
  provider.addScope('https://www.googleapis.com/auth/classroom.topics');
  provider.addScope('https://www.googleapis.com/auth/classroom.topics.readonly');

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Error signing in with Google", error);
  }
};
