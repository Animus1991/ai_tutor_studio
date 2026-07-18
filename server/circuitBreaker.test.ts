import { beforeEach, describe, expect, it } from 'vitest';
import { createCircuitBreaker } from './circuitBreaker';

describe('circuitBreaker', () => {
  const breaker = createCircuitBreaker({
    name: 'test',
    failureThreshold: 2,
    cooldownMs: 50,
  });

  beforeEach(() => {
    breaker.__reset();
  });

  it('opens after threshold failures and recovers after cooldown', async () => {
    await expect(breaker.exec(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    await expect(breaker.exec(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    expect(breaker.getState()).toBe('open');
    expect(breaker.getSnapshot().alertCount).toBeGreaterThan(0);
    await expect(breaker.exec(async () => 'ok')).rejects.toMatchObject({ code: 'circuit_open' });

    await new Promise((r) => setTimeout(r, 60));
    expect(breaker.getState()).toBe('half_open');
    await expect(breaker.exec(async () => 'ok')).resolves.toBe('ok');
    expect(breaker.getState()).toBe('closed');
  });

  it('emits budget pressure alerts', () => {
    breaker.noteBudgetPressure('quota test');
    expect(breaker.getSnapshot().lastAlert?.reason).toContain('quota');
  });
});
