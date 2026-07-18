/**
 * Focus timer wellbeing bounds — SDT-aligned limits (not grind gamification).
 * Caps continuous focus and nudges breaks after pomodoro cycles.
 */

/** Max continuous focus before forced break nudge (seconds). */
export const MAX_CONTINUOUS_FOCUS_SEC = 50 * 60;
/** Suggested break after N completed pomodoros. */
export const BREAK_AFTER_POMODOROS = 4;
/** Soft daily focus budget (seconds) — warn, do not hard-block learning. */
export const DAILY_FOCUS_BUDGET_SEC = 4 * 60 * 60;

export type WellbeingNudge = {
  level: 'ok' | 'break' | 'break';
  reason: string;
  reasonEl: string;
  suggestBreak: boolean;
};

export function evaluateFocusWellbeing(input: {
  continuousFocusSec: number;
  completedPomodoros: number;
  dailyFocusSec: number;
}): WellbeingNudge {
  if (input.continuousFocusSec >= MAX_CONTINUOUS_FOCUS_SEC) {
    return {
      level: 'break',
      reason: 'Take a break — continuous focus exceeded 50 minutes.',
      reasonEl: 'Κάνε διάλειμμα — ξεπέρασες 50 λεπτά συνεχούς εστίασης.',
      suggestBreak: true,
    };
  }
  if (input.dailyFocusSec >= DAILY_FOCUS_BUDGET_SEC) {
    return {
      level: 'suggest',
      reason: 'Daily focus budget reached — rest supports retention.',
      reasonEl: 'Έφτασες το ημερήσιο budget εστίασης — η ξεκούραση βοηθά τη συγκράτηση.',
      suggestBreak: true,
    };
  }
  if (
    input.completedPomodoros > 0 &&
    input.completedPomodoros % BREAK_AFTER_POMODOROS === 0
  ) {
    return {
      level: 'suggest',
      reason: 'Long break after four pomodoros supports wellbeing.',
      reasonEl: 'Μεγάλο διάλειμμα μετά από τέσσερα pomodoros στηρίζει την ευεξία.',
      suggestBreak: true,
    };
  }
  return {
    level: 'ok',
    reason: 'Within wellbeing bounds.',
    reasonEl: 'Εντός ορίων ευεξίας.',
    suggestBreak: false,
  };
}
