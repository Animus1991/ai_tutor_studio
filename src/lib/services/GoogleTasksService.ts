import { getAccessToken } from '../auth';

export class GoogleTasksService {
  private static instance: GoogleTasksService;
  
  private constructor() {}

  public static getInstance(): GoogleTasksService {
    if (!GoogleTasksService.instance) {
      GoogleTasksService.instance = new GoogleTasksService();
    }
    return GoogleTasksService.instance;
  }

  public async getTaskLists(): Promise<any> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");
    const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch task lists");
    return res.json();
  }

  public async getTasks(taskListId: string): Promise<any> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch tasks");
    return res.json();
  }
  
  public async createTask(taskListId: string, task: { title: string; notes?: string; due?: string }): Promise<any> {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(task)
    });
    if (!res.ok) throw new Error("Failed to create task");
    return res.json();
  }
}

export const googleTasksService = GoogleTasksService.getInstance();
