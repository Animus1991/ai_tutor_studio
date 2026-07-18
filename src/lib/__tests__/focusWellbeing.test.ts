import { describe, expect, it } from 'vitest';
import {
  BREAK_AFTER_POMODOROS,
  DAILY_FOCUS_BUDGET_SEC,
  evaluateFocusWellbeing,
  MAX_CONTINUOUS_FOCUS_SEC,
} from '../focusWellbeing';

describe('focusWellbeing', () => {
  it('stays ok within bounds', () => {
    const n = evaluateFocusWellbeing({
      continuousFocusSec: 20 * 60,
      completedPomodoros: 1,
      dailyFocusSec: 40 * 60,
    });
    expect(n.level).toBe('ok');
    expect(n.suggestBreak).toBe(false);
  });

  it('forces break after continuous focus cap', () => {
    const n = evaluateFocusWellbeing({
      continuousFocusSec: MAX_CONTINUOUS_FOCUS_SEC,
      completedPomodoros: 0,
      dailyFocusSec: MAX_CONTINUOUS_FOCUS_SEC,
    });
    expect(n.level).toBe('break');
    expect(n.suggestBreak).toBe(true);
  });

  it('suggests break after pomodoro cycles and daily budget', () => {
    const cycle = evaluateFocusWellbeing({
      continuousFocusSec: 0,
      completedPomodoros: BREAK_AFTER_POMODOROS,
      dailyFocusSec: 25 * 60,
    });
    expect(cycle.level).toBe('suggest');

    const daily = evaluateFocusWellbeing({
      continuousFocusSec: 10 * 60,
      completedPomodoros: 1,
      dailyFocusSec: DAILY_FOCUS_BUDGET_SEC,
    });
    expect(daily.level).toBe('suggest');
  });
});
