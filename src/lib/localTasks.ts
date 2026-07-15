import localforage from "localforage";

export const LOCAL_TASKS_KEY = "memora-tasks";
export const LOCAL_TASKS_UPDATED_EVENT = "memora:tasks-updated";

export interface LocalTask {
  id: string;
  title: string;
  course: string;
  completed: boolean;
  priority?: string;
  dueDate?: string;
  [key: string]: unknown;
}

export async function readLocalTasks(): Promise<LocalTask[]> {
  const stored = await localforage.getItem<unknown>(LOCAL_TASKS_KEY);
  if (!stored) return [];

  try {
    const parsed = typeof stored === "string" ? JSON.parse(stored) : stored;
    return Array.isArray(parsed)
      ? parsed.filter(
          (task): task is LocalTask =>
            Boolean(
              task &&
                typeof task === "object" &&
                "id" in task &&
                typeof task.id === "string" &&
                "title" in task &&
                typeof task.title === "string",
            ),
        )
      : [];
  } catch {
    return [];
  }
}

export async function writeLocalTasks(tasks: LocalTask[]): Promise<void> {
  await localforage.setItem(LOCAL_TASKS_KEY, tasks);
  window.dispatchEvent(new CustomEvent(LOCAL_TASKS_UPDATED_EVENT));
}
