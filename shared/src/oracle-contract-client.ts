/**
 * Typed wrappers for the SignalOracle contract entry points. Argument names
 * mirror the Odra `publish_signal` / `resolve_signal` parameters exactly (Odra
 * derives runtime-arg names from the Rust function parameters).
 */
import { Args, CLValue, Key, PrivateKey, RpcClient } from "./casper-sdk.js";
import { callContract, SubmittedTx } from "./casper-client.js";
import type { VerityConfig } from "./env-config.js";
import { Direction } from "./signal-types.js";

/** Generous payment ceilings (motes) for the small oracle entry points. */
const PUBLISH_PAYMENT_MOTES = 6_000_000_000;
const RESOLVE_PAYMENT_MOTES = 4_000_000_000;
const STAKE_PAYMENT_MOTES = 6_000_000_000;
const ADMIN_PAYMENT_MOTES = 4_000_000_000;

export interface PublishParams {
  rpc: RpcClient;
  config: VerityConfig;
  signer: PrivateKey;
  packageHash: string;
  asset: string;
  direction: Direction;
  confidence: number;
  horizonHours: number;
  priceAtPublishMicro: number;
  reasoning: string;
}

export async function publishSignalOnChain(p: PublishParams): Promise<SubmittedTx> {
  const args = Args.fromMap({
    asset: CLValue.newCLString(p.asset),
    direction: CLValue.newCLUint8(p.direction),
    confidence: CLValue.newCLUint8(p.confidence),
    horizon_hours: CLValue.newCLUInt32(p.horizonHours),
    price_at_publish: CLValue.newCLUint64(p.priceAtPublishMicro),
    reasoning: CLValue.newCLString(p.reasoning),
  });
  return callContract({
    rpc: p.rpc,
    config: p.config,
    signer: p.signer,
    packageHash: p.packageHash,
    entryPoint: "publish_signal",
    args,
    paymentMotes: PUBLISH_PAYMENT_MOTES,
    wait: true,
  });
}

export interface ResolveParams {
  rpc: RpcClient;
  config: VerityConfig;
  signer: PrivateKey;
  packageHash: string;
  id: number;
  priceAtResolveMicro: number;
}

export async function resolveSignalOnChain(p: ResolveParams): Promise<SubmittedTx> {
  const args = Args.fromMap({
    id: CLValue.newCLUint64(p.id),
    price_at_resolve: CLValue.newCLUint64(p.priceAtResolveMicro),
  });
  return callContract({
    rpc: p.rpc,
    config: p.config,
    signer: p.signer,
    packageHash: p.packageHash,
    entryPoint: "resolve_signal",
    args,
    paymentMotes: RESOLVE_PAYMENT_MOTES,
    wait: true,
  });
}

// --- Staking (collateral behind the oracle's word) ---------------------------
//
// The stake asset is the x402USD CEP-18 token; an oracle bonds it via
// `transfer_from`, so it must `approve` the SignalOracle package first. Amounts
// are token base units (x402USD has 2 decimals → 100.00 = 10000).

/** Common on-chain call context for the SignalOracle package. */
export interface OracleTxCtx {
  rpc: RpcClient;
  config: VerityConfig;
  signer: PrivateKey;
  /** SignalOracle package hash. */
  packageHash: string;
}

/** A stored contract/package referenced as a Key (spender / stake token). */
function packageKey(hashHex: string) {
  return Key.newKey(`hash-${hashHex.replace(/^hash-/, "").replace(/^package-/, "")}`);
}

/** Owner: wire the CEP-18 collateral asset (x402USD package hash). */
export function setStakeTokenOnChain(p: OracleTxCtx & { tokenPackageHash: string }): Promise<SubmittedTx> {
  return callContract({
    ...ctx(p), entryPoint: "set_stake_token",
    args: Args.fromMap({ token: CLValue.newCLKey(packageKey(p.tokenPackageHash)) }),
    paymentMotes: ADMIN_PAYMENT_MOTES, wait: true,
  });
}

/** Owner: set the minimum bond required to publish (base units). */
export function setMinStakeOnChain(p: OracleTxCtx & { minStakeBaseUnits: number }): Promise<SubmittedTx> {
  return callContract({
    ...ctx(p), entryPoint: "set_min_stake",
    args: Args.fromMap({ amount: CLValue.newCLUInt256(p.minStakeBaseUnits) }),
    paymentMotes: ADMIN_PAYMENT_MOTES, wait: true,
  });
}

/** Owner: set the treasury that receives slashed collateral (prefixed account/key). */
export function setTreasuryOnChain(p: OracleTxCtx & { treasuryKey: string }): Promise<SubmittedTx> {
  return callContract({
    ...ctx(p), entryPoint: "set_treasury",
    args: Args.fromMap({ treasury: CLValue.newCLKey(Key.newKey(p.treasuryKey)) }),
    paymentMotes: ADMIN_PAYMENT_MOTES, wait: true,
  });
}

/** Oracle: approve the SignalOracle package to pull `amount` of the stake token. */
export function approveStakeOnChain(p: {
  rpc: RpcClient; config: VerityConfig; signer: PrivateKey;
  tokenPackageHash: string; oraclePackageHash: string; amountBaseUnits: number;
}): Promise<SubmittedTx> {
  return callContract({
    rpc: p.rpc, config: p.config, signer: p.signer, packageHash: p.tokenPackageHash,
    entryPoint: "approve",
    args: Args.fromMap({
      spender: CLValue.newCLKey(packageKey(p.oraclePackageHash)),
      amount: CLValue.newCLUInt256(p.amountBaseUnits),
    }),
    paymentMotes: ADMIN_PAYMENT_MOTES, wait: true,
  });
}

/** Oracle: bond `amount` base units of collateral (requires a prior approve). */
export function stakeOnChain(p: OracleTxCtx & { amountBaseUnits: number }): Promise<SubmittedTx> {
  return callContract({
    ...ctx(p), entryPoint: "stake",
    args: Args.fromMap({ amount: CLValue.newCLUInt256(p.amountBaseUnits) }),
    paymentMotes: STAKE_PAYMENT_MOTES, wait: true,
  });
}

/** Oracle: withdraw unlocked collateral back to its own account. */
export function withdrawStakeOnChain(p: OracleTxCtx & { amountBaseUnits: number }): Promise<SubmittedTx> {
  return callContract({
    ...ctx(p), entryPoint: "withdraw_stake",
    args: Args.fromMap({ amount: CLValue.newCLUInt256(p.amountBaseUnits) }),
    paymentMotes: STAKE_PAYMENT_MOTES, wait: true,
  });
}

function ctx(p: OracleTxCtx) {
  return { rpc: p.rpc, config: p.config, signer: p.signer, packageHash: p.packageHash };
}
