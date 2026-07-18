/**
 * Psychometric calibration bins — confidence vs correctness.
 * Complements quizIrt confidence bands with reliability diagnostics.
 */

export type CalibrationObservation = {
  /** Predicted P(correct) 0–1 */
  predicted: number;
  /** Actual outcome 0 or 1 */
  actual: 0 | 1;
};

export type CalibrationBin = {
  label: string;
  /** Bin center predicted probability */
  predictedMean: number;
  /** Observed accuracy in bin */
  observedMean: number | null;
  count: number;
};

export type CalibrationReport = {
  bins: CalibrationBin[];
  /** Mean absolute calibration error across non-empty bins */
  mace: number | null;
  /** Brier score (lower is better) */
  brier: number | null;
  n: number;
};

const DEFAULT_EDGES = [0, 0.2, 0.4, 0.6, 0.8, 1.0001];

export function computeCalibration(
  observations: CalibrationObservation[],
  edges: number[] = DEFAULT_EDGES,
): CalibrationReport {
  const bins: CalibrationBin[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const inBin = observations.filter((o) => o.predicted >= lo && o.predicted < hi);
    const predictedMean = inBin.length
      ? inBin.reduce((a, o) => a + o.predicted, 0) / inBin.length
      : (lo + Math.min(hi, 1)) / 2;
    const observedMean = inBin.length
      ? inBin.reduce((a, o) => a + o.actual, 0) / inBin.length
      : null;
    bins.push({
      label: `${Math.round(lo * 100)}–${Math.round(Math.min(hi, 1) * 100)}%`,
      predictedMean: Math.round(predictedMean * 1000) / 1000,
      observedMean: observedMean === null ? null : Math.round(observedMean * 1000) / 1000,
      count: inBin.length,
    });
  }

  const nonEmpty = bins.filter((b) => b.count > 0 && b.observedMean !== null);
  const mace = nonEmpty.length
    ? nonEmpty.reduce((a, b) => a + Math.abs(b.predictedMean - (b.observedMean as number)), 0) /
      nonEmpty.length
    : null;

  const brier = observations.length
    ? observations.reduce((a, o) => a + (o.predicted - o.actual) ** 2, 0) / observations.length
    : null;

  return {
    bins,
    mace: mace === null ? null : Math.round(mace * 1000) / 1000,
    brier: brier === null ? null : Math.round(brier * 1000) / 1000,
    n: observations.length,
  };
}
