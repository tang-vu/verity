/**
 * Thin wrapper over casper-js-sdk v5 for the operations verity needs: connect an
 * RPC client (optionally through the CSPR.cloud hosted node), load an Ed25519
 * key from PEM, and submit a signed contract-call transaction returning its hash
 * + cspr.live link. Casper 2.x TransactionV1 path (testnet `casper-test`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Args,
  ContractCallBuilder,
  HttpHandler,
  KeyAlgorithm,
  PrivateKey,
  RpcClient,
  Timestamp,
} from "./casper-sdk.js";
import type { VerityConfig } from "./env-config.js";
import { txLink } from "./logging.js";

// The build host clock can run a few seconds ahead of the Casper node, which
// rejects any transaction whose timestamp "has not yet occurred". Stamp
// transactions slightly in the past (well within the default TTL) so a small
// forward clock skew never gets a call rejected at acceptance.
const CLOCK_SKEW_BUFFER_MS = 60_000;

/** Create an RPC client; attach the CSPR.cloud auth header when using its node. */
export function makeRpcClient(config: VerityConfig): RpcClient {
  const handler = new HttpHandler(config.nodeRpcUrl);
  if (config.csprCloudAccessToken && /cspr\.cloud/i.test(config.nodeRpcUrl)) {
    handler.setCustomHeaders({ Authorization: config.csprCloudAccessToken });
  }
  return new RpcClient(handler);
}

/** Load an Ed25519 private key from a PEM file (path relative to cwd or absolute). */
export function loadPrivateKey(pemPath: string): PrivateKey {
  const pem = readFileSync(resolve(pemPath), "utf8");
  return PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
}

export interface SubmittedTx {
  txHash: string;
  explorerUrl: string;
}

/**
 * Build, sign, and submit a contract-call transaction. When `wait` is set, also
 * block until the node reports execution (so callers can read the outcome).
 */
export async function callContract(opts: {
  rpc: RpcClient;
  config: VerityConfig;
  signer: PrivateKey;
  /** Odra package hash — calls dispatch via the contract package (versioned). */
  packageHash: string;
  entryPoint: string;
  args: Args;
  paymentMotes: number;
  wait?: boolean;
}): Promise<SubmittedTx> {
  const transaction = new ContractCallBuilder()
    .from(opts.signer.publicKey)
    .byPackageHash(opts.packageHash)
    .entryPoint(opts.entryPoint)
    .runtimeArgs(opts.args)
    .chainName(opts.config.chainName)
    .timestamp(new Timestamp(new Date(Date.now() - CLOCK_SKEW_BUFFER_MS)))
    .payment(opts.paymentMotes)
    .build();

  transaction.sign(opts.signer);

  const result = await opts.rpc.putTransaction(transaction);
  const txHash = result.transactionHash.toHex();

  if (opts.wait) {
    await opts.rpc.waitForTransaction(transaction, 120_000);
    // Confirm the call didn't revert on-chain (a reverted call still "completes").
    const info = await opts.rpc.getTransactionByTransactionHash(txHash);
    const execErr = info.executionInfo?.executionResult?.errorMessage;
    if (execErr) {
      throw new Error(`Contract call "${opts.entryPoint}" reverted: ${execErr} (tx ${txHash})`);
    }
  }

  return { txHash, explorerUrl: txLink(opts.config.explorerBase, txHash) };
}
