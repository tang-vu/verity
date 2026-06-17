/**
 * TypeScript mirror of the on-chain `Signal` / `Reputation` types and the
 * direction / status encodings used by the SignalOracle contract. Keeping a
 * single source of truth here avoids drift between the contract and the agents.
 */

/** Price fixed-point scale shared with the contract (micro-USD). */
export const PRICE_SCALE = 1_000_000;

export enum Direction {
  Down = 0,
  Flat = 1,
  Up = 2,
}

export enum SignalStatus {
  Pending = 0,
  Correct = 1,
  Wrong = 2,
}

export interface Signal {
  id: number;
  asset: string;
  direction: Direction;
  confidence: number; // 0..100
  horizonHours: number;
  priceAtPublish: number; // micro-USD
  reasoning: string;
  publishedAt: number; // ms
  status: SignalStatus;
  resolvedAt: number; // ms, 0 while pending
  priceAtResolve: number; // micro-USD, 0 while pending
  publisher: string; // account hash hex
}

export interface Reputation {
  accuracyBps: number; // 0..10000
  totalSignals: number;
  resolvedSignals: number;
  correctSignals: number;
}

export function directionLabel(d: Direction): string {
  return d === Direction.Up ? "UP" : d === Direction.Down ? "DOWN" : "FLAT";
}

export function directionFromLabel(label: string): Direction {
  const up = label.trim().toUpperCase();
  if (up === "UP") return Direction.Up;
  if (up === "DOWN") return Direction.Down;
  return Direction.Flat;
}

export function statusLabel(s: SignalStatus): string {
  return s === SignalStatus.Correct
    ? "CORRECT"
    : s === SignalStatus.Wrong
    ? "WRONG"
    : "PENDING";
}

/** Convert a floating USD price to integer micro-USD for on-chain storage. */
export function usdToMicro(price: number): number {
  return Math.round(price * PRICE_SCALE);
}

/** Convert integer micro-USD back to a USD number for display. */
export function microToUsd(micro: number): number {
  return micro / PRICE_SCALE;
}

/** Basis points (0..10000) to a percent string, e.g. 7500 -> "75.0%". */
export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}
