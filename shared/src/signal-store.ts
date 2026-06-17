/**
 * Authoritative local index of every signal the oracle has published, each entry
 * carrying its on-chain publish/resolve transaction hashes. The contract is the
 * source of truth for reputation; this store is the verifiable audit trail the
 * x402 server and dashboard render (every number links to a cspr.live tx).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fromRepoRoot } from "./repo-root.js";
import { Direction, Reputation, SignalStatus } from "./signal-types.js";

export interface StoredSignal {
  id: number;
  asset: string;
  symbol: string;
  direction: Direction;
  confidence: number;
  horizonHours: number;
  priceAtPublish: number; // micro-USD (on-chain scale)
  priceUsdAtPublish: number;
  reasoning: string;
  keyFactors: string[];
  publishedAt: number; // ms epoch
  publisher: string; // account hash hex
  publishTxHash: string;
  publishExplorerUrl: string;
  status: SignalStatus;
  resolvedAt?: number;
  priceAtResolve?: number;
  priceUsdAtResolve?: number;
  correct?: boolean;
  resolveTxHash?: string;
  resolveExplorerUrl?: string;
}

const DEFAULT_STORE = "./loop-output/signals.json";

function storePath(): string {
  return fromRepoRoot(process.env.VERITY_STORE_PATH ?? DEFAULT_STORE);
}

export function loadSignals(): StoredSignal[] {
  const path = storePath();
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf8")) as StoredSignal[];
  } catch {
    return [];
  }
}

export function saveSignals(signals: StoredSignal[]): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(signals, null, 2));
}

export function appendSignal(signal: StoredSignal): void {
  const signals = loadSignals();
  signals.push(signal);
  saveSignals(signals);
}

export function updateSignal(id: number, patch: Partial<StoredSignal>): StoredSignal | undefined {
  const signals = loadSignals();
  const idx = signals.findIndex((s) => s.id === id);
  if (idx === -1) return undefined;
  signals[idx] = { ...signals[idx]!, ...patch };
  saveSignals(signals);
  return signals[idx];
}

export function latestSignal(): StoredSignal | undefined {
  const signals = loadSignals();
  return signals.length ? signals[signals.length - 1] : undefined;
}

export function nextSignalId(): number {
  return loadSignals().length;
}

/**
 * Cumulative hit-rate reputation, mirroring the on-chain contract math: accuracy
 * = correct / resolved (bps), neutral 5000 when nothing has resolved yet.
 */
export function computeReputation(signals: StoredSignal[]): Reputation {
  const resolved = signals.filter((s) => s.status !== SignalStatus.Pending);
  const correct = resolved.filter((s) => s.correct === true).length;
  const accuracyBps = resolved.length === 0 ? 5000 : Math.floor((correct * 10000) / resolved.length);
  return {
    accuracyBps,
    totalSignals: signals.length,
    resolvedSignals: resolved.length,
    correctSignals: correct,
  };
}
