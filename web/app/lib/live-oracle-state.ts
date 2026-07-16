/**
 * Reconstructs the oracle's LIVE on-chain state from the public testnet
 * explorer API: every publish/resolve/stake tx on the SignalOracle package and
 * every x402 settlement on the X402Token package, replayed in chain order with
 * the exact same grading/slashing math as the contract
 * (contracts/src/reputation_math.rs + staking_math.rs). No secrets required.
 * Falls back to the committed snapshot if the explorer API is unreachable.
 */
import snapshotJson from "../../data/oracle-snapshot.json";
import {
  byChainOrder,
  argNumber,
  argString,
  deploySucceeded,
  deployTimeMs,
  entryPointName,
  fetchPackageDeploys,
  type ExplorerDeploy,
} from "./explorer-api";
import type { LoopEntry, Reputation, RevenueInfo, Signal, Stake, X402Info } from "./dashboard-data";
import {
  contractExplorerUrl,
  ORACLE_PACKAGE_HASH,
  PRODUCER_ACCOUNT_HASH,
  txExplorerUrl,
  X402_ASSET_DECIMALS,
  X402_ASSET_SYMBOL,
  X402_PRICE,
  X402_TOKEN_PACKAGE_HASH,
} from "./verity-public-config";

export interface OracleState {
  generatedAt: string;
  source: "live" | "snapshot";
  contract: string;
  explorer: string;
  signals: Signal[]; // ascending by id, mirrors the on-chain Mapping
  reputation: Reputation;
  stake: Stake | null;
  x402: X402Info;
  revenue: RevenueInfo;
  loopLog: LoopEntry[]; // the consumer agent's off-chain decision log (snapshot)
}

// Contract constants mirrored from reputation_math.rs / staking_math.rs.
const NEUTRAL_BPS = 5000;
const FLAT_BAND_BPS = 50;
const SLASH_BPS = 2000;

const SYMBOLS: Record<string, string> = { "casper-network": "CSPR", "pax-gold": "PAXG" };
const symbolOf = (asset: string) => SYMBOLS[asset] ?? asset.split("-")[0].toUpperCase();

/** Exact mirror of reputation_math::is_correct (integer math, ±0.5% FLAT band). */
function isCorrect(direction: number, pricePublish: number, priceResolve: number): boolean {
  if (direction === 2) return priceResolve > pricePublish;
  if (direction === 0) return priceResolve < pricePublish;
  if (direction === 1) return Math.abs(priceResolve - pricePublish) * 10_000 <= pricePublish * FLAT_BAND_BPS;
  return false;
}

function buildSignals(oracleOk: ExplorerDeploy[]): Signal[] {
  return oracleOk
    .filter((d) => entryPointName(d) === "publish_signal")
    .map((d, id) => {
      const asset = argString(d, "asset");
      return {
        id,
        asset,
        symbol: symbolOf(asset),
        directionLabel: (["DOWN", "FLAT", "UP"][argNumber(d, "direction")] ?? "FLAT") as Signal["directionLabel"],
        confidence: argNumber(d, "confidence"),
        horizonHours: argNumber(d, "horizon_hours"),
        priceUsdAtPublish: argNumber(d, "price_at_publish") / 1e6,
        reasoning: argString(d, "reasoning"),
        statusLabel: "PENDING" as Signal["statusLabel"],
        publishTxHash: d.deploy_hash,
        publishExplorerUrl: txExplorerUrl(d.deploy_hash),
        publishedAt: deployTimeMs(d),
      };
    });
}

