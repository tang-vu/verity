/**
 * x402 wire types shared by the paying client and the paywall server, following
 * the x402 protocol + the Casper facilitator's `exact` scheme (CEP-18
 * transfer_with_authorization via EIP-712).
 */
import type { Authorization } from "./eip712-casper.js";

/** Metadata for the CEP-18 asset, echoed in the EIP-712 domain. */
export interface AssetExtra {
  name: string;
  version: string;
  decimals: number;
  symbol?: string;
}

/** One acceptable payment option advertised by a 402 challenge. */
export interface PaymentRequirements {
  scheme: "exact";
  network: string; // CAIP-2, e.g. "casper:casper-test"
  asset: string; // CEP-18 package hash hex (verifyingContract)
  payTo: string; // payee account hash, "00" + 64 hex
  amount: string; // price in the asset's smallest unit
  maxTimeoutSeconds: number;
  resource: string; // protected URL
  description?: string;
  mimeType?: string;
  extra: AssetExtra;
}

/** Body of the HTTP 402 response. */
export interface PaymentRequiredResponse {
  x402Version: number;
  error?: string;
  accepts: PaymentRequirements[];
}

/** The signed payment, base64-encoded into the `X-PAYMENT` request header. */
export interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: string;
  payload: {
    signature: string; // hex (ed25519: 64 bytes)
    publicKey: string; // algorithm-prefixed Casper public key hex
    authorization: Authorization;
  };
}

export interface FacilitatorVerifyResponse {
  isValid: boolean;
  payer?: string;
  invalidReason?: string;
  invalidMessage?: string;
}

export interface FacilitatorSettleResponse {
  success: boolean;
  transaction?: string; // settlement tx (deploy/transaction hash)
  network?: string;
  payer?: string;
  errorReason?: string;
  errorMessage?: string;
}

export const X402_VERSION = 2;
export const PAYMENT_HEADER = "X-PAYMENT";
export const PAYMENT_RESPONSE_HEADER = "X-PAYMENT-RESPONSE";
