/**
 * Rebuilds the oracle's signal book from the chain itself.
 *
 * The local store (`loop-output/signals.json`) is a cache, not the record: it is
 * gitignored and lives on whichever machine last ran the agent. Without this
 * reader, losing that file loses the oracle's memory of its own open calls —
 * they could never be resolved, and the next publish would reuse id 0 and
 * collide with signals already on-chain, because ids are assigned client-side
 * from the store's length.
 *
 * So the book is reconstructed from the public testnet explorer API by replaying
 * every successful publish/resolve on the SignalOracle package in chain order.
 * That is the same reconstruction the dashboard does, and it needs no secrets —
 * which is what lets the oracle's cycle run unattended on any machine.
 */
import { txLink } from "./logging.js";
import { isCorrect } from "./reputation-math.js";
import { Direction, SignalStatus } from "./signal-types.js";
import type { StoredSignal } from "./signal-store.js";

/** Only the deploy fields this replay needs; the API returns considerably more. */
export interface ExplorerDeploy {
  deploy_hash: string;
  block_height: number;
  caller_hash: string;
  args: Record<string, { parsed: unknown }> | null;
  error_message: string | null;
  timestamp: string; // ISO-8601
  contract_entrypoint: { name: string } | null;
}

const DEFAULT_API_BASE = "https://api.testnet.cspr.live";
const PAGE_LIMIT = 100;
const MAX_PAGES = 10; // 1000 deploys, far beyond the oracle's activity

export interface ChainReadOptions {
  packageHash: string;
  /** Public explorer API base; no access token required. */
  apiBase?: string;
  /** Explorer base for the human-facing tx links stored alongside each signal. */
  explorerBase?: string;
  fetchImpl?: typeof fetch;
}

/** Every deploy ever executed against a contract package, newest first. */
export async function fetchPackageDeploys(opts: ChainReadOptions): Promise<ExplorerDeploy[]> {
  const apiBase = opts.apiBase ?? DEFAULT_API_BASE;
  const doFetch = opts.fetchImpl ?? fetch;
  const all: ExplorerDeploy[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `${apiBase}/deploys?contract_package_hash=${opts.packageHash}` +
      `&limit=${PAGE_LIMIT}&page=${page}`;
    const res = await doFetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      throw new Error(`explorer API ${res.status} for contract package ${opts.packageHash}`);
    }
    const body = (await res.json()) as { item_count: number; data: ExplorerDeploy[] };
    const batch = body.data ?? [];
    all.push(...batch);
    if (batch.length === 0 || all.length >= body.item_count) break;
  }
  return all;
}

const succeeded = (d: ExplorerDeploy): boolean => !d.error_message;
const entryPoint = (d: ExplorerDeploy): string => d.contract_entrypoint?.name ?? "";
/**
 * Deploy time as the chain recorded it. This runs about a minute before the
 * wall-clock the publisher writes locally, which waits for confirmation first —
 * immaterial against horizons measured in hours, and the verifiable one of the
 * two, so a rehydrated book uses it for the horizon math.
 */
const deployTimeMs = (d: ExplorerDeploy): number => Date.parse(d.timestamp);

/** Oldest first — the order the contract saw them, which is what a replay needs. */
export function byChainOrder(a: ExplorerDeploy, b: ExplorerDeploy): number {
  return a.block_height - b.block_height || deployTimeMs(a) - deployTimeMs(b);
}

function argNumber(d: ExplorerDeploy, name: string): number {
  return Number(d.args?.[name]?.parsed ?? 0);
}

function argString(d: ExplorerDeploy, name: string): string {
  return String(d.args?.[name]?.parsed ?? "");
}

const SYMBOLS: Record<string, string> = { "casper-network": "CSPR", "pax-gold": "PAXG" };

/** CoinGecko asset id -> ticker, matching what the publisher stored locally. */
export function symbolOf(asset: string): string {
  return SYMBOLS[asset] ?? (asset.split("-")[0] ?? asset).toUpperCase();
}

/**
 * Replays publish/resolve deploys into the agent's signal book.
 *
 * Ids come from publish order, mirroring the client-side `nextSignalId()` that
 * assigned them — the Nth successful publish on this package is signal #N.
 */
export function replaySignals(
  deploys: ExplorerDeploy[],
  explorerBase = "https://testnet.cspr.live"
): StoredSignal[] {
  const ordered = deploys.filter(succeeded).sort(byChainOrder);
  const signals: StoredSignal[] = [];

  for (const d of ordered) {
    const entry = entryPoint(d);

    if (entry === "publish_signal") {
      const asset = argString(d, "asset");
      const priceAtPublish = argNumber(d, "price_at_publish");
      signals.push({
        id: signals.length,
        asset,
        symbol: symbolOf(asset),
        direction: argNumber(d, "direction") as Direction,
        confidence: argNumber(d, "confidence"),
        horizonHours: argNumber(d, "horizon_hours"),
        priceAtPublish,
        priceUsdAtPublish: priceAtPublish / 1e6,
        reasoning: argString(d, "reasoning"),
        keyFactors: [], // an LLM detail the contract never stored
        publishedAt: deployTimeMs(d),
        publisher: d.caller_hash,
        publishTxHash: d.deploy_hash,
        publishExplorerUrl: txLink(explorerBase, d.deploy_hash),
        status: SignalStatus.Pending,
      });
      continue;
    }

    if (entry === "resolve_signal") {
      const signal = signals[argNumber(d, "id")];
      // A resolve of an unknown or already-graded id can only be noise: the
      // contract rejects the second one, so it never changed the score.
      if (!signal || signal.status !== SignalStatus.Pending) continue;

      const priceAtResolve = argNumber(d, "price_at_resolve");
      const correct = isCorrect(signal.direction, signal.priceAtPublish, priceAtResolve);
      signal.status = correct ? SignalStatus.Correct : SignalStatus.Wrong;
      signal.correct = correct;
      signal.resolvedAt = deployTimeMs(d);
      signal.priceAtResolve = priceAtResolve;
      signal.priceUsdAtResolve = priceAtResolve / 1e6;
      signal.resolveTxHash = d.deploy_hash;
      signal.resolveExplorerUrl = txLink(explorerBase, d.deploy_hash);
    }
  }

  return signals;
}

/** Fetch + replay: the oracle's book exactly as the chain records it. */
export async function readSignalsFromChain(opts: ChainReadOptions): Promise<StoredSignal[]> {
  const deploys = await fetchPackageDeploys(opts);
  return replaySignals(deploys, opts.explorerBase);
}

/**
 * Merges chain truth over a local book. The chain wins on everything it records;
 * the local entry only contributes what was never on-chain to begin with (the
 * LLM's key factors), so a rehydrate keeps the richer audit trail where it has
 * one and still corrects any drift.
 */
export function mergeWithLocal(chain: StoredSignal[], local: StoredSignal[]): StoredSignal[] {
  const byId = new Map(local.map((s) => [s.id, s]));
  return chain.map((s) => {
    const prior = byId.get(s.id);
    const keyFactors = s.keyFactors.length > 0 ? s.keyFactors : prior?.keyFactors ?? [];
    return { ...s, keyFactors };
  });
}
