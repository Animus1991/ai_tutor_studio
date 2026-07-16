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
} from "../lib/offlineSyncQueue";
import { readLocalTasks } from "../lib/localTasks";

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
});
