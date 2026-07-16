/**
 * Shared types + tiny helpers for the dashboard page and its components.
 * Shapes mirror web/data/oracle-snapshot.json (served by /api/oracle/*).
 */

export const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_BASE ?? "https://testnet.cspr.live";

export type StatusLabel = "PENDING" | "CORRECT" | "WRONG";

export interface Stake {
  stakeSymbol: string;
  decimals: number;
  bondedBaseUnits: number;
  minStakeBaseUnits: number;
  slashedBaseUnits: number;
  txs?: { label: string; txHash: string; explorerUrl: string }[];
}

export interface Signal {
  id: number;
  asset: string;
  symbol: string;
  directionLabel: "UP" | "DOWN" | "FLAT";
  confidence: number;
  horizonHours: number;
  priceUsdAtPublish: number;
  priceUsdAtResolve?: number;
  reasoning: string;
  statusLabel: StatusLabel;
  publishTxHash: string;
  publishExplorerUrl: string;
  resolveTxHash?: string;
  resolveExplorerUrl?: string;
  publishedAt: number;
}

export interface Reputation {
  accuracyBps: number;
  totalSignals: number;
  resolvedSignals: number;
  correctSignals: number;
}

/** x402 pricing of the paid signal endpoint (amounts are CEP-18 base units). */
export interface X402Info {
  priceBaseUnits: string;
  symbol: string;
  decimals: number;
}

/** Live x402 revenue: on-chain facilitator settlements paying the oracle. */
export interface RevenueInfo {
  settledCount: number;
  totalBaseUnits: number;
  symbol: string;
  decimals: number;
  latestTxHash?: string;
  latestExplorerUrl?: string;
  latestAt?: number;
}

/** Whether the API served freshly reconstructed chain data or the snapshot. */
export interface DataProvenance {
  source: "live" | "snapshot";
  generatedAt: string;
}

export interface LoopEntry {
  at: number;
  signalId: number;
  directionLabel: string;
  confidence: number;
  reputationBps: number;
  decisionSide: string;
  decisionNotional: number;
  decisionRationale: string;
  paid: boolean;
  settlementTx?: string;
  swapVia: string;
  swapTx?: string;
  swapExplorerUrl?: string;
  swapDetail: string;
}

export interface SignalsResponse extends DataProvenance { count: number; signals: Signal[] }
export interface RepResponse extends DataProvenance {
  reputation: Reputation;
  stake?: Stake | null;
  x402?: X402Info | null;
  revenue?: RevenueInfo | null;
  contract: string | null;
  explorer: string | null;
}
export interface LoopResponse { count: number; entries: LoopEntry[] }

export function fmtUnits(baseUnits: number, decimals: number): string {
  return (baseUnits / 10 ** decimals).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function txLink(hash: string): string {
  return `${EXPLORER}/transaction/${hash}`;
}

/** USD prices span 5 orders of magnitude (CSPR ~$0.014, PAXG ~$4160). */
export function fmtUsd(value?: number | null): string {
  if (value == null) return "—";
  return "$" + (value >= 1 ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value.toPrecision(3));
}

export function fmtWhen(ms?: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function short(hash?: string): string {
  if (!hash || hash === "n/a") return "—";
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}