async function buildLiveState(): Promise<OracleState> {
  const [oracleDeploys, tokenDeploys] = await Promise.all([
    fetchPackageDeploys(ORACLE_PACKAGE_HASH),
    fetchPackageDeploys(X402_TOKEN_PACKAGE_HASH),
  ]);
  const oracleOk = oracleDeploys.filter(deploySucceeded).sort(byChainOrder);
  const signals = buildSignals(oracleOk);

  // Replay stake/resolve events in chain order: a WRONG resolve slashes 20% of
  // the oracle's REMAINING bond at that moment, exactly like the contract.
  let bonded = 0;
  let slashed = 0;
  let minStake = 0;
  let stakeTokenSet = false;
  let resolved = 0;
  let correct = 0;
  const stakeTxs: NonNullable<Stake["txs"]> = [];
  const pushTx = (label: string, d: ExplorerDeploy) =>
    stakeTxs.push({ label, txHash: d.deploy_hash, explorerUrl: txExplorerUrl(d.deploy_hash) });

  for (const d of oracleOk) {
    const entry = entryPointName(d);
    if (entry === "set_stake_token") { stakeTokenSet = true; pushTx("set_stake_token", d); }
    else if (entry === "set_treasury") pushTx("set_treasury", d);
    else if (entry === "set_min_stake") { minStake = argNumber(d, "amount"); pushTx("set_min_stake", d); }
    else if (entry === "stake") { bonded += argNumber(d, "amount"); pushTx("stake", d); }
    else if (entry === "withdraw_stake") { bonded -= argNumber(d, "amount"); pushTx("withdraw", d); }
    else if (entry === "resolve_signal") {
      const signal = signals[argNumber(d, "id")];
      if (!signal || signal.statusLabel !== "PENDING") continue;
      const priceResolveMicro = argNumber(d, "price_at_resolve");
      const direction = signal.directionLabel === "UP" ? 2 : signal.directionLabel === "DOWN" ? 0 : 1;
      const ok = isCorrect(direction, Math.round(signal.priceUsdAtPublish * 1e6), priceResolveMicro);
      signal.statusLabel = ok ? "CORRECT" : "WRONG";
      signal.priceUsdAtResolve = priceResolveMicro / 1e6;
      signal.resolveTxHash = d.deploy_hash;
      signal.resolveExplorerUrl = txExplorerUrl(d.deploy_hash);
      resolved += 1;
      if (ok) correct += 1;
      else if (stakeTokenSet && bonded > 0) {
        const cut = Math.floor((bonded * SLASH_BPS) / 10_000);
        bonded -= cut;
        slashed += cut;
        pushTx("slash", d);
      }
    }
  }

  // x402 revenue: every facilitator settlement is a transfer_with_authorization
  // on the token package paying the producer. Count + sum them live.
  const settlements = tokenDeploys
    .filter((d) => deploySucceeded(d) && entryPointName(d) === "transfer_with_authorization")
    .filter((d) => argString(d, "to").includes(PRODUCER_ACCOUNT_HASH))
    .sort(byChainOrder);
  const latest = settlements[settlements.length - 1];
  const revenue: RevenueInfo = {
    settledCount: settlements.length,
    totalBaseUnits: settlements.reduce((sum, d) => sum + argNumber(d, "amount"), 0),
    symbol: X402_ASSET_SYMBOL,
    decimals: X402_ASSET_DECIMALS,
    latestTxHash: latest?.deploy_hash,
    latestExplorerUrl: latest ? txExplorerUrl(latest.deploy_hash) : undefined,
    latestAt: latest ? deployTimeMs(latest) : undefined,
  };

  return {
    generatedAt: new Date().toISOString(),
    source: "live",
    contract: ORACLE_PACKAGE_HASH,
    explorer: contractExplorerUrl(ORACLE_PACKAGE_HASH),
    signals,
    reputation: {
      accuracyBps: resolved > 0 ? Math.floor((correct * 10_000) / resolved) : NEUTRAL_BPS,
      totalSignals: signals.length,
      resolvedSignals: resolved,
      correctSignals: correct,
    },
    stake: stakeTokenSet
      ? {
          stakeSymbol: X402_ASSET_SYMBOL,
          decimals: X402_ASSET_DECIMALS,
          bondedBaseUnits: bonded,
          minStakeBaseUnits: minStake,
          slashedBaseUnits: slashed,
          txs: stakeTxs,
        }
      : null,
    x402: { priceBaseUnits: X402_PRICE, symbol: X402_ASSET_SYMBOL, decimals: X402_ASSET_DECIMALS },
    revenue,
    loopLog: (snapshotJson as { loopLog?: LoopEntry[] }).loopLog ?? [],
  };
}

/** Committed testnet snapshot, reshaped to OracleState (explorer API down). */
function snapshotState(): OracleState {
  const snap = snapshotJson as unknown as OracleState & { generatedAt: string };
  const loopLog = (snapshotJson as { loopLog?: LoopEntry[] }).loopLog ?? [];
  const settled = loopLog.filter((entry) => entry.settlementTx); // newest first
  const settledEntry = settled[0];
  return {
    ...snap,
    source: "snapshot",
    explorer: contractExplorerUrl(ORACLE_PACKAGE_HASH),
    revenue: {
      settledCount: settled.length,
      totalBaseUnits: settled.length * Number(X402_PRICE),
      symbol: X402_ASSET_SYMBOL,
      decimals: X402_ASSET_DECIMALS,
      latestTxHash: settledEntry?.settlementTx,
      latestExplorerUrl: settledEntry ? txExplorerUrl(settledEntry.settlementTx as string) : undefined,
    },
    loopLog,
  };
}

// 30s in-memory cache: keeps the dashboard snappy and is polite to the public
// explorer API. Serverless instances each hold their own copy — that's fine.
let cached: { state: OracleState; at: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getOracleState(): Promise<OracleState> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.state;
  try {
    const state = await buildLiveState();
    cached = { state, at: Date.now() };
    return state;
  } catch (err) {
    console.error("[live-oracle-state] explorer API failed, serving fallback:", err);
    return cached?.state ?? snapshotState();
  }
}
