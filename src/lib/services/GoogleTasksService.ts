import { getAccessToken } from '../auth';

async function resolveToken(explicit?: string | null): Promise<string> {
  const token = explicit || (await getAccessToken());
  if (!token) throw new Error('Not authenticated — connect Google Tasks scope');
  return token;
}

export class GoogleTasksService {
  private static instance: GoogleTasksService;

  private constructor() {}

  public static getInstance(): GoogleTasksService {
    if (!GoogleTasksService.instance) {
      GoogleTasksService.instance = new GoogleTasksService();
    }
    return GoogleTasksService.instance;
  }

  public async getTaskLists(accessToken?: string | null): Promise<{ items?: Array<{ id: string; title?: string }> }> {
    const token = await resolveToken(accessToken);
    const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch task lists (${res.status})`);
    return res.json();
  }

  public async getTasks(
    taskListId: string,
    accessToken?: string | null,
  ): Promise<{ items?: Array<{ id: string; title?: string; notes?: string; status?: string; due?: string; updated?: string }> }> {
    const token = await resolveToken(accessToken);
    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks?showCompleted=true&showHidden=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Failed to fetch tasks (${res.status})`);
    return res.json();
  }

  public async createTask(
    taskListId: string,
    task: { title: string; notes?: string; due?: string },
    accessToken?: string | null,
  ): Promise<{ id?: string }> {
    const token = await resolveToken(accessToken);
    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(task),
      },
    );
    if (!res.ok) throw new Error(`Failed to create task (${res.status})`);
    return res.json();
  }

  public async patchTask(
    taskListId: string,
    taskId: string,
    patch: { title?: string; notes?: string; status?: string; due?: string },
    accessToken?: string | null,
  ): Promise<unknown> {
    const token = await resolveToken(accessToken);
    const res = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      },
    );
    if (!res.ok) throw new Error(`Failed to patch task (${res.status})`);
    return res.json();
  }

  /**
   * Push local tasks missing on Google; patch LWW winners.
   * Returns counts for user-visible merge summary.
   */
  public async syncFromLocal(
    localTasks: Array<{
      id: string;
      title: string;
      notes?: string;
      completed?: boolean;
      due?: string | null;
      googleTaskId?: string | null;
    }>,
    accessToken?: string | null,
  ): Promise<{ listId: string; created: number; patched: number; remoteCount: number }> {
    const lists = await this.getTaskLists(accessToken);
    const listId = lists.items?.[0]?.id;
    if (!listId) throw new Error('No Google Tasks list available');

    const remote = await this.getTasks(listId, accessToken);
    const remoteItems = remote.items ?? [];
    const { mergeTasksLastWriteWins } = await import('../googleTasksSync');
    const merge = mergeTasksLastWriteWins(
      localTasks.map((t) => ({
        id: String(t.id),
        title: t.title,
        notes: t.notes,
        completed: t.completed,
        due: t.due,
        googleTaskId: t.googleTaskId,
        updatedAt: Date.now(),
      })),
      remoteItems,
    );

    let created = 0;
    let patched = 0;
    for (const task of merge.toPush) {
      if (task.googleTaskId) {
        await this.patchTask(
          listId,
          task.googleTaskId,
          {
            title: task.title,
            notes: task.notes,
            status: task.completed ? 'completed' : 'needsAction',
            due: task.due || undefined,
          },
          accessToken,
        );
        patched += 1;
      } else {
        await this.createTask(
          listId,
          {
            title: task.title,
            notes: task.notes,
            due: task.due || undefined,
          },
          accessToken,
        );
        created += 1;
      }
    }

    return { listId, created, patched, remoteCount: remoteItems.length };
  }
}

export const googleTasksService = GoogleTasksService.getInstance();
