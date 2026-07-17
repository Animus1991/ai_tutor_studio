/**
 * Simple circuit breaker for upstream dependencies (Gemini, etc.).
 */
export type CircuitState = 'closed' | 'open' | 'half_open';

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

  return {
    getState(): CircuitState {
      if (state === 'open' && Date.now() - openedAt >= cooldownMs) {
        state = 'half_open';
        halfOpenInFlight = 0;
      }
      return state;
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
        if (state === 'half_open' || failures >= failureThreshold) {
          state = 'open';
          openedAt = Date.now();
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
    },
  };
}

export const geminiCircuit = createCircuitBreaker({
  name: 'gemini',
  failureThreshold: 5,
  cooldownMs: 30_000,
});
