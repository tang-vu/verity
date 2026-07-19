/**
 * Local snapshot of the oracle's on-chain collateral: how much x402USD it has
 * bonded, the minimum required to publish, and how much has been slashed by wrong
 * calls. The contract is the source of truth; this store is the verifiable audit
 * trail (every entry carries a real tx hash) the x402 server and dashboard render,
 * so the "reputation is backed by real capital" claim is inspectable on cspr.live.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fromRepoRoot } from "./repo-root.js";

export interface StakeTx {
  label: string; // e.g. "stake", "slash", "withdraw", "set_min_stake"
  txHash: string;
  explorerUrl: string;
  at: number;
  /** Collateral moved by this tx, when the entry represents one. Absent on the
   *  configuration steps, and on slash entries recorded before it was tracked. */
  amountBaseUnits?: number;
}

export interface StakeState {
  oracle: string; // publisher account hash hex
  stakeTokenPackageHash?: string;
  stakeSymbol: string; // "x402"
  decimals: number; // 2
  bondedBaseUnits: number; // currently bonded collateral
  minStakeBaseUnits: number; // publish gate
  slashedBaseUnits: number; // cumulative slashed
  treasury?: string; // where slashed collateral flows (consumer account)
  txs: StakeTx[];
  updatedAt: number;
}

const DEFAULT_STORE = "./loop-output/stake.json";

function storePath(): string {
  return fromRepoRoot(process.env.VERITY_STAKE_STORE_PATH ?? DEFAULT_STORE);
}

export function loadStakeState(): StakeState | undefined {
  const path = storePath();
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as StakeState;
  } catch {
    return undefined;
  }
}

export function saveStakeState(state: StakeState): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  state.updatedAt = Date.now();
  writeFileSync(path, JSON.stringify(state, null, 2));
}

/** Convert stake token base units to a display number (respecting decimals). */
export function stakeToDisplay(baseUnits: number, decimals: number): number {
  return baseUnits / 10 ** decimals;
}

/**
 * Fraction (bps) of the *remaining* bond destroyed by one wrong resolution.
 * Mirrors the contract's SLASH_BPS — losses compound, so live collateral tracks
 * recent honesty rather than a lifetime average.
 */
export const SLASH_BPS = 2_000;

/** Collateral destroyed by a single wrong resolution, integer-floored as on-chain. */
export function slashAmount(bondedBaseUnits: number): number {
  return Math.floor((bondedBaseUnits * SLASH_BPS) / 10_000);
}

/**
 * Mirror into the local store the slash that `resolve_signal` just applied on-chain
 * for a wrong call. The contract is the source of truth; without this the store —
 * and the dashboard snapshot built from it — keeps reporting a bond that was
 * already burned. Shares the resolve tx hash, since the slash happens inside it.
 * Returns the slashed amount, or undefined when there is no stake state yet.
 */
export function recordSlash(tx: { txHash: string; explorerUrl: string }): number | undefined {
  const state = loadStakeState();
  if (!state) return undefined;
  const cut = slashAmount(state.bondedBaseUnits);
  state.bondedBaseUnits -= cut;
  state.slashedBaseUnits += cut;
  state.txs.push({
    label: "slash",
    txHash: tx.txHash,
    explorerUrl: tx.explorerUrl,
    at: Date.now(),
    amountBaseUnits: cut,
  });
  saveStakeState(state);
  return cut;
}
