/**
 * Oracle Agent — resolve due signals. For each PENDING signal whose horizon has
 * elapsed, fetch the current price, call SignalOracle.resolve_signal on-chain
 * (which grades the call and updates accuracy), and record the outcome locally.
 *
 * Run: `tsx oracle-agent/src/resolve-signal.ts [--all] [--id 7,8]`
 *   --all     resolve every pending signal now, ignoring horizon (demo/seed use).
 *   --id N,M  only resolve the listed signal ids (still must be pending/due).
 *   --dry-run print what would be resolved and stop before any on-chain call.
 *
 * Signals far past their horizon are skipped unless named explicitly — see
 * `isStale`. This keeps an unattended run from grading old calls against prices
 * that have nothing to do with the window those calls were made for.
 */
import {
  Direction,
  loadConfig,
  loadPrivateKey,
  loadSignals,
  log,
  makeRpcClient,
  recordSlash,
  require_,
  resolveSignalOnChain,
  section,
  stakeToDisplay,
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

function dueAt(signal: StoredSignal): number {
  return signal.publishedAt + signal.horizonHours * 3_600_000;
}

function isDue(signal: StoredSignal, all: boolean): boolean {
  if (signal.status !== SignalStatus.Pending) return false;
  if (all) return true;
  return Date.now() >= dueAt(signal);
}

/**
 * A call is stale once a further full horizon has passed beyond its deadline.
 * Grading a 24h call against a price from days later measures drift, not the
 * forecast, yet still slashes the bond for it — so an unattended run leaves
 * these alone and an operator has to name the id to resolve one anyway.
 */
function isStale(signal: StoredSignal): boolean {
  return Date.now() > dueAt(signal) + signal.horizonHours * 3_600_000;
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

export async function resolveDue(
  all: boolean,
  idFilter?: Set<number>,
  dryRun = false
): Promise<void> {
  const config = loadConfig();
  section("verity oracle — resolve signals");

  const packageHash = require_(
    config,
    "signalOraclePackageHash",
    "Set SIGNAL_ORACLE_PACKAGE_HASH"
  );
  const signer = loadPrivateKey(config.producerSecretKeyPath);
  const rpc = makeRpcClient(config);

  const candidates = loadSignals().filter(
    (s) => isDue(s, all) && (!idFilter || idFilter.has(s.id))
  );
  // Named ids (and --all) are an explicit operator decision; anything else that
  // has gone stale is held back rather than silently graded and slashed.
  const explicit = all || idFilter !== undefined;
  const stale = explicit ? [] : candidates.filter(isStale);
  const due = explicit ? candidates : candidates.filter((s) => !isStale(s));

  if (stale.length > 0) {
    log(
      "warn",
      `Skipping ${stale.length} stale signal(s): #${stale.map((s) => s.id).join(", #")}. ` +
        `Resolve one deliberately with --id if that is what you want.`
    );
  }
  if (due.length === 0) {
    log("info", "No signals due for resolution.");
    return;
  }
  log("info", `${due.length} signal(s) to resolve.`);
  if (dryRun) {
    for (const s of due) {
      log("info", `  would resolve #${s.id} (${s.asset}, due ${new Date(dueAt(s)).toISOString()})`);
    }
    log("ok", "Dry run — nothing was sent on-chain.");
    return;
  }

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

    // A wrong call slashes the bond inside resolve_signal; mirror it locally so the
    // audit trail and the dashboard snapshot do not keep showing burned collateral.
    if (!correct) {
      const cut = recordSlash(tx);
      if (cut !== undefined) {
        log("warn", `Slashed ${stakeToDisplay(cut, config.x402AssetDecimals)} ${config.x402AssetSymbol} for the wrong call.`);
      }
    }

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
const dryRun = process.argv.includes("--dry-run");
resolveDue(all, parseIdFilter(process.argv), dryRun).catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
