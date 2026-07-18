/**
 * Simple circuit breaker for upstream dependencies (Gemini, etc.).
 * Emits budget alerts when opening / quota-class failures accumulate.
 */
export type CircuitState = 'closed' | 'open' | 'half_open';

export type CircuitAlert = {
  name: string;
  state: CircuitState;
  failures: number;
  at: string;
  reason: string;
};

export type CircuitSnapshot = {
  name: string;
  state: CircuitState;
  failures: number;
  openedAt: number | null;
  alertCount: number;
  lastAlert: CircuitAlert | null;
};

type AlertListener = (alert: CircuitAlert) => void;

const globalAlertListeners = new Set<AlertListener>();
const recentAlerts: CircuitAlert[] = [];

export function onCircuitAlert(listener: AlertListener): () => void {
  globalAlertListeners.add(listener);
  return () => globalAlertListeners.delete(listener);
}

export function recentCircuitAlerts(): readonly CircuitAlert[] {
  return recentAlerts;
}

function emitAlert(alert: CircuitAlert): void {
  recentAlerts.push(alert);
  if (recentAlerts.length > 50) recentAlerts.splice(0, recentAlerts.length - 50);
  for (const fn of globalAlertListeners) {
    try {
      fn(alert);
    } catch {
      /* ignore listener errors */
    }
  }
  console.warn(
    `[circuit:${alert.name}] ${alert.state} failures=${alert.failures} — ${alert.reason}`,
  );
}

export function createCircuitBreaker(options: {
  name: string;
  failureThreshold?: number;
  cooldownMs?: number;
  halfOpenMax?: number;
}) {
  const failureThreshold = options.failureThreshold ?? 5;
  const cooldownMs = options.cooldownMs ?? 30_000;
  const halfOpenMax = options.halfOpenMax ?? 1;

  let state: CircuitState = 'closed';
  let failures = 0;
  let openedAt = 0;
  let halfOpenInFlight = 0;
  let alertCount = 0;
  let lastAlert: CircuitAlert | null = null;

  const openCircuit = (reason: string) => {
    const wasOpen = state === 'open';
    state = 'open';
    openedAt = Date.now();
    if (!wasOpen) {
      alertCount += 1;
      lastAlert = {
        name: options.name,
        state: 'open',
        failures,
        at: new Date().toISOString(),
        reason,
      };
      emitAlert(lastAlert);
    }
  };

  return {
    getState(): CircuitState {
      if (state === 'open' && Date.now() - openedAt >= cooldownMs) {
        state = 'half_open';
        halfOpenInFlight = 0;
      }
      return state;
    },
    getSnapshot(): CircuitSnapshot {
      return {
        name: options.name,
        state: this.getState(),
        failures,
        openedAt: openedAt || null,
        alertCount,
        lastAlert,
      };
    },
    /** Record quota / budget pressure without necessarily opening yet. */
    noteBudgetPressure(reason: string): void {
      failures += 1;
      alertCount += 1;
      lastAlert = {
        name: options.name,
        state: this.getState(),
        failures,
        at: new Date().toISOString(),
        reason: reason.slice(0, 200),
      };
      emitAlert(lastAlert);
      if (failures >= failureThreshold) openCircuit(reason);
    },
    async exec<T>(fn: () => Promise<T>): Promise<T> {
      const nowState = this.getState();
      if (nowState === 'open') {
        const err = new Error(`${options.name} circuit open — try again shortly`);
        (err as Error & { code?: string }).code = 'circuit_open';
        throw err;
      }
      if (nowState === 'half_open') {
        if (halfOpenInFlight >= halfOpenMax) {
          const err = new Error(`${options.name} circuit half-open — capacity reached`);
          (err as Error & { code?: string }).code = 'circuit_open';
          throw err;
        }
        halfOpenInFlight += 1;
      }
      try {
        const result = await fn();
        failures = 0;
        state = 'closed';
        halfOpenInFlight = 0;
        return result;
      } catch (error) {
        failures += 1;
        const msg = String((error as Error)?.message ?? error);
        const quota = /quota|resource_exhausted|429|budget/i.test(msg);
        if (quota) {
          alertCount += 1;
          lastAlert = {
            name: options.name,
            state: 'open',
            failures,
            at: new Date().toISOString(),
            reason: `quota/budget: ${msg.slice(0, 160)}`,
          };
          emitAlert(lastAlert);
        }
        if (state === 'half_open' || failures >= failureThreshold || quota) {
          openCircuit(quota ? `quota/budget: ${msg.slice(0, 120)}` : `failure threshold (${failures})`);
        }
        halfOpenInFlight = 0;
        throw error;
      }
    },
    /** Test helper */
    __reset() {
      state = 'closed';
      failures = 0;
      openedAt = 0;
      halfOpenInFlight = 0;
      alertCount = 0;
      lastAlert = null;
    },
  };
}

export const geminiCircuit = createCircuitBreaker({
  name: 'gemini',
  failureThreshold: 5,
  cooldownMs: 30_000,
});
