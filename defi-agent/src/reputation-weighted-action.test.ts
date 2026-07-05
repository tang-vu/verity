/**
 * Unit tests for the novel mechanic: action sizing as a function of the oracle's
 * on-chain reputation. Run: `npm run test:agent`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Direction, Reputation } from "@verity/shared";
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
