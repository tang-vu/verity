/**
 * Grading the oracle's *confidence*, not just its direction.
 *
 * The hit rate in `reputation-math` asks one question: was the call right? It is
 * blind to how loudly the oracle claimed it would be. That leaves the stated
 * confidence as a free variable the oracle fully controls — and the consumer
 * sizes its capital by it (`weight = accuracy x confidence`). An oracle that
 * stamps 95% on every call moves strictly more of the consumer's money than an
 * honest one, at zero cost, while its hit rate stays untouched.
 *
 * Calibration closes that hole off-chain, with no new trust: confidence and
 * outcome are both stored on-chain per signal, so anyone can recompute these
 * numbers from the contract's own history and get the same answer.
 *
 * A forecast of "70%" is a claim that calls like this one come true ~70% of the
 * time. We score it with the Brier score (mean squared error of the stated
 * probability against the realised 0/1 outcome) and, more usably for the
 * consumer, with the gap between what the oracle claimed on average and what it
 * actually delivered. That gap becomes a haircut on future stated confidence:
 * inflating confidence now shrinks the capital the oracle can move later, which
 * is exactly the price that was missing.
 */

/** One resolved call: what the oracle claimed, and what actually happened. */
export interface CalibrationEntry {
  /** Stated confidence 0..=100 as published on-chain. */
  confidence: number;
  /** Did the call resolve CORRECT? */
  correct: boolean;
}

export type CalibrationVerdict =
  | "UNPROVEN"
  | "OVERCONFIDENT"
  | "CALIBRATED"
  | "UNDERCONFIDENT";

export interface Calibration {
  /** Number of resolved calls the score is built from. */
  resolved: number;
  /** Mean stated confidence, 0..1. */
  meanConfidence: number;
  /** Realised hit rate, 0..1. */
  hitRate: number;
  /** Brier score 0..1 — mean (stated - outcome)^2. Lower is better; 0.25 is a coin flip. */
  brier: number;
  /** meanConfidence - hitRate. Positive = the oracle talks bigger than it delivers. */
  overconfidenceGap: number;
  /** Multiplier applied to future stated confidence, 0..1. */
  reliabilityFactor: number;
  verdict: CalibrationVerdict;
}

/**
 * Resolved calls needed before the measurement is treated as signal rather than
 * noise. Below this the verdict is UNPROVEN (the factor still shrinks smoothly).
 */
export const MIN_RESOLVED_FOR_VERDICT = 3;

/**
 * Pseudo-observations of "perfectly calibrated" mixed into the factor. With few
 * resolved calls one unlucky miss would otherwise halve the oracle's sizing, so
 * the factor is pulled toward 1.0 and earns its bite as the sample grows.
 */
export const CALIBRATION_PRIOR_WEIGHT = 5;

/** Tolerance (in probability) inside which claimed and delivered count as matching. */
export const CALIBRATED_BAND = 0.05;

/** A neutral score for an oracle with nothing resolved: no evidence, no haircut. */
export function neutralCalibration(): Calibration {
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

/**
 * Score an oracle's stated confidence against its realised outcomes.
 *
 * `reliabilityFactor` is the delivered-over-claimed ratio, shrunk toward 1.0 by
 * `CALIBRATION_PRIOR_WEIGHT` and capped at 1.0. The cap is deliberate: an
 * under-confident oracle is not handed *extra* capital for having sandbagged —
 * the consumer never sizes above what the oracle was willing to claim.
 */
export function computeCalibration(entries: CalibrationEntry[]): Calibration {
  const resolved = entries.length;
  if (resolved === 0) return neutralCalibration();

  let sumConfidence = 0;
  let correct = 0;
  let sumSquaredError = 0;

  for (const entry of entries) {
    const stated = clamp01(entry.confidence / 100);
    const outcome = entry.correct ? 1 : 0;
    sumConfidence += stated;
    correct += outcome;
    sumSquaredError += (stated - outcome) ** 2;
  }

  const meanConfidence = sumConfidence / resolved;
  const hitRate = correct / resolved;
  const brier = sumSquaredError / resolved;
  const overconfidenceGap = meanConfidence - hitRate;

  // Raw ratio of delivered to claimed. An oracle claiming ~0% is not making a
  // confidence claim at all, so there is nothing to discount.
  const rawFactor = meanConfidence > 0 ? hitRate / meanConfidence : 1;
  const sampleWeight = resolved / (resolved + CALIBRATION_PRIOR_WEIGHT);
  const shrunk = 1 - sampleWeight + sampleWeight * rawFactor;
  const reliabilityFactor = clamp01(Math.min(1, shrunk));

  return {
    resolved,
    meanConfidence,
    hitRate,
    brier,
    overconfidenceGap,
    reliabilityFactor,
    verdict: verdictFor(resolved, overconfidenceGap),
  };
}

function verdictFor(resolved: number, gap: number): CalibrationVerdict {
  if (resolved < MIN_RESOLVED_FOR_VERDICT) return "UNPROVEN";
  if (gap > CALIBRATED_BAND) return "OVERCONFIDENT";
  if (gap < -CALIBRATED_BAND) return "UNDERCONFIDENT";
  return "CALIBRATED";
}

/**
 * The confidence a consumer should actually act on: what the oracle claims,
 * discounted by how much it has historically overclaimed. Returns 0..100 so it
 * drops straight into the existing sizing formula.
 */
export function calibratedConfidence(statedConfidence: number, calibration: Calibration): number {
  const stated = Math.max(0, Math.min(100, statedConfidence));
  return Math.round(stated * calibration.reliabilityFactor);
}

/**
 * Score a book of signals, ignoring any still pending. Structurally typed so it
 * accepts a `StoredSignal[]` (or anything else carrying a stated confidence and
 * a resolved outcome) without dragging store/IO types into this pure module.
 */
export function calibrationFromSignals(
  signals: ReadonlyArray<{ confidence: number; correct?: boolean }>
): Calibration {
  const resolved = signals
    .filter((s): s is { confidence: number; correct: boolean } => typeof s.correct === "boolean")
    .map((s) => ({ confidence: s.confidence, correct: s.correct }));
  return computeCalibration(resolved);
}

/** One-line, human/judge-readable summary of the score. */
export function describeCalibration(calibration: Calibration): string {
  if (calibration.resolved === 0) return "no resolved calls yet — confidence unproven";
  const claimed = (calibration.meanConfidence * 100).toFixed(0);
  const delivered = (calibration.hitRate * 100).toFixed(0);
  const haircut = ((1 - calibration.reliabilityFactor) * 100).toFixed(0);
  return (
    `${calibration.verdict.toLowerCase()}: claimed ${claimed}% on average, delivered ${delivered}% ` +
    `over ${calibration.resolved} resolved (Brier ${calibration.brier.toFixed(3)}) ` +
    `→ ${haircut}% haircut on stated confidence`
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
