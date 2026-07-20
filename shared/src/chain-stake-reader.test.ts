/**
 * Tests for rebuilding the bond from chain history.
 *
 * The case that motivated this module: a fresh runner with no local stake file
 * must still report the same bond, slash total and tx trail as the machine that
 * ran the agent. So the tests assert the replay against hand-built deploys where
 * the arithmetic is checkable by hand.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { replayStake } from "./chain-stake-reader.js";
import type { ExplorerDeploy } from "./chain-signal-reader.js";
import { SignalStatus } from "./signal-types.js";
import type { StoredSignal } from "./signal-store.js";

let height = 0;

function deploy(entrypoint: string, args: Record<string, number> = {}): ExplorerDeploy {
  height += 1;
  return {
    deploy_hash: `hash${height}`,
    block_height: height,
    caller_hash: "caller",
    args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, { parsed: v }])),
    error_message: null,
    timestamp: new Date(1_700_000_000_000 + height * 1000).toISOString(),
    contract_entrypoint: { name: entrypoint },
  };
}

function failed(d: ExplorerDeploy): ExplorerDeploy {
  return { ...d, error_message: "User error: 9" };
}

function signal(id: number, status: SignalStatus): StoredSignal {
  return { id, status } as StoredSignal;
}

const OPTS = { stakeSymbol: "x402", decimals: 2, explorerBase: "https://testnet.cspr.live" };

test("no stake token set means staking is off, not a zero bond", () => {
  const state = replayStake([deploy("publish_signal", { id: 0 })], [], OPTS);
  assert.equal(state, undefined);
});

test("bond accumulates from stake and drops on withdraw", () => {
  const state = replayStake(
    [
      deploy("set_stake_token"),
      deploy("set_min_stake", { amount: 50_000 }),
      deploy("stake", { amount: 160_000 }),
      deploy("withdraw_stake", { amount: 10_000 }),
    ],
    [],
    OPTS
  );
  assert.ok(state);
  assert.equal(state.bondedBaseUnits, 150_000);
  assert.equal(state.minStakeBaseUnits, 50_000);
  assert.equal(state.slashedBaseUnits, 0);
});

test("a wrong resolve slashes 20% of the remaining bond, a correct one costs nothing", () => {
  const state = replayStake(
    [
      deploy("set_stake_token"),
      deploy("stake", { amount: 200_000 }),
      deploy("resolve_signal", { id: 0 }), // correct — no slash
      deploy("resolve_signal", { id: 1 }), // wrong  — 20% of 200_000
      deploy("resolve_signal", { id: 2 }), // wrong  — 20% of 160_000
    ],
    [
      signal(0, SignalStatus.Correct),
      signal(1, SignalStatus.Wrong),
      signal(2, SignalStatus.Wrong),
    ],
    OPTS
  );
  assert.ok(state);
  assert.equal(state.slashedBaseUnits, 40_000 + 32_000);
  assert.equal(state.bondedBaseUnits, 128_000);
});

test("slashing compounds on the remaining bond, never below zero", () => {
  const deploys = [deploy("set_stake_token"), deploy("stake", { amount: 100 })];
  const signals: StoredSignal[] = [];
  for (let id = 0; id < 40; id++) {
    deploys.push(deploy("resolve_signal", { id }));
    signals.push(signal(id, SignalStatus.Wrong));
  }
  const state = replayStake(deploys, signals, OPTS);
  assert.ok(state);
  assert.ok(state.bondedBaseUnits >= 0, `bond ${state.bondedBaseUnits}`);
  assert.equal(state.bondedBaseUnits + state.slashedBaseUnits, 100);
});

test("a resolve before staking is switched on cannot slash", () => {
  const state = replayStake(
    [
      deploy("resolve_signal", { id: 0 }),
      deploy("set_stake_token"),
      deploy("stake", { amount: 1_000 }),
    ],
    [signal(0, SignalStatus.Wrong)],
    OPTS
  );
  assert.ok(state);
  assert.equal(state.slashedBaseUnits, 0);
  assert.equal(state.bondedBaseUnits, 1_000);
});

test("reverted deploys are ignored — a failed stake bonds nothing", () => {
  const state = replayStake(
    [deploy("set_stake_token"), failed(deploy("stake", { amount: 500_000 })), deploy("stake", { amount: 1_000 })],
    [],
    OPTS
  );
  assert.ok(state);
  assert.equal(state.bondedBaseUnits, 1_000);
});

test("the tx trail carries amounts and real explorer links", () => {
  const state = replayStake(
    [deploy("set_stake_token"), deploy("stake", { amount: 1_000 }), deploy("resolve_signal", { id: 0 })],
    [signal(0, SignalStatus.Wrong)],
    OPTS
  );
  assert.ok(state);
  const labels = state.txs.map((t) => t.label);
  assert.deepEqual(labels, ["set_stake_token", "stake", "slash"]);

  const slash = state.txs.find((t) => t.label === "slash");
  assert.equal(slash?.amountBaseUnits, 200);
  assert.match(slash?.explorerUrl ?? "", /^https:\/\/testnet\.cspr\.live\/transaction\/hash/);
  assert.ok((slash?.at ?? 0) > 0);

  // Configuration steps move no collateral, so they carry no amount.
  assert.equal(state.txs[0]?.amountBaseUnits, undefined);
});

test("replay is order-independent — deploys arrive newest-first from the API", () => {
  const ordered = [
    deploy("set_stake_token"),
    deploy("stake", { amount: 10_000 }),
    deploy("resolve_signal", { id: 0 }),
  ];
  const signals = [signal(0, SignalStatus.Wrong)];
  const forward = replayStake(ordered, signals, OPTS);
  const reversed = replayStake([...ordered].reverse(), signals, OPTS);
  assert.deepEqual(reversed, forward);
});
