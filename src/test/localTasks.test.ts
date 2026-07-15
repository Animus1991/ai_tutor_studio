import { beforeEach, describe, expect, it, vi } from "vitest";

let storedValue: unknown;

vi.mock("localforage", () => ({
  default: {
    getItem: vi.fn(async () => storedValue ?? null),
    setItem: vi.fn(async (_key: string, value: unknown) => {
      storedValue = value;
      return value;
    }),
  },
}));

import { readLocalTasks, writeLocalTasks } from "../lib/localTasks";

beforeEach(() => {
  storedValue = undefined;
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});

describe("local task persistence", () => {
  it("reads current array storage", async () => {
    storedValue = [
      { id: "1", title: "Review", course: "Math", completed: false },
    ];
    await expect(readLocalTasks()).resolves.toHaveLength(1);
  });

  it("migrates legacy JSON-string storage and filters malformed records", async () => {
    storedValue = JSON.stringify([
      { id: "1", title: "Valid", course: "Math", completed: false },
      { title: "Missing id" },
    ]);
    await expect(readLocalTasks()).resolves.toEqual([
      { id: "1", title: "Valid", course: "Math", completed: false },
    ]);
  });

  it("writes tasks and emits a refresh event", async () => {
    const tasks = [
      { id: "1", title: "Review", course: "Math", completed: false },
    ];
    await writeLocalTasks(tasks);
    expect(storedValue).toEqual(tasks);
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
  });
});
