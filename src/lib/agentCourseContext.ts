import localforage from 'localforage';

const KEY = 'memora-agent-course-id';

export async function loadAgentCourseId(): Promise<string | null> {
  return localforage.getItem<string>(KEY);
}

export async function saveAgentCourseId(courseId: string | null): Promise<void> {
  if (courseId) await localforage.setItem(KEY, courseId);
  else await localforage.removeItem(KEY);
}
