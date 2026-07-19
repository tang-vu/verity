/**
 * The JS slash math is a mirror of the contract's `staking_math.rs`. If the two
 * ever drift, the dashboard and the local audit trail start reporting collateral
 * the chain does not agree with — so these cases are deliberately the same
 * vectors the Rust unit tests assert.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SLASH_BPS, slashAmount } from "./stake-store.js";

test("slash rate matches the contract's SLASH_BPS", () => {
  assert.equal(SLASH_BPS, 2_000); // 20%
});

test("slashes the bps fraction of the remaining bond", () => {
  assert.equal(slashAmount(10_000), 2_000);
  assert.equal(slashAmount(12_345), 2_469); // floors
});

test("zero stake slashes zero", () => {
  assert.equal(slashAmount(0), 0);
});

test("slashing compounds downwards", () => {
  let stake = 1_000;
  for (let i = 0; i < 3; i++) stake -= slashAmount(stake);
  assert.equal(stake, 512);
});

test("reproduces the two live wrong resolves that took 1600 to 1024", () => {
  let bonded = 160_000; // base units (2 decimals) = 1600.00 x402
  const first = slashAmount(bonded);
  bonded -= first;
  const second = slashAmount(bonded);
  bonded -= second;

  assert.equal(first, 32_000); // 320.00
  assert.equal(second, 25_600); // 256.00
  assert.equal(bonded, 102_400); // 1024.00
});
