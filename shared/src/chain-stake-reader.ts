/**
 * Rebuilds the oracle's collateral position from the chain itself.
 *
 * Same problem `chain-signal-reader` solves for the signal book, and the same
 * cause: `loop-output/stake.json` is a gitignored cache on whichever machine last
 * ran the agent. The scheduled cycle runs on a fresh CI runner that has no such
 * file, so the snapshot it committed carried no bond, no slash total and no tx
 * trail — the dashboard's collateral card, blanked on every unattended turn.
 *
 * Bond state is fully derivable from public history: stake/withdraw carry their
 * amount, and a slash is implied by a resolve that graded WRONG. Replaying those
 * in chain order with the contract's own 20%-of-remaining rule reproduces the
 * live figures without secrets and without a local file.
 *
 * Scope of the tx trail: these are events on the *oracle* package. The CEP-18
 * `approve` calls that precede a stake happen on the token package and so are not
 * here — they move no collateral, and the bond/slash totals are unaffected.
 * Verified against a local store built by the agent: identical bonded, slashed
 * and minimum figures.
 */
import { fetchPackageDeploys, byChainOrder, type ChainReadOptions, type ExplorerDeploy } from "./chain-signal-reader.js";
import { txLink } from "./logging.js";
import { SLASH_BPS, type StakeTx } from "./stake-store.js";
import { SignalStatus } from "./signal-types.js";
import type { StoredSignal } from "./signal-store.js";

/** The part of the oracle's stake state that public chain history can prove. */
export interface ChainStakeState {
  stakeSymbol: string;
  decimals: number;
  bondedBaseUnits: number;
  minStakeBaseUnits: number;
  slashedBaseUnits: number;
  txs: StakeTx[];
}

const succeeded = (d: ExplorerDeploy): boolean => !d.error_message;
const entryPoint = (d: ExplorerDeploy): string => d.contract_entrypoint?.name ?? "";
const deployTimeMs = (d: ExplorerDeploy): number => Date.parse(d.timestamp);
const argNumber = (d: ExplorerDeploy, name: string): number => Number(d.args?.[name]?.parsed ?? 0);

export interface ReplayStakeOptions {
  /** Display symbol for the bonded asset, e.g. "x402". */
  stakeSymbol: string;
  decimals: number;
  explorerBase?: string;
}

/**
 * Replay staking history into a live bond.
 *
 * `signals` supplies the grade of each resolve — the contract slashes on a WRONG
 * resolution, so the reader must know the outcome the contract computed rather
 * than re-deriving it. Pass the book from `replaySignals` over the same deploys.
 *
 * Returns undefined until the owner has set a stake token: before that the
 * contract cannot hold collateral, and reporting a zero bond would read as "this
 * oracle staked nothing" rather than "staking is not switched on".
 */
export function replayStake(
  deploys: ExplorerDeploy[],
  signals: StoredSignal[],
  opts: ReplayStakeOptions
): ChainStakeState | undefined {
  const explorerBase = opts.explorerBase ?? "https://testnet.cspr.live";
  const ordered = deploys.filter(succeeded).sort(byChainOrder);

  let bonded = 0;
  let slashed = 0;
  let minStake = 0;
  let stakeTokenSet = false;
  const txs: StakeTx[] = [];

  const pushTx = (label: string, d: ExplorerDeploy, amountBaseUnits?: number) =>
    txs.push({
      label,
      txHash: d.deploy_hash,
      explorerUrl: txLink(explorerBase, d.deploy_hash),
      at: deployTimeMs(d),
      ...(amountBaseUnits === undefined ? {} : { amountBaseUnits }),
    });

  for (const d of ordered) {
    switch (entryPoint(d)) {
      case "set_stake_token":
        stakeTokenSet = true;
        pushTx("set_stake_token", d);
        break;
      case "set_treasury":
        pushTx("set_treasury", d);
        break;
      case "set_min_stake":
        minStake = argNumber(d, "amount");
        pushTx("set_min_stake", d);
        break;
      case "stake": {
        const amount = argNumber(d, "amount");
        bonded += amount;
        pushTx("stake", d, amount);
        break;
      }
      case "withdraw_stake": {
        const amount = argNumber(d, "amount");
        bonded -= amount;
        pushTx("withdraw", d, amount);
        break;
      }
      case "resolve_signal": {
        // Only a wrong call costs collateral, and only once staking is live and
        // there is something left to take.
        const graded = signals.find((s) => s.id === argNumber(d, "id"));
        if (!graded || graded.status !== SignalStatus.Wrong) break;
        if (!stakeTokenSet || bonded <= 0) break;
        const cut = Math.floor((bonded * SLASH_BPS) / 10_000);
        bonded -= cut;
        slashed += cut;
        pushTx("slash", d, cut);
        break;
      }
    }
  }

  if (!stakeTokenSet) return undefined;
  return {
    stakeSymbol: opts.stakeSymbol,
    decimals: opts.decimals,
    bondedBaseUnits: bonded,
    minStakeBaseUnits: minStake,
    slashedBaseUnits: slashed,
    txs,
  };
}

/** Fetch the package's history and replay the bond from it. */
export async function readStakeFromChain(
  opts: ChainReadOptions & ReplayStakeOptions,
  signals: StoredSignal[]
): Promise<ChainStakeState | undefined> {
  const deploys = await fetchPackageDeploys(opts);
  return replayStake(deploys, signals, opts);
}
