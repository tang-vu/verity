/**
 * Snapshot the current testnet data (signals, reputation, collateral, loop log)
 * into web/data/oracle-snapshot.json so the dashboard runs standalone on Vercel —
 * no oracle server needed. All values are real on-chain testnet data.
 *
 * This runs on the unattended cycle, on a CI runner that has none of the agent's
 * local `loop-output/` files. Anything read only from those files would therefore
 * be committed as empty and wipe what the last good run recorded, so:
 *   - the bond is rebuilt from chain history (chain-stake-reader), and
 *   - the loop log, which no chain read can reconstruct, is carried forward from
 *     the existing snapshot rather than overwritten with nothing.
 *
 * Run: node --import tsx scripts/generate-web-snapshot.ts
 */
import { existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeReputation,
  directionLabel,
  loadConfig,
  loadLoopLog,
  loadSignals,
  loadStakeState,
  readStakeFromChain,
  statusLabel,
  type ChainStakeState,
  type StakeState,
} from "@verity/shared";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = loadConfig();
const signals = loadSignals();
const pkg = cfg.signalOraclePackageHash ?? cfg.signalOracleContractHash ?? null;

const outDir = resolve(root, "web/data");
const out = resolve(outDir, "oracle-snapshot.json");

/**
 * What lands in the snapshot's `stake` field: the chain-derived bond, optionally
 * carrying the config-only accounts the local store knows about.
 */
type SnapshotStake =
  | (ChainStakeState & Record<string, unknown>)
  | StakeState
  | Record<string, unknown>
  | null;

/** Whatever the last run committed — the only source for fields the chain can't prove. */
function previousSnapshot(): { loopLog?: unknown[]; stake?: Record<string, unknown> | null } {
  if (!existsSync(out)) return {};
  try {
    return JSON.parse(readFileSync(out, "utf8"));
  } catch {
    return {};
  }
}

/**
 * The bond, preferring public chain history over the local cache.
 *
 * The local store additionally knows the oracle and treasury accounts, which are
 * constructor/config details rather than replayable events, so those ride along
 * when the file happens to exist. A chain read failure falls back to the cache,
 * and an empty cache falls back to what was already published — never to null,
 * which would blank the collateral card.
 */
async function resolveStake(): Promise<SnapshotStake> {
  const local = loadStakeState();
  const previous = previousSnapshot().stake ?? null;
  let chain: ChainStakeState | undefined;

  if (pkg) {
    try {
      chain = await readStakeFromChain(
        {
          packageHash: pkg,
          explorerBase: cfg.explorerBase,
          stakeSymbol: cfg.x402AssetSymbol,
          decimals: cfg.x402AssetDecimals,
        },
        signals
      );
    } catch (err) {
      console.warn(`  stake: chain read failed (${err instanceof Error ? err.message : err})`);
    }
  }

  if (!chain) return local ?? previous;
  return {
    ...(previous ?? {}),
    ...(local ?? {}),
    ...chain,
    ...(local?.oracle ? { oracle: local.oracle } : {}),
  };
}

const localLoopLog = loadLoopLog();
const loopLog = localLoopLog.length > 0 ? localLoopLog.slice().reverse() : previousSnapshot().loopLog ?? [];

const snapshot = {
  generatedAt: new Date().toISOString(),
  signals: signals.map((s) => ({ ...s, directionLabel: directionLabel(s.direction), statusLabel: statusLabel(s.status) })),
  reputation: computeReputation(signals),
  stake: await resolveStake(),
  x402: { priceBaseUnits: cfg.x402Price, symbol: cfg.x402AssetSymbol, decimals: cfg.x402AssetDecimals },
  contract: pkg,
  explorer: pkg ? `${cfg.explorerBase}/contract-package/${pkg}` : null,
  loopLog,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(out, JSON.stringify(snapshot, null, 2));
const stake = snapshot.stake as ChainStakeState | null;
console.log(`snapshot written: ${out}`);
console.log(
  `  ${snapshot.signals.length} signals · reputation ${(snapshot.reputation.accuracyBps / 100).toFixed(1)}% · ` +
    `bond ${stake ? `${stake.bondedBaseUnits} (${stake.slashedBaseUnits} slashed, ${stake.txs?.length ?? 0} txs)` : "none"} · ` +
    `${snapshot.loopLog.length} loop runs${localLoopLog.length === 0 ? " (carried forward)" : ""}`
);
