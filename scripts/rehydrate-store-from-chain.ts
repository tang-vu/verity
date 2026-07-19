/**
 * Rebuilds the local signal book from the chain.
 *
 * The store in loop-output/ is a cache on one machine; the contract is the
 * record. Run this and the oracle can be operated from anywhere — a fresh
 * clone, a new laptop, a CI runner — without losing track of its open calls or
 * reusing a signal id that is already taken on-chain.
 *
 * Run: `npm run rehydrate`
 *      `npm run rehydrate -- --dry-run`   compare chain vs local, write nothing
 */
import {
  loadConfig,
  loadSignals,
  log,
  mergeWithLocal,
  readSignalsFromChain,
  require_,
  saveSignals,
  section,
  statusLabel,
  StoredSignal,
} from "@verity/shared";

/** A one-line description of what a rehydrate would change, for the operator. */
function describeDrift(chain: StoredSignal[], local: StoredSignal[]): string[] {
  const byId = new Map(local.map((s) => [s.id, s]));
  const notes: string[] = [];

  for (const signal of chain) {
    const prior = byId.get(signal.id);
    if (!prior) {
      notes.push(`+ #${signal.id} ${signal.symbol} ${statusLabel(signal.status)} — missing locally`);
    } else if (prior.status !== signal.status) {
      notes.push(
        `~ #${signal.id} ${signal.symbol} ${statusLabel(prior.status)} → ${statusLabel(signal.status)}`
      );
    }
  }

  // Local-only entries are the dangerous direction: a publish that the store
  // recorded but the chain never accepted would shift every later id by one.
  for (const signal of local) {
    if (!chain.some((c) => c.id === signal.id)) {
      notes.push(`- #${signal.id} ${signal.symbol} — local only, not on-chain`);
    }
  }

  return notes;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const config = loadConfig();
  section(`verity — rehydrate signal book from chain${dryRun ? " (dry run)" : ""}`);

  const packageHash = require_(config, "signalOraclePackageHash", "Set SIGNAL_ORACLE_PACKAGE_HASH");

  log("chain", `Reading publish/resolve history for package ${packageHash.slice(0, 12)}…`);
  const chain = await readSignalsFromChain({
    packageHash,
    explorerBase: config.explorerBase,
  });
  const local = loadSignals();

  const resolved = chain.filter((s) => s.correct !== undefined).length;
  const correct = chain.filter((s) => s.correct === true).length;
  log(
    "info",
    `Chain: ${chain.length} signal(s), ${resolved} resolved, ${correct} correct. Local: ${local.length}.`
  );

  const drift = describeDrift(chain, local);
  if (drift.length === 0) {
    log("ok", "Local book already matches the chain — nothing to do.");
    return;
  }
  for (const note of drift) log("warn", `  ${note}`);

  if (dryRun) {
    log("ok", "Dry run — the local book was left untouched.");
    return;
  }

  saveSignals(mergeWithLocal(chain, local));
  log("ok", `Rehydrated ${chain.length} signal(s) from chain.`);
  log("info", `Next publish will take id #${chain.length}.`);
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
