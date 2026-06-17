/**
 * Interop shim for casper-js-sdk.
 *
 * casper-js-sdk ships as a CommonJS webpack bundle. Node's native ESM loader
 * cannot statically detect its named exports, so `import { X } from "casper-js-sdk"`
 * throws at runtime ("does not provide an export named ..."). Importing the
 * default (= module.exports) and re-exporting the members is the reliable path.
 * All verity code imports Casper SDK symbols from here.
 */
import pkg from "casper-js-sdk";

const sdk = pkg as unknown as typeof import("casper-js-sdk");

export const {
  Args,
  CLValue,
  ContractCallBuilder,
  SessionBuilder,
  HttpHandler,
  RpcClient,
  PrivateKey,
  PublicKey,
  KeyAlgorithm,
  EntityIdentifier,
} = sdk;

// Re-export the class types so they can be used in type positions too.
export type PrivateKey = InstanceType<typeof sdk.PrivateKey>;
export type PublicKey = InstanceType<typeof sdk.PublicKey>;
export type RpcClient = InstanceType<typeof sdk.RpcClient>;
export type Args = InstanceType<typeof sdk.Args>;
