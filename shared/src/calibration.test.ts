/**
 * Tests for the confidence-grading rule.
 *
 * The property that matters economically: an oracle cannot buy a bigger slice of
 * the consumer's capital by inflating stated confidence. These cases pin that
 * down, plus the shrinkage that stops a single unlucky miss from gutting a young
 * oracle's sizing.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CALIBRATION_PRIOR_WEIGHT,
  calibratedConfidence,
  computeCalibration,
  describeCalibration,
  neutralCalibration,
  type CalibrationEntry,
} from "./calibration.js";

/** n resolved calls all stated at `confidence`, of which `correct` came true. */
function book(n: number, confidence: number, correct: number): CalibrationEntry[] {
  return Array.from({ length: n }, (_, i) => ({ confidence, correct: i < correct }));
}

test("empty book is neutral — no evidence, no haircut", () => {
  const cal = computeCalibration([]);
  assert.equal(cal.resolved, 0);
  assert.equal(cal.reliabilityFactor, 1);
  assert.equal(cal.verdict, "UNPROVEN");
  assert.deepEqual(cal, neutralCalibration());
  assert.equal(calibratedConfidence(90, cal), 90);
});

test("a perfectly calibrated oracle keeps its full stated confidence", () => {
  // Claims 80%, delivers 8/10.
  const cal = computeCalibration(book(10, 80, 8));
  assert.ok(Math.abs(cal.meanConfidence - 0.8) < 1e-9, `mean ${cal.meanConfidence}`);
  assert.equal(cal.hitRate, 0.8);
  assert.ok(Math.abs(cal.overconfidenceGap) < 1e-9, `gap ${cal.overconfidenceGap}`);
  assert.equal(cal.verdict, "CALIBRATED");
  assert.equal(cal.reliabilityFactor, 1);
  assert.equal(calibratedConfidence(80, cal), 80);
});

test("an overconfident oracle is discounted toward what it actually delivers", () => {
  // Claims 95% every time, is right half the time.
  const cal = computeCalibration(book(20, 95, 10));
  assert.equal(cal.verdict, "OVERCONFIDENT");
  assert.ok(cal.overconfidenceGap > 0.4, `gap ${cal.overconfidenceGap}`);

  // raw = 0.5/0.95 = 0.5263; weight = 20/25 = 0.8 -> 0.2 + 0.8*0.5263 = 0.6211
  assert.ok(Math.abs(cal.reliabilityFactor - 0.6211) < 0.001, `factor ${cal.reliabilityFactor}`);
  assert.equal(calibratedConfidence(95, cal), 59);
});

test("inflating stated confidence cannot buy more capital", () => {
  // Same underlying skill (10/20 right), two different bragging strategies.
  const honest = computeCalibration(book(20, 50, 10));
  const inflated = computeCalibration(book(20, 95, 10));

  const honestEffective = calibratedConfidence(50, honest);
  const inflatedEffective = calibratedConfidence(95, inflated);

  // The liar ends up no better off than the honest oracle it copied.
  assert.ok(
    inflatedEffective <= honestEffective + 10,
    `inflated ${inflatedEffective} vs honest ${honestEffective}`
  );
  // And the honest one is not punished for telling the truth.
  assert.equal(honest.verdict, "CALIBRATED");
  assert.equal(honestEffective, 50);
});

test("under-confidence is recognised but never rewarded with extra size", () => {
  // Claims 40%, delivers 9/10 — sandbagging.
  const cal = computeCalibration(book(10, 40, 9));
  assert.equal(cal.verdict, "UNDERCONFIDENT");
  assert.ok(cal.overconfidenceGap < 0);
  // Factor is capped at 1: the consumer never sizes above what was claimed.
  assert.equal(cal.reliabilityFactor, 1);
  assert.equal(calibratedConfidence(40, cal), 40);
});

test("a thin book is shrunk toward neutral, not gutted by one miss", () => {
  const cal = computeCalibration(book(1, 90, 0));
  assert.equal(cal.verdict, "UNPROVEN");
  // raw = 0; weight = 1/(1+5) -> factor = 1 - 1/6 = 0.8333
  const expected = 1 - 1 / (1 + CALIBRATION_PRIOR_WEIGHT);
  assert.ok(Math.abs(cal.reliabilityFactor - expected) < 1e-9, `factor ${cal.reliabilityFactor}`);
  // Same miss rate on a fat book bites much harder.
  const fat = computeCalibration(book(50, 90, 0));
  assert.ok(fat.reliabilityFactor < 0.11, `factor ${fat.reliabilityFactor}`);
});

test("brier score rewards sharp-and-right, punishes sure-and-wrong", () => {
  assert.equal(computeCalibration(book(4, 100, 4)).brier, 0); // perfect
  assert.equal(computeCalibration(book(4, 100, 0)).brier, 1); // maximally wrong
  assert.equal(computeCalibration(book(4, 50, 2)).brier, 0.25); // coin flip
});

test("mixed-confidence book scores each call on its own claim", () => {
  const cal = computeCalibration([
    { confidence: 90, correct: true },
    { confidence: 90, correct: false },
    { confidence: 60, correct: true },
    { confidence: 60, correct: true },
  ]);
  assert.equal(cal.resolved, 4);
  assert.equal(cal.hitRate, 0.75);
  assert.equal(cal.meanConfidence, 0.75);
  // (0.1^2 + 0.9^2 + 0.4^2 + 0.4^2) / 4
  assert.ok(Math.abs(cal.brier - 0.285) < 1e-9, `brier ${cal.brier}`);
  assert.equal(cal.verdict, "CALIBRATED");
});

test("out-of-range confidence is clamped rather than corrupting the score", () => {
  const cal = computeCalibration([
    { confidence: 140, correct: true },
    { confidence: -20, correct: false },
  ]);
  assert.equal(cal.meanConfidence, 0.5);
  assert.equal(cal.brier, 0);
  assert.equal(calibratedConfidence(200, cal), 100);
});

test("description reads as a judge-facing one-liner", () => {
  const text = describeCalibration(computeCalibration(book(20, 95, 10)));
  assert.match(text, /overconfident/);
  assert.match(text, /claimed 95%/);
  assert.match(text, /delivered 50%/);
  assert.match(text, /haircut/);
});
