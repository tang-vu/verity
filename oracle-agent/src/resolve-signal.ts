/**
 * Oracle Agent — resolve due signals. For each PENDING signal whose horizon has
 * elapsed, fetch the current price, call SignalOracle.resolve_signal on-chain
 * (which grades the call and updates accuracy), and record the outcome locally.
 *
 * Run: `tsx oracle-agent/src/resolve-signal.ts [--all] [--id 7,8]`
 *   --all     resolve every pending signal now, ignoring horizon (demo/seed use).
 *   --id N,M  only resolve the listed signal ids (still must be pending/due).
 */
import {
  Direction,
  loadConfig,
  loadPrivateKey,
  loadSignals,
  log,
  makeRpcClient,
  require_,
  resolveSignalOnChain,
  section,
  SignalStatus,
  StoredSignal,
  updateSignal,
  usdToMicro,
} from "@verity/shared";
import { fetchMarketSnapshot } from "./market-data.js";

const FLAT_BAND_BPS = 50; // mirrors contract: +/-0.50% counts as FLAT-correct

function isCorrect(direction: Direction, publishMicro: number, resolveMicro: number): boolean {
  if (direction === Direction.Up) return resolveMicro > publishMicro;
  if (direction === Direction.Down) return resolveMicro < publishMicro;
  const delta = Math.abs(resolveMicro - publishMicro);
  return delta * 10_000 <= publishMicro * FLAT_BAND_BPS;
}

function isDue(signal: StoredSignal, all: boolean): boolean {
  if (signal.status !== SignalStatus.Pending) return false;
  if (all) return true;
  const dueAt = signal.publishedAt + signal.horizonHours * 3_600_000;
  return Date.now() >= dueAt;
}

function parseIdFilter(argv: string[]): Set<number> | undefined {
  const ids: number[] = [];
  for (let i = 0; i < argv.length; i++) {
    const next = argv[i + 1];
    if (argv[i] === "--id" && next) {
      ids.push(...next.split(",").map(Number).filter(Number.isInteger));
    }
  }
  return ids.length > 0 ? new Set(ids) : undefined;
}

export async function resolveDue(all: boolean, idFilter?: Set<number>): Promise<void> {
  const config = loadConfig();
  section("verity oracle — resolve signals");

  const packageHash = require_(
    config,
    "signalOraclePackageHash",
    "Set SIGNAL_ORACLE_PACKAGE_HASH"
  );
  const signer = loadPrivateKey(config.producerSecretKeyPath);
  const rpc = makeRpcClient(config);

  const due = loadSignals().filter(
    (s) => isDue(s, all) && (!idFilter || idFilter.has(s.id))
  );
  if (due.length === 0) {
    log("info", "No signals due for resolution.");
    return;
  }
  log("info", `${due.length} signal(s) to resolve.`);

  for (const signal of due) {
    const snapshot = await fetchMarketSnapshot(signal.asset, config.signalVsCurrency);
    const resolveMicro = usdToMicro(snapshot.price);
    const correct = isCorrect(signal.direction, signal.priceAtPublish, resolveMicro);

    log("chain", `Resolving signal #${signal.id} (${correct ? "CORRECT" : "WRONG"})...`);
    const tx = await resolveSignalOnChain({
      rpc,
      config,
      signer,
      packageHash,
      id: signal.id,
      priceAtResolveMicro: resolveMicro,
    });
    log("ok", `Resolved #${signal.id}. tx: ${tx.txHash}`);
    log("chain", tx.explorerUrl);

    updateSignal(signal.id, {
      status: correct ? SignalStatus.Correct : SignalStatus.Wrong,
      resolvedAt: snapshot.timestampMs,
      priceAtResolve: resolveMicro,
      priceUsdAtResolve: snapshot.price,
      correct,
      resolveTxHash: tx.txHash,
      resolveExplorerUrl: tx.explorerUrl,
    });
  }
}

const all = process.argv.includes("--all");
resolveDue(all, parseIdFilter(process.argv)).catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
