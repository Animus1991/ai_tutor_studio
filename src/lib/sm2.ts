export interface SM2Data {
  repetition: number;
  interval: number;
  easinessFactor: number;
}

/**
 * Calculates the next review interval using the SuperMemo-2 algorithm.
 * @param quality User's self-assessed quality of recall (0-5)
 *  0: Complete blackout
 *  1: Incorrect response; the correct one remembered
 *  2: Incorrect response; where the correct one seemed easy to recall
 *  3: Correct response recalled with serious difficulty
 *  4: Correct response after a hesitation
 *  5: Perfect response
 * @param prevData Previous SM2 data (repetition, interval, easinessFactor)
 * @returns New SM2 data for the next review
 */
export function calculateSM2(quality: number, prevData: SM2Data): SM2Data {
  let { repetition, interval, easinessFactor } = prevData;

  if (quality >= 3) {
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easinessFactor);
    }
    repetition += 1;
  } else {
    repetition = 0;
    interval = 1;
  }

  easinessFactor = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easinessFactor < 1.3) {
    easinessFactor = 1.3;
  }

  return { repetition, interval, easinessFactor };
}
