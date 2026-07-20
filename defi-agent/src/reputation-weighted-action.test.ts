/**
 * Unit tests for the novel mechanic: action sizing as a function of the oracle's
 * on-chain reputation. Run: `npm run test:agent`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Direction, Reputation, computeCalibration } from "@verity/shared";
import { decideAction } from "./reputation-weighted-action.js";

function rep(accuracyBps: number): Reputation {
  return { accuracyBps, totalSignals: 10, resolvedSignals: 8, correctSignals: 6 };
}

const base = { maxNotional: 1000, minReputationBps: 4000 };

test("reputation below the gate forces HOLD (no capital at risk)", () => {
  const d = decideAction({ direction: Direction.Up, confidence: 90, reputation: rep(3000), ...base });
  assert.equal(d.side, "HOLD");
  assert.equal(d.notional, 0);
  assert.equal(d.reasonCode, "REPUTATION_BELOW_GATE");
});

test("FLAT signal never trades", () => {
  const d = decideAction({ direction: Direction.Flat, confidence: 90, reputation: rep(9000), ...base });
  assert.equal(d.side, "HOLD");
  assert.equal(d.reasonCode, "SIGNAL_FLAT");
});

test("UP signal with strong reputation buys, sized by reputation × confidence", () => {
  const d = decideAction({ direction: Direction.Up, confidence: 50, reputation: rep(8000), ...base });
  assert.equal(d.side, "BUY");
  // weight = 0.80 * 0.50 = 0.40 → 1000 * 0.40 = 400
  assert.equal(d.notional, 400);
  assert.ok(Math.abs(d.weight - 0.4) < 1e-9);
});

test("DOWN signal sells", () => {
  const d = decideAction({ direction: Direction.Down, confidence: 100, reputation: rep(10000), ...base });
  assert.equal(d.side, "SELL");
  assert.equal(d.notional, 1000); // full notional at perfect rep + confidence
});

test("higher reputation deploys strictly more capital for the same signal", () => {
  const weak = decideAction({ direction: Direction.Up, confidence: 80, reputation: rep(5000), ...base });
  const strong = decideAction({ direction: Direction.Up, confidence: 80, reputation: rep(9000), ...base });
  assert.ok(strong.notional > weak.notional, "stronger reputation → larger position");
});

test("undercollateralized oracle is ignored regardless of accuracy", () => {
  const d = decideAction({
    direction: Direction.Up,
    confidence: 100,
    reputation: rep(10000), // perfect accuracy…
    ...base,
    stakeBaseUnits: 10_000, // …but bond below the required floor
    minStakeBaseUnits: 50_000,
  });
  assert.equal(d.side, "HOLD");
  assert.equal(d.reasonCode, "STAKE_BELOW_GATE");
});

test("sufficient bond passes the collateral gate and trades normally", () => {
  const d = decideAction({
    direction: Direction.Up,
    confidence: 50,
    reputation: rep(8000),
    ...base,
    stakeBaseUnits: 200_000,
    minStakeBaseUnits: 50_000,
  });
  assert.equal(d.side, "BUY");
  assert.equal(d.notional, 400); // gate passed → same reputation×confidence sizing
});

/** A book of `n` resolved calls stated at `confidence`, `correct` of them right. */
function calibrationFrom(n: number, confidence: number, correct: number) {
  return computeCalibration(
    Array.from({ length: n }, (_, i) => ({ confidence, correct: i < correct }))
  );
}

test("stated confidence is taken at face value when calibration is unknown", () => {
  const d = decideAction({ direction: Direction.Up, confidence: 90, reputation: rep(8000), ...base });
  assert.equal(d.effectiveConfidence, 90);
  assert.equal(d.notional, 720); // 0.80 * 0.90 * 1000
});

test("an overconfident oracle moves less capital on the same claim", () => {
  const honest = decideAction({
    direction: Direction.Up,
    confidence: 90,
    reputation: rep(8000),
    ...base,
    calibration: calibrationFrom(20, 90, 18), // claims 90, delivers 90
  });
  const liar = decideAction({
    direction: Direction.Up,
    confidence: 90,
    reputation: rep(8000),
    ...base,
    calibration: calibrationFrom(20, 90, 10), // claims 90, delivers 50
  });

  assert.equal(honest.effectiveConfidence, 90);
  assert.ok(liar.effectiveConfidence < 70, `effective ${liar.effectiveConfidence}`);
  assert.ok(liar.notional < honest.notional, "overconfidence must cost sizing");
  assert.match(liar.rationale, /overconfident/);
});

test("inflating confidence does not out-earn honesty at equal skill", () => {
  // Both oracles are right 12/20; one claims 60%, the other claims 95%.
  const honest = decideAction({
    direction: Direction.Up,
    confidence: 60,
    reputation: rep(8000),
    ...base,
    calibration: calibrationFrom(20, 60, 12),
  });
  const inflated = decideAction({
    direction: Direction.Up,
    confidence: 95,
    reputation: rep(8000),
    ...base,
    calibration: calibrationFrom(20, 95, 12),
  });
  assert.ok(
    inflated.notional <= honest.notional * 1.15,
    `inflated ${inflated.notional} vs honest ${honest.notional}`
  );
});

test("the haircut cannot flip a decision or deploy negative capital", () => {
  const d = decideAction({
    direction: Direction.Down,
    confidence: 80,
    reputation: rep(9000),
    ...base,
    calibration: calibrationFrom(30, 80, 0), // never right
  });
  assert.equal(d.side, "SELL"); // direction still comes from the signal
  assert.ok(d.notional >= 0);
  assert.ok(d.notional < 100, `nearly zero size, got ${d.notional}`);
});
