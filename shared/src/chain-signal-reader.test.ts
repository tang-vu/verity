/**
 * The replay is what lets the oracle recover its own book from the chain, so the
 * cases that matter are the ones where a naive reader would get it wrong: out-of
 * -order pages, failed deploys that never counted, and duplicate resolves.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeWithLocal, replaySignals, symbolOf, type ExplorerDeploy } from "./chain-signal-reader.js";
import { Direction, SignalStatus } from "./signal-types.js";
import type { StoredSignal } from "./signal-store.js";

let height = 0;

function publish(args: Partial<Record<string, unknown>> = {}): ExplorerDeploy {
  const merged = {
    asset: "casper-network",
    direction: Direction.Up,
    confidence: 70,
    horizon_hours: 24,
    price_at_publish: 1_000_000,
    reasoning: "test call",
    ...args,
  };
  return deploy("publish_signal", merged);
}

function resolve(id: number, priceAtResolve: number): ExplorerDeploy {
  return deploy("resolve_signal", { id, price_at_resolve: priceAtResolve });
}

function deploy(name: string, args: Record<string, unknown>): ExplorerDeploy {
  height += 1;
  return {
    deploy_hash: `hash-${name}-${height}`,
    block_height: height,
    caller_hash: "producer-account-hash",
    args: Object.fromEntries(Object.entries(args).map(([k, v]) => [k, { parsed: v }])),
    error_message: null,
    timestamp: new Date(1_700_000_000_000 + height * 60_000).toISOString(),
    contract_entrypoint: { name },
  };
}

test("assigns ids by publish order, mirroring client-side nextSignalId", () => {
  const signals = replaySignals([publish(), publish({ asset: "pax-gold" }), publish()]);

  assert.deepEqual(
    signals.map((s) => s.id),
    [0, 1, 2]
  );
  assert.equal(signals[1]!.symbol, "PAXG");
});

test("replays in chain order regardless of the order the API returned", () => {
  const first = publish({ reasoning: "first" });
  const second = publish({ reasoning: "second" });

  // The explorer returns newest first; a reader that trusted that order would
  // hand the oracle mismatched ids and it would resolve the wrong call.
  const signals = replaySignals([second, first]);

  assert.equal(signals[0]!.reasoning, "first");
  assert.equal(signals[1]!.reasoning, "second");
});

test("ignores failed deploys — they never reached the contract", () => {
  const failed = { ...publish(), error_message: "Out of gas" };

  const signals = replaySignals([publish(), failed, publish()]);

  assert.equal(signals.length, 2);
});

test("grades an UP call against the resolve price", () => {
  const up = replaySignals([publish({ direction: Direction.Up }), resolve(0, 1_200_000)]);
  assert.equal(up[0]!.status, SignalStatus.Correct);
  assert.equal(up[0]!.correct, true);
  assert.equal(up[0]!.priceUsdAtResolve, 1.2);

  const down = replaySignals([publish({ direction: Direction.Up }), resolve(0, 900_000)]);
  assert.equal(down[0]!.status, SignalStatus.Wrong);
  assert.equal(down[0]!.correct, false);
});

test("a FLAT call inside the band is correct", () => {
  const inBand = replaySignals([
    publish({ direction: Direction.Flat }),
    resolve(0, 1_004_000), // +0.40%
  ]);
  assert.equal(inBand[0]!.status, SignalStatus.Correct);

  const outOfBand = replaySignals([
    publish({ direction: Direction.Flat }),
    resolve(0, 1_006_000), // +0.60%
  ]);
  assert.equal(outOfBand[0]!.status, SignalStatus.Wrong);
});

test("keeps the first verdict when a resolve is replayed twice", () => {
  // The contract rejects the second resolve, so a reader that applied it would
  // invent a grading the chain never performed.
  const call = publish({ direction: Direction.Up });
  const firstResolve = resolve(0, 1_200_000);
  const replayed = resolve(0, 800_000);

  const signals = replaySignals([call, firstResolve, replayed]);

  assert.equal(signals[0]!.status, SignalStatus.Correct);
  assert.equal(signals[0]!.resolveTxHash, firstResolve.deploy_hash);
});

test("skips a resolve for an id that was never published", () => {
  const signals = replaySignals([publish(), resolve(7, 1_200_000)]);

  assert.equal(signals.length, 1);
  assert.equal(signals[0]!.status, SignalStatus.Pending);
});

test("unresolved calls stay pending so the cycle can still grade them", () => {
  const signals = replaySignals([publish(), publish(), resolve(0, 1_200_000)]);

  assert.equal(signals[0]!.status, SignalStatus.Correct);
  assert.equal(signals[1]!.status, SignalStatus.Pending);
  assert.equal(signals[1]!.resolveTxHash, undefined);
});

test("carries tx links for every on-chain event", () => {
  const signals = replaySignals([publish(), resolve(0, 1_200_000)], "https://testnet.cspr.live");

  assert.match(signals[0]!.publishExplorerUrl, /^https:\/\/testnet\.cspr\.live\/transaction\/hash-publish/);
  assert.match(signals[0]!.resolveExplorerUrl!, /^https:\/\/testnet\.cspr\.live\/transaction\/hash-resolve/);
});

test("merge keeps local key factors, which were never stored on-chain", () => {
  const chain = replaySignals([publish()]);
  const local = [{ ...chain[0]!, keyFactors: ["ETF inflows", "funding flipped"] }] as StoredSignal[];

  const merged = mergeWithLocal(chain, local);

  assert.deepEqual(merged[0]!.keyFactors, ["ETF inflows", "funding flipped"]);
});

test("merge lets the chain correct a stale local status", () => {
  const chain = replaySignals([publish(), resolve(0, 1_200_000)]);
  const local = [{ ...chain[0]!, status: SignalStatus.Pending, correct: undefined }] as StoredSignal[];

  const merged = mergeWithLocal(chain, local);

  assert.equal(merged[0]!.status, SignalStatus.Correct);
});

test("symbols fall back to the asset id's first segment", () => {
  assert.equal(symbolOf("casper-network"), "CSPR");
  assert.equal(symbolOf("pax-gold"), "PAXG");
  assert.equal(symbolOf("wrapped-bitcoin"), "WRAPPED");
});
