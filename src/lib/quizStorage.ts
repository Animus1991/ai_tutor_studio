import localforage from 'localforage';

export type QuizScoreRecord = {
  correct: number;
  total: number;
  lastAt: string;
};

function key(courseId: string) {
  return `memora-quiz-score-${courseId}`;
}

export async function loadQuizScore(courseId: string): Promise<QuizScoreRecord | null> {
  return localforage.getItem<QuizScoreRecord>(key(courseId));
}

export async function saveQuizScore(
  courseId: string,
  correct: number,
  total: number,
): Promise<void> {
  await localforage.setItem(key(courseId), {
    correct,
    total,
    lastAt: new Date().toISOString(),
  });
}
