import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_MODE_KEY } from "../lib/demoStorage";

vi.mock("localforage", () => ({
  default: {
    clear: vi.fn().mockResolvedValue(undefined),
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("demo authentication state", () => {
  it("enters and exits a persistent local demo session", async () => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal("localStorage", localStorage);
    const { useAuthStore } = await import("../store/useAuthStore");

    useAuthStore.getState().enterDemoMode();
    expect(useAuthStore.getState()).toMatchObject({
      isDemoMode: true,
      needsAuth: false,
      user: null,
      accessToken: "demo-token",
    });
    expect(localStorage.getItem(DEMO_MODE_KEY)).toBe("1");

    useAuthStore.getState().exitDemoMode();
    expect(useAuthStore.getState()).toMatchObject({
      isDemoMode: false,
      needsAuth: true,
      user: null,
      accessToken: null,
    });
    expect(localStorage.getItem(DEMO_MODE_KEY)).toBeNull();
  });

  it("restores demo mode after a page reload", async () => {
    const localStorage = new MemoryStorage();
    localStorage.setItem(DEMO_MODE_KEY, "1");
    vi.stubGlobal("localStorage", localStorage);

    const { useAuthStore } = await import("../store/useAuthStore");
    expect(useAuthStore.getState()).toMatchObject({
      isDemoMode: true,
      needsAuth: false,
      accessToken: "demo-token",
    });
  });

  it("normalizes authenticated custom claims and locks manual role changes", async () => {
    const localStorage = new MemoryStorage();
    vi.stubGlobal("localStorage", localStorage);
    const { useAuthStore } = await import("../store/useAuthStore");

    useAuthStore.getState().setClaimRole("admin");
    expect(useAuthStore.getState().userRole).toBe("admin");

    useAuthStore.getState().setUserRole("student");
    expect(useAuthStore.getState().userRole).toBe("admin");

    useAuthStore.getState().setClaimRole("untrusted-role");
    expect(useAuthStore.getState().userRole).toBe("student");
  });
});
