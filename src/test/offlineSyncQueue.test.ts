import { describe, expect, it, vi } from "vitest";

vi.mock("localforage", () => {
  const store = new Map<string, unknown>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => store.clear()),
    },
  };
});

import {
  enqueueOfflineMutation,
  flushOfflineMutationQueue,
  getOfflineQueueSize,
  readConflicts,
  resolveConflict,
} from "../lib/offlineSyncQueue";
import { readLocalTasks, writeLocalTasks } from "../lib/localTasks";

describe("offlineSyncQueue", () => {
  it("queues and flushes local task mutations when online", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
    });

    await enqueueOfflineMutation({
      id: "task:demo-1",
      op: "upsert_task",
      payload: {
        task: {
          id: "demo-1",
          title: "Queued task",
          course: "Biology",
          completed: false,
        },
      },
    });

    expect(await getOfflineQueueSize()).toBe(1);
    const result = await flushOfflineMutationQueue();
    expect(result.applied).toBe(1);
    expect(result.remaining).toBe(0);

    const tasks = await readLocalTasks();
    expect(tasks.some((task) => task.id === "demo-1")).toBe(true);
  });

  it("records a conflict when remote version moved ahead", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });

    await writeLocalTasks([
      {
        id: "c1",
        title: "Remote newer",
        course: "Chem",
        completed: false,
        version: 5,
      } as never,
    ]);

    await enqueueOfflineMutation({
      id: "task:c1",
      op: "upsert_task",
      baseVersion: 2,
      payload: {
        task: {
          id: "c1",
          title: "Local edit",
          course: "Chem",
          completed: false,
          version: 3,
        },
      },
    });

    const result = await flushOfflineMutationQueue();
    expect(result.conflicts).toBeGreaterThanOrEqual(1);
    const conflicts = await readConflicts();
    expect(conflicts.length).toBeGreaterThanOrEqual(1);

    await resolveConflict(conflicts[0].id, "local");
    expect((await readConflicts()).every((c) => c.id !== conflicts[0].id)).toBe(true);
  });
});
