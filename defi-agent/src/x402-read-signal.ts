/**
 * Pays the oracle's x402 paywall and returns the unlocked latest-signal payload.
 * Thin wrapper over the shared x402 paying client, targeting the oracle server's
 * protected /signal/latest endpoint.
 */
import { payAndFetch, PrivateKey, VerityConfig } from "@verity/shared";

export interface ReadSignalResult {
  payload: unknown;
  paid: boolean;
  settlement?: unknown;
}

export async function payAndReadSignal(
  config: VerityConfig,
  signer: PrivateKey
): Promise<ReadSignalResult> {
  const url = `${config.oracleServerUrl}/signal/latest`;
  const result = await payAndFetch({ url, config, signer });
  return { payload: result.data, paid: result.paid, settlement: result.settlement };
}
