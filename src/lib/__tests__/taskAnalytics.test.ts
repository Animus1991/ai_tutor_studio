import { describe, it, expect } from 'vitest';
import { buildTaskAnalytics } from '../taskAnalytics';

describe('buildTaskAnalytics', () => {
  it('returns 7 daily points', () => {
    const data = buildTaskAnalytics([], []);
    expect(data).toHaveLength(7);
    expect(data[0]).toHaveProperty('date');
    expect(data[0]).toHaveProperty('focusTime');
    expect(data[0]).toHaveProperty('mastery');
    expect(data[0]).toHaveProperty('completionRate');
  });

  it('reflects completed tasks in completion rate', () => {
    const today = new Date().toISOString();
    const data = buildTaskAnalytics(
      [
        { completed: true, createdAt: today },
        { completed: false, createdAt: today },
      ],
      [],
    );
    expect(data.some((d) => d.completionRate > 0)).toBe(true);
  });

  it('sums focus time from study sessions', () => {
    const today = new Date().toISOString();
    const data = buildTaskAnalytics(
      [],
      [{ date: today, duration: 25, type: 'focus' }],
    );
    const todayPoint = data[data.length - 1];
    expect(todayPoint.focusTime).toBeGreaterThanOrEqual(25);
  });
});
