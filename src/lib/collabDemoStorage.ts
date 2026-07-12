import localforage from 'localforage';

const MESSAGES_KEY = 'memora-collab-messages';
const QUIZZES_KEY = 'memora-collab-quizzes';

export type CollabMessage = {
  id: string;
  roomId: string;
  user: string;
  text: string;
  time: string;
  userId?: string;
};

export type CollabQuiz = {
  id: string;
  roomId: string;
  formId: string;
  formUrl: string;
  title: string;
  userId?: string;
  createdAt: string;
};

const SEED_MESSAGES: CollabMessage[] = [
  {
    id: 'welcome',
    roomId: 'default_room',
    user: 'System',
    text: 'Welcome to Memora Collab! Chat, whiteboard, and quizzes sync via Yjs — demo mode stores messages locally.',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
];

export async function loadCollabMessages(roomId: string): Promise<CollabMessage[]> {
  const all = (await localforage.getItem<CollabMessage[]>(MESSAGES_KEY)) ?? SEED_MESSAGES;
  const room = all.filter((m) => m.roomId === roomId);
  return room.length > 0 ? room : SEED_MESSAGES.filter((m) => m.roomId === roomId);
}

export async function saveCollabMessage(msg: CollabMessage): Promise<void> {
  const all = (await localforage.getItem<CollabMessage[]>(MESSAGES_KEY)) ?? [];
  await localforage.setItem(MESSAGES_KEY, [...all, msg]);
}

export async function loadCollabQuizzes(roomId: string): Promise<CollabQuiz[]> {
  const all = (await localforage.getItem<CollabQuiz[]>(QUIZZES_KEY)) ?? [];
  return all.filter((q) => q.roomId === roomId);
}

export async function saveCollabQuiz(quiz: CollabQuiz): Promise<void> {
  const all = (await localforage.getItem<CollabQuiz[]>(QUIZZES_KEY)) ?? [];
  await localforage.setItem(QUIZZES_KEY, [...all, quiz]);
}
