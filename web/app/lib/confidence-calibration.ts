/**
 * The dashboard's copy of the confidence-grading rule.
 *
 * Mirrors `shared/src/calibration.ts` — kept as a copy for the same reason
 * `reputation-math` is: this file must stay free of Node-only dependencies so
 * the site builds on Vercel. Change one, change both.
 *
 * Why the dashboard shows this at all: accuracy answers "was it right?", but the
 * consumer sizes its position by the *confidence* the oracle stamped on the
 * call — and that number is the oracle's own unaudited claim. Grading it is what
 * stops "always say 95%" from being a free way to move more of someone's money.
 */
import type { Signal } from "./dashboard-data";

export const MIN_RESOLVED_FOR_VERDICT = 3;
export const CALIBRATION_PRIOR_WEIGHT = 5;
export const CALIBRATED_BAND = 0.05;

export type CalibrationVerdict =
  | "UNPROVEN"
  | "OVERCONFIDENT"
  | "CALIBRATED"
  | "UNDERCONFIDENT";

export interface Calibration {
  resolved: number;
  /** Mean stated confidence, 0..1. */
  meanConfidence: number;
  /** Realised hit rate, 0..1. */
  hitRate: number;
  /** Brier score 0..1 — mean squared error of claim vs outcome. Lower is better. */
  brier: number;
  /** meanConfidence - hitRate. Positive = talks bigger than it delivers. */
  overconfidenceGap: number;
  /** Haircut multiplier a consumer applies to stated confidence, 0..1. */
  reliabilityFactor: number;
  verdict: CalibrationVerdict;
}

/** Score the oracle's stated confidence against the resolved rows of its book. */
export function calibrationFromSignals(signals: Signal[]): Calibration {
  const resolvedRows = signals.filter(
    (s) => s.statusLabel === "CORRECT" || s.statusLabel === "WRONG"
  );
  const resolved = resolvedRows.length;
  if (resolved === 0) {
    return {
      resolved: 0,
      meanConfidence: 0,
      hitRate: 0,
      brier: 0,
      overconfidenceGap: 0,
      reliabilityFactor: 1,
      verdict: "UNPROVEN",
    };
  }

  let sumConfidence = 0;
  let correct = 0;
  let sumSquaredError = 0;

  for (const row of resolvedRows) {
    const stated = clamp01(row.confidence / 100);
    const outcome = row.statusLabel === "CORRECT" ? 1 : 0;
    sumConfidence += stated;
    correct += outcome;
    sumSquaredError += (stated - outcome) ** 2;
  }

  const meanConfidence = sumConfidence / resolved;
  const hitRate = correct / resolved;
  const overconfidenceGap = meanConfidence - hitRate;

  const rawFactor = meanConfidence > 0 ? hitRate / meanConfidence : 1;
  const sampleWeight = resolved / (resolved + CALIBRATION_PRIOR_WEIGHT);
  const reliabilityFactor = clamp01(Math.min(1, 1 - sampleWeight + sampleWeight * rawFactor));

  return {
    resolved,
    meanConfidence,
    hitRate,
    brier: sumSquaredError / resolved,
    overconfidenceGap,
    reliabilityFactor,
    verdict:
      resolved < MIN_RESOLVED_FOR_VERDICT
        ? "UNPROVEN"
        : overconfidenceGap > CALIBRATED_BAND
        ? "OVERCONFIDENT"
        : overconfidenceGap < -CALIBRATED_BAND
        ? "UNDERCONFIDENT"
        : "CALIBRATED",
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
