/**
 * Typed wrappers for the SignalOracle contract entry points. Argument names
 * mirror the Odra `publish_signal` / `resolve_signal` parameters exactly (Odra
 * derives runtime-arg names from the Rust function parameters).
 */
import { Args, CLValue, PrivateKey, RpcClient } from "./casper-sdk.js";
import { callContract, SubmittedTx } from "./casper-client.js";
import type { VerityConfig } from "./env-config.js";
import { Direction } from "./signal-types.js";

/** Generous payment ceilings (motes) for the small oracle entry points. */
const PUBLISH_PAYMENT_MOTES = 6_000_000_000;
const RESOLVE_PAYMENT_MOTES = 4_000_000_000;

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
